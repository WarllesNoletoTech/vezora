/** Apenas diagnóstico. Nunca modifica ownerId, contas ou pagamentos. */
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
async function run(){
  const tenants=await db.tenant.findMany({select:{id:true,slug:true,name:true,ownerId:true},orderBy:{createdAt:'asc'}});
  const ids=[...new Set(tenants.map(t=>t.ownerId).filter(Boolean))];
  const users=await db.user.findMany({where:{id:{in:ids}},select:{id:true}});
  const valid=new Set(users.map(u=>u.id));
  const missing=tenants.filter(t=>!t.ownerId||!valid.has(t.ownerId));
  console.log(`Estabelecimentos consultados: ${tenants.length}`);
  console.log(`Estabelecimentos sem proprietário válido: ${missing.length}`);
  for(const t of missing){console.log(`- Slug: ${t.slug}; tenantId: ${t.id}; ownerId original: ${t.ownerId||'(ausente)'}`);}
  if(missing.length){
    console.log('ATENÇÃO: nenhum registro foi alterado. Identifique o proprietário legítimo antes de qualquer correção do ownerId.');
    console.log('Não vincule automaticamente esses estabelecimentos à conta SUPERADMIN.');
  }else console.log('Todos os vínculos de proprietário consultados estão íntegros.');
}
run().catch(err=>{console.error('Diagnóstico interrompido:',err.message);process.exitCode=1;}).finally(()=>db.$disconnect());
