/** Normaliza dados anteriores a v0.7 sem sobrescrever configuracoes existentes. */
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
async function fill(collection,field,value){
 const result=await db.$runCommandRaw({update:collection,updates:[{q:{$or:[{[field]:{$exists:false}},{[field]:null}]},u:{$set:{[field]:value}},multi:true}]});
 console.log(`${collection}.${field}:`,result.nModified??result.n??'concluido');
}
async function main(){
 await fill('Professional','role','EMPLOYEE');
 await fill('Professional','salaryEnabled',false);
 await fill('Professional','salaryCents',0);
 await fill('Professional','commissionMode','NONE');
 await fill('Professional','commissionValue',0);
 await fill('Booking','receiptRevision',0);
 await fill('SubscriptionPayment','paymentMethod','PIX');
 console.log('Backfill financeiro concluido. Valores existentes foram preservados.');
}
main().catch(err=>{console.error('Backfill falhou:',err.message);process.exitCode=1}).finally(()=>db.$disconnect());
