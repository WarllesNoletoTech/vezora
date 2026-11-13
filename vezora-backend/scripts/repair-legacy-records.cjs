/**
 * Vezora / MongoDB — correção ADITIVA de campos obrigatórios ausentes.
 * Modo padrão: somente diagnóstico. Para aplicar: --apply.
 * Não remove coleções, não cria receitas nem altera valores existentes.
 * Faz backup do banco antes de executar --apply em produção.
 */
const {PrismaClient} = require('@prisma/client');
const db = new PrismaClient();
const apply = process.argv.includes('--apply');
const specs = [
  ['Tenant', {
    bio:'', whatsapp:'', instagram:'', address:'', logoUrl:'', coverUrl:'',
    primaryColor:'#8F5176', secondaryColor:'#211925', timezone:'America/Sao_Paulo'
  }],
  ['Service', {description:'', depositMode:'NONE', depositValue:0, active:true}],
  ['Professional', {
    photoUrl:'', active:true, bookingRevision:0, role:'EMPLOYEE', salaryEnabled:false,
    salaryCents:0, commissionMode:'NONE', commissionValue:0
  }],
  ['Booking', {depositCents:0, receiptRevision:0}],
  ['SubscriptionPayment', {paymentMethod:'PIX', qrCode:'', qrCodeBase64:'', ticketUrl:''}]
];
async function run() {
  console.log(`Vezora — verificação de documentos antigos (${apply?'APLICAR':'SIMULAÇÃO'})`);
  let missing = 0, updated = 0;
  for (const [collection, fields] of specs) {
    for (const [field, value] of Object.entries(fields)) {
      const query = {$or:[{[field]:{$exists:false}},{[field]:null}]};
      const count = await db.$runCommandRaw({count:collection,query});
      if (!Number.isFinite(count.n)) throw Error(`Não foi possível ler a contagem de ${collection}.${field}`);
      if (count.n === 0) continue;
      console.log(`${collection}.${field}: ${count.n} documento(s) sem o campo`);
      missing += count.n;
      if (apply) {
        const result = await db.$runCommandRaw({update:collection,updates:[{q:query,u:{$set:{[field]:value}},multi:true}]});
        if (result.ok !== 1) throw Error(`Falha atualizando ${collection}.${field}`);
        updated += result.nModified ?? result.n ?? 0;
      }
    }
  }
  console.log(apply?`Concluído: ${updated} correções aditivas; valores existentes preservados.`:`Encontradas ${missing} ausências. Para reparar, execute: npm run db:repair-legacy -- --apply`);
}
run().catch(err=>{console.error('Falha no diagnóstico/reparo:',err.message);process.exitCode=1;}).finally(()=>db.$disconnect());
