import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma, BookingStatus, DepositMode } from '@prisma/client';
import { z, ZodError } from 'zod';
import { DateTime } from 'luxon';
import { db } from './db';
import { env } from './env';
import { DEFAULT_SCHEDULE, depositCents, localSlot, phoneDigits, slotsForDay, Schedule } from './core';
import { decrypt, encrypt, rand, sha256 } from './crypto';
import { createPreference, exchangeCode, getPayment, mpReady, validMpWebhook } from './mp';

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
    const payload = jwt.verify(req.cookies?.vezora_session || '',env.JWT_SECRET) as jwt.JwtPayload;
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
const slug = z.string().trim().min(3).max(45).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const phone = z.string().transform(phoneDigits).pipe(z.string().min(10).max(13));
const accountData = z.object({name,email:z.string().trim().toLowerCase().email(),password:z.string().min(8).max(128)});

app.get('/',(_req,res)=>res.json({name:'Vezora API',status:'online',health:'/api/health'}));
app.get('/api/health',(_req,res)=>res.json({status:'ok',name:'Vezora API'}));
app.post('/api/auth/register',wrap(async(req,res)=>{
  const body=accountData.extend({business:name,slug}).parse(req.body);
  const hash=await bcrypt.hash(body.password,12);
  const user=await db.$transaction(async tx=>{
    const user=await tx.user.create({data:{name:body.name,email:body.email,passwordHash:hash}});
    const tenant=await tx.tenant.create({data:{name:body.business,slug:body.slug,ownerId:user.id}});
    await tx.professional.create({data:{tenantId:tenant.id,name:body.name,schedule:DEFAULT_SCHEDULE}});
    return user;
  });
  session(res,user.id); res.status(201).json({ok:true});
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
  const user=await db.user.findUnique({where:{id:req.userId},select:{id:true,name:true,email:true}});
  const tenant=await myTenant(req);
  res.json({user,tenant});
}));
app.patch('/api/tenant',auth,wrap(async(req,res)=>{
  const tenant=await myTenant(req);
  const update=z.object({
    name:name.optional(),bio:z.string().max(400).optional(),
    whatsapp:z.string().max(22).optional(),instagram:z.string().max(120).optional(),
    address:z.string().max(240).optional(),logoUrl:cleanUrl.optional(),coverUrl:cleanUrl.optional(),
    primaryColor:hex.optional(),secondaryColor:hex.optional(),
    timezone:z.enum(['America/Sao_Paulo','America/Belem','America/Manaus','America/Cuiaba','America/Recife','America/Fortaleza','America/Rio_Branco']).optional()
  }).strict().parse(req.body);
  res.json(await db.tenant.update({where:{id:tenant.id},data:update}));
}));

