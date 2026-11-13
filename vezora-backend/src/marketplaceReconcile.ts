import { BookingStatus } from '@prisma/client';
import { db } from './db';
import { getPayment, searchPaymentsForBooking } from './mp';

// Toda confirmação é feita consultando diretamente a conta do vendedor no Mercado Pago.
// Nunca confiar no status, valor ou recebedor enviado pelo navegador/webhook.
type Result = { outcome: 'reconciled' | 'not_found' | 'ignored'; bookingId?: string; status?: string; reason?: string };
const validPaymentId = /^\d{1,24}$/;
const validSellerId = /^\d{1,24}$/;

export async function reconcileMarketplacePayment(tenantId: string, paymentId: string): Promise<Result> {
  if (!validPaymentId.test(paymentId)) return {outcome:'ignored',reason:'invalid_payment_id'};
  const account=await db.paymentAccount.findUnique({where:{tenantId},select:{sellerUserId:true}});
  if (!account) return {outcome:'not_found',reason:'seller_not_connected'};
  const payment=await getPayment(tenantId,paymentId);
  // Somente pagamentos efetivamente pertencentes ao vendedor conectado.
  if(String(payment.collector_id)!==account.sellerUserId) return {outcome:'ignored',reason:'collector_mismatch'};
  if(typeof payment.external_reference!=='string'||!payment.external_reference) return {outcome:'ignored',reason:'missing_reference'};
  const original=await db.booking.findFirst({where:{id:payment.external_reference,tenantId}});
  if(!original||!original.depositCents||Math.abs(payment.transaction_amount*100-original.depositCents)>1) return {outcome:'ignored',reason:'booking_or_amount_mismatch'};

  const status=await db.$transaction(async tx=>{
    const b=await tx.booking.findFirst({where:{id:original.id,tenantId}});
    if (!b) return null;
    if(Math.abs(payment.transaction_amount*100-b.depositCents)>1) return null;
    const paid=payment.status==='approved';
    // Não sobrescrever um pagamento já aprovado por uma tentativa nova que falhou.
    if(b.paymentStatus==='approved' && b.mpPaymentId!==String(payment.id) && !paid) return b.status;

    let next: BookingStatus=b.status;
    if(paid && b.paymentStatus==='approved' && b.mpPaymentId && b.mpPaymentId!==String(payment.id)) {
      // Dois pagamentos aprovados exigem análise humana e possível reembolso.
      next='NEEDS_REVIEW';
    } else if(paid && ['PENDING_PAYMENT','EXPIRED'].includes(b.status)) {
      // Confirmação recebida atrasada: comparar data do pagamento, não horário do webhook.
      const approvedAt=payment.date_approved ? new Date(payment.date_approved) : null;
      const withinWindow=b.expiresAt==null || (approvedAt!==null && Number.isFinite(approvedAt.getTime()) && approvedAt<=b.expiresAt) || (approvedAt==null && b.expiresAt>=new Date());
      if(withinWindow) {
        // Proteção contra corrida: reservar o profissional na mesma transação da checagem.
        await tx.professional.update({where:{id:b.professionalId},data:{bookingRevision:{increment:1}}});
        const conflicts=await tx.booking.count({where:{id:{not:b.id},professionalId:b.professionalId,startAt:{lt:b.endAt},endAt:{gt:b.startAt},OR:[{status:{in:['CONFIRMED','COMPLETED']}},{status:'PENDING_PAYMENT',expiresAt:{gt:new Date()}}]}});
        next=conflicts ? 'NEEDS_REVIEW' : 'CONFIRMED';
      } else {
        next='NEEDS_REVIEW';
      }
    } else if(paid && b.status==='CANCELLED') {
      next='NEEDS_REVIEW';
    } else if(['cancelled','refunded','charged_back'].includes(payment.status) && ['CONFIRMED','COMPLETED'].includes(b.status) && b.mpPaymentId===String(payment.id)) {
      next='NEEDS_REVIEW';
    }
    const storedPaymentId=(paid && b.paymentStatus==='approved' && b.mpPaymentId && b.mpPaymentId!==String(payment.id))?b.mpPaymentId:String(payment.id);
    const storedPaymentStatus=(paid && b.paymentStatus==='approved')?'approved':payment.status;
    await tx.booking.update({where:{id:b.id},data:{status:next,paymentStatus:storedPaymentStatus,mpPaymentId:storedPaymentId,depositPaidAt:paid?(b.depositPaidAt||new Date()):(['refunded','charged_back','cancelled'].includes(payment.status)?null:b.depositPaidAt)}});
    return next;
  });
  return status ? {outcome:'reconciled',bookingId:original.id,status} : {outcome:'ignored',reason:'record_changed'};
}

export async function reconcileMarketplaceWebhook(paymentId:string, sellerId:string|undefined, tenantId?:string):Promise<Result[]> {
  if(!validPaymentId.test(paymentId)) return [{outcome:'ignored',reason:'invalid_payment_id'}];
  const tenantIds=tenantId ? [tenantId] :
    sellerId && validSellerId.test(sellerId)
      ? (await db.paymentAccount.findMany({where:{sellerUserId:sellerId},select:{tenantId:true}})).map(a=>a.tenantId)
      : [];
  if(!tenantIds.length) return [{outcome:'not_found',reason:'seller_not_found'}];
  const results:Result[]=[];
  for (const id of tenantIds) {
    // Falhas da API ou do MongoDB são propagadas para forçar reenvio do webhook.
    const result=await reconcileMarketplacePayment(id,paymentId);
    results.push(result);
  }
  return results;
}

// Recuperação de notificações perdidas: somente busca com token do vendedor.
export async function recoverMarketplaceBooking(bookingId:string):Promise<Result> {
  const booking=await db.booking.findUnique({where:{id:bookingId},select:{tenantId:true,depositCents:true,status:true}});
  if (!booking) return {outcome:'not_found',reason:'booking_not_found'};
  if (!booking.depositCents || ['CONFIRMED','COMPLETED','CANCELLED'].includes(booking.status)) {
    return {outcome:'ignored',bookingId,status:booking.status,reason:'no_recovery_needed'};
  }
  const payments=await searchPaymentsForBooking(booking.tenantId,bookingId);
  const matches=payments.filter(p=>p.external_reference===bookingId && validPaymentId.test(String(p.id)));
  // Primeiro pagamentos aprovados; pendentes não confirmam a agenda.
  matches.sort((a,b)=>Number(b.status==='approved')-Number(a.status==='approved'));
  let last:Result|undefined;
  for(const p of matches.slice(0,10)) {
    const result=await reconcileMarketplacePayment(booking.tenantId,String(p.id));
    if(result.outcome==='reconciled') last=result;
    if(result.outcome==='reconciled' && p.status==='approved') return result;
  }
  return last || {outcome:'not_found',bookingId,reason:'no_matching_payment'};
}
