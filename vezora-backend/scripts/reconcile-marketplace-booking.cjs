// Uso: npm run payments:reconcile-booking -- --booking UUID --payment ID
// Não confia em status fornecido no terminal: valida tudo pela API do Mercado Pago.
require('dotenv/config');
const { db } = require('../dist/db');
const { reconcileMarketplacePayment } = require('../dist/marketplaceReconcile');
const args=process.argv.slice(2);
const param=(key)=>args[args.indexOf(key)+1];
(async()=>{
  const bookingId=param('--booking'),paymentId=param('--payment');
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(bookingId||'') || !/^\d{1,24}$/.test(paymentId||'')) {
    throw new Error('Informe --booking UUID e --payment ID numérico do Mercado Pago');
  }
  const booking=await db.booking.findUnique({where:{id:bookingId},select:{tenantId:true,status:true,paymentStatus:true}});
  if (!booking) throw new Error('Reserva não encontrada no MongoDB');
  const result=await reconcileMarketplacePayment(booking.tenantId,paymentId);
  console.log('Resultado da consulta oficial:',result);
  const updated=await db.booking.findUnique({where:{id:bookingId},select:{status:true,paymentStatus:true}});
  console.log('Reserva após conciliação:',updated);
})().catch(e=>{console.error('Conciliação não concluída:',e.message);process.exitCode=1}).finally(async()=>db.$disconnect());
