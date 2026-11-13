import {Router, Request, Response, NextFunction} from 'express';
import {ReceiptMethod} from '@prisma/client';
import {DateTime} from 'luxon';
import {z} from 'zod';
import {db} from './db';
import {financialSummary} from './finance';
import {renderFinancialPdf} from './financePdf';

export const financialRoutes=Router();
const run=(fn:(req:Request,res:Response)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>Promise.resolve(fn(req,res)).catch(next);
function fail(status:number,message:string):never {throw Object.assign(new Error(message),{status});}
async function tenantOf(req:Request){
  const tenant=await db.tenant.findUnique({where:{ownerId:(req as Request&{userId?:string}).userId!}});
  if(!tenant)fail(404,'Estabelecimento não encontrado');
  return tenant;
}
const range=z.object({from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict();
async function reportData(req:Request){
  const tenant=await tenantOf(req);
  const params=range.parse(req.query);
  const from=DateTime.fromISO(params.from,{zone:tenant.timezone}).startOf('day');
  const to=DateTime.fromISO(params.to,{zone:tenant.timezone}).startOf('day');
  if(!from.isValid||!to.isValid||from.toMillis()>to.toMillis()||to.diff(from,'days').days>366)fail(400,'Informe um período válido de até 366 dias');
  const where={tenantId:tenant.id,startAt:{gte:from.toUTC().toJSDate(),lt:to.plus({days:1}).toUTC().toJSDate()}};
  // Não apresentar relatórios truncados sem aviso.
  const [bookings,pros]=await Promise.all([
    db.booking.findMany({where,include:{service:{select:{id:true,name:true,priceCents:true}},professional:{select:{id:true,name:true,commissionMode:true,commissionValue:true}},receipts:{select:{id:true,amountCents:true,method:true,note:true,createdAt:true,voidedAt:true,voidReason:true}}},orderBy:{startAt:'desc'},take:5001}),
    db.professional.findMany({where:{tenantId:tenant.id,active:true},select:{id:true,name:true,role:true,salaryEnabled:true,salaryCents:true,commissionMode:true,commissionValue:true}})
  ]);
  if(bookings.length>5000)fail(422,'O período contém mais de 5.000 reservas. Selecione um intervalo menor.');
  return {tenant:{id:tenant.id,name:tenant.name,slug:tenant.slug,timezone:tenant.timezone},period:params,generatedAt:new Date(),...financialSummary(bookings,pros)};
}
financialRoutes.get('/reports/financial',run(async(req,res)=>{res.json(await reportData(req));}));
financialRoutes.get('/reports/financial.pdf',run(async(req,res)=>{
  const data=await reportData(req);
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`attachment; filename="vezora-relatorio-${data.period.from}-${data.period.to}.pdf"`);
  res.setHeader('Cache-Control','private, no-store');
  renderFinancialPdf(res,data);
}));
const receiptInput=z.object({amountCents:z.number().int().positive().max(10_000_000),method:z.nativeEnum(ReceiptMethod),note:z.string().trim().max(140).default('')}).strict();
financialRoutes.post('/bookings/:id/receipts',run(async(req,res)=>{
  const tenant=await tenantOf(req);
  const input=receiptInput.parse(req.body);
  const created=await db.$transaction(async tx=>{
    // Atualização serializa lançamentos concorrentes sobre a mesma reserva.
    const booking=await tx.booking.findFirst({where:{id:String(req.params.id),tenantId:tenant.id},include:{service:{select:{priceCents:true}},receipts:{select:{amountCents:true,voidedAt:true}}}});
    if(!booking)fail(404,'Reserva não encontrada');
    if(booking.status!=='COMPLETED')fail(409,'Conclua o atendimento antes de registrar recebimentos no estabelecimento');
    await tx.booking.update({where:{id:booking.id},data:{receiptRevision:{increment:1}}});
    const gross=booking.servicePriceCents??booking.service.priceCents;
    const deposit=booking.paymentStatus==='approved'?booking.depositCents:0;
    const manual=booking.receipts.filter(r=>!r.voidedAt).reduce((sum,r)=>sum+r.amountCents,0);
    if(input.amountCents>gross-deposit-manual)fail(409,'O lançamento supera o saldo não recebido do atendimento');
    return tx.bookingReceipt.create({data:{tenantId:tenant.id,bookingId:booking.id,amountCents:input.amountCents,method:input.method,note:input.note,recordedById:(req as Request&{userId?:string}).userId!}});
  });
  res.status(201).json(created);
}));
financialRoutes.patch('/bookings/:id/receipts/:receiptId/void',run(async(req,res)=>{
  const tenant=await tenantOf(req);
  const input=z.object({reason:z.string().trim().min(8).max(200)}).strict().parse(req.body);
  await db.$transaction(async tx=>{
    const booking=await tx.booking.findFirst({where:{tenantId:tenant.id,id:String(req.params.id)},select:{id:true}});
    if(!booking)fail(404,'Reserva não encontrada');
    await tx.booking.update({where:{id:booking.id},data:{receiptRevision:{increment:1}}});
    const result=await tx.bookingReceipt.updateMany({where:{id:String(req.params.receiptId),tenantId:tenant.id,bookingId:booking.id,voidedAt:null},data:{voidedAt:new Date(),voidReason:input.reason}});
    if(result.count!==1)fail(404,'Lançamento inexistente ou já estornado');
  });
  res.json({ok:true});
}));
