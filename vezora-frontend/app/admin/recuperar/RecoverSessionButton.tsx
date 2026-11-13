'use client';
import {useState} from 'react';
export default function RecoverSessionButton(){
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function reset(){setBusy(true);setError('');try{const response=await fetch('/api/session/reset',{method:'POST',cache:'no-store'});if(!response.ok)throw new Error('Falha ao limpar a sessão');window.location.replace('/entrar');}catch(e){setError(e instanceof Error?e.message:'Falha de conexão');setBusy(false);}}
 return <><div className="ad-bootstrap-actions"><button type="button" onClick={()=>void reset()} disabled={busy}>{busy?'Encerrando sessão...':'Limpar sessão e fazer login'}</button><a href="/admin/diagnostico">Abrir diagnóstico</a></div>{error&&<p role="alert">{error}</p>}</>;
}
