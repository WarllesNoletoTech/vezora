/** Apenas diagnóstico. Nunca modifica ownerId, contas ou pagamentos. */
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
async function run(){
  const tenants=await db.tenant.findMany({select:{id:true,slug:true,name:true,ownerId:true,archivedAt:true},orderBy:{createdAt:'asc'}});
  const ids=[...new Set(tenants.map(t=>t.ownerId).filter(Boolean))];
  const users=await db.user.findMany({select:{id:true,email:true,deletedAt:true}});
  const valid=new Set(users.filter(u=>!u.deletedAt).map(u=>u.id));
  const missing=tenants.filter(t=>!t.archivedAt&&(!t.ownerId||!valid.has(t.ownerId)));
  console.log(`Estabelecimentos consultados: ${tenants.length}`);
  console.log(`Estabelecimentos sem proprietário válido: ${missing.length}`);
  for(const t of missing){console.log(`- Slug: ${t.slug}; tenantId: ${t.id}; ownerId original: ${t.ownerId||'(ausente)'}`);}
  const emails=new Map();
  for(const u of users){if(u.deletedAt)continue;const key=u.email.trim().toLowerCase();emails.set(key,[...(emails.get(key)||[]),u.id]);}
  const duplicates=[...emails.entries()].filter(([_,refs])=>refs.length>1);
  console.log(`E-mails ativos duplicados ignorando maiúsculas: ${duplicates.length}`);
  for(const [email,ids] of duplicates)console.log(`- ${email}; userIds: ${ids.join(', ')}`);
  const [bookings,services,professionals]=await Promise.all([
    db.booking.findMany({select:{id:true,tenantId:true,serviceId:true,professionalId:true}}),
    db.service.findMany({select:{id:true,tenantId:true}}),
    db.professional.findMany({select:{id:true,tenantId:true}})
  ]);
  const byService=new Map(services.map(s=>[s.id,s.tenantId]));
  const byPro=new Map(professionals.map(p=>[p.id,p.tenantId]));
  const crossed=bookings.filter(b=>byService.get(b.serviceId)!==b.tenantId||byPro.get(b.professionalId)!==b.tenantId);
  console.log(`Reservas com vínculos ausentes ou cruzados: ${crossed.length}`);
  for(const b of crossed.slice(0,30))console.log(`- booking: ${b.id}, tenant: ${b.tenantId}, serviceTenant: ${byService.get(b.serviceId)||'(ausente)'}, proTenant: ${byPro.get(b.professionalId)||'(ausente)'}`);
  if(missing.length||duplicates.length||crossed.length){
    console.log('ATENÇÃO: nenhum registro foi alterado. Identifique o proprietário legítimo antes de qualquer correção do ownerId.');
    console.log('Não vincule automaticamente esses estabelecimentos à conta SUPERADMIN.');
  }else console.log('Vínculos e e-mails ativos consistentes.');
}
run().catch(err=>{console.error('Diagnóstico interrompido:',err.message);process.exitCode=1;}).finally(()=>db.$disconnect());
