import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma, BookingStatus, DepositMode, BusinessType, ProfessionalRole, CommissionMode } from '@prisma/client';
import { z, ZodError } from 'zod';
import { DateTime } from 'luxon';
import { db } from './db';
import { env } from './env';
import { DEFAULT_SCHEDULE, depositCents, localSlot, phoneDigits, slotsForDay, Schedule } from './core';
import { decrypt, encrypt, rand, sha256 } from './crypto';
import { createPreference, exchangeCode, mpReady, validMpWebhook } from './mp';
import { reconcileMarketplaceWebhook, recoverMarketplaceBooking } from './marketplaceReconcile';
import {splitPayerName,validDeviceId} from './paymentDetails';
import { themeFor } from './business';
import { billingState, hasAccess, generatePix, reconcileSubscription, verifyBillingWebhook, platformSettings } from './billing';
import adminRouter from './admin';
import {financialRoutes} from './financeRoutes';
import {commissionFor} from './finance';
import {startCardSubscription,cardSubscriptionStatus,cancelCardSubscription,reconcileCardInvoice,updateCardSubscriptionFromProvider} from './cardSubscriptions';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.WEB_URL, credentials: true }));
app.use(express.json({limit:'32kb'}));
app.use(cookieParser());
app.use('/api/auth', rateLimit({windowMs:15*60_000,limit:35,standardHeaders:'draft-7',legacyHeaders:false}));
app.use('/api/public', rateLimit({windowMs:15*60_000,limit:140,standardHeaders:'draft-7',legacyHeaders:false}));
app.use((req,res,next)=>{
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== env.WEB_URL) {
    res.status(403).json({error:'Origem não permitida'}); return;
  }
  next();
});

type Authed = Request & { userId?: string; tenantId?: string };
const wrap = (fn: (req: Authed,res: Response)=>Promise<unknown>) =>
  (req: Request,res: Response,next: NextFunction) => Promise.resolve(fn(req as Authed,res)).catch(next);
