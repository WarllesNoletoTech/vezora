import { Prisma, Tenant } from '@prisma/client';
import { db } from './db';
import { env } from './env';
import { verifyMercadoPagoSignature } from './webhookSignature';
import { accessPeriod,BILLING_DAYS } from './trial';
import {splitPayerName,validDeviceId} from './paymentDetails';

export async function platformSettings() {
  // O primeiro acesso cria a configuracao neutra (valor zero): nao cobra sem preco salvo.
  return db.platformSettings.upsert({where:{id:'global'},create:{id:'global',monthlyPriceCents:0,trialDays:3},update:{}});
}
export function billingState(tenant: Pick<Tenant,'trialStartsAt'|'subscriptionEndsAt'|'businessType'|'trialDays'|'trialExtensionDays'|'suspendedAt'>, monthlyPriceCents=0, now=new Date()) {
  return {
    ...accessPeriod(tenant,now),
    monthlyPriceCents,
    pixConfigured:Boolean(monthlyPriceCents>=100 && env.VEZORA_MP_ACCESS_TOKEN && env.VEZORA_MP_WEBHOOK_SECRET && env.API_PUBLIC_URL),
    cardConfigured:Boolean(monthlyPriceCents>=100 && env.VEZORA_MP_ACCESS_TOKEN && env.VEZORA_MP_WEBHOOK_SECRET && env.API_PUBLIC_URL)
  };
}
export function hasAccess(tenant:Pick<Tenant,'trialStartsAt'|'subscriptionEndsAt'|'businessType'|'trialDays'|'trialExtensionDays'|'suspendedAt'>) {
  return ['ACTIVE','TRIAL'].includes(accessPeriod(tenant).status);
}

type MPSubscriptionPayment={id:number|string;status:string;external_reference:string;transaction_amount:number;payment_method_id:string;currency_id?:string;collector_id?:number|string;date_approved?:string|null;transaction_details?:{external_resource_url?:string};point_of_interaction?:{transaction_data?:{qr_code?:string;qr_code_base64?:string;ticket_url?:string}}};
async function mpAPI<T>(path:string,method:'GET'|'POST',body?:unknown,idempotencyKey?:string,deviceId?:string): Promise<T> {
  if(!env.VEZORA_MP_ACCESS_TOKEN) throw Object.assign(new Error('Cobrança Pix do Vezora não configurada'),{status:503});
  const result=await fetch('https://api.mercadopago.com'+path,{method,headers:{Authorization:`Bearer ${env.VEZORA_MP_ACCESS_TOKEN}`,'Content-Type':'application/json',...(idempotencyKey?{'X-Idempotency-Key':idempotencyKey}:{}),...(deviceId&&validDeviceId(deviceId)?{'X-meli-session-id':deviceId}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  if(!result.ok) {
    // Logar somente códigos de diagnóstico do provedor. Não registrar token, CPF, e-mail ou payload da cobrança.
    let diagnostic: unknown = null;
    try {
      const payload: unknown = await result.json();
      if (payload && typeof payload === 'object') {
        const info = payload as {error?:unknown; status?:unknown; cause?:unknown};
        const causeCodes = Array.isArray(info.cause)
          ? info.cause.slice(0, 5).map((c: unknown) => c && typeof c === 'object' ? (c as {code?:unknown}).code : undefined)
            .filter((c:unknown) => typeof c === 'string' || typeof c === 'number')
          : [];
        diagnostic = {
          errorCode: typeof info.error === 'string' ? info.error.slice(0,80) : undefined,
          causeCodes
        };
      }
    } catch { /* O provedor pode retornar resposta não JSON. */ }
    console.error('Mercado Pago plataforma HTTP', result.status, diagnostic);
    throw Object.assign(new Error('Não foi possível gerar/consultar Pix agora'),{status:502});
  }
  return await result.json() as T;
}
export async function paymentFromProvider(id:string) {return mpAPI<MPSubscriptionPayment>(`/v1/payments/${encodeURIComponent(id)}`,'GET');}
export async function generatePix(id:string,payerEmail:string,amountCents:number,document:string,expiresAt:Date,payerFullName='',deviceId?:string) {
  const payer=splitPayerName(payerFullName);
  console.info('[Vezora Assinaturas] Pix solicitado; Device ID oficial:', validDeviceId(deviceId) ? 'presente' : 'indisponível');
  return mpAPI<MPSubscriptionPayment>('/v1/payments','POST',{
    transaction_amount:amountCents/100,
    description:'Assinatura Vezora - 30 dias',payment_method_id:'pix',
    external_reference:id,
    payer:{email:payerEmail,first_name:payer.firstName,...(payer.lastName?{last_name:payer.lastName}:{}),identification:{type:document.length===11?'CPF':'CNPJ',number:document}},
    additional_info:{items:[{id:'vezora-mensalidade',title:'Assinatura Vezora - 30 dias',description:'Acesso mensal ao sistema de agendamentos Vezora',category_id:'services',quantity:1,unit_price:amountCents/100}]},
    notification_url:`${env.API_PUBLIC_URL}/api/billing/webhook`,
    // O Mercado Pago exige pelo menos 30 minutos no momento em que recebe a requisição.
    // Usar o vencimento local da cobrança (45 min) evita rejeição por latência de rede.
    date_of_expiration:expiresAt.toISOString()
  },id,deviceId);
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
  const providerPaidAt=external.date_approved?new Date(external.date_approved):new Date();
  if(!Number.isFinite(providerPaidAt.getTime())||providerPaidAt.getTime()>Date.now()+5*60000) return false;
  const tryUpdate=()=>db.$transaction(async tx=>{
    const pending=await tx.subscriptionPayment.updateMany({where:{id:invoice.id,status:'PENDING'},data:{status:'PAID',paidAt:providerPaidAt,mpPaymentId:String(external.id)}});
    if(!pending.count)return false;
    const tenant=await tx.tenant.findUnique({where:{id:invoice.tenantId}});
    if(!tenant)return false;
    const base=tenant.subscriptionEndsAt && tenant.subscriptionEndsAt>providerPaidAt?tenant.subscriptionEndsAt:providerPaidAt;
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
