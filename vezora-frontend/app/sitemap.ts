import type {MetadataRoute} from 'next';
import {SITE_URL} from '@/lib/seo-server';
import {landingPages} from '@/lib/seo-landing';

export const revalidate=900;

type SitemapApi={tenants:{slug:string}[];hasMore:boolean};
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const rows:MetadataRoute.Sitemap=[
  {url:SITE_URL+'/',changeFrequency:'weekly',priority:1},
  ...Object.keys(landingPages).map(slug=>({url:`${SITE_URL}/solucoes/${slug}`,changeFrequency:'monthly' as const,priority:0.8}))
 ];
 const apiBase=process.env.API_INTERNAL_URL?.trim();
 if(!apiBase)return rows;
 const seen=new Set<string>();
 try{
  for(let page=1;page<=80;page++){
    const url=new URL('/api/seo/tenants',apiBase);
    url.searchParams.set('page',String(page));
    const response=await fetch(url.toString(),{next:{revalidate:900},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Sitemap upstream HTTP '+response.status);
    const batch=await response.json() as SitemapApi;
    for(const t of batch.tenants){
      if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.slug)||seen.has(t.slug))continue;
      seen.add(t.slug);
      rows.push({url:`${SITE_URL}/${encodeURIComponent(t.slug)}`,changeFrequency:'weekly',priority:0.6});
    }
    if(!batch.hasMore)break;
  }
 }catch(error){
  console.error('[Vezora sitemap] Não foi possível listar os estabelecimentos:',error);
 }
 return rows;
}
