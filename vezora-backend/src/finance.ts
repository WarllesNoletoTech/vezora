/** Regras financeiras puras: valores sempre em centavos, sem arredondamento flutuante. */
export type CommissionModeValue = 'NONE' | 'PERCENT' | 'FIXED';
export function commissionFor(priceCents: number, mode: CommissionModeValue, value: number): number {
  if (!Number.isInteger(priceCents) || priceCents < 0 || !Number.isInteger(value) || value < 0) throw new Error('Valores inválidos para comissão');
  if (mode === 'NONE') return 0;
  if (mode === 'PERCENT') {
    if (value > 100) throw new Error('Comissão percentual superior a 100%');
    return Math.round(priceCents * value / 100);
  }
  return value; // remuneração fixa por atendimento, independente do preço
}
export type ReceiptRow = {id:string;amountCents:number;method:string;note:string;createdAt:Date;voidedAt:Date|null;voidReason:string|null};
export type FinancialBookingRow = {
  id:string; startAt:Date; status:string; clientName:string;
  servicePriceCents:number|null; commissionCents:number|null;
  paymentStatus:string|null; depositCents:number; depositPaidAt:Date|null;
  service:{id:string;name:string;priceCents:number};
  professional:{id:string;name:string;commissionMode:CommissionModeValue;commissionValue:number};
  receipts:ReceiptRow[];
};
export type FinancialProRow = {id:string;name:string;role:string;salaryEnabled:boolean;salaryCents:number;commissionMode:CommissionModeValue;commissionValue:number};
export function financialSummary(bookings:FinancialBookingRow[], pros:FinancialProRow[]) {
  const totals = {
    completed:0, cancelled:0, confirmed:0, pending:0,
    completedRevenueCents:0, scheduledRevenueCents:0, depositsConfirmedCents:0, manualReceivedCents:0,
    collectedCents:0, outstandingCents:0, commissionsCents:0, monthlySalariesCents:0,
    legacyUnpricedCount:0, legacyCommissionCount:0
  };
  const methods = new Map<string,number>();
  const byService=new Map<string,{id:string;name:string;count:number;revenueCents:number}>();
  const byProfessional=new Map<string,{id:string;name:string;count:number;revenueCents:number;commissionCents:number}>();
  const lines: {id:string;startAt:Date;clientName:string;serviceName:string;professionalName:string;status:string;priceCents:number;receivedCents:number;dueCents:number;commissionCents:number;receipts:ReceiptRow[]}[]=[];
  for(const b of bookings){
    if(b.status==='CANCELLED')totals.cancelled++;
    if(b.status==='CONFIRMED')totals.confirmed++;
    if(b.status==='PENDING_PAYMENT')totals.pending++;
    const price=b.servicePriceCents??b.service.priceCents;
    if(b.status==='CONFIRMED')totals.scheduledRevenueCents+=price;
    if(b.status!=='COMPLETED')continue;
    totals.completed++;
    totals.completedRevenueCents+=price;
    if(b.servicePriceCents===null)totals.legacyUnpricedCount++;
    if(b.commissionCents===null)totals.legacyCommissionCount++;
    const commission=b.commissionCents??commissionFor(price,b.professional.commissionMode,b.professional.commissionValue);
    totals.commissionsCents+=commission;
    const paidDeposit=b.paymentStatus==='approved'?b.depositCents:0;
    const receipts=b.receipts.filter(r=>!r.voidedAt);
    const collectedManual=receipts.reduce((acc,r)=>acc+r.amountCents,0);
    for(const receipt of receipts)methods.set(receipt.method,(methods.get(receipt.method)||0)+receipt.amountCents);
    totals.depositsConfirmedCents+=paidDeposit;
    totals.manualReceivedCents+=collectedManual;
    const collected=paidDeposit+collectedManual;
    const due=Math.max(0,price-collected);
    totals.outstandingCents+=due;
    const svc=byService.get(b.service.id)||{id:b.service.id,name:b.service.name,count:0,revenueCents:0};
    svc.count++;svc.revenueCents+=price;byService.set(b.service.id,svc);
    const pro=byProfessional.get(b.professional.id)||{id:b.professional.id,name:b.professional.name,count:0,revenueCents:0,commissionCents:0};
    pro.count++;pro.revenueCents+=price;pro.commissionCents+=commission;byProfessional.set(b.professional.id,pro);
    lines.push({id:b.id,startAt:b.startAt,clientName:b.clientName,serviceName:b.service.name,professionalName:b.professional.name,status:b.status,priceCents:price,receivedCents:collected,dueCents:due,commissionCents:commission,receipts:b.receipts});
  }
  totals.collectedCents=totals.depositsConfirmedCents+totals.manualReceivedCents;
  totals.monthlySalariesCents=pros.filter(p=>p.salaryEnabled).reduce((sum,p)=>sum+p.salaryCents,0);
  return {
    totals,
    byService:[...byService.values()].sort((a,b)=>b.revenueCents-a.revenueCents),
    byProfessional:[...byProfessional.values()].sort((a,b)=>b.revenueCents-a.revenueCents),
    byMethod:[...methods.entries()].map(([method,amountCents])=>({method,amountCents})).sort((a,b)=>b.amountCents-a.amountCents),
    lines:lines.sort((a,b)=>b.startAt.getTime()-a.startAt.getTime()),
    payroll:pros.map(p=>({id:p.id,name:p.name,role:p.role,salaryEnabled:p.salaryEnabled,salaryCents:p.salaryCents,commissionMode:p.commissionMode,commissionValue:p.commissionValue}))
  };
}