const serviceInput=z.object({name,description:z.string().max(500).default(''),priceCents:z.number().int().min(0).max(10_000_000),durationMin:z.number().int().min(15).max(720),depositMode:z.nativeEnum(DepositMode).default('NONE'),depositValue:z.number().int().min(0).max(10_000_000).default(0),active:z.boolean().default(true)}).refine(v=>v.depositMode!=='PERCENT'||v.depositValue<=100,{message:'Percentual não pode superar 100%'}).refine(v=>v.depositMode!=='FIXED'||v.depositValue<=v.priceCents,{message:'Sinal maior que o valor do serviço'});
app.get('/api/services',auth,wrap(async(req,res)=>{const t=await myTenant(req);res.json(await db.service.findMany({where:{tenantId:t.id},orderBy:{createdAt:'desc'}}));}));
app.post('/api/services',auth,wrap(async(req,res)=>{const t=await myTenant(req);res.status(201).json(await db.service.create({data:{...serviceInput.parse(req.body),tenantId:t.id}}));}));
app.patch('/api/services/:id',auth,wrap(async(req,res)=>{
  const t=await myTenant(req);
  const old=await db.service.findFirst({where:{tenantId:t.id,id:String(req.params.id)}});
  if(!old) fail(404,'Serviço não encontrado');
  const body=serviceInput.parse({...old,...req.body});
  res.json(await db.service.update({where:{id:old!.id},data:body}));
}));
const timePattern=/^([01]\d|2[0-3]):[0-5]\d$/;
const workday=z.union([z.null(),z.tuple([z.string().regex(timePattern),z.string().regex(timePattern)]).refine(v=>v[1]>v[0],'Intervalo inválido')]);
const scheduleSchema=z.record(z.enum(['0','1','2','3','4','5','6']),workday);
const proInput=z.object({name,photoUrl:cleanUrl.default(''),schedule:scheduleSchema.default(DEFAULT_SCHEDULE),active:z.boolean().default(true)});
app.get('/api/professionals',auth,wrap(async(req,res)=>{const t=await myTenant(req);res.json(await db.professional.findMany({where:{tenantId:t.id},orderBy:{name:'asc'}}));}));
app.post('/api/professionals',auth,wrap(async(req,res)=>{const t=await myTenant(req);const v=proInput.parse(req.body);res.status(201).json(await db.professional.create({data:{...v,tenantId:t.id}}));}));
app.patch('/api/professionals/:id',auth,wrap(async(req,res)=>{
  const t=await myTenant(req);
  const pro=await db.professional.findFirst({where:{id:String(req.params.id),tenantId:t.id}});
  if(!pro) fail(404,'Profissional não encontrado');
  const v=proInput.parse({...pro,...req.body});
  res.json(await db.professional.update({where:{id:pro!.id},data:v}));
}));
app.get('/api/bookings',auth,wrap(async(req,res)=>{
  const t=await myTenant(req);
  const rows=await db.booking.findMany({where:{tenantId:t.id,startAt:{gte:DateTime.utc().minus({days:30}).toJSDate()}},include:{service:{select:{name:true,priceCents:true}},professional:{select:{name:true}}},orderBy:{startAt:'asc'},take:250});
  res.json(rows);
}));
app.patch('/api/bookings/:id',auth,wrap(async(req,res)=>{
  const t=await myTenant(req);
  const b=await db.booking.findFirst({where:{tenantId:t.id,id:String(req.params.id)}});
  if(!b) fail(404,'Reserva não encontrada');
  const {status}=z.object({status:z.enum(['COMPLETED','CANCELLED'])}).parse(req.body);
  if(b!.status!=='CONFIRMED') fail(409,'Somente reservas confirmadas podem ser encerradas ou canceladas');
  res.json(await db.booking.update({where:{id:b!.id},data:{status}}));
}));

