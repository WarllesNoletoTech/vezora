'use client';
import {useEffect,useState} from 'react';
import {Bell,BellOff,Send} from 'lucide-react';
import {api} from '@/lib/api';
type OneSignalClient={init:(options:Record<string,unknown>)=>Promise<void>;login:(id:string)=>Promise<void>;logout:()=>Promise<void>;Notifications:{permission:boolean;requestPermission:()=>Promise<void>}};
declare global {interface Window {OneSignalDeferred?:Array<(api:OneSignalClient)=>void|Promise<void>>;VezoraPush?:OneSignalClient}}
const appId=process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID||'';
export default function PushSetup({userId}:{userId:string}){
 const [ready,R]=useState(false),[enabled,E]=useState(false),[error,S]=useState(''),[testing,T]=useState(false),[unsupported,U]=useState(false);
 useEffect(()=>{
  if(!userId||!appId)return;
  if(!('serviceWorker' in navigator)||!('Notification' in window)){U(true);return;}
  let cancelled=false;
  if(window.VezoraPush){void window.VezoraPush.login(userId).then(()=>{if(!cancelled){R(true);E(window.VezoraPush?.Notifications.permission||Notification.permission==='granted')}}).catch(()=>{if(!cancelled)S('Falha ao vincular notificações a esta conta.')});return()=>{cancelled=true};}
  window.OneSignalDeferred=window.OneSignalDeferred||[];
  window.OneSignalDeferred.push(async OneSignal=>{
   if(cancelled)return;
   try{
    if(!window.VezoraPush){await OneSignal.init({appId,serviceWorkerPath:'OneSignalSDKWorker.js',serviceWorkerParam:{scope:'/'},notifyButton:{enable:false},allowLocalhostAsSecureOrigin:false});window.VezoraPush=OneSignal;}
    await OneSignal.login(userId);
    if(!cancelled){R(true);E(OneSignal.Notifications.permission||Notification.permission==='granted')}
   }catch(e){if(!cancelled)S('Não foi possível iniciar as notificações. Confira o domínio e o App ID do OneSignal.');console.warn('Vezora push init',e instanceof Error?e.message:'erro')}
  });
  if(!document.querySelector('script[data-vezora-onesignal]')){
   const script=document.createElement('script');script.src='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';script.defer=true;script.dataset.vezoraOnesignal='1';script.onerror=()=>S('Falha ao carregar o SDK do OneSignal. Confira a conexão e o bloqueador do navegador.');document.head.appendChild(script);
  }
  return()=>{cancelled=true};
 },[userId]);
 async function ask(){S('');try{if(!window.VezoraPush)throw new Error('SDK indisponível');await window.VezoraPush.Notifications.requestPermission();E(Notification.permission==='granted'||window.VezoraPush.Notifications.permission);if(Notification.permission==='denied')S('Notificações bloqueadas no navegador. Libere nas configurações do site.')}catch{S('Não foi possível solicitar permissão. Em iPhone, instale o aplicativo na tela inicial primeiro.')}}
 async function test(){T(true);S('');try{await api('/notifications/test',{method:'POST'});S('Teste enviado ao OneSignal. Verifique as notificações deste aparelho.')}catch(e){S((e as Error).message)}finally{T(false)}}
 if(!appId)return <p className="muted small">Para ativar alertas, configure o OneSignal nas variáveis de ambiente.</p>;
 if(unsupported)return <p className="muted small">Este navegador não disponibiliza notificações web. No iPhone, instale o Vezora na tela inicial e abra o aplicativo instalado.</p>;
 return <div className="vezora-push-control">{enabled?<><span className="vezora-push-on"><Bell size={17}/> Notificações ativadas neste dispositivo</span><button className="btn btn-outline btn-small" type="button" disabled={testing} onClick={()=>void test()}><Send size={15}/> {testing?'Enviando...':'Testar aviso'}</button></>:
 <button className="btn btn-outline btn-small" type="button" disabled={!ready} onClick={()=>void ask()}>{ready?<Bell size={17}/>:<BellOff size={17}/>} {ready?'Ativar notificações':'Conectando OneSignal...'}</button>}
 {error&&<p className="muted small" role="status">{error}</p>}</div>;
}
