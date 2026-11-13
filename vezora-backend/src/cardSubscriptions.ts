/** Assinatura recorrente do Vezora por cartão: checkout hospedado pelo Mercado Pago.
 * Nenhum número de cartão ou CVV é recebido ou persistido no Vezora.
 * SOMENTE pagamentos aprovados conferidos na API oficial liberam acesso.
 */
import {Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {db} from './db';
import {env} from './env';
import {BILLING_DAYS} from './trial';

type Preapproval={id:string;status:string;external_reference?:string;collector_id?:number|string;payer_email?:string;init_point?:string;next_payment_date?:string};
type AuthorizedInvoice={id:number|string;preapproval_id:string;currency_id?:string;transaction_amount:string|number;debit_date?:string;payment?:{id:number|string;status:string}};
type ProviderPayment={id:number|string;status:string;transaction_amount:number;payment_method_id?:string;payment_type_id?:string;currency_id?:string;collector_id?:number|string;date_approved?:string;date_created?:string};
function error(status:number,message:string):never{throw Object.assign(new Error(message),{status});}
function configured(){return !!(env.VEZORA_MP_ACCESS_TOKEN&&env.VEZORA_MP_WEBHOOK_SECRET&&env.API_PUBLIC_URL);}
async function requestMP<T>(path:string,method:'GET'|'POST'|'PUT'='GET',body?:unknown,idempotencyKey?:string):Promise<T>{
 if(!configured())error(503,'A integração de assinaturas Mercado Pago ainda não foi configurada.');
 const response=await fetch(`https://api.mercadopago.com${path}`,{
  method,headers:{Authorization:`Bearer ${env.VEZORA_MP_ACCESS_TOKEN}`,'Content-Type':'application/json',
   ...(method==='POST'?{'X-Idempotency-Key':idempotencyKey||randomUUID()}: {})},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)
 });
 if(!response.ok){console.error('Mercado Pago assinatura cartão HTTP',response.status);error(502,'Não foi possível consultar o serviço de assinaturas do Mercado Pago.');}
 return await response.json() as T;
}
function safeCheckoutUrl(url:string){
 try{const u=new URL(url);return u.protocol==='https:'&&(/(^|\.)mercadopago\.com\.(br|ar|mx|cl|co|pe|uy)$/.test(u.hostname)||/(^|\.)mercadopago\.com$/.test(u.hostname));}catch{return false;}
}
export async function startCardSubscription(tenantId:string,payerEmail:string,amountCents:number){
 if(!configured())error(503,'Configuração de cartão indisponível. Verifique credenciais e webhook no Heroku.');
 const existing=await db.cardSubscription.findUnique({where:{tenantId}});
 if(existing?.status==='ERROR')error(409,'A última autorização teve resultado incerto. Contate o suporte do Vezora antes de repetir, para evitar cobrança duplicada.');
 if(existing&&['CREATING','PENDING','AUTHORIZED','PAUSED'].includes(existing.status)){
  if(existing.status==='CREATING')error(409,'Existe uma autorização em preparação. Tente novamente após conferir o status.');
  if(existing.checkoutUrl&&safeCheckoutUrl(existing.checkoutUrl))return {checkoutUrl:existing.checkoutUrl,status:existing.status};
  error(409,'Há uma autorização de cartão. Cancele-a antes de criar outra.');
 }
 let record;
 if(existing){
  const claimed=await db.cardSubscription.updateMany({where:{tenantId,status:'CANCELLED'},data:{preapprovalId:randomUUID(),status:'CREATING',checkoutUrl:'',payerEmail,amountCents}});
  if(!claimed.count)error(409,'Há uma autorização de cartão em andamento.');
  record=await db.cardSubscription.findUniqueOrThrow({where:{tenantId}});
 }else{
  try{record=await db.cardSubscription.create({data:{tenantId,payerEmail,amountCents,status:'CREATING'}});}
  catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')error(409,'Já existe uma autorização em andamento.');throw e;}
 }
 try{
  const provider=await requestMP<Preapproval>('/preapproval','POST',{
   reason:'Assinatura mensal Vezora',external_reference:record.id,payer_email:payerEmail,
   auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:amountCents/100,currency_id:'BRL'},
   back_url:`${env.WEB_URL}/assinatura?cartao=retorno`,status:'pending'
  },record.preapprovalId);
  if(!provider.id||!provider.init_point||!safeCheckoutUrl(provider.init_point))error(502,'Mercado Pago não retornou um link de autorização válido.');
  await db.cardSubscription.update({where:{id:record.id},data:{preapprovalId:String(provider.id),checkoutUrl:provider.init_point,status:'PENDING'}});
  return {checkoutUrl:provider.init_point,status:'PENDING'};
 }catch(e){
  // Não excluir o registro sem saber se a assinatura foi criada no provedor.
  // O admin poderá reconciliar o estado por identificador quando necessário.
  await db.cardSubscription.update({where:{id:record.id},data:{status:'ERROR'}}).catch(()=>{});
  throw e;
 }
}
export async function updateCardSubscriptionFromProvider(preapprovalId:string){
 const local=await db.cardSubscription.findUnique({where:{preapprovalId}});
 if(!local)return false;
 const provider=await requestMP<Preapproval>(`/preapproval/${encodeURIComponent(preapprovalId)}`);
 if(provider.id!==local.preapprovalId||provider.external_reference!==local.id||provider.payer_email?.toLowerCase()!==local.payerEmail.toLowerCase())return false;
 if(env.VEZORA_MP_COLLECTOR_ID&&String(provider.collector_id)!==env.VEZORA_MP_COLLECTOR_ID)return false;
 const status=String(provider.status).toUpperCase();
 await db.cardSubscription.update({where:{id:local.id},data:{status:status==='AUTHORIZED'?'AUTHORIZED':['CANCELLED','CANCELED'].includes(status)?'CANCELLED':status==='PAUSED'?'PAUSED':'PENDING'}});
 // Autorização do cartão NÃO equivale a cobrança recebida.
 return true;
}
export async function reconcileCardInvoice(authorizedPaymentId:string){
 if(!/^\d{1,24}$/.test(authorizedPaymentId))return false;
 const invoice=await requestMP<AuthorizedInvoice>(`/authorized_payments/${authorizedPaymentId}`);
 const local=await db.cardSubscription.findUnique({where:{preapprovalId:String(invoice.preapproval_id)}});
 if(!local||!invoice.payment?.id||invoice.payment.status!=='approved')return false;
 if(invoice.currency_id&&invoice.currency_id!=='BRL')return false;
 if(Math.abs(Number(invoice.transaction_amount)*100-local.amountCents)>1)return false;
 const mpId=String(invoice.payment.id);
 const payment=await requestMP<ProviderPayment>(`/v1/payments/${encodeURIComponent(mpId)}`);
 if(String(payment.id)!==mpId||payment.status!=='approved'||(payment.payment_method_id==='pix'||(payment.payment_type_id&&payment.payment_type_id!=='credit_card'))||(payment.currency_id&&payment.currency_id!=='BRL')||Math.abs(Number(payment.transaction_amount)*100-local.amountCents)>1)return false;
 if(env.VEZORA_MP_COLLECTOR_ID&&String(payment.collector_id)!==env.VEZORA_MP_COLLECTOR_ID)return false;
 const timestamp=Date.parse(payment.date_approved||invoice.debit_date||payment.date_created||'');
 if(!Number.isFinite(timestamp)||timestamp>Date.now()+5*60000)return false;
 const approvedAt=new Date(timestamp);
 try{
  return await db.$transaction(async tx=>{
   // A unicidade do paymentId impede creditar duas vezes webhook duplicado.
   await tx.cardSubscriptionCharge.create({data:{tenantId:local.tenantId,preapprovalId:local.preapprovalId!,mpPaymentId:mpId,amountCents:local.amountCents,paidAt:approvedAt}});
   await tx.subscriptionPayment.create({data:{tenantId:local.tenantId,amountCents:local.amountCents,status:'PAID',paymentMethod:'CARD',mpPaymentId:mpId,paidAt:approvedAt,expiresAt:approvedAt}});
   const tenant=await tx.tenant.findUnique({where:{id:local.tenantId}});
   if(!tenant)error(404,'Estabelecimento não encontrado');
   // O provedor cobra por mês-calendário: 32 dias evitam bloquear no dia 31.
   // Não acumular os 2 dias extras em cada renovação.
   const currentEnd=tenant.subscriptionEndsAt?.getTime()||0;
   const nextEnd=new Date(Math.max(currentEnd,approvedAt.getTime()+Math.max(BILLING_DAYS,32)*86400000));
   await tx.tenant.update({where:{id:local.tenantId},data:{subscriptionEndsAt:nextEnd}});
   return true;
  });
 }catch(e){
  if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return false;
  throw e;
 }
}
export async function cardSubscriptionStatus(tenantId:string,refresh=false){
 const sub=await db.cardSubscription.findUnique({where:{tenantId}});
 if(!sub)return {configured:configured(),status:'NONE',checkoutUrl:null,preapprovalId:null,amountCents:null};
 if(refresh&&sub.preapprovalId&&['PENDING','AUTHORIZED'].includes(sub.status)&&configured()){
  // Reconciliação manual dos pagamentos aprovados: o checkout pode fechar antes do webhook.
  try{
   await updateCardSubscriptionFromProvider(sub.preapprovalId);
   const paid=await requestMP<{results:AuthorizedInvoice[]}>(`/authorized_payments/search?preapproval_id=${encodeURIComponent(sub.preapprovalId)}&limit=15`);
   for(const invoice of paid.results||[])if(invoice.payment?.status==='approved')await reconcileCardInvoice(String(invoice.id));
  }catch(e){console.error('Falha ao consultar status da assinatura de cartão',e instanceof Error?e.message:'erro');}
 }
 const updated=await db.cardSubscription.findUnique({where:{id:sub.id}});
 return {configured:configured(),status:updated?.status||sub.status,checkoutUrl:updated?.checkoutUrl&&safeCheckoutUrl(updated.checkoutUrl)?updated.checkoutUrl:null,preapprovalId:updated?.preapprovalId||null,amountCents:updated?.amountCents??null};
}
export async function cancelCardSubscription(tenantId:string){
 const sub=await db.cardSubscription.findUnique({where:{tenantId}});
 if(!sub||!['CREATING','PENDING','AUTHORIZED','PAUSED'].includes(sub.status))return false;
 if(sub.status==='CREATING')error(409,'Aguarde a conclusão da autorização antes de cancelar.');
 if(sub.preapprovalId){await requestMP(`/preapproval/${encodeURIComponent(sub.preapprovalId)}`,'PUT',{status:'canceled'});}
 await db.cardSubscription.update({where:{id:sub.id},data:{status:'CANCELLED'}});
 // Período já pago continua válido até vencimento; cancelar impede novas cobranças.
 return true;
}
