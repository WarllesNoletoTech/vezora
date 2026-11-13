import {whatsappUrl} from '@/lib/api';
/** Atendimento manual pelo WhatsApp, sem API paga. */
export default function WhatsAppSupport({panel=false}:{panel?:boolean}){
 const message=panel?'Olá! Sou lojista do Vezora e preciso de ajuda para configurar minha agenda.':'Olá! Conheci o Vezora e gostaria de saber mais sobre o sistema de agendamentos.';
 return <a href={whatsappUrl('559481077884',message)} className="vezora-whatsapp" target="_blank" rel="noopener noreferrer" aria-label="Falar com o suporte Vezora no WhatsApp" title="Falar com o suporte Vezora">
  <svg viewBox="0 0 32 32" aria-hidden="true" width="27" height="27" fill="currentColor"><path d="M16.02 3a13 13 0 0 0-11.2 19.63L3 29l6.55-1.72A13.02 13.02 0 1 0 16.02 3Zm0 23.63c-2.12 0-4.19-.56-6-1.63l-.43-.25-3.89 1.02 1.04-3.79-.28-.44A10.62 10.62 0 1 1 16.02 26.63Zm5.82-7.95c-.32-.16-1.89-.93-2.19-1.04-.29-.1-.5-.15-.71.16-.21.31-.81 1.04-.99 1.25-.18.21-.36.24-.68.08a8.81 8.81 0 0 1-4.38-3.83c-.33-.57.33-.53.95-1.76a.6.6 0 0 0-.03-.56c-.08-.16-.72-1.73-.99-2.37-.26-.63-.53-.54-.72-.55h-.61c-.21 0-.55.08-.84.4-.29.31-1.1 1.07-1.1 2.6 0 1.53 1.12 3.02 1.27 3.22.16.2 2.2 3.36 5.36 4.7.75.32 1.33.51 1.78.65.75.24 1.44.21 1.98.13.6-.09 1.89-.78 2.15-1.53.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"/></svg>
  <span>Suporte Vezora</span>
 </a>
}
