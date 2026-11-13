import { Prisma, Tenant } from '@prisma/client';
import { db } from './db';
import { env } from './env';
import { verifyMercadoPagoSignature } from './webhookSignature';
import { accessPeriod,BILLING_DAYS } from './trial';

export function billingState(tenant: Pick<Tenant,'trialStartsAt'|'subscriptionEndsAt'|'businessType'>, now=new Date()) {
  return {
    ...accessPeriod(tenant,now),
    monthlyPriceCents:env.VEZORA_MONTHLY_PRICE_CENTS,
    pixConfigured:Boolean(env.VEZORA_MONTHLY_PRICE_CENTS>0 && env.VEZORA_MP_ACCESS_TOKEN && env.VEZORA_MP_WEBHOOK_SECRET && env.API_PUBLIC_URL)
  };
}
export function hasAccess(tenant:Pick<Tenant,'trialStartsAt'|'subscriptionEndsAt'|'businessType'>) {
  return ['ACTIVE','TRIAL'].includes(billingState(tenant).status);
}

type MPSubscriptionPayment={id:number|string;status:string;external_reference:string;transaction_amount:number;payment_method_id:string;currency_id?:string;collector_id?:number|string;transaction_details?:{external_resource_url?:string};point_of_interaction?:{transaction_data?:{qr_code?:string;qr_code_base64?:string;ticket_url?:string}}};
async function mpAPI<T>(path:string,method:'GET'|'POST',body?:unknown,idempotencyKey?:string): Promise<T> {
  if(!env.VEZORA_MP_ACCESS_TOKEN) throw Object.assign(new Error('Cobrança Pix do Vezora não configurada'),{status:503});
  const result=await fetch('https://api.mercadopago.com'+path,{method,headers:{Authorization:`Bearer ${env.VEZORA_MP_ACCESS_TOKEN}`,'Content-Type':'application/json',...(idempotencyKey?{'X-Idempotency-Key':idempotencyKey}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  if(!result.ok) {console.error('Mercado Pago plataforma HTTP',result.status);throw Object.assign(new Error('Não foi possível gerar/consultar Pix agora'),{status:502});}
  return await result.json() as T;
}
export async function paymentFromProvider(id:string) {return mpAPI<MPSubscriptionPayment>(`/v1/payments/${encodeURIComponent(id)}`,'GET');}
export async function generatePix(id:string,payerEmail:string,amountCents:number,document:string) {
  return mpAPI<MPSubscriptionPayment>('/v1/payments','POST',{
    transaction_amount:amountCents/100,
    description:'Assinatura Vezora - 30 dias',payment_method_id:'pix',
    external_reference:id,payer:{email:payerEmail,identification:{type:document.length===11?'CPF':'CNPJ',number:document}},
    notification_url:`${env.API_PUBLIC_URL}/api/billing/webhook`,
    date_of_expiration:new Date(Date.now()+30*60000).toISOString()
  },id);
}
export function verifyBillingWebhook(signature:string,requestId:string,id:string) {
  return Boolean(env.VEZORA_MP_WEBHOOK_SECRET && verifyMercadoPagoSignature(signature,requestId,id,env.VEZORA_MP_WEBHOOK_SECRET));
}
/** Confere sempre o pagamento na API oficial; corpo de webhook e retorno do cliente não concedem acesso. */
export async function reconcileSubscription(paymentId:string) {
  const external=await paymentFromProvider(paymentId);
  const invoice=await db.subscriptionPayment.findUnique({where:{id:String(external.external_reference||'')}});
  if(!invoice) return false;
  if(String(external.payment_method_id)!=='pix'||Math.abs(Number(external.transaction_amount)*100-invoice.amountCents)>1||
     (external.currency_id && external.currency_id!=='BRL')||
     (env.VEZORA_MP_COLLECTOR_ID&&String(external.collector_id)!==env.VEZORA_MP_COLLECTOR_ID)||
     (invoice.mpPaymentId&&invoice.mpPaymentId!==String(external.id))) return false;
  if(external.status!=='approved') return false;
  const tryUpdate=()=>db.$transaction(async tx=>{
    const pending=await tx.subscriptionPayment.updateMany({where:{id:invoice.id,status:'PENDING'},data:{status:'PAID',paidAt:new Date(),mpPaymentId:String(external.id)}});
    if(!pending.count)return false;
    const tenant=await tx.tenant.findUnique({where:{id:invoice.tenantId}});
    if(!tenant)return false;
    const base=tenant.subscriptionEndsAt && tenant.subscriptionEndsAt>new Date()?tenant.subscriptionEndsAt:new Date();
    await tx.tenant.update({where:{id:tenant.id},data:{subscriptionEndsAt:new Date(base.getTime()+BILLING_DAYS*86400000)}});
    return true;
  });
  for(let attempt=0;attempt<3;attempt++){
    try{return await tryUpdate();}
    catch(error){
      const text=String((error as Error).message||'');
      if(attempt===2||!(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2034')&&!/WriteConflict|TransientTransactionError/i.test(text))throw error;
    }
  }
  return false;
}
