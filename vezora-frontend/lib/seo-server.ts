import {cache} from 'react';
import type {PublicTenant} from '@/lib/seo-types';

export const SITE_URL='https://vezora-agendamentos.vercel.app';

/** Consulta somente o endpoint público existente, sem cookies, tokens ou dados de usuário. */
export const publicTenant=cache(async (slug:string):Promise<PublicTenant|null>=>{
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return null;
  const value=process.env.API_INTERNAL_URL?.trim();
  if(!value)throw new Error('API_INTERNAL_URL não configurada na Vercel');
  const base=new URL(value);
  if(process.env.NODE_ENV==='production'&&base.protocol!=='https:')throw new Error('Backend SEO exige HTTPS');
  const url=new URL('/api/public/'+encodeURIComponent(slug),base);
  const res=await fetch(url.toString(),{cache:'no-store',headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(res.status===404)return null;
  if(!res.ok)throw new Error('API pública indisponível para SEO: HTTP '+res.status);
  return (await res.json()) as PublicTenant;
});

export function isIndexable(t:PublicTenant){
  return t.bookingEnabled&&t.services.some(s=>s.active!==false)&&Boolean(t.businessType)&&t.name.trim().length>=3;
}
export function metaDescription(t:PublicTenant){
  const desc=t.bio?.replace(/\s+/g,' ').trim();
  if(desc&&desc.length>=30)return desc.slice(0,155);
  const services=t.services.filter(s=>s.active!==false).slice(0,3).map(s=>s.name);
  return `Agende online na ${t.name}. ${services.length?'Serviços: '+services.join(', ')+'. ':''}Confira os horários disponíveis e reserve pelo Vezora.`.slice(0,155);
}
