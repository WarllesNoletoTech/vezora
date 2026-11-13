/** Notificações ao dono da loja. Sem credenciais, o restante do sistema continua funcionando. */
import { createHash } from 'node:crypto';
import {db} from './db';
import {env} from './env';

export function notificationKey(event: string, bookingId: string) {
 const hex=createHash('sha256').update(`vezora:${event}:${bookingId}`).digest('hex');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export const pushConfigured=()=>Boolean(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY);
export async function sendOwnerPush(ownerId:string,event:string,bookingId:string,heading:string,body:string):Promise<boolean>{
 if(!pushConfigured())return false;
 try{
  const response=await fetch('https://api.onesignal.com/notifications',{
   method:'POST',headers:{Authorization:`Key ${process.env.ONESIGNAL_REST_API_KEY}`,'Content-Type':'application/json'},
   body:JSON.stringify({app_id:process.env.ONESIGNAL_APP_ID,include_aliases:{external_id:[ownerId]},target_channel:'push',
    headings:{en:heading,pt:heading},contents:{en:body,pt:body},url:`${env.WEB_URL}/painel?tab=bookings`,
    idempotency_key:notificationKey(event,bookingId)}),signal:AbortSignal.timeout(8000)
  });
  if(!response.ok){console.warn('OneSignal recusou notificação',response.status);return false;}
  const receipt=await response.json().catch(()=>null) as {id?:string|null;recipients?:number;errors?:unknown}|null;
  if(!receipt?.id || receipt.recipients===0){console.warn('OneSignal não encontrou inscrição ativa ou não criou a notificação');return false;}
  return true;
 }catch(error){console.warn('OneSignal indisponível',error instanceof Error?error.message:'erro');return false;}
}
export async function notifyBooking(bookingId:string,event:'created'|'confirmed'|'cancelled'|'reminder'|'review'){
 if(!pushConfigured())return false;
 const b=await db.booking.findUnique({where:{id:bookingId},select:{id:true,clientName:true,startAt:true,tenant:{select:{ownerId:true,timezone:true,name:true}},service:{select:{name:true}}}});
 if(!b)return false;
 const date=b.startAt.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:b.tenant.timezone});
 const titles={created:'Novo agendamento no Vezora',confirmed:'Sinal confirmado!',cancelled:'Agendamento cancelado',reminder:'Lembrete: atendimento em 1 hora',review:'Pagamento precisa de revisão'};
 const contents={created:`${b.clientName} agendou ${b.service.name} para ${date}. Confira o sinal no painel.`,confirmed:`${b.clientName}: ${b.service.name}, ${date}. Sinal aprovado.`,cancelled:`Reserva de ${b.clientName} em ${date} foi cancelada.`,reminder:`${b.clientName} tem horário de ${b.service.name} às ${date}.`,review:`Confira o pagamento e o horário de ${b.clientName} no painel.`};
 return sendOwnerPush(b.tenant.ownerId,event,b.id,titles[event],contents[event]);
}
