import {Router, Request, Response, NextFunction} from 'express';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {db} from './db';
import {platformSettings} from './billing';
import {accessPeriod} from './trial';
import {env} from './env';
import {phoneDigits} from './core';

export type AdminRequest=Request & {userId?:string};
const router=Router();
const run=(fn:(req:AdminRequest,res:Response)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>Promise.resolve(fn(req as AdminRequest,res)).catch(next);
function fail(code:number,msg:string):never {
  throw Object.assign(new Error(msg),{status:code});
}
const paging=z.coerce.number().int().min(1).max(100000).default(1);
const query=z.string().trim().max(90).default('');
const reason=z.string().trim().min(8,'Informe uma justificativa com 8 caracteres ou mais').max(240);
const perPage=15;
const summaryTenantSelect={id:true,businessType:true,trialStartsAt:true,trialExtensionDays:true,subscriptionEndsAt:true,suspendedAt:true,createdAt:true} as const;
async function audit(actorId:string,action:string,tenantId:string|undefined,details:string){
  await db.adminAuditLog.create({data:{actorId,action,tenantId,details:details.slice(0,600)}});
}

router.get('/summary',run(async(_req,res)=>{
  const [tenants,owners,admins,bookings,receipts,received30,latest,setting]=await Promise.all([
    db.tenant.findMany({select:summaryTenantSelect}),
    db.user.count(),
    db.user.count({where:{role:'SUPERADMIN'}}),
    db.booking.count(),
    db.subscriptionPayment.aggregate({where:{status:'PAID'},_sum:{amountCents:true},_count:{_all:true}}),
    db.subscriptionPayment.aggregate({where:{status:'PAID',paidAt:{gte:new Date(Date.now()-30*86400000)}},_sum:{amountCents:true}}),
    db.subscriptionPayment.findMany({take:6,orderBy:{createdAt:'desc'},select:{id:true,status:true,amountCents:true,createdAt:true,tenant:{select:{name:true}}}}),
    platformSettings()
  ]);
  const statusCounts:Record<string,number>={ACTIVE:0,TRIAL:0,EXPIRED:0,ONBOARDING:0,SUSPENDED:0};
  const types:Record<string,number>={};
  for(const t of tenants){const st=accessPeriod(t).status;statusCounts[st]=(statusCounts[st]||0)+1;types[t.businessType||'PENDENTE']=(types[t.businessType||'PENDENTE']||0)+1;}
  res.json({totalTenants:tenants.length,totalOwners:owners-admins,totalBookings:bookings,newTenants30:tenants.filter(t=>t.createdAt>=new Date(Date.now()-30*86400000)).length,
    statusCounts,types,receivedTotalCents:receipts._sum.amountCents||0,received30Cents:received30._sum.amountCents||0,paidPaymentCount:receipts._count._all,
    latestPayments:latest,monthlyPriceCents:setting.monthlyPriceCents});
}));
router.get('/settings',run(async(_req,res)=>{
  const s=await platformSettings();
  res.json({monthlyPriceCents:s.monthlyPriceCents,updatedAt:s.updatedAt,pixConfigured:Boolean(s.monthlyPriceCents>=100&&env.VEZORA_MP_ACCESS_TOKEN&&env.VEZORA_MP_WEBHOOK_SECRET&&env.API_PUBLIC_URL),
    paymentIntegrationConfigured:Boolean(env.VEZORA_MP_ACCESS_TOKEN&&env.VEZORA_MP_WEBHOOK_SECRET&&env.API_PUBLIC_URL)});
}));
router.patch('/settings',run(async(req,res)=>{
  const body=z.object({monthlyPriceCents:z.number().int().refine(v=>v===0||(v>=100&&v<=500000),'Informe zero ou valor entre R$ 1,00 e R$ 5.000,00')}).strict().parse(req.body);
  const before=await platformSettings();
  const saved=await db.$transaction(async tx=>{
    const updated=await tx.platformSettings.update({where:{id:'global'},data:{monthlyPriceCents:body.monthlyPriceCents}});
    await tx.adminAuditLog.create({data:{actorId:req.userId!,action:'SET_MONTHLY_PRICE',details:`de ${before.monthlyPriceCents} para ${updated.monthlyPriceCents} centavos`}});
    return updated;
  });
  res.json({monthlyPriceCents:saved.monthlyPriceCents,updatedAt:saved.updatedAt});
}));

/** Exporta dados operacionais (ate 5.000 linhas) exclusivamente para SUPERADMIN. */
const csvField=(value:unknown)=>{
  let s=String(value??'').replace(/[\r\n]/g,' ');
  if(/^[=+@-]/.test(s))s="'"+s; // Prevenir injecao de formula ao abrir no Excel.
  return `"${s.replace(/"/g,'""')}"`;
};
function sendCsv(res:Response,name:string,columns:string[],rows:unknown[][]){
  const body='\ufeff'+[columns,...rows].map(fields=>fields.map(csvField).join(';')).join('\r\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',`attachment; filename="${name}"`);
  res.setHeader('Cache-Control','private, no-store');
  res.send(body);
}
router.get('/export/tenants',run(async(_req,res)=>{
  const records=await db.tenant.findMany({take:5000,orderBy:{createdAt:'desc'},select:{name:true,slug:true,businessType:true,createdAt:true,subscriptionEndsAt:true,trialStartsAt:true,trialExtensionDays:true,suspendedAt:true,owner:{select:{name:true,email:true,phone:true}}}});
  sendCsv(res,'vezora-estabelecimentos.csv',['Estabelecimento','Slug','Segmento','Lojista','Email','WhatsApp','Criado em','Status','Vencimento assinatura'],records.map(t=>[t.name,t.slug,t.businessType||'',t.owner.name,t.owner.email,t.owner.phone||'',t.createdAt.toISOString(),accessPeriod(t).status,t.subscriptionEndsAt?.toISOString()||'']));
}));
router.get('/export/payments',run(async(_req,res)=>{
  const records=await db.subscriptionPayment.findMany({
    take:5000,
    orderBy:{createdAt:'desc'},
    select:{
      id:true,status:true,amountCents:true,createdAt:true,paidAt:true,
      tenant:{select:{name:true,owner:{select:{email:true}}}}
    }
  });
  sendCsv(res,'vezora-cobrancas.csv',['ID','Estabelecimento','Email','Valor (R$)','Status','Emissao','Pagamento'],records.map(p=>[p.id,p.tenant.name,p.tenant.owner.email,(p.amountCents/100).toFixed(2).replace('.',','),p.status,p.createdAt.toISOString(),p.paidAt?.toISOString()||'']));
}));

router.get('/tenants',run(async(req,res)=>{
  const input=z.object({page:paging,search:query,businessType:z.string().max(40).optional()}).parse(req.query);
  const where:Prisma.TenantWhereInput={};
  if(input.businessType&&input.businessType!=='TODOS'){
    const valid=['BARBEARIA','CABELEIREIRO','SALAO_BELEZA','NAIL_DESIGNER','MANICURE_PEDICURE','LASH_DESIGNER','SOBRANCELHAS','ESTETICA','MAQUIAGEM','DEPILACAO','MASSOTERAPIA','PODOLOGIA','OUTROS'];
    if(!valid.includes(input.businessType))fail(400,'Categoria inválida');
    where.businessType=input.businessType as NonNullable<Prisma.TenantWhereInput['businessType']>;
  }
  if(input.search){const ownerFilters:Prisma.UserWhereInput[]=[{name:{contains:input.search,mode:'insensitive'}},{email:{contains:input.search,mode:'insensitive'}}];const digits=phoneDigits(input.search);if(digits.length>=3)ownerFilters.push({phone:{contains:digits}});where.OR=[{name:{contains:input.search,mode:'insensitive'}},{slug:{contains:input.search,mode:'insensitive'}},{owner:{is:{OR:ownerFilters}}}];}
  const [total,items]=await Promise.all([
    db.tenant.count({where}),
    db.tenant.findMany({where,take:perPage,skip:(input.page-1)*perPage,orderBy:{createdAt:'desc'},
      select:{...summaryTenantSelect,name:true,slug:true,whatsapp:true,subscriptionEndsAt:true,suspensionReason:true,
        owner:{select:{id:true,name:true,email:true,phone:true}},_count:{select:{services:true,professionals:true,bookings:true}}}})
  ]);
  res.json({items:items.map(t=>({...t,billingStatus:accessPeriod(t).status})),page:input.page,pageSize:perPage,total});
}));
router.get('/tenants/:id',run(async(req,res)=>{
  const t=await db.tenant.findUnique({where:{id:String(req.params.id)},include:{
    owner:{select:{id:true,name:true,email:true,phone:true,createdAt:true}},
    subscriptionPayments:{take:15,orderBy:{createdAt:'desc'},select:{id:true,amountCents:true,status:true,paidAt:true,createdAt:true,expiresAt:true}},
    _count:{select:{services:true,professionals:true,bookings:true}},
    paymentAccount:{select:{sellerUserId:true,createdAt:true}}
  }});
  if(!t)fail(404,'Estabelecimento não encontrado');
  res.json({...t,billingStatus:accessPeriod(t).status});
}));
router.patch('/tenants/:id/suspension',run(async(req,res)=>{
  const {suspended,reason:why}=z.object({suspended:z.boolean(),reason:z.string().trim().max(240).default('')}).strict().parse(req.body);
  if(suspended && why.length<8)fail(400,'Informe o motivo do bloqueio');
  const t=await db.tenant.findUnique({where:{id:String(req.params.id)}});
  if(!t)fail(404,'Estabelecimento não encontrado');
  const updated=await db.tenant.update({where:{id:t!.id},data:{suspendedAt:suspended?new Date():null,suspensionReason:suspended?why:''}});
  await audit(req.userId!,suspended?'SUSPEND_TENANT':'RESTORE_TENANT',t!.id,why||'Reativado pelo administrador');
  res.json({ok:true,billingStatus:accessPeriod(updated).status});
}));
router.post('/tenants/:id/trial',run(async(req,res)=>{
  const body=z.object({days:z.number().int().min(1).max(30),reason}).strict().parse(req.body);
  const t=await db.tenant.findUnique({where:{id:String(req.params.id)}});
  if(!t)fail(404,'Estabelecimento não encontrado');
  if((t!.trialExtensionDays??0)+body.days>365)fail(400,'Limite de 365 dias adicionais por estabelecimento');
  const updated=await db.tenant.update({where:{id:t!.id},data:{trialStartsAt:t!.trialStartsAt||new Date(),trialExtensionDays:(t!.trialExtensionDays??0)+body.days}});
  await audit(req.userId!,'EXTEND_TRIAL',t!.id,`${body.days} dia(s): ${body.reason}`);
  res.json({ok:true,billingStatus:accessPeriod(updated).status});
}));
router.post('/tenants/:id/grant',run(async(req,res)=>{
  const body=z.object({days:z.number().int().min(1).max(365),reason}).strict().parse(req.body);
  const updated=await db.$transaction(async tx=>{
    const t=await tx.tenant.findUnique({where:{id:String(req.params.id)}});
    if(!t)fail(404,'Estabelecimento não encontrado');
    const now=new Date();const base=t!.subscriptionEndsAt&&t!.subscriptionEndsAt>now?t!.subscriptionEndsAt:now;
    const after=new Date(base.getTime()+body.days*86400000);
    const saved=await tx.tenant.update({where:{id:t!.id},data:{subscriptionEndsAt:after}});
    await tx.adminAuditLog.create({data:{actorId:req.userId!,tenantId:t!.id,action:'GRANT_ACCESS',details:`${body.days} dia(s): ${body.reason}`}});
    return saved;
  });
  res.json({ok:true,subscriptionEndsAt:updated.subscriptionEndsAt,billingStatus:accessPeriod(updated).status});
}));
router.get('/users',run(async(req,res)=>{
  const {page,search}=z.object({page:paging,search:query}).parse(req.query);
  const filters:Prisma.UserWhereInput[]=[{name:{contains:search,mode:'insensitive'}},{email:{contains:search,mode:'insensitive'}}];const digits=phoneDigits(search);if(digits.length>=3)filters.push({phone:{contains:digits}});const where:Prisma.UserWhereInput=search?{OR:filters}:{};
  const [total,items]=await Promise.all([db.user.count({where}),db.user.findMany({where,take:perPage,skip:(page-1)*perPage,orderBy:{createdAt:'desc'},select:{id:true,name:true,email:true,phone:true,role:true,createdAt:true,tenant:{select:{id:true,name:true,slug:true}}}})]);
  res.json({total,page,pageSize:perPage,items});
}));
router.patch('/users/:id/phone',run(async(req,res)=>{
  const body=z.object({phone:z.string().transform(phoneDigits).pipe(z.string().min(10).max(13)),reason}).strict().parse(req.body);
  const u=await db.user.findUnique({where:{id:String(req.params.id)}});
  if(!u)fail(404,'Usuário não encontrado');
  const updated=await db.user.update({where:{id:u!.id},data:{phone:body.phone}});
  await audit(req.userId!,'CORRECT_OWNER_PHONE',undefined,`ID ${u!.id}; ${body.reason}`);
  res.json({id:updated.id,phone:updated.phone});
}));
router.get('/payments',run(async(req,res)=>{
  const {page,status}=z.object({page:paging,status:z.enum(['TODOS','PENDING','PAID','EXPIRED','CANCELLED']).default('TODOS')}).parse(req.query);
  const where:Prisma.SubscriptionPaymentWhereInput=status==='TODOS'?{}:{status};
  const [total,items]=await Promise.all([db.subscriptionPayment.count({where}),db.subscriptionPayment.findMany({where,take:perPage,skip:(page-1)*perPage,orderBy:{createdAt:'desc'},select:{id:true,status:true,amountCents:true,createdAt:true,paidAt:true,expiresAt:true,tenant:{select:{id:true,name:true,slug:true,owner:{select:{name:true,email:true}}}}}})]);
  res.json({total,page,pageSize:perPage,items});
}));
router.get('/audit',run(async(req,res)=>{
  const {page}=z.object({page:paging}).parse(req.query);
  const [total,items]=await Promise.all([db.adminAuditLog.count(),db.adminAuditLog.findMany({take:perPage,skip:(page-1)*perPage,orderBy:{createdAt:'desc'},select:{id:true,action:true,details:true,tenantId:true,createdAt:true,actorId:true}})]);
  res.json({total,page,pageSize:perPage,items});
}));
export default router;
