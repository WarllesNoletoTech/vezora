/** Mensagens abertas manualmente pela lojista; nenhuma mensagem é enviada sem seu clique. */
import type {Booking,Tenant} from './api';
import {brl,whatsappUrl} from './api';
export type WhatsAppBookingAction={key:string;label:string;href:string};
export function bookingWhatsappActions(b:Booking,t:Tenant,origin:string,now=Date.now()):WhatsAppBookingAction[]{
  const digits=(b.clientPhone||'').replace(/\D/g,'');
  if(!/^\d{10,13}$/.test(digits))return [];
  const date=new Date(b.startAt).toLocaleString('pt-BR',{timeZone:t.timezone,dateStyle:'full',timeStyle:'short'});
  const hi=`Olá, ${b.clientName}! Aqui é do ${t.name}.`;
  const appointment=`${b.service.name} em ${date}`;
  const page=`${origin}/${encodeURIComponent(t.slug)}`;
  const tracking=`${origin}/agendamento/${encodeURIComponent(b.id)}`;
  const actions:{key:string;label:string;message:string}[]=[];
  if(b.status==='PENDING_PAYMENT'){
    const valid=Boolean(b.checkoutUrl)&&(!b.expiresAt||new Date(b.expiresAt).getTime()>now);
    actions.push({key:'signal',label:valid?'Lembrar sinal':'Orientar cliente',message:valid
      ?`${hi} Sua reserva de ${appointment} aguarda o sinal de ${brl(b.depositCents)}. Para confirmar, pague pelo link: ${b.checkoutUrl}. Acompanhe pelo Vezora: ${tracking}. Se já pagou, aguarde a confirmação automática.`
      :`${hi} Sua reserva de ${appointment} não está confirmada. O prazo do sinal expirou ou o link está indisponível. Para remarcar, acesse ${page} ou fale conosco.`});
  }else if(b.status==='CONFIRMED'){
    const signalPaid=b.depositCents>0&&Boolean(b.depositPaidAt);
    actions.push({key:'confirmed',label:signalPaid?'Confirmar sinal pago':'Confirmar horário',message:signalPaid
      ?`${hi} Recebemos o sinal de ${brl(b.depositCents)}! Seu agendamento de ${appointment} está confirmado. Esperamos você!`
      :`${hi} Seu agendamento de ${appointment} está confirmado. Esperamos você!`});
    if(new Date(b.startAt).getTime()>now)actions.push({key:'reminder',label:'Lembrar atendimento',message:`${hi} Passando para lembrar: seu horário de ${appointment} está confirmado. Se precisar reagendar, avise com antecedência. Até breve!`});
  }else if(b.status==='NEEDS_REVIEW'){
    actions.push({key:'review',label:'Avisar análise',message:`${hi} Estamos conferindo o pagamento referente a ${appointment}. Avisaremos assim que houver confirmação. Evite pagar novamente sem nossa orientação.`});
  }else if(b.status==='CANCELLED'||b.status==='EXPIRED'){
    actions.push({key:'cancel',label:'Avisar situação',message:`${hi} Seu agendamento de ${appointment} não está mais confirmado. Para marcar novamente, acesse ${page}. Se houve pagamento, entre em contato para conferirmos.`});
  }else if(b.status==='COMPLETED'){
    actions.push({key:'thanks',label:'Agradecer',message:`${hi} Obrigado por escolher nosso atendimento de ${b.service.name}! Foi um prazer receber você. Agende novamente: ${page}`});
  }
  return actions.map(({key,label,message})=>({key,label,href:whatsappUrl(digits,message)}));
}
