'use client';
import {useEffect,useState} from 'react';
import {Download,Smartphone,X} from 'lucide-react';
interface InstallEvent extends Event {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>}
export default function InstallApp({welcome=false}:{welcome?:boolean}){
 const [deferred,D]=useState<InstallEvent|null>(null),[visible,V]=useState(false),[installed,I]=useState(false),[ios,IOS]=useState(false);
 useEffect(()=>{
  const standalone=window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
  I(standalone);IOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  if(welcome&&!standalone)V(true);
  const ready=(e:Event)=>{e.preventDefault();D(e as InstallEvent)};
  const didInstall=()=>{I(true);V(false);D(null)};
  window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',didInstall);
  return()=>{window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',didInstall)};
 },[welcome]);
 async function install(){if(deferred){await deferred.prompt();const choice=await deferred.userChoice;if(choice.outcome==='accepted')V(false);D(null)}else V(true)}
 if(installed)return null;
 return <><button type="button" className="btn btn-outline btn-small" onClick={install}><Download size={17}/> Instalar Vezora</button>
  {visible&&<div className="vezora-dialog-overlay" role="presentation"><section className="vezora-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
   <button type="button" className="vezora-close" onClick={()=>V(false)} aria-label="Fechar"><X size={20}/></button><div className="vezora-dialog-icon"><Smartphone/></div>
   <h2 id="install-title">Tenha o Vezora na tela inicial</h2><p>Abra sua agenda como aplicativo, com acesso rápido aos agendamentos, sem precisar instalar pela loja de aplicativos.</p>
   {deferred?<button type="button" className="btn btn-primary wide" onClick={()=>void install()}><Download size={18}/> Instalar aplicativo</button>:
   <p className="vezora-help">{ios?'No Safari: toque em Compartilhar e depois em “Adicionar à Tela de Início”. Abra o app instalado para receber notificações.':'No Chrome: abra o menu do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”. Se o navegador oferecer instalação, este botão será ativado.'}</p>}
   <button type="button" className="btn btn-outline wide" onClick={()=>V(false)}>Agora não, continuar no painel</button>
  </section></div>}
 </>;
}
