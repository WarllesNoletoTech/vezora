/** Heroku: heroku run npm run admin:promote -- --email usuario@dominio.com -a vezora */
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
async function main(){
 const index=process.argv.indexOf('--email');
 const email=index>=0?process.argv[index+1]?.trim().toLowerCase():'';
 if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Uso: npm run admin:promote -- --email usuario@dominio.com');
 const user=await db.user.findUnique({where:{email}});
 if(!user)throw Error('Conta inexistente. Registre primeiro uma conta normal pelo site.');
 await db.user.update({where:{id:user.id},data:{role:'SUPERADMIN'}});
 await db.adminAuditLog.create({data:{actorId:user.id,action:'PROMOTE_SUPERADMIN',details:'Promocao executada via CLI no ambiente do servidor'}});
 console.log('Conta promovida a SUPERADMIN. Faca login novamente e acesse /admin.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