app.get('/api/public/:slug',wrap(async(req,res)=>{
  const t=await db.tenant.findUnique({where:{slug:String(req.params.slug)},select:{id:true,name:true,slug:true,bio:true,whatsapp:true,instagram:true,address:true,logoUrl:true,coverUrl:true,primaryColor:true,secondaryColor:true,timezone:true,services:{where:{active:true},select:{id:true,name:true,description:true,priceCents:true,durationMin:true,depositMode:true,depositValue:true}},professionals:{where:{active:true},select:{id:true,name:true,photoUrl:true}}}});
  if(!t) fail(404,'Estabelecimento não encontrado');
  res.json(t);
}));
app.get('/api/public/:slug/availability',wrap(async(req,res)=>{
  const params=z.object({serviceId:z.string().uuid(),professionalId:z.string().uuid(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).parse(req.query);
  const t=await db.tenant.findUnique({where:{slug:String(req.params.slug)}});
  if(!t) fail(404,'Estabelecimento não encontrado');
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
  const [service,prof]=await Promise.all([
    db.service.findFirst({where:{id:p.serviceId,tenantId:tenant!.id,active:true}}),
    db.professional.findFirst({where:{id:p.professionalId,tenantId:tenant!.id,active:true}})
  ]);
  if(!service||!prof) fail(404,'Serviço ou profissional indisponível');
  const startAt=localSlot(p.date,p.time,tenant!.timezone);
  const endAt=DateTime.fromJSDate(startAt).plus({minutes:service!.durationMin}).toJSDate();
  const deposit=depositCents(service!.priceCents,service!.depositMode,service!.depositValue);
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
    return tx.booking.create({data:{tenantId:tenant!.id,serviceId:service!.id,professionalId:prof!.id,clientName:p.clientName,clientPhone:p.clientPhone,startAt,endAt,depositCents:deposit,status:deposit>0?'PENDING_PAYMENT':'CONFIRMED',expiresAt:deposit>0?new Date(Date.now()+15*60_000):null}});
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
    const preference=await createPreference(tenant!.id,{
      items:[{id:booking.id,title:`Sinal • ${service!.name}`,quantity:1,currency_id:'BRL',unit_price:deposit/100}],
      external_reference:booking.id,
      payer:{name:p.clientName},
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
  const b=await db.booking.findUnique({where:{id:String(req.params.id)},select:{status:true,startAt:true,depositCents:true,paymentStatus:true,checkoutUrl:true,expiresAt:true}});
  if(!b) fail(404,'Reserva não encontrada');
  const isExpired=b.status==='PENDING_PAYMENT'&&!!b.expiresAt&&b.expiresAt<new Date();
  res.json({...b,status:isExpired?'EXPIRED':b.status,checkoutUrl:isExpired?null:b.checkoutUrl});
}));

app.get('/api/payments/status',auth,wrap(async(req,res)=>{
  const t=await myTenant(req);
  const a=await db.paymentAccount.findUnique({where:{tenantId:t.id},select:{sellerUserId:true,expiresAt:true,updatedAt:true}});
  res.json({connected:!!a,sellerUserId:a?.sellerUserId,configured:mpReady()});
}));
app.post('/api/payments/connect',auth,wrap(async(req,res)=>{
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
app.delete('/api/payments/connect',auth,wrap(async(req,res)=>{
  const t=await myTenant(req);
  await db.paymentAccount.deleteMany({where:{tenantId:t.id}});
  res.json({ok:true});
}));
app.post('/api/payments/webhook/:tenantId',wrap(async(req,res)=>{
  // A assinatura usa o data.id do querystring, nunca apenas o body enviado por terceiros.
  const dataId=String(req.query['data.id']||'');
  if(!validMpWebhook(String(req.headers['x-signature']||''),String(req.headers['x-request-id']||''),dataId)) fail(401,'Assinatura inválida');
  if(req.query.type!=='payment' && req.body?.type!=='payment') {res.status(200).json({received:true});return;}
  if(!/^\d{1,24}$/.test(dataId)) {res.status(200).json({received:true});return;}
  try{
    const t=await db.tenant.findUnique({where:{id:String(req.params.tenantId)},include:{paymentAccount:true}});
    if(!t?.paymentAccount) {res.status(200).json({received:true});return;}
    const payment=await getPayment(t.id,dataId);
    if(String(payment.collector_id)!==t.paymentAccount.sellerUserId) {res.status(200).json({received:true});return;}
    const booking=await db.booking.findFirst({where:{id:payment.external_reference,tenantId:t.id}});
    if(!booking||!booking.depositCents||Math.abs(payment.transaction_amount*100-booking.depositCents)>1) {res.status(200).json({received:true});return;}
    await db.$transaction(async tx=>{
      const current=await tx.booking.findUnique({where:{id:booking.id}});
      if(!current) return;
      const amountMatches=Math.abs(payment.transaction_amount*100-current.depositCents)<=1;
      if(!amountMatches) return;
      const paid=payment.status==='approved';
      // Não deixar uma segunda tentativa recusada sobrescrever o pagamento aprovado.
      if(current.paymentStatus==='approved' && current.mpPaymentId!==String(payment.id) && !paid) return;
      let status:BookingStatus=current.status;
      if(paid && current.status==='PENDING_PAYMENT') status=current.expiresAt && current.expiresAt<new Date()?'NEEDS_REVIEW':'CONFIRMED';
      else if(paid && ['EXPIRED','CANCELLED'].includes(current.status)) status='NEEDS_REVIEW';
      else if(paid && current.paymentStatus==='approved' && current.mpPaymentId && current.mpPaymentId!==String(payment.id)) status='NEEDS_REVIEW';
      else if(['cancelled','refunded','charged_back'].includes(payment.status) && ['CONFIRMED','COMPLETED'].includes(current.status) && current.mpPaymentId===String(payment.id)) status='NEEDS_REVIEW';
      await tx.booking.update({where:{id:current.id},data:{status,paymentStatus:payment.status,mpPaymentId:String(payment.id)}});
    });
    res.status(200).json({received:true});
  }catch(e){console.error('Falha ao reconciliar webhook do MP',e);res.status(503).json({error:'Conciliação indisponível; reenvie o evento'});}
}));

app.use('/api',(_req,res)=>res.status(404).json({error:'Rota da API nao encontrada. Confirme a versao do backend implantada no Heroku.'}));

app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{
  if(res.headersSent)return;
  if(err instanceof ZodError){res.status(400).json({error:err.issues.map(e=>e.message).join('; ')});return;}
  if(err instanceof Prisma.PrismaClientKnownRequestError && err.code==='P2002'){res.status(409).json({error:'Já existe um registro com esses dados'});return;}
  if(err instanceof Prisma.PrismaClientKnownRequestError && err.code==='P2034'){res.status(409).json({error:'Conflito de agendamento. Tente novamente'});return;}
  const e=err as {status?:number,message?:string};
  const status=e.status&&e.status>=400&&e.status<600?e.status:500;
  if(status===500)console.error(err);
  res.status(status).json({error:status===500?'Erro interno. Tente novamente.':e.message});
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
