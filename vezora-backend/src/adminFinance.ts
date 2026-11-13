/** Relatórios consolidados acessíveis APENAS pela rota /api/admin (SUPERADMIN). */
import {Router,Request,Response,NextFunction} from 'express';
import {DateTime} from 'luxon';
import {z} from 'zod';
import type {Prisma} from '@prisma/client';
import {db} from './db';
import {commissionFor} from './finance';
import {renderAdminFinancePdf} from './adminFinancePdf';

export const adminFinanceRouter=Router();
const run=(fn:(req:Request,res:Response)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>Promise.resolve(fn(req,res)).catch(next);
function fail(status:number,message:string):never{throw Object.assign(new Error(message),{status});}
const ZONE='America/Sao_Paulo';
const paramsSchema=z.object({
  from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tenantId:z.string().min(1).max(90).optional()
}).strict();
const MAX_BOOKINGS=12000;
const MAX_TENANTS=1000;
const MAX_PAYMENTS=50000;
const empty=()=>({
  completed:0,confirmed:0,cancelled:0,pending:0,other:0,
  completedRevenueCents:0,collectedCents:0,depositsCents:0,manualCents:0,
  outstandingCents:0,commissionsCents:0,monthlySalariesCents:0,
  legacyPriceCount:0,legacyCommissionCount:0,
  subscriptionReceivedCents:0,subscriptionPaymentCount:0
});
export type FinanceTotals=ReturnType<typeof empty>;
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100);
export function rollup(rows:FinanceTotals[]):FinanceTotals{
 const result=empty(); for(const r of rows){for(const key of Object.keys(result) as (keyof FinanceTotals)[])result[key]+=r[key];} return result;
}
const csv=(v:unknown)=>{let s=String(v??'').replace(/[\r\n]/g,' ');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
function sendCsv(res:Response,filename:string,rows:(string|number)[][]){
 res.setHeader('Content-Type','text/csv; charset=utf-8');
 res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);
 res.setHeader('Cache-Control','private, no-store');
 res.send('\ufeff'+rows.map(row=>row.map(csv).join(';')).join('\r\n'));
}
export async function createAdminFinanceReport(query:unknown){
 const p=paramsSchema.parse(query);
 const begin=DateTime.fromISO(p.from,{zone:ZONE}); const end=DateTime.fromISO(p.to,{zone:ZONE});
 if(!begin.isValid||!end.isValid||begin.toISODate()!==p.from||end.toISODate()!==p.to||begin.toMillis()>end.toMillis()||end.diff(begin,'days').days>366)
   fail(400,'Informe um período válido de até 366 dias.');
 const timeRange={gte:begin.startOf('day').toUTC().toJSDate(),lt:end.plus({days:1}).startOf('day').toUTC().toJSDate()};
 const tenants=await db.tenant.findMany({
  where:p.tenantId?{id:p.tenantId}:{},take:MAX_TENANTS+1,orderBy:{name:'asc'},
  select:{id:true,name:true,slug:true,businessType:true,createdAt:true,timezone:true,
   owner:{select:{name:true,email:true,phone:true}},paymentAccount:{select:{id:true}}}
 });
 if(tenants.length>MAX_TENANTS)fail(422,'Há mais de 1.000 estabelecimentos. Divida a consulta por estabelecimento.');
 if(p.tenantId&&!tenants.length)fail(404,'Estabelecimento não encontrado.');
 const scope:Prisma.BookingWhereInput={startAt:timeRange,...(p.tenantId?{tenantId:p.tenantId}:{})};
 const [bookings,subscriptions,staff]=await Promise.all([
  db.booking.findMany({where:scope,take:MAX_BOOKINGS+1,orderBy:{startAt:'desc'},
   select:{tenantId:true,status:true,servicePriceCents:true,commissionCents:true,paymentStatus:true,depositCents:true,
    service:{select:{priceCents:true}},professional:{select:{commissionMode:true,commissionValue:true}},
    receipts:{where:{voidedAt:null},select:{amountCents:true}}}}),
  db.subscriptionPayment.findMany({where:{status:'PAID',paidAt:timeRange,...(p.tenantId?{tenantId:p.tenantId}:{})},
   select:{tenantId:true,amountCents:true},take:MAX_PAYMENTS+1}),
  db.professional.findMany({where:{active:true,...(p.tenantId?{tenantId:p.tenantId}:{})},select:{tenantId:true,salaryEnabled:true,salaryCents:true}})
 ]);
 if(bookings.length>MAX_BOOKINGS)fail(422,`O período tem mais de ${MAX_BOOKINGS.toLocaleString('pt-BR')} agendamentos. Reduza o período ou selecione um estabelecimento.`);
 if(subscriptions.length>MAX_PAYMENTS)fail(422,'Há mais de 50.000 pagamentos no período. Reduza o intervalo.');
 const map=new Map(tenants.map(t=>[t.id,empty()]));
 for(const s of staff){const t=map.get(s.tenantId);if(t&&s.salaryEnabled)t.monthlySalariesCents+=s.salaryCents;}
 for(const b of bookings){
  const t=map.get(b.tenantId);if(!t)continue;
  if(b.status==='CANCELLED'){t.cancelled++;continue;}
  if(b.status==='CONFIRMED'){t.confirmed++;continue;}
  if(b.status==='PENDING_PAYMENT'){t.pending++;continue;}
  if(b.status!=='COMPLETED'){t.other++;continue;}
  t.completed++;
  const price=b.servicePriceCents??b.service.priceCents;
  const commission=b.commissionCents??commissionFor(price,b.professional.commissionMode,b.professional.commissionValue);
  if(b.servicePriceCents===null)t.legacyPriceCount++;
  if(b.commissionCents===null)t.legacyCommissionCount++;
  const deposit=b.paymentStatus==='approved'?b.depositCents:0;
  const manual=b.receipts.reduce((acc,r)=>acc+r.amountCents,0);
  t.completedRevenueCents+=price;t.depositsCents+=deposit;t.manualCents+=manual;
  t.collectedCents+=deposit+manual;t.outstandingCents+=Math.max(0,price-deposit-manual);t.commissionsCents+=commission;
 }
 for(const s of subscriptions){const t=map.get(s.tenantId);if(t){t.subscriptionReceivedCents+=s.amountCents;t.subscriptionPaymentCount++;}}
 const items=tenants.map(t=>({...t,hasMercadoPago:Boolean(t.paymentAccount),paymentAccount:undefined,...map.get(t.id)!})).sort((a,b)=>b.completedRevenueCents-a.completedRevenueCents);
 const totals=rollup([...map.values()]);
 return {period:p,timezone:ZONE,generatedAt:new Date().toISOString(),totals,items,
  definitions:{completedRevenue:'Valor dos serviços concluídos no período, pela data do atendimento',
   collected:'Sinais aprovados e recebimentos manuais registrados para atendimentos concluídos no período',
   outstanding:'Saldo dos serviços concluídos ainda não registrado como recebido',
   commissions:'Comissões previstas, não necessariamente pagas',
   monthlySalaries:'Soma dos salários mensais cadastrados; NÃO é despesa efetivamente paga no período',
   subscriptionReceived:'Assinaturas pagas ao Vezora via Pix ou cartão dentro do período, separadas do faturamento dos estabelecimentos',
   dataLimit:`Relatórios com mais de ${MAX_BOOKINGS} reservas devem ser divididos; nunca exibimos valores parciais silenciosamente.`}};
}
adminFinanceRouter.get('/summary',run(async(req,res)=>{const report=await createAdminFinanceReport(req.query);res.setHeader('Cache-Control','private, no-store');res.json(report);}));
adminFinanceRouter.get('/export.csv',run(async(req,res)=>{
 const r=await createAdminFinanceReport(req.query);
 const columns=['Estabelecimento','Segmento','Proprietário','WhatsApp','Concluídos','Faturamento R$','Recebido R$','Pendente R$','Comissões R$','Salários mensais cadastrados R$','Assinaturas pagas ao Vezora R$'];
 const amount=(v:number)=>(v/100).toFixed(2).replace('.',',');
 const rows=r.items.map(t=>[t.name,t.businessType||'',t.owner.name,t.owner.phone||'',t.completed,amount(t.completedRevenueCents),amount(t.collectedCents),amount(t.outstandingCents),amount(t.commissionsCents),amount(t.monthlySalariesCents),amount(t.subscriptionReceivedCents)]);
 sendCsv(res,`vezora-admin-financeiro-${r.period.from}-${r.period.to}.csv`,[columns,...rows]);
}));
adminFinanceRouter.get('/report.pdf',run(async(req,res)=>{
 const r=await createAdminFinanceReport(req.query);
 res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="vezora-admin-financeiro-${r.period.from}-${r.period.to}.pdf"`);
 res.setHeader('Cache-Control','private, no-store');
 renderAdminFinancePdf(res,r);
}));
