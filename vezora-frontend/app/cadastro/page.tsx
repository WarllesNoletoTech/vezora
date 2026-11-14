'use client';
import {useEffect,useState} from 'react';
import type {FormEvent,CSSProperties} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,Building2,CheckCircle2,CalendarClock} from 'lucide-react';
import Brand from '@/components/Brand';
import BusinessMotif from '@/components/BusinessMotif';
import {businessOptions,BusinessType,businessTheme} from '@/lib/business';
import {api} from '@/lib/api';
export default function Signup(){
 const r=useRouter();const [form,F]=useState({name:'',email:'',password:'',phone:'',business:'',slug:'',businessType:''});
 const [trialDays,TRIALDAYS]=useState<number|null>(null);
 const [error,S]=useState(''),[busy,B]=useState(false),[slugEdited,D]=useState(false),[host,HOST]=useState('vezora-agendamentos.vercel.app'),[showPassword,SHOW]=useState(false);
 useEffect(()=>{HOST(window.location.host);void api<{trialDays:number}>('/platform/public-settings').then(s=>TRIALDAYS(s.trialDays)).catch(()=>{});},[]);
 function update(k:keyof typeof form,v:string){F(old=>({...old,[k]:v,...(k==='business'&&!slugEdited?{slug:v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}: {})}));}
 async function submit(e:FormEvent){e.preventDefault();B(true);S('');try{await api('/auth/register',{method:'POST',body:JSON.stringify({...form,email:form.email.trim().toLowerCase()})});r.replace('/painel?welcome=1');r.refresh();}catch(x){S((x as Error).message)}finally{B(false)}}
 const theme=businessTheme(form.businessType as BusinessType);
 return <main className="auth-shell auth-neutral"><div className="auth-aside"><Brand light/><div><span className="overline">BEM-VINDO À VEZORA</span><h1>Seu negócio.<br/><em>Sua identidade.</em></h1><p>Uma agenda para barbearias, salões, nail designers e muito mais.</p><div className="auth-trial-note"><CalendarClock size={19}/> {trialDays===null?'Teste grátis disponível':`${trialDays} dias grátis para experimentar`}. Depois, assinatura por Pix ou cartão.</div></div><small>Vezora • Seu tempo, sua marca.</small></div><div className="auth-main"><div className="auth-form"><div className="auth-icon"><Building2/></div><h2>Crie seu espaço</h2><p>Conte o que você faz para personalizarmos sua experiência.</p><form onSubmit={submit}>
 <label>Seu nome<input autoComplete="name" required minLength={2} value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Seu nome completo"/></label>
 <label>WhatsApp com DDD<input type="tel" inputMode="tel" autoComplete="tel" required minLength={10} maxLength={20} value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="(94) 99999-9999"/><small className="muted">Usado para contato e suporte. Você poderá editar o WhatsApp comercial no painel.</small></label>
 <label>Tipo de negócio<select required value={form.businessType} onChange={e=>update('businessType',e.target.value)}><option value="" disabled>Selecione sua área de atuação</option>{businessOptions.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</select></label>
 {form.businessType&&<div className="business-type-preview" style={{'--business-primary':theme.primary,'--business-secondary':theme.secondary} as CSSProperties}><BusinessMotif type={theme.value}/><span><b>{theme.headline}</b><small>Seu site e painel começarão com as cores e o estilo dessa área. Você poderá personalizar depois.</small></span></div>}
 <label>Nome do estabelecimento<input autoComplete="organization" required minLength={2} value={form.business} onChange={e=>update('business',e.target.value)} placeholder="Ex.: Barbearia Central"/></label>
 <label>Seu link de agendamento<div className="slug-input"><span>{host}/</span><input required minLength={3} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={e=>{D(true);update('slug',e.target.value.toLowerCase())}} placeholder="meu-negocio"/></div></label>
 <label>E-mail<input type="email" autoComplete="email" required value={form.email} onChange={e=>update('email',e.target.value)} placeholder="seu@email.com"/></label>
 <label>Senha<div className="password-field"><input type={showPassword?'text':'password'} autoComplete="new-password" required minLength={8} value={form.password} onChange={e=>update('password',e.target.value)} placeholder="Mínimo de 8 caracteres"/><button type="button" onClick={()=>SHOW(x=>!x)} aria-label={showPassword?'Ocultar senha':'Mostrar senha'}>{showPassword?'Ocultar':'Mostrar'}</button></div></label>
 <div className="signup-trial"><CheckCircle2 size={18}/> {trialDays===null?'Teste grátis':`Teste grátis por ${trialDays} dias`}. Para continuar, pagamento via Pix ou cartão.</div>
 {error&&<div className="alert error" role="alert">{error}{error.toLowerCase().includes('e-mail já possui cadastro')&&<> <Link href="/entrar" style={{textDecoration:'underline'}}>Entrar com meu e-mail</Link></>}</div>}
 <button className="btn btn-primary wide" disabled={busy} aria-busy={busy}>{busy?'Criando...':'Criar meu espaço'} <ArrowRight size={18}/></button></form><p className="auth-switch">Já tem uma conta? <Link href="/entrar">Entrar</Link></p></div></div></main>
}
