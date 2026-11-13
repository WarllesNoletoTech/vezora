'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,CheckCircle2,ClipboardCheck,X} from 'lucide-react';
import type {Service,Professional,Tenant} from '@/lib/api';
type StepTab='overview'|'bookings'|'services'|'team'|'finance'|'identity'|'payments';
export default function FirstSteps({tenant,services,pros,connected,onNavigate}:{tenant:Tenant;services:Service[];pros:Professional[];connected:boolean;onNavigate:(tab:StepTab)=>void}){
 const key=`vezora-onboarding-dismissed:${tenant.id}`;
 const [open,O]=useState(false),[shared,SH]=useState(false);
 useEffect(()=>{O(!localStorage.getItem(key));const refresh=()=>SH(!!localStorage.getItem(`vezora-shared:${tenant.id}`));refresh();window.addEventListener('vezora-link-shared',refresh);return()=>window.removeEventListener('vezora-link-shared',refresh)},[key,tenant.id]);
 const steps=[
  {name:'Personalize sua marca',tip:'Inclua logo, capa, cores, descrição e WhatsApp comercial.',done:!!tenant.logoUrl&&!!tenant.bio,tab:'identity' as StepTab},
  {name:'Cadastre seus serviços',tip:'Defina preço, duração e sinal de cada procedimento.',done:services.length>0,tab:'services' as StepTab},
  {name:'Organize os profissionais',tip:'Confira horários, folgas, salário e comissão de quem atende.',done:pros.length>0&&pros.every(p=>!!p.schedule),tab:'team' as StepTab},
  {name:'Conecte seu Mercado Pago',tip:'Conecte a conta do estabelecimento para receber sinais.',done:connected,tab:'payments' as StepTab},
  {name:'Divulgue seu link',tip:'Copie o link da Visão geral e compartilhe com seus clientes.',done:shared,tab:'overview' as StepTab}
 ];
 const completed=steps.filter(s=>s.done).length;
 if(!open)return <button className="btn btn-outline btn-small" type="button" onClick={()=>O(true)}><ClipboardCheck size={17}/> Guia inicial ({completed}/{steps.length})</button>;
 return <section className="panel vezora-firststeps" aria-labelledby="vezora-steps-title"><div className="vezora-steps-header"><div><span className="overline">COMECE POR AQUI</span><h2 id="vezora-steps-title">Prepare seu espaço em cinco passos</h2><p>Seu site ficará pronto para receber agendamentos conforme você avança.</p></div><button type="button" className="vezora-close" aria-label="Ocultar guia" onClick={()=>{localStorage.setItem(key,'1');O(false)}}><X size={19}/></button></div>
 <div className="vezora-progress"><div style={{width:`${completed/steps.length*100}%`}}/></div><small>{completed} de {steps.length} etapas concluídas</small>
 <div className="vezora-steps-list">{steps.map((s,i)=><button type="button" key={s.name} onClick={()=>{onNavigate(s.tab);if(i===4){navigator.clipboard?.writeText(`${window.location.origin}/${tenant.slug}`).then(()=>{localStorage.setItem(`vezora-shared:${tenant.id}`,'1');SH(true)}).catch(()=>{})}}}>
 <span className={s.done?'vezora-step-ok':'vezora-step-num'}>{s.done?<CheckCircle2 size={20}/>:i+1}</span><span><b>{s.name}</b><small>{s.tip}</small></span><ArrowRight size={17}/></button>)}</div>
 <p className="muted small">Dica: instale o Vezora e permita notificações para receber avisos de novas reservas e lembretes. Você pode reabrir este guia quando quiser.</p></section>
}
