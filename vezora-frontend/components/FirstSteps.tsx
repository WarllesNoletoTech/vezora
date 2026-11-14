'use client';
import {useCallback,useEffect,useState} from 'react';
import {ArrowRight,BellRing,CheckCircle2,ClipboardCheck,X} from 'lucide-react';
import PushSetup,{type PushStatus} from '@/components/PushSetup';
import {api,type Service,type Professional,type Tenant} from '@/lib/api';
type StepTab='overview'|'bookings'|'services'|'team'|'finance'|'identity'|'payments';
export default function FirstSteps({tenant,services,pros,connected,userId,onNavigate}:{tenant:Tenant;services:Service[];pros:Professional[];connected:boolean;userId:string;onNavigate:(tab:StepTab)=>void}){
 const key=`vezora-onboarding-dismissed:${tenant.id}`;
 const completionKey=`vezora-onboarding-complete:${tenant.id}`;
 const [open,O]=useState(false),[shared,SH]=useState(false),[finished,FIN]=useState(false);
 const [pushExpanded,XP]=useState(false);
 const [push,SP]=useState<PushStatus>({configured:false,ready:false,subscribed:false,tested:false});
 const onPushStatus=useCallback((next:PushStatus)=>SP(old=>old.configured===next.configured&&old.ready===next.ready&&old.subscribed===next.subscribed&&old.tested===next.tested?old:next),[]);
 useEffect(()=>{const wasFinished=!!tenant.onboardingCompletedAt||localStorage.getItem(completionKey)==='1';FIN(wasFinished);O(!wasFinished&&!localStorage.getItem(key));const refresh=()=>SH(!!localStorage.getItem(`vezora-shared:${tenant.id}`));refresh();window.addEventListener('vezora-link-shared',refresh);return()=>window.removeEventListener('vezora-link-shared',refresh)},[key,completionKey,tenant.id,tenant.onboardingCompletedAt]);
 const steps=[
  {name:'Personalize sua marca',tip:'Inclua logo, capa, cores, descrição e WhatsApp comercial.',done:!!tenant.logoUrl&&!!tenant.coverUrl&&!!tenant.bio.trim(),tab:'identity' as StepTab},
  {name:'Cadastre seus serviços',tip:'Defina preço, duração e sinal de cada procedimento.',done:services.length>0,tab:'services' as StepTab},
  {name:'Organize os profissionais',tip:'Confira horários, folgas, salário e comissão de quem atende.',done:pros.length>0&&pros.every(p=>!!p.schedule),tab:'team' as StepTab},
  {name:'Conecte seu Mercado Pago',tip:'Conecte a conta do estabelecimento para receber sinais.',done:connected,tab:'payments' as StepTab},
  {name:'Divulgue seu link',tip:'Copie o link da Visão geral e compartilhe com seus clientes.',done:shared,tab:'overview' as StepTab},
  {name:'Ative e teste as notificações',tip:'Permita alertas e envie um aviso para confirmar que chegou neste aparelho.',done:push.subscribed&&push.tested,tab:'overview' as StepTab}
 ];
 const completed=steps.filter(s=>s.done).length;
 const pushStep=steps.length-1;
 useEffect(()=>{if(completed===steps.length){localStorage.setItem(completionKey,'1');FIN(true);O(false);if(!tenant.onboardingCompletedAt)void api('/tenant/checklist/complete',{method:'PATCH'}).catch(()=>{console.warn('Vezora: conclusão do guia não sincronizada com o servidor')})}},[completed,completionKey,steps.length,tenant.onboardingCompletedAt]);
 function selectStep(index:number,tab:StepTab){
  if(index===pushStep){XP(current=>!current);return;}
  onNavigate(tab);
  if(index===4){navigator.clipboard?.writeText(`${window.location.origin}/${tenant.slug}`).then(()=>{localStorage.setItem(`vezora-shared:${tenant.id}`,'1');SH(true)}).catch(()=>{});}
 }
 if(finished||completed===steps.length)return <div className={push.subscribed?'vezora-push-inline-collapsed':'vezora-push-reenable'}><PushSetup userId={userId} onStatusChange={onPushStatus}/></div>;
 if(!open)return <><button className="btn btn-outline btn-small" type="button" onClick={()=>O(true)}><ClipboardCheck size={17}/> Guia inicial ({completed}/{steps.length})</button><div className="vezora-push-inline-collapsed"><PushSetup userId={userId} onStatusChange={onPushStatus}/></div></>;
 return <section className="panel vezora-firststeps" aria-labelledby="vezora-steps-title"><div className="vezora-steps-header"><div><span className="overline">COMECE POR AQUI</span><h2 id="vezora-steps-title">Prepare seu espaço em seis passos</h2><p>Configure seus agendamentos e teste os alertas antes de divulgar sua página.</p></div><button type="button" className="vezora-close" aria-label="Ocultar guia" onClick={()=>{localStorage.setItem(key,'1');O(false)}}><X size={19}/></button></div>
 <div className="vezora-progress"><div style={{width:`${completed/steps.length*100}%`}}/></div><small>{completed} de {steps.length} etapas concluídas</small>
 <div className="vezora-steps-list">{steps.map((s,i)=><div className="vezora-step-entry" key={s.name}>
  <button type="button" aria-expanded={i===pushStep?pushExpanded:undefined} onClick={()=>selectStep(i,s.tab)}>
   <span className={s.done?'vezora-step-ok':'vezora-step-num'}>{s.done?<CheckCircle2 size={20}/>:i+1}</span><span><b>{s.name}</b><small>{s.tip}</small></span><ArrowRight size={17}/>
  </button>
  {i===pushStep&&pushExpanded&&<div className="vezora-firststeps-push"><div className="vezora-push-explanation"><BellRing size={19}/><div><b>Avisos de novos horários e lembretes</b><p>1. Ative as notificações neste dispositivo. 2. Envie o teste. 3. Confirme que recebeu o aviso. Faça isso em cada celular ou computador em que deseja receber alertas.</p></div></div>
   <p className="muted small">A permissão depende do navegador; no iPhone, abra o Vezora instalado na tela inicial. Os lembretes automáticos também exigem o OneSignal e o agendador configurados no servidor.</p>
  </div>}
  {i===pushStep&&<div className={pushExpanded?"vezora-push-inline-expanded":"vezora-push-inline-collapsed"}><PushSetup userId={userId} onStatusChange={onPushStatus}/></div>}
 </div>)}</div>
 <p className="muted small">Dica: instale o Vezora e conclua o teste de notificações para não perder novos agendamentos. Ao concluir todas as etapas, este guia desaparece automaticamente.</p></section>;
}
