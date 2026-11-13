/** Busca proprietários separadamente para evitar erro do Prisma quando há tenant órfão.
 * A relação NÃO é alterada aqui: correção de titularidade exige identificação manual.
 */
import {db} from './db';

export type OwnerPreview={id:string;name:string;email:string;phone:string|null;createdAt:Date|null;ownerMissing:boolean};
export async function loadOwnerMap(records:ReadonlyArray<{ownerId:string}>):Promise<Map<string,OwnerPreview>>{
  const ids=[...new Set(records.map(t=>t.ownerId).filter((x):x is string=>typeof x==='string'&&x.length>0))];
  if(!ids.length)return new Map();
  // Lotes limitados para evitar consultas com listas de IDs excessivamente grandes.
  const map=new Map<string,OwnerPreview>();
  for(let i=0;i<ids.length;i+=500){
    const users=await db.user.findMany({where:{id:{in:ids.slice(i,i+500)}},select:{id:true,name:true,email:true,phone:true,createdAt:true}});
    for(const u of users)map.set(u.id,{...u,ownerMissing:false});
  }
  return map;
}
export function ownerPreview(ownerId:string,map:ReadonlyMap<string,OwnerPreview>):OwnerPreview{
  const found=map.get(ownerId);
  if(found)return found;
  return {id:ownerId||'',name:'Proprietário não localizado',email:'',phone:null,createdAt:null,ownerMissing:true};
}