function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), {status});
}
function auth(req: Authed, _res: Response, next: NextFunction) {
  try {
    const payload = jwt.verify(req.cookies?.vezora_session || '',env.JWT_SECRET,{issuer:'vezora'}) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string') fail(401,'Sessão inválida');
    req.userId = payload.sub;
    next();
  } catch { next(Object.assign(new Error('Entre na sua conta'),{status:401})); }
}
function session(res: Response, id: string) {
  const token=jwt.sign({},env.JWT_SECRET,{subject:id,expiresIn:'7d',issuer:'vezora'});
  res.cookie('vezora_session',token,{httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',maxAge:7*86400000,path:'/'});
}
async function myTenant(req: Authed) {
  const tenant = await db.tenant.findUnique({where:{ownerId:req.userId!}});
  if (!tenant) fail(404,'Estabelecimento não encontrado');
  return tenant!;
}
const cleanUrl = z.union([z.literal(''), z.string().url().startsWith('https://').max(600)]);
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const name = z.string().trim().min(2).max(90);
const reservedSlugs=new Set(['admin','api','painel','cadastro','entrar','assinatura','agendamento','atualizar-cadastro','favicon.ico']);
const slug = z.string().trim().min(3).max(45).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine(v=>!reservedSlugs.has(v),{message:'Este link de agendamento está reservado'});
const phone = z.string().transform(phoneDigits).pipe(z.string().min(10).max(13));
const businessTypeSchema=z.nativeEnum(BusinessType);
function subscriptionGuard(req:Authed,_res:Response,next:NextFunction){
  void Promise.all([myTenant(req),db.user.findUnique({where:{id:req.userId},select:{phone:true}})]).then(([t,user])=>{
    if(!t.businessType || !user || !/^\d{10,13}$/.test(user.phone||'')) fail(428,'Atualize seu cadastro e informe um WhatsApp válido para continuar');
    if(!hasAccess(t)) fail(402,t.suspendedAt?'Este estabelecimento foi suspenso pelo administrador.':'Seu teste grátis terminou. Pague a assinatura por Pix ou cartão para continuar.');
    next();
  }).catch(next);
}

const accountData = z.object({name,phone,email:z.string().trim().toLowerCase().email(),password:z.string().min(8).max(128)});

app.get('/',(_req,res)=>res.json({name:'Vezora API',status:'online',health:'/api/health'}));
app.get('/api/health',(_req,res)=>{res.setHeader('Cache-Control','no-store');res.json({status:'ok',name:'Vezora API',version:'1.0.3'});});
app.get('/api/platform/public-settings',wrap(async(_req,res)=>{const s=await platformSettings();res.json({trialDays:s.trialDays});}));
app.post('/api/auth/register',wrap(async(req,res)=>{
  const body=accountData.extend({business:name,slug,businessType:businessTypeSchema}).strict().parse(req.body);
  const hash=await bcrypt.hash(body.password,12);
  const settings=await platformSettings();
  const user=await db.$transaction(async tx=>{
    const user=await tx.user.create({data:{name:body.name,email:body.email,phone:body.phone,role:'LOJISTA',passwordHash:hash}});
    const palette=themeFor(body.businessType);
    const tenant=await tx.tenant.create({data:{name:body.business,slug:body.slug,ownerId:user.id,businessType:body.businessType,trialStartsAt:new Date(),trialDays:settings.trialDays,whatsapp:body.phone,primaryColor:palette.primary,secondaryColor:palette.secondary}});
    await tx.professional.create({data:{tenantId:tenant.id,name:body.name,schedule:DEFAULT_SCHEDULE,role:'OWNER'}});
    return user;
  });
  session(res,user.id); res.status(201).json({ok:true,trialDays:settings.trialDays});
}));
app.post('/api/auth/login',wrap(async(req,res)=>{
  const body=z.object({email:z.string().email(),password:z.string()}).parse(req.body);
  const user=await db.user.findUnique({where:{email:body.email.toLowerCase().trim()}});
  if (!user || !(await bcrypt.compare(body.password,user.passwordHash))) fail(401,'E-mail ou senha inválidos');
  session(res,user!.id);res.json({ok:true});
}));
app.post('/api/auth/logout',(_req,res)=>{
  res.clearCookie('vezora_session',{path:'/',httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax'});
  res.json({ok:true});
});
app.get('/api/me',auth,wrap(async(req,res)=>{
  const user=await db.user.findUnique({where:{id:req.userId},select:{id:true,name:true,email:true,phone:true,role:true}});
  if(!user) fail(401,'Sessão inválida');
  if(user!.role==='SUPERADMIN'){
    res.json({user,tenant:null,billing:null,onboardingRequired:false});return;
  }
  const tenant=await myTenant(req);
  const settings=await platformSettings();
  const incomplete=!tenant.businessType||!/^\d{10,13}$/.test(user!.phone||'');
  res.json({user,tenant,billing:billingState(tenant,settings.monthlyPriceCents),onboardingRequired:incomplete});
}));
app.patch('/api/tenant/onboarding',auth,wrap(async(req,res)=>{
  const old=await myTenant(req);
  const data=z.object({businessType:businessTypeSchema,name:name.optional(),phone}).strict().parse(req.body);
  const theme=themeFor(data.businessType);
  const settings=await platformSettings();
  const usingOldColors=old.primaryColor==='#8F5176'&&old.secondaryColor==='#211925';
  const updated=await db.$transaction(async tx=>{
    await tx.user.update({where:{id:req.userId!},data:{phone:data.phone}});
    return tx.tenant.update({where:{id:old.id},data:{
      businessType:data.businessType,...(data.name?{name:data.name}:{}),
      ...(!old.whatsapp?{whatsapp:data.phone}:{}),
      // Contas antigas sem teste registrado recebem o prazo comercial vigente.
      ...(!old.trialStartsAt?{trialStartsAt:new Date(),trialDays:settings.trialDays}:{}),
      ...(usingOldColors?{primaryColor:theme.primary,secondaryColor:theme.secondary}:{})
    }});
  });
  res.json({tenant:updated,billing:billingState(updated,settings.monthlyPriceCents)});
}));

app.patch('/api/tenant',auth,subscriptionGuard,wrap(async(req,res)=>{
  const tenant=await myTenant(req);
  const update=z.object({
    businessType:businessTypeSchema.optional(),
    name:name.optional(),bio:z.string().max(400).optional(),
    whatsapp:z.string().max(22).optional(),instagram:z.string().max(120).optional(),
    address:z.string().max(240).optional(),logoUrl:cleanUrl.optional(),coverUrl:cleanUrl.optional(),
    primaryColor:hex.optional(),secondaryColor:hex.optional(),
    timezone:z.enum(['America/Sao_Paulo','America/Belem','America/Manaus','America/Cuiaba','America/Recife','America/Fortaleza','America/Rio_Branco']).optional()
  }).strict().parse(req.body);
  res.json(await db.tenant.update({where:{id:tenant.id},data:update}));
}));

const serviceFields=z.object({name,description:z.string().max(500).default(''),priceCents:z.number().int().min(0).max(10_000_000),durationMin:z.number().int().min(15).max(720),depositMode:z.nativeEnum(DepositMode).default('NONE'),depositValue:z.number().int().min(0).max(10_000_000).default(0),active:z.boolean().default(true)});
const serviceInput=serviceFields.refine(v=>v.depositMode!=='PERCENT'||v.depositValue<=100,{message:'Percentual não pode superar 100%'}).refine(v=>v.depositMode!=='FIXED'||v.depositValue<=v.priceCents,{message:'Sinal maior que o valor do serviço'});
app.get('/api/services',auth,subscriptionGuard,wrap(async(req,res)=>{const t=await myTenant(req);res.json(await db.service.findMany({where:{tenantId:t.id},orderBy:{createdAt:'desc'}}));}));
app.post('/api/services',auth,subscriptionGuard,wrap(async(req,res)=>{const t=await myTenant(req);res.status(201).json(await db.service.create({data:{...serviceInput.parse(req.body),tenantId:t.id}}));}));
app.patch('/api/services/:id',auth,subscriptionGuard,wrap(async(req,res)=>{
  const t=await myTenant(req);
  const old=await db.service.findFirst({where:{tenantId:t.id,id:String(req.params.id)}});
  if(!old) fail(404,'Serviço não encontrado');
  const changes=serviceFields.partial().strict().parse(req.body);
  const body=serviceInput.parse({...old,...changes});
  res.json(await db.service.update({where:{id:old!.id},data:body}));
}));
const timePattern=/^([01]\d|2[0-3]):[0-5]\d$/;
const workday=z.union([z.null(),z.tuple([z.string().regex(timePattern),z.string().regex(timePattern)]).refine(v=>v[1]>v[0],'Intervalo inválido')]);
const scheduleSchema=z.record(z.enum(['0','1','2','3','4','5','6']),workday);
const proFields=z.object({
  name,photoUrl:cleanUrl.default(''),schedule:scheduleSchema.default(DEFAULT_SCHEDULE),active:z.boolean().default(true),
  role:z.nativeEnum(ProfessionalRole).default('EMPLOYEE'),
  salaryEnabled:z.boolean().default(false),salaryCents:z.number().int().min(0).max(100_000_000).default(0),
  commissionMode:z.nativeEnum(CommissionMode).default('NONE'),commissionValue:z.number().int().min(0).max(100_000_000).default(0)
});
const proInput=proFields.superRefine((v,ctx)=>{
  if(v.commissionMode==='PERCENT'&&v.commissionValue>100)ctx.addIssue({code:'custom',path:['commissionValue'],message:'A comissão percentual não pode superar 100%'});
  if(!v.salaryEnabled && v.salaryCents!==0)ctx.addIssue({code:'custom',path:['salaryCents'],message:'Sem salário habilitado, informe valor zero'});
  if(v.commissionMode==='NONE'&&v.commissionValue!==0)ctx.addIssue({code:'custom',path:['commissionValue'],message:'Sem comissão habilitada, informe valor zero'});
});
const proPatch=proFields.partial().strict();
app.get('/api/professionals',auth,subscriptionGuard,wrap(async(req,res)=>{const t=await myTenant(req);res.json(await db.professional.findMany({where:{tenantId:t.id},orderBy:{name:'asc'}}));}));
app.post('/api/professionals',auth,subscriptionGuard,wrap(async(req,res)=>{const t=await myTenant(req);const v=proInput.parse(req.body);res.status(201).json(await db.professional.create({data:{...v,tenantId:t.id}}));}));
app.patch('/api/professionals/:id',auth,subscriptionGuard,wrap(async(req,res)=>{
  const t=await myTenant(req);
  const pro=await db.professional.findFirst({where:{id:String(req.params.id),tenantId:t.id}});
  if(!pro) fail(404,'Profissional não encontrado');
  const changes=proPatch.parse(req.body);
  const v=proInput.parse({...pro,...changes});
  res.json(await db.professional.update({where:{id:pro!.id},data:v}));
}));
app.get('/api/bookings',auth,subscriptionGuard,wrap(async(req,res)=>{
  const t=await myTenant(req);
  const rows=await db.booking.findMany({where:{tenantId:t.id,startAt:{gte:DateTime.utc().minus({days:30}).toJSDate()}},include:{service:{select:{name:true,priceCents:true}},professional:{select:{name:true}},receipts:{orderBy:{createdAt:'desc'}}},orderBy:{startAt:'asc'},take:250});
  res.json(rows);
}));
app.patch('/api/bookings/:id',auth,subscriptionGuard,wrap(async(req,res)=>{
  const t=await myTenant(req);
  const b=await db.booking.findFirst({where:{tenantId:t.id,id:String(req.params.id)}});
  if(!b) fail(404,'Reserva não encontrada');
  const {status}=z.object({status:z.enum(['COMPLETED','CANCELLED'])}).parse(req.body);
  if(b!.status!=='CONFIRMED') fail(409,'Somente reservas confirmadas podem ser encerradas ou canceladas');
  res.json(await db.booking.update({where:{id:b!.id},data:{status}}));
}));

app.get('/api/public/:slug',wrap(async(req,res)=>{
  const t=await db.tenant.findUnique({where:{slug:String(req.params.slug)},select:{id:true,name:true,slug:true,bio:true,whatsapp:true,instagram:true,address:true,logoUrl:true,coverUrl:true,primaryColor:true,secondaryColor:true,timezone:true,businessType:true,trialStartsAt:true,trialDays:true,trialExtensionDays:true,suspendedAt:true,subscriptionEndsAt:true,paymentAccount:{select:{id:true}},services:{where:{active:true},select:{id:true,name:true,description:true,priceCents:true,durationMin:true,depositMode:true,depositValue:true}},professionals:{where:{active:true},select:{id:true,name:true,photoUrl:true}}}});
  if(!t) fail(404,'Estabelecimento não encontrado');
  const {paymentAccount,...publicData}=t;
  const state=billingState(t);
  const {trialStartsAt,trialDays,trialExtensionDays,suspendedAt,subscriptionEndsAt,...safe}=publicData;
  res.json({...safe,paymentAvailable:!!paymentAccount&&mpReady(),bookingEnabled:state.status==='TRIAL'||state.status==='ACTIVE'});
}));
app.get('/api/public/:slug/availability',wrap(async(req,res)=>{
  const params=z.object({serviceId:z.string().uuid(),professionalId:z.string().uuid(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).parse(req.query);
  const t=await db.tenant.findUnique({where:{slug:String(req.params.slug)}});
  if(!t) fail(404,'Estabelecimento não encontrado');
  if(!hasAccess(t)) fail(402,'Este estabelecimento não está recebendo agendamentos no momento.');
  const [s,p]=await Promise.all([
    db.service.findFirst({where:{id:params.serviceId,tenantId:t!.id,active:true}}),
    db.professional.findFirst({where:{id:params.professionalId,tenantId:t!.id,active:true}})
  ]);
  if(!s||!p) fail(404,'Serviço ou profissional não encontrado');
  const today=DateTime.now().setZone(t!.timezone).startOf('day');
  const target=DateTime.fromISO(params.date,{zone:t!.timezone});
  if(!target.isValid||target<today||target>today.plus({days:60})) fail(400,'Escolha uma data nos próximos 60 dias');
  const start=target.startOf('day').toUTC().toJSDate();
  const end=target.plus({days:1}).startOf('day').toUTC().toJSDate();
  const rows=await db.booking.findMany({where:{professionalId:p!.id,startAt:{lt:end},endAt:{gt:start},OR:[{status:{in:['CONFIRMED','COMPLETED']}},{status:'PENDING_PAYMENT',expiresAt:{gt:new Date()}}]},select:{startAt:true,endAt:true}});
  res.json({slots:slotsForDay({date:params.date,timezone:t!.timezone,durationMin:s!.durationMin,schedule:p!.schedule as Schedule,booked:rows})});
}));

const bookingInput=z.object({serviceId:z.string().uuid(),professionalId:z.string().uuid(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.string().regex(timePattern),clientName:z.string().trim().min(2).max(100),clientPhone:phone});
app.post('/api/public/:slug/bookings',wrap(async(req,res)=>{
  const p=bookingInput.parse(req.body);
  const tenant=await db.tenant.findUnique({where:{slug:String(req.params.slug)}});
  if(!tenant) fail(404,'Estabelecimento não encontrado');
  if(!hasAccess(tenant)) fail(402,'Este estabelecimento não está recebendo agendamentos no momento.');
  const [service,prof]=await Promise.all([
    db.service.findFirst({where:{id:p.serviceId,tenantId:tenant!.id,active:true}}),
    db.professional.findFirst({where:{id:p.professionalId,tenantId:tenant!.id,active:true}})
  ]);
  if(!service||!prof) fail(404,'Serviço ou profissional indisponível');
  const startAt=localSlot(p.date,p.time,tenant!.timezone);
  const endAt=DateTime.fromJSDate(startAt).plus({minutes:service!.durationMin}).toJSDate();
  const deposit=depositCents(service!.priceCents,service!.depositMode,service!.depositValue);
  if(deposit>0 && !mpReady()) fail(503,'Pagamentos de sinal ainda não estão configurados. Contate o estabelecimento.');
  if(deposit>0 && !(await db.paymentAccount.findUnique({where:{tenantId:tenant!.id}}))) fail(409,'Este estabelecimento ainda não habilitou o pagamento de sinal');
  const now=new Date();
  const today=DateTime.now().setZone(tenant!.timezone).startOf('day');
  const target=DateTime.fromISO(p.date,{zone:tenant!.timezone});
  if(!target.isValid || target<today || target>today.plus({days:60})) fail(400,'Data fora do período permitido');
  // MongoDB: incrementa um mesmo documento dentro da transação para provocar
  // write conflict entre duas reservas concorrentes do mesmo profissional.
  // Uma transação concorrente só terá sucesso após consultar as reservas novamente.
  // Exige replica set (Atlas fornece isso nativamente).
  const bookOnce = () => db.$transaction(async tx=>{
    await tx.professional.update({
      where: {id: prof!.id},
      data: {bookingRevision: {increment: 1}}
    });
    const overlaps=await tx.booking.findMany({where:{professionalId:prof!.id,startAt:{lt:endAt},endAt:{gt:startAt},OR:[{status:{in:['CONFIRMED','COMPLETED']}},{status:'PENDING_PAYMENT',expiresAt:{gt:now}}]},select:{startAt:true,endAt:true}});
    const choices=slotsForDay({date:p.date,timezone:tenant!.timezone,durationMin:service!.durationMin,schedule:prof!.schedule as Schedule,booked:overlaps,now});
    if(!choices.includes(p.time)) fail(409,'Horário não está mais disponível');
    return tx.booking.create({data:{tenantId:tenant!.id,serviceId:service!.id,professionalId:prof!.id,clientName:p.clientName,clientPhone:p.clientPhone,startAt,endAt,depositCents:deposit,servicePriceCents:service!.priceCents,commissionCents:commissionFor(service!.priceCents,prof!.commissionMode,prof!.commissionValue),status:deposit>0?'PENDING_PAYMENT':'CONFIRMED',expiresAt:deposit>0?new Date(Date.now()+15*60_000):null}});
  },{timeout: 10000, maxWait: 5000});
  let booking: Awaited<ReturnType<typeof bookOnce>> | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { booking = await bookOnce(); break; }
    catch (err) {
      // TransientTransactionError/write conflict do MongoDB: repetir a consulta.
      const message = String((err as Error).message || '');
      const transient = (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034')
        || /WriteConflict|TransientTransactionError|conflict/i.test(message);
      if (!transient || attempt === 2) throw err;
      await new Promise(resolve => setTimeout(resolve, 35 * (attempt + 1)));
    }
  }
  if (!booking) fail(409, 'Não foi possível reservar este horário');
  if(deposit===0){res.status(201).json({id:booking.id,status:booking.status,checkoutUrl:null});return;}
  try {
    const returnUrl=`${env.WEB_URL}/agendamento/${booking.id}`;
    const payer=splitPayerName(p.clientName);
    const preference=await createPreference(tenant!.id,{
      items:[{id:booking.id,title:`Sinal • ${service!.name}`.slice(0,120),description:`Sinal de agendamento: ${service!.name}`.slice(0,250),category_id:'services',quantity:1,currency_id:'BRL',unit_price:deposit/100}],
      external_reference:booking.id,
      payer:{name:payer.firstName,...(payer.lastName?{surname:payer.lastName}:{})},
      back_urls:{success:returnUrl,pending:returnUrl,failure:returnUrl},
      auto_return:'approved',
      notification_url:`${env.API_PUBLIC_URL}/api/payments/webhook/${tenant!.id}`,
      expires:true,expiration_date_from:new Date().toISOString(),expiration_date_to:booking.expiresAt!.toISOString()
    });
    await db.booking.update({where:{id:booking.id},data:{checkoutUrl:preference.init_point,preferenceId:preference.id}});
    res.status(201).json({id:booking.id,status:'PENDING_PAYMENT',checkoutUrl:preference.init_point});
  } catch(e){
    await db.booking.update({where:{id:booking.id},data:{status:'EXPIRED',expiresAt:new Date()}});
    throw e;
  }
}));
app.get('/api/booking-status/:id',wrap(async(req,res)=>{
  const b=await db.booking.findUnique({where:{id:String(req.params.id)},select:{status:true,startAt:true,depositCents:true,paymentStatus:true,checkoutUrl:true,expiresAt:true,tenant:{select:{timezone:true}}}});
  if(!b) fail(404,'Reserva não encontrada');
  const isExpired=b.status==='PENDING_PAYMENT'&&!!b.expiresAt&&b.expiresAt<new Date();
  res.json({...b,status:isExpired?'EXPIRED':b.status,checkoutUrl:isExpired?null:b.checkoutUrl});
}));
// Recuperação manual de webhook perdido: verifica o pagamento diretamente na conta
// OAuth do lojista. Não aceita informações de pagamento fornecidas pelo cliente.
const reconcileLimiter=rateLimit({windowMs:15*60_000,limit:6,standardHeaders:'draft-7',legacyHeaders:false});
app.post('/api/booking-status/:id/reconcile',reconcileLimiter,wrap(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.id);
  const result=await recoverMarketplaceBooking(id);
  if(result.reason==='booking_not_found') fail(404,'Reserva não encontrada');
  const booking=await db.booking.findUnique({where:{id},select:{status:true,paymentStatus:true,depositPaidAt:true}});
  res.json({status:booking?.status||null,paymentStatus:booking?.paymentStatus||null,verified:!!booking?.depositPaidAt,outcome:result.outcome});
}));

// Assinatura da PLATAFORMA: não utiliza o token OAuth individual do lojista.
app.get('/api/billing/status',auth,wrap(async(req,res)=>{
  const t=await myTenant(req);
  const [latest,settings]=await Promise.all([
    db.subscriptionPayment.findFirst({where:{tenantId:t.id},orderBy:{createdAt:'desc'},select:{id:true,status:true,createdAt:true,expiresAt:true}}),
    platformSettings()
  ]);
  res.json({...billingState(t,settings.monthlyPriceCents),latestPayment:latest});
}));
app.post('/api/billing/pix',auth,wrap(async(req,res)=>{
  const tenant=await myTenant(req);
  const data=z.object({document:z.string().transform(x=>x.replace(/\D/g,'')).refine(x=>x.length===11||x.length===14,'Informe CPF ou CNPJ válido'),deviceId:z.preprocess(value=>validDeviceId(value)?value:undefined,z.string().optional())}).strict().parse(req.body);
  if(!tenant.businessType) fail(428,'Atualize o tipo de negócio antes de pagar');
  const contact=await db.user.findUnique({where:{id:req.userId},select:{phone:true}});
  if(!contact || !/^\d{10,13}$/.test(contact.phone||'')) fail(428,'Complete seu cadastro com WhatsApp antes de pagar');
  if(tenant.suspendedAt)fail(403,'Este estabelecimento está suspenso. Contate o administrador.');
  const settings=await platformSettings();
  if(!env.VEZORA_MP_ACCESS_TOKEN||!env.VEZORA_MP_WEBHOOK_SECRET||!env.API_PUBLIC_URL||settings.monthlyPriceCents<100) fail(503,'Pagamento Pix ou mensalidade ainda não configurados pelo administrador do Vezora');
  const activeCard=await db.cardSubscription.findUnique({where:{tenantId:tenant.id},select:{status:true}});
  if(activeCard&&['PENDING','AUTHORIZED','PAUSED','CREATING'].includes(activeCard.status))fail(409,'Existe uma autorização de cartão. Cancele a renovação antes de gerar Pix para evitar cobrança duplicada.');
  const user=await db.user.findUnique({where:{id:req.userId}});
  if(!user) fail(401,'Sessão inválida');
  // A cobrança guarda o valor escolhido pelo admin no momento da emissão;
  // uma alteração posterior nao muda os valores de uma cobrança já emitida.
  let invoice=await db.subscriptionPayment.findFirst({where:{tenantId:tenant.id,status:'PENDING',amountCents:settings.monthlyPriceCents,expiresAt:{gt:new Date(Date.now()+60000)}},orderBy:{createdAt:'desc'}});
  // Rascunhos legados podem estar perto de vencer; não solicitar um Pix ao provedor
  // com validade abaixo do mínimo de 30 minutos documentado pelo Mercado Pago.
  if(invoice && (!invoice.mpPaymentId || !invoice.qrCode) && invoice.expiresAt.getTime()-Date.now()<31*60000){
    invoice=null;
  }
  if(!invoice)invoice=await db.subscriptionPayment.create({data:{tenantId:tenant.id,amountCents:settings.monthlyPriceCents,expiresAt:new Date(Date.now()+45*60000)}});
  if(!invoice.mpPaymentId||!invoice.qrCode){
    const payment=await generatePix(invoice.id,user!.email,invoice.amountCents,data.document,invoice.expiresAt,user!.name,validDeviceId(data.deviceId)?data.deviceId:undefined);
    const tx=payment.point_of_interaction?.transaction_data;
    if(!payment.id||!tx?.qr_code) fail(502,'Mercado Pago não retornou o Pix. Tente novamente.');
    invoice=await db.subscriptionPayment.update({where:{id:invoice.id},data:{mpPaymentId:String(payment.id),qrCode:tx.qr_code,qrCodeBase64:tx.qr_code_base64||'',ticketUrl:tx.ticket_url||''}});
  }
  res.json({invoiceId:invoice.id,amountCents:invoice.amountCents,qrCode:invoice.qrCode,qrCodeBase64:invoice.qrCodeBase64,ticketUrl:invoice.ticketUrl,expiresAt:invoice.expiresAt});
}));
app.post('/api/billing/check/:id',auth,wrap(async(req,res)=>{
  const t=await myTenant(req);
  const invoice=await db.subscriptionPayment.findFirst({where:{tenantId:t.id,id:String(req.params.id)}});
  if(!invoice) fail(404,'Cobrança não encontrada');
  if(invoice.status==='PENDING'&&invoice.mpPaymentId) await reconcileSubscription(invoice.mpPaymentId);
  const updated=await db.tenant.findUniqueOrThrow({where:{id:t.id}});
  const updatedInvoice=await db.subscriptionPayment.findUniqueOrThrow({where:{id:invoice.id}});
  const settings=await platformSettings();
  res.json({paymentStatus:updatedInvoice.status,...billingState(updated,settings.monthlyPriceCents)});
}));

// Cartão recorrente: autorização do cartão é feita no checkout seguro do Mercado Pago.
app.get('/api/billing/card/status',auth,wrap(async(req,res)=>{
  const t=await myTenant(req);res.json(await cardSubscriptionStatus(t.id,true));
}));
app.post('/api/billing/card/start',auth,wrap(async(req,res)=>{
  const t=await myTenant(req);
  if(t.suspendedAt)fail(403,'Estabelecimento suspenso.');
  if(!t.businessType)fail(428,'Complete o cadastro antes de assinar.');
  const owner=await db.user.findUnique({where:{id:req.userId},select:{email:true,phone:true}});
  if(!owner||!owner.phone)fail(428,'Informe WhatsApp no cadastro.');
  const s=await platformSettings();
  if(s.monthlyPriceCents<100)fail(503,'Defina a mensalidade no painel do administrador.');
  const pendingPix=await db.subscriptionPayment.findFirst({where:{tenantId:t.id,status:'PENDING',expiresAt:{gt:new Date()}},select:{id:true}});
  if(pendingPix)fail(409,'Há um Pix pendente. Aguarde seu vencimento antes de cadastrar cartão.');
  const created=await startCardSubscription(t.id,owner.email,s.monthlyPriceCents);
  res.json(created);
}));
app.post('/api/billing/card/cancel',auth,wrap(async(req,res)=>{
  const t=await myTenant(req);await cancelCardSubscription(t.id);res.json({ok:true});
}));
app.post('/api/billing/webhook',wrap(async(req,res)=>{
  const dataId=String(req.query['data.id']||'');
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(dataId)||!verifyBillingWebhook(String(req.headers['x-signature']||''),String(req.headers['x-request-id']||''),dataId))fail(401,'Assinatura inválida');
  const type=String(req.query.type||req.body?.type||'');
  if(type==='payment'&&/^\d{1,24}$/.test(dataId))await reconcileSubscription(dataId);
  if(type==='subscription_authorized_payment'&&/^\d{1,24}$/.test(dataId))await reconcileCardInvoice(dataId);
  if(type==='subscription_preapproval')await updateCardSubscriptionFromProvider(dataId);
  res.json({received:true});
}));

app.get('/api/payments/status',auth,subscriptionGuard,wrap(async(req,res)=>{
  const t=await myTenant(req);
  const a=await db.paymentAccount.findUnique({where:{tenantId:t.id},select:{sellerUserId:true,expiresAt:true,updatedAt:true}});
  res.json({connected:!!a,sellerUserId:a?.sellerUserId,configured:mpReady()});
}));
app.post('/api/payments/connect',auth,subscriptionGuard,wrap(async(req,res)=>{
  if(!mpReady()) fail(503,'Configure a integração Mercado Pago no ambiente da API');
  const t=await myTenant(req);
  const state=rand(32),verifier=rand(48);
  const challenge=Buffer.from(sha256(verifier),'hex').toString('base64url');
  await db.oAuthState.create({data:{tenantId:t.id,stateHash:sha256(state),encryptedVerifier:encrypt(verifier),expiresAt:new Date(Date.now()+10*60_000)}});
  const q=new URLSearchParams({client_id:env.MP_CLIENT_ID,response_type:'code',platform_id:'mp',state,redirect_uri:env.MP_REDIRECT_URI,code_challenge:challenge,code_challenge_method:'S256'});
  res.json({url:`https://auth.mercadopago.com/authorization?${q.toString()}`});
}));
app.get('/api/payments/callback',wrap(async(req,res)=>{
  const {code,state,error}=req.query;
  if(error||typeof code!=='string'||typeof state!=='string') return res.redirect(`${env.WEB_URL}/painel?mp=error`);
  const record=await db.oAuthState.findUnique({where:{stateHash:sha256(state)}});
  if(!record||record.expiresAt<new Date()) return res.redirect(`${env.WEB_URL}/painel?mp=expired`);
  await db.oAuthState.delete({where:{id:record.id}});
  try{
    const token=await exchangeCode(code,decrypt(record.encryptedVerifier));
    await db.paymentAccount.upsert({where:{tenantId:record.tenantId},create:{tenantId:record.tenantId,sellerUserId:String(token.user_id),encryptedToken:encrypt(token.access_token),encryptedRefresh:encrypt(token.refresh_token),expiresAt:new Date(Date.now()+token.expires_in*1000)},update:{sellerUserId:String(token.user_id),encryptedToken:encrypt(token.access_token),encryptedRefresh:encrypt(token.refresh_token),expiresAt:new Date(Date.now()+token.expires_in*1000)}});
    res.redirect(`${env.WEB_URL}/painel?mp=connected`);
  }catch(e){console.error('OAuth callback failed',e);res.redirect(`${env.WEB_URL}/painel?mp=error`);}
}));
app.delete('/api/payments/connect',auth,subscriptionGuard,wrap(async(req,res)=>{
  const t=await myTenant(req);
  // Não descartar a credencial enquanto uma transação recente pode
  // precisar de confirmação automática ou de conciliação manual.
  const unsettled=await db.booking.count({where:{tenantId:t.id,OR:[
    {status:'PENDING_PAYMENT',createdAt:{gte:new Date(Date.now()-24*60*60_000)}},
    {status:'NEEDS_REVIEW'}
  ]}});
  if(unsettled>0) fail(409,'Existem pagamentos recentes pendentes ou em revisão. Resolva-os antes de desconectar o Mercado Pago.');
  await db.paymentAccount.deleteMany({where:{tenantId:t.id}});
  res.json({ok:true});
}));
// Webhooks externos não usam cookie de lojista. A assinatura HMAC é obrigatória.
// A confirmação é SEMPRE feita por consulta autenticada ao Mercado Pago, com validação
// do recebedor, da referência e do valor antes de modificar uma reserva.
async function marketplaceWebhook(req: Authed,res: Response, tenantId?: string) {
  const dataId=String(req.query['data.id']||'');
  if(!validMpWebhook(String(req.headers['x-signature']||''),String(req.headers['x-request-id']||''),dataId)) fail(401,'Assinatura inválida');
  if(req.query.type!=='payment' && req.body?.type!=='payment') {res.status(200).json({received:true});return;}
  if(!/^\d{1,24}$/.test(dataId)) {res.status(200).json({received:true});return;}
  try {
    // user_id é apenas uma pista para encontrar a conta do vendedor no webhook genérico.
    // A titularidade real é conferida novamente na API do Mercado Pago.
    const sellerId=req.body?.user_id==null?undefined:String(req.body.user_id);
    const results=await reconcileMarketplaceWebhook(dataId,sellerId,tenantId);
    console.info('Webhook Marketplace processado', {route:tenantId?'tenant':'generic',outcomes:results.map(r=>r.outcome),statuses:results.map(r=>r.status||r.reason)});
    // Não confirmar entrega de notificação que não pôde identificar o vendedor.
    // Retornar 503 permite novas tentativas em caso de problema temporário.
    if(results.some(r=>r.outcome==='not_found')) {res.status(503).json({received:false});return;}
    res.status(200).json({received:true});
  } catch(e) {
    console.error('Falha ao reconciliar webhook Marketplace',e);
    res.status(503).json({error:'Conciliação indisponível; reenvie o evento'});
  }
}
app.post('/api/payments/webhook',wrap(async(req,res)=>marketplaceWebhook(req,res)));
app.post('/api/payments/webhook/:tenantId',wrap(async(req,res)=>marketplaceWebhook(req,res,String(req.params.tenantId))));

// A role e consultada no banco a cada chamada administrativa.
app.use('/api/admin',auth,(req:Authed,_res,next)=>{
  void db.user.findUnique({where:{id:req.userId},select:{role:true}}).then(user=>{
    if(!user || user.role!=='SUPERADMIN') return next(Object.assign(new Error('Acesso restrito ao superadministrador'),{status:403}));
    next();
  }).catch(next);
},adminRouter);

// Rotas financeiras do lojista precisam de sessão e assinatura ativa.
// Monte este router DEPOIS dos callbacks OAuth, webhooks e APIs públicas.
// Se montado antes, auth bloqueia /api/payments/callback e /api/payments/webhook.
app.use('/api',auth,subscriptionGuard,financialRoutes);

app.use('/api',(_req,res)=>res.status(404).json({error:'Rota da API nao encontrada. Confirme a versao do backend implantada no Heroku.'}));

app.use((err:unknown,req:Request,res:Response,_next:NextFunction)=>{
  if(res.headersSent)return;
  const requestId = /^[a-zA-Z0-9-]{8,80}$/.test(req.get('x-request-id')||'')
    ? req.get('x-request-id')! : randomUUID();
  res.setHeader('x-request-id',requestId);
  if(err instanceof ZodError){res.status(400).json({error:err.issues.map(e=>e.message).join('; ')});return;}
  if(err instanceof Prisma.PrismaClientKnownRequestError && err.code==='P2002'){res.status(409).json({error:'Já existe um registro com esses dados'});return;}
  if(err instanceof Prisma.PrismaClientKnownRequestError && err.code==='P2034'){res.status(409).json({error:'Conflito de agendamento. Tente novamente'});return;}
  const e=err as {status?:number,message?:string,code?:string,name?:string};
  const status=e.status&&e.status>=400&&e.status<600?e.status:500;
  if(status===500){
    // Sem cookies, corpos HTTP, chaves de API ou senhas nos logs.
    console.error('[Vezora API]',JSON.stringify({requestId,route:req.originalUrl.split('?')[0],method:req.method,prismaCode:e.code||null,errorName:e.name||'Error'}));
    console.error(err);
  }
  res.status(status).json({error:status===500?'Erro interno ao consultar os dados. Confira os logs do Heroku.':e.message,requestId});
});

// No Heroku, somente sinaliza prontidão após verificar acesso ao MongoDB.
void db.$connect().then(() => {
  const server = app.listen(env.PORT, () => console.log(`Vezora API pronta na porta ${env.PORT}`));
  process.on('SIGTERM', () => {
    server.close(() => { void db.$disconnect().finally(() => process.exit(0)); });
  });
}).catch(error => {
  console.error('Falha de conexão com MongoDB. Confira MONGODB_URI, banco na URL, usuário, senha, replica set e Network Access do Atlas. Tipo:', error instanceof Error ? error.name : 'desconhecido');
  process.exit(1);
});
