import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import PublicBooking from '@/components/PublicBookingClient';
import {businessTheme} from '@/lib/business';
import {SITE_URL,publicTenant,isIndexable,metaDescription} from '@/lib/seo-server';

export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {slug}=await params;
 const t=await publicTenant(slug);
 if(!t)return {title:'Estabelecimento não encontrado',robots:{index:false,follow:false}};
 const canonical=SITE_URL+'/'+encodeURIComponent(t.slug);
 const title=`${t.name} — ${businessTheme(t.businessType).label} | Agendamento online`;
 const description=metaDescription(t);
 const visible=isIndexable(t);
 const images=t.coverUrl?[{url:t.coverUrl,alt:`Capa de ${t.name}`}]:[{url:'/og-vezora.png',alt:'Vezora — Agendamento online'}];
 return {
  title,description,alternates:{canonical},
  robots:visible?{index:true,follow:true}:{index:false,follow:false},
  openGraph:{type:'website',locale:'pt_BR',siteName:'Vezora',title,description,url:canonical,images},
  twitter:{card:'summary_large_image',title,description,images:images.map(i=>i.url)}
 };
}

export default async function PublicPage({params}:Props){
 const {slug}=await params;
 const t=await publicTenant(slug);
 if(!t)notFound();
 const canonical=SITE_URL+'/'+encodeURIComponent(t.slug);
 const data={
  '@context':'https://schema.org',
  '@type':t.businessType==='BARBEARIA'||t.businessType==='CABELEIREIRO'?'HairSalon': ['SALAO_BELEZA','NAIL_DESIGNER','MANICURE_PEDICURE','LASH_DESIGNER','SOBRANCELHAS','ESTETICA','MAQUIAGEM','DEPILACAO'].includes(t.businessType||'')?'BeautySalon':'LocalBusiness',
  '@id':canonical+'#estabelecimento',
  name:t.name,url:canonical,
  description:metaDescription(t),
  ...(t.logoUrl?{logo:t.logoUrl}:{}),
  ...(t.coverUrl?{image:t.coverUrl}:{}),
  ...(t.whatsapp?{telephone:t.whatsapp}:{}),
  ...(t.address?{address:{'@type':'PostalAddress',streetAddress:t.address,addressCountry:'BR'}}:{}),
  ...(isIndexable(t)&&t.services.length?{
    hasOfferCatalog:{
      '@type':'OfferCatalog',name:'Serviços disponíveis',
      itemListElement:t.services.filter(s=>s.active!==false).slice(0,60).map(s=>({
        '@type':'OfferCatalog',name:s.name,
        itemListElement:[{'@type':'Offer',price:(s.priceCents/100).toFixed(2),priceCurrency:'BRL',itemOffered:{'@type':'Service',name:s.name,...(s.description?{description:s.description}:{})}}]
      }))
    }
  }:{})
 };
 return <>
  {isIndexable(t)&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(data).replace(/</g,'\\u003c')}}/>}
  <PublicBooking key={t.slug} slug={t.slug} initialTenant={t}/>
 </>;
}
