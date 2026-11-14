/**
 * Armazenamento persistente de imagens via MongoDB GridFS.
 * O Heroku não possui disco persistente, por isso nunca gravamos uploads no dyno.
 * Não há migração Prisma: são usadas coleções GridFS independentes.
 */
import {GridFSBucket,MongoClient,ObjectId} from 'mongodb';
import {Readable} from 'node:stream';
import {env} from './env';

export type MediaKind='logo'|'cover';
export const MAX_MEDIA_BYTES:Record<MediaKind,number>={logo:1_500_000,cover:3_000_000};
let mongoPromise:Promise<MongoClient>|undefined;
function connection():Promise<MongoClient>{
 if(!mongoPromise){
  const client=new MongoClient(env.MONGODB_URI,{maxPoolSize:4});
  mongoPromise=client.connect().catch(error=>{mongoPromise=undefined;throw error});
 }
 return mongoPromise;
}
async function bucket(){
 const client=await connection();
 // A conexão do Vezora precisa trazer o nome do banco (ex.: ...mongodb.net/vezora).
 const database=new URL(env.MONGODB_URI).pathname.replace(/^\//,'');
 if(!database)throw new Error('Configure um nome de banco na MONGODB_URI para armazenar imagens');
 return new GridFSBucket(client.db(decodeURIComponent(database)),{bucketName:'vezora_media'});
}
export function sniffImageMime(buffer:Buffer):'image/jpeg'|'image/png'|'image/webp'|null{
 if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return 'image/jpeg';
 if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(buffer.length>=12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return 'image/webp';
 return null;
}
const extension:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
export async function saveTenantMedia(tenantId:string,kind:MediaKind,buffer:Buffer,mime:string){
 if(buffer.length===0||buffer.length>MAX_MEDIA_BYTES[kind])throw Object.assign(new Error('Imagem excede o limite permitido'),{status:413});
 const detected=sniffImageMime(buffer);
 if(!detected||detected!==mime)throw Object.assign(new Error('Envie uma imagem JPEG, PNG ou WebP válida'),{status:415});
 const collection=await bucket();
 const upload=collection.openUploadStream(`${tenantId}/${kind}.${extension[detected]}`,{
  metadata:{tenantId,kind,mimeType:detected,createdAt:new Date()}
 });
 try{
  await new Promise<void>((resolve,reject)=>{
   const input=Readable.from([buffer]);
   input.on('error',reject);upload.on('error',reject);upload.on('finish',()=>resolve());input.pipe(upload);
  });
  return {fileId:(upload.id as ObjectId).toHexString(),mime:detected};
 }catch(error){
  await collection.delete(upload.id as ObjectId).catch(()=>{});
  throw error;
 }
}
export async function findTenantMedia(tenantId:string,kind:MediaKind,fileId:string){
 if(!ObjectId.isValid(fileId)||!(/^[a-f\d]{24}$/i.test(fileId)))return null;
 const collection=await bucket();
 const id=new ObjectId(fileId);
 const info=await collection.find({_id:id,'metadata.tenantId':tenantId,'metadata.kind':kind}).next();
 if(!info)return null;
 const mime=info.metadata?.mimeType;
 if(!['image/jpeg','image/png','image/webp'].includes(mime))return null;
 return {stream:collection.openDownloadStream(id),mime:mime as string,length:info.length};
}
export function mediaUrl(tenantId:string,kind:MediaKind,fileId:string){
 return `${env.WEB_URL}/api/media/${tenantId}/${kind}/${fileId}`;
}
export function extractMediaId(url:string,tenantId:string,kind:MediaKind):string|null{
 const prefix=`${env.WEB_URL}/api/media/${tenantId}/${kind}/`;
 if(!url.startsWith(prefix))return null;
 const id=url.slice(prefix.length);
 return /^[a-f\d]{24}$/i.test(id)?id:null;
}
export async function deleteTenantMedia(fileId:string){
 if(!/^[a-f\d]{24}$/i.test(fileId))return;
 try{await (await bucket()).delete(new ObjectId(fileId))}catch{/* arquivo antigo ausente ou já apagado */}
}
