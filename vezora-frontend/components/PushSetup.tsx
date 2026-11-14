'use client';
import {useEffect,useState} from 'react';
import {Bell,BellOff,CheckCircle2,Send} from 'lucide-react';
import {api} from '@/lib/api';

type OneSignalClient={
 init:(options:Record<string,unknown>)=>Promise<void>;
 login:(id:string)=>Promise<void>;
 logout:()=>Promise<void>;
 Notifications:{permission:boolean;requestPermission:()=>Promise<boolean>};
 User:{PushSubscription:{
  id?:string|null;
  optedIn?:boolean;
  optIn:()=>Promise<void>;
  addEventListener?:(event:'change',listener:()=>void)=>void;
  removeEventListener?:(event:'change',listener:()=>void)=>void;
 }};
};
declare global {interface Window {OneSignalDeferred?:Array<(api:OneSignalClient)=>void|Promise<void>>;VezoraPush?:OneSignalClient}}
export type PushStatus={configured:boolean;ready:boolean;subscribed:boolean;tested:boolean};
const appId=process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID||'';
function testKey(userId:string){return `vezora-push-verified:${appId}:${userId}`}
function hasSubscription(client?:OneSignalClient){return !!client?.Notifications.permission && !!client?.User.PushSubscription.optedIn && !!client?.User.PushSubscription.id && Notification.permission==='granted'}

export default function PushSetup({userId,onStatusChange}:{userId:string;onStatusChange?:(status:PushStatus)=>void}){
 const [ready,R]=useState(false),[subscribed,E]=useState(false),[tested,D]=useState(false);
 const [message,S]=useState(''),[testing,T]=useState(false),[unsupported,U]=useState(false),[testPending,Q]=useState(false);
 useEffect(()=>{
  if(!userId||!appId)return;
  if(!('serviceWorker' in navigator)||!('Notification' in window)){U(true);return;}
  let cancelled=false;
  const refresh=()=>{
   if(cancelled)return;
   const allowed=hasSubscription(window.VezoraPush);
   E(allowed);
   if(!allowed){D(false);Q(false);if(Notification.permission==='denied')localStorage.removeItem(testKey(userId))}
   else D(localStorage.getItem(testKey(userId))==='1');
  };
  const onSubscriptionChange=()=>refresh();
  const initialize=async (OneSignal:OneSignalClient)=>{
   if(cancelled)return;
   try{
    if(!window.VezoraPush){
     await OneSignal.init({appId,serviceWorkerPath:'OneSignalSDKWorker.js',serviceWorkerParam:{scope:'/'},notifyButton:{enable:false},allowLocalhostAsSecureOrigin:false});
     window.VezoraPush=OneSignal;
    }
    await window.VezoraPush!.login(userId);
    if(!cancelled){R(true);refresh();window.VezoraPush?.User.PushSubscription.addEventListener?.('change',onSubscriptionChange)}
   }catch(e){if(!cancelled)S('Não foi possível iniciar as notificações. Confira App ID, domínio e Service Worker no OneSignal.');console.warn('Vezora push init',e instanceof Error?e.message:'erro')}
  };
  if(window.VezoraPush)void initialize(window.VezoraPush);
  else{
   window.OneSignalDeferred=window.OneSignalDeferred||[];
   window.OneSignalDeferred.push(initialize);
   if(!document.querySelector('script[data-vezora-onesignal]')){
    const script=document.createElement('script');script.src='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';script.defer=true;script.dataset.vezoraOnesignal='1';script.onerror=()=>{if(!cancelled)S('Falha ao carregar o OneSignal. Verifique conexão, bloqueadores e domínio.')};document.head.appendChild(script);
   }
  }
  const onFocus=()=>{if(window.VezoraPush)refresh()};
  const onVisibility=()=>{if(!document.hidden)onFocus()};
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onVisibility);
  return()=>{cancelled=true;window.VezoraPush?.User.PushSubscription.removeEventListener?.('change',onSubscriptionChange);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility)};
 },[userId]);
 useEffect(()=>{onStatusChange?.({configured:!!appId,ready,subscribed,tested})},[onStatusChange,ready,subscribed,tested]);
 async function ask(){
  S('');
  try{
   const client=window.VezoraPush;
   if(!client)throw new Error('SDK indisponível');
   if(Notification.permission==='denied'){S('Notificações bloqueadas. Abra as permissões deste site no navegador e habilite os avisos.');return;}
   await client.Notifications.requestPermission();
   if(Notification.permission==='granted'&&!client.User.PushSubscription.optedIn)await client.User.PushSubscription.optIn();
   const allowed=hasSubscription(client);
   E(allowed);
   if(!allowed){S('A permissão ou a inscrição push ainda não foi ativada. Confira as permissões do dispositivo e tente novamente.');return;}
   D(localStorage.getItem(testKey(userId))==='1');
   S('Notificações ativadas. Agora clique em “Enviar teste”.');
  }catch{S('Não foi possível ativar os avisos. No iPhone, instale o Vezora na tela inicial e abra o aplicativo instalado.')}
 }
 async function test(){
  T(true);S('');Q(false);
  try{
   if(!hasSubscription(window.VezoraPush)){E(false);throw new Error('Ative as notificações neste aparelho antes de testar.');}
   const result=await api<{ok:boolean;message?:string}>('/notifications/test',{method:'POST'});
   if(!result.ok)throw new Error('O OneSignal não aceitou o envio.');
   Q(true);S('Solicitação de teste enviada. Aguarde o aviso e clique em “Recebi a notificação” somente quando ele aparecer neste dispositivo.');
  }catch(e){S((e as Error).message)}finally{T(false)}
 }
 function confirm(){if(!testPending||!hasSubscription(window.VezoraPush))return;localStorage.setItem(testKey(userId),'1');D(true);Q(false);S('Teste confirmado neste dispositivo! Você receberá alertas quando o navegador permitir.')}
 if(!appId)return <p className="muted small">Notificações ainda não configuradas. Solicite ao administrador do Vezora para definir o App ID do OneSignal na Vercel e as credenciais no Heroku.</p>;
 if(unsupported)return <p className="muted small">Este navegador não disponibiliza notificações web. No iPhone, instale o Vezora na tela inicial e abra o aplicativo instalado.</p>;
 return <div className="vezora-push-control vezora-push-setup">
  <div className="vezora-push-action-row">
   {subscribed?<span className="vezora-push-on"><CheckCircle2 size={17}/> Notificações permitidas neste dispositivo</span>:<button className="btn btn-outline btn-small" type="button" disabled={!ready} onClick={()=>void ask()}>{ready?<Bell size={17}/>:<BellOff size={17}/>} {ready?'Ativar notificações':'Conectando OneSignal...'}</button>}
   {subscribed&&<button className="btn btn-outline btn-small" type="button" disabled={testing} onClick={()=>void test()}><Send size={15}/> {testing?'Enviando...':'Enviar teste'}</button>}
  </div>
  {testPending&&<button type="button" className="btn btn-primary btn-small" onClick={confirm}><CheckCircle2 size={16}/> Recebi a notificação</button>}
  {subscribed&&tested&&<div className="vezora-push-on"><CheckCircle2 size={17}/> Teste confirmado neste dispositivo</div>}
  {message&&<p className="muted small" role="status">{message}</p>}
 </div>;
}
