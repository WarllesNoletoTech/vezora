'use client';
import {useState} from 'react';
import type {FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowRight,LockKeyhole} from 'lucide-react';
import Brand from '@/components/Brand';
import {api} from '@/lib/api';
export default function Login(){const r=useRouter();const [email,E]=useState('');const [password,P]=useState('');const [error,S]=useState('');const [busy,B]=useState(false);
async function submit(e:FormEvent){e.preventDefault();B(true);S('');try{await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});r.push('/painel');r.refresh();}catch(x){S((x as Error).message)}finally{B(false)}}
return <main className="auth-shell"><div className="auth-aside"><Brand light/><div><span className="overline">BEM-VINDO DE VOLTA</span><h1>Sua agenda.<br/><em>Seu próximo passo.</em></h1><p>Organize o que importa. Nós cuidamos do resto.</p></div><small>Vezora • Seu negócio, do seu jeito.</small></div><div className="auth-main"><div className="auth-form"><div className="auth-icon"><LockKeyhole/></div><h2>Entrar no painel</h2><p>Acesse o espaço do seu estabelecimento.</p><form onSubmit={submit}><label>E-mail<input type="email" required value={email} onChange={e=>E(e.target.value)} placeholder="seu@email.com"/></label><label>Senha<input type="password" minLength={8} required value={password} onChange={e=>P(e.target.value)} placeholder="••••••••"/></label>{error&&<div className="alert error">{error}</div>}<button className="btn btn-primary wide" disabled={busy}>{busy?'Entrando...':'Entrar na minha conta'} <ArrowRight size={18}/></button></form><p className="auth-switch">Ainda não tem uma conta? <Link href="/cadastro">Criar meu espaço</Link></p></div></div></main>}
