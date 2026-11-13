/** Migração aditiva para documentos anteriores a v0.7. Não apaga campos. */
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
async function fill(collection,field,value){
  const result=await db.$runCommandRaw({update:collection,updates:[{q:{[field]:{$exists:false}},u:{$set:{[field]:value}},multi:true}]});
  console.log(`${collection}.${field}:`,result.nModified??result.n??'ok');
}
async function main(){
  await fill('Professional','role','EMPLOYEE');
  await fill('Professional','salaryEnabled',false);
  await fill('Professional','salaryCents',0);
  await fill('Professional','commissionMode','NONE');
  await fill('Professional','commissionValue',0);
  await fill('Booking','receiptRevision',0);
  console.log('Backfill v0.7 concluído; valores históricos de preço/comissão NÃO foram inventados.');
}
main().catch(e=>{console.error('Falha no backfill:',e.message);process.exitCode=1}).finally(()=>db.$disconnect());
