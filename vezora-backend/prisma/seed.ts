import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_SCHEDULE } from '../src/core';
const db=new PrismaClient();
async function main(){
  if(process.env.NODE_ENV==='production')throw new Error('Seed de demonstração não pode rodar em produção');
  const email='demo@vezora.local';
  if(await db.user.findUnique({where:{email}})){console.log('Conta demo já existe');return;}
  const user=await db.user.create({data:{name:'Mariana Costa',email,passwordHash:await bcrypt.hash('Demo@123456',12)}});
  const tenant=await db.tenant.create({data:{name:'Studio Aurora',slug:'studio-aurora',ownerId:user.id,bio:'Um espaço especial para cuidar de você.',whatsapp:'5599999999999',primaryColor:'#915475',secondaryColor:'#241C29'}});
  await db.professional.createMany({data:[{tenantId:tenant.id,name:'Mariana Costa',schedule:DEFAULT_SCHEDULE},{tenantId:tenant.id,name:'Ana Beatriz',schedule:DEFAULT_SCHEDULE}]});
  await db.service.createMany({data:[
    {tenantId:tenant.id,name:'Alongamento de unhas',description:'Alongamento e finalização',durationMin:120,priceCents:15000},
    {tenantId:tenant.id,name:'Design de sobrancelhas',description:'Design personalizado',durationMin:45,priceCents:4500},
    {tenantId:tenant.id,name:'Extensão de cílios',description:'Aplicação fio a fio',durationMin:120,priceCents:18000},
    {tenantId:tenant.id,name:'Manicure e pedicure',description:'Cuidado completo',durationMin:90,priceCents:6500}
  ]});
  console.log('Demo criada: demo@vezora.local / Demo@123456 — /studio-aurora');
}
main().finally(()=>db.$disconnect()).catch(e=>{console.error(e);process.exit(1)});
