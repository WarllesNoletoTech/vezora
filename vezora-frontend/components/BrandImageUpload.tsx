'use client';

import {useState} from 'react';
import {ImagePlus,Trash2,UploadCloud} from 'lucide-react';
import {api} from '@/lib/api';

type Kind='logo'|'cover';
const LIMIT:Record<Kind,number>={logo:1_500_000,cover:3_000_000};

/** Compacta imagens no próprio navegador antes de enviar (inclusive fotos grandes de celular). */
async function prepareImage(file:File,kind:Kind):Promise<Blob>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
 if(file.size>20_000_000)throw new Error('A imagem original deve ter no máximo 20 MB.');
 const objectUrl=URL.createObjectURL(file);
 let image:HTMLImageElement;
 try{
  image=await new Promise((resolve,reject)=>{
   const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Não foi possível abrir a imagem.'));img.src=objectUrl;
  });
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('2d');
  if(!context)throw new Error('Este navegador não permite preparar imagens.');
  const maxW=kind==='logo'?1000:1800;
  const maxH=kind==='logo'?1000:1100;
  const ratio=Math.min(1,maxW/image.naturalWidth,maxH/image.naturalHeight);
  const outputType=kind==='logo'?'image/webp':'image/jpeg';
  let width=Math.max(1,Math.round(image.naturalWidth*ratio));
  let height=Math.max(1,Math.round(image.naturalHeight*ratio));
  for(let scale=0;scale<4;scale++){
   canvas.width=width;canvas.height=height;
   if(outputType==='image/jpeg'){
    context.fillStyle='#ffffff';context.fillRect(0,0,width,height);
   }else context.clearRect(0,0,width,height);
   context.drawImage(image,0,0,width,height);
   for(const quality of [0.85,0.72,0.58]){
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,outputType,quality));
    // Alguns navegadores antigos retornam PNG quando WebP não está disponível.
    if(blob && ['image/webp','image/png','image/jpeg'].includes(blob.type) && blob.size<=LIMIT[kind])return blob;
   }
   width=Math.max(1,Math.round(width*0.76));height=Math.max(1,Math.round(height*0.76));
  }
  throw new Error('Não foi possível reduzir essa imagem. Escolha um arquivo menor.');
 }finally{URL.revokeObjectURL(objectUrl)}
}

export default function BrandImageUpload({kind,url,onUploaded,onError,onBusyChange}:{kind:Kind;url:string;onUploaded:(url:string)=>void;onError:(message:string)=>void;onBusyChange?:(busy:boolean)=>void}){
 const [busy,B]=useState(false);
 const [notice,N]=useState('');
 const label=kind==='logo'?'Logotipo':'Imagem de capa';
 async function upload(file:File){
  B(true);onBusyChange?.(true);N('Preparando imagem...');onError('');
  try{
   const image=await prepareImage(file,kind);
   N('Enviando imagem...');
   const result=await api<{url:string}>(`/tenant/media/${kind}`,{method:'PUT',headers:{'Content-Type':image.type},body:image});
   onUploaded(result.url);
   N(`${label} enviada e salva com sucesso!`);
  }catch(error){N('');onError(error instanceof Error?error.message:'Não foi possível enviar a imagem.');}
  finally{B(false);onBusyChange?.(false)}
 }
 async function remove(){
  B(true);onBusyChange?.(true);N('');onError('');
  try{await api(`/tenant/media/${kind}`,{method:'DELETE'});onUploaded('');N(`${label} removida.`)}
  catch(error){onError(error instanceof Error?error.message:'Falha ao remover imagem.');}
  finally{B(false);onBusyChange?.(false)}
 }
 return <div className="vezora-image-upload">
  <div className="vezora-image-upload-heading"><strong>{label}</strong><span>{kind==='logo'?'Recomendado: imagem quadrada com fundo transparente.':'Recomendado: imagem horizontal para sua página.'}</span></div>
  {url?<div className={`vezora-image-preview ${kind}`}><img src={url} alt={`${label} atual`}/></div>:<div className={`vezora-image-empty ${kind}`}><ImagePlus size={23}/><span>Sem {kind==='logo'?'logo':'capa'} cadastrada</span></div>}
  <div className="vezora-image-upload-actions">
   <label className={`btn btn-outline btn-small ${busy?'is-busy':''}`}>
    <UploadCloud size={16}/> {busy?'Enviando...':url?'Trocar imagem':'Escolher imagem'}
    <input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void upload(file)}}/>
   </label>
   {url&&<button className="btn btn-plain btn-small" type="button" disabled={busy} onClick={()=>void remove()}><Trash2 size={15}/> Remover</button>}
  </div>
  <small className="muted">JPG, PNG ou WebP. Ajuste automático para o tamanho ideal. Nenhum link é necessário.</small>
  {notice&&<small className="vezora-image-notice" role="status">{notice}</small>}
 </div>;
}
