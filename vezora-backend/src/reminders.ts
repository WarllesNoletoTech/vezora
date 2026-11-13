/** Execute a cada 10 min pelo Heroku Scheduler: npm run notifications:reminders */
import {db} from './db';
import {notifyBooking,pushConfigured} from './notifications';
async function main(){
 if(!pushConfigured()){console.log('OneSignal desativado: configure ONESIGNAL_APP_ID e ONESIGNAL_REST_API_KEY');return;}
 const now=Date.now();
 const rows=await db.booking.findMany({where:{status:'CONFIRMED',startAt:{gte:new Date(now+50*60000),lte:new Date(now+70*60000)},
  OR:[{reminderNotifiedAt:null},{reminderNotifiedAt:{isSet:false}}]},select:{id:true},take:250});
 let sent=0,failed=0;
 for(const row of rows){
  // Reserva atômica para evitar duas execuções do Scheduler notificando a mesma pessoa.
  const claimed=await db.booking.updateMany({where:{id:row.id,status:'CONFIRMED',OR:[{reminderNotifiedAt:null},{reminderNotifiedAt:{isSet:false}}]},data:{reminderNotifiedAt:new Date()}});
  if(!claimed.count)continue;
  const ok=await notifyBooking(row.id,'reminder').catch(()=>false);
  if(ok)sent++;else{
   failed++;
   await db.booking.updateMany({where:{id:row.id},data:{reminderNotifiedAt:null}});
  }
 }
 console.log('Lembretes Vezora',JSON.stringify({checked:rows.length,sent,failed}));
}
main().catch(e=>{console.error('Falha no agendamento de lembretes',e);process.exitCode=1}).finally(async()=>db.$disconnect());
