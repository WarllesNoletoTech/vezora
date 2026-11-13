'use client';

import {useCallback,useEffect,useState} from 'react';

type Check = { label: string; status: 'checking'|'ok'|'failed'; message: string };
const initial: Check[] = [
 {label:'API /api/health',status:'checking',message:'Aguardando teste'},
 {label:'Sessão /api/me',status:'checking',message:'Aguardando teste'},
 {label:'Permissão /api/admin/summary',status:'checking',message:'Aguardando teste'},
 {label:'Listagem /api/admin/tenants',status:'checking',message:'Aguardando teste'},
 {label:'Financeiro /api/admin/finance/summary',status:'checking',message:'Aguardando teste'},
];

async function readApi(path:string):Promise<{status:number; data:Record<string,unknown>}> {
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try {
  const res=await fetch('/api'+path,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
  const data=await res.json().catch(()=>({})) as Record<string,unknown>;
  return {status:res.status,data};
 } finally {clearTimeout(timeout)}
}
export default function AdminDiagnosticPanel(){
 const [items,setItems]=useState<Check[]>(initial);
 const [running,RUN]=useState(true);
 const run=useCallback(async()=>{
  RUN(true);setItems(initial);
  const now=new Date().toISOString().slice(0,10);
  const begin=now.slice(0,7)+'-01';
  const targets=[['API /api/health','/health'],['Sessão /api/me','/me'],['Permissão /api/admin/summary','/admin/summary'],['Listagem /api/admin/tenants','/admin/tenants?page=1&businessType=TODOS'],['Financeiro /api/admin/finance/summary',`/admin/finance/summary?from=${begin}&to=${now}`]] as const;
  for(let i=0;i<targets.length;i++){
   const [label,path]=targets[i];
   try {
    const r=await readApi(path);
    let msg=r.status===200?'HTTP 200 — conectado':`HTTP ${r.status}`;
    let passed=r.status===200;
    if(path==='/health'&&r.status===200){
     msg=`HTTP 200 — API ${typeof r.data.version==='string'?r.data.version:'versão não identificada'}`;
    }
    if(path==='/me'&&r.status===200){
     const user=r.data.user as {role?:string}|undefined;
     msg=`HTTP 200 — perfil: ${user?.role||'não informado'}`;
     passed=user?.role==='SUPERADMIN';
     if(!passed)msg+=' (acesso administrativo não concedido)';
    }
    if(!passed && typeof r.data.error==='string')msg+=' — '+r.data.error;
    if(!passed && typeof r.data.requestId==='string')msg+=' · referência '+r.data.requestId;
    setItems(prev=>prev.map((item,n)=>n===i?{label,status:passed?'ok':'failed',message:msg}:item));
   } catch(e) {
    const message=e instanceof Error&&e.name==='AbortError'?'Tempo de resposta excedido (12 s)':e instanceof Error?e.message:'Falha de rede';
    setItems(prev=>prev.map((item,n)=>n===i?{label,status:'failed',message}:item));
   }
  }
  RUN(false);
 },[]);
 useEffect(()=>{void run()},[run]);
 return <section aria-label="Resultados dos testes" className="ad-diagnostic-results">
  <h2>Conexão e permissões</h2>
  {items.map(item=><div className="ad-diagnostic-item" key={item.label}>
   <strong>{item.label}</strong>
   <span className={'ad-diagnostic-status '+item.status}>{item.status==='checking'?'Verificando':item.status==='ok'?'OK':'Atenção'}</span>
   <small>{item.message}</small>
  </div>)}
  <button type="button" onClick={()=>void run()} disabled={running}>{running?'Verificando...':'Testar novamente'}</button>
  <p>Se todos os testes aparecerem como OK e o painel continuar em branco, abra o Console do navegador (F12) e envie somente o texto do primeiro erro, sem tokens ou cookies.</p>
 </section>;
}
