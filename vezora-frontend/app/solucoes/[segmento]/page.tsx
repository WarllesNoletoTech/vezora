import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,CheckCircle2,CalendarDays} from 'lucide-react';
import Brand from '@/components/Brand';
import {landingPages} from '@/lib/seo-landing';
import {SITE_URL} from '@/lib/seo-server';

type Props={params:Promise<{segmento:string}>};
const paths=Object.keys(landingPages) as Array<keyof typeof landingPages>;
export function generateStaticParams(){return paths.map(segmento=>({segmento}));}
export const dynamicParams=false;

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {segmento}=await params;
 const info=landingPages[segmento as keyof typeof landingPages];
 if(!info)return {robots:{index:false,follow:false}};
 const canonical=`${SITE_URL}/solucoes/${segmento}`;
 return {title:info.title,description:info.description,alternates:{canonical},
  openGraph:{title:info.title,description:info.description,siteName:'Vezora',locale:'pt_BR',url:canonical,images:['/og-vezora.png']},
  twitter:{card:'summary_large_image',title:info.title,description:info.description}};
}

export default async function LandingPage({params}:Props){
 const {segmento}=await params;
 const info=landingPages[segmento as keyof typeof landingPages];
 if(!info)notFound();
 return <main className="site">
  <header className="topbar container"><Brand/><nav className="site-nav"><Link href="/">Início</Link><Link href="/#recursos">Recursos</Link><Link href="/#planos">Teste grátis</Link></nav><div className="nav-actions"><Link href="/entrar" className="link-login">Entrar</Link><Link href="/cadastro" className="btn btn-dark btn-small">Criar espaço <ArrowRight size={16}/></Link></div></header>
  <section className="hero container" style={{minHeight:'auto',paddingTop:76,paddingBottom:65}}>
   <div className="hero-copy" style={{maxWidth:810}}>
    <span className="eyebrow"><CalendarDays size={15}/> VEZORA PARA {info.tag}</span>
    <h1>{info.heading}</h1>
    <p>{info.lead}</p>
    <div className="hero-buttons"><Link href="/cadastro" className="btn btn-primary">Experimentar o Vezora <ArrowRight size={18}/></Link><Link href="/#como-funciona" className="btn btn-ghost">Conhecer recursos</Link></div>
   </div>
  </section>
  <section className="section container">
   <div className="section-heading"><span className="overline">FEITO PARA SUA ROTINA</span><h2>Mais clareza em cada agendamento.</h2><p>Organize sua agenda de acordo com os procedimentos e horários do seu negócio.</p></div>
   <div className="feature-grid">{info.challenges.map(item=><article key={item} className="feature-card"><div className="feature-icon"><CheckCircle2 size={22}/></div><h3>{item}</h3></article>)}</div>
  </section>
  <section className="split-section"><div className="container" style={{paddingTop:58,paddingBottom:58}}>
   <div className="section-heading"><span className="overline">COMO COMEÇAR</span><h2>Três passos para começar.</h2></div>
   <ol style={{display:'grid',gap:20,maxWidth:780,margin:'25px auto',paddingLeft:26}}>{info.steps.map(step=><li key={step} style={{lineHeight:1.7}}>{step}</li>)}</ol>
   <div style={{textAlign:'center'}}><Link href="/cadastro" className="btn btn-primary">Criar meu espaço <ArrowRight size={18}/></Link></div>
  </div></section>
  <section className="section container">
   <div className="section-heading"><span className="overline">DÚVIDAS FREQUENTES</span><h2>Antes de começar.</h2></div>
   <div style={{maxWidth:820,margin:'0 auto',display:'grid',gap:14}}>{info.faq.map(([question,answer])=><details key={question} className="feature-card"><summary style={{cursor:'pointer',fontWeight:700}}>{question}</summary><p style={{marginTop:12}}>{answer}</p></details>)}</div>
  </section>
  <section className="section container"><div className="section-heading"><span className="overline">OUTRAS SOLUÇÕES</span><h2>Uma agenda para cada tipo de negócio.</h2></div><div style={{display:'flex',flexWrap:'wrap',gap:14,justifyContent:'center'}}>{paths.filter(p=>p!==segmento).map(p=><Link key={p} className="btn btn-outline" href={`/solucoes/${p}`}>{landingPages[p].title}</Link>)}</div></section>
  <footer className="footer"><div className="container"><Brand light/><span>Vezora — Sua marca. Sua agenda.</span></div></footer>
 </main>;
}
