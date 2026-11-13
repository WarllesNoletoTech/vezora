'use client';
import {useEffect,useState} from 'react';
import type {FormEvent,CSSProperties} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowRight,CheckCircle2,RefreshCw} from 'lucide-react';
import Brand from '@/components/Brand';
import BusinessMotif from '@/components/BusinessMotif';
import {api} from '@/lib/api';
import {businessOptions,BusinessType,businessTheme} from '@/lib/business';
export default function CompleteProfile(){
 const router=useRouter();const [name,N]=useState(''),[businessType,T]=useState(''),[busy,B]=useState(false),[loading,L]=useState(true),[err,E]=useState('');
 useEffect(()=>{api<{tenant:{name:string;businessType?:BusinessType|null};onboardingRequired:boolean}>('/me').then(v=>{if(!v.onboardingRequired){router.replace('/painel');return}N(v.tenant.name)}).catch(()=>router.replace('/entrar')).finally(()=>L(false))},[router]);
 async function save(e:FormEvent){e.preventDefault();B(true);E('');try{await api('/tenant/onboarding',{method:'PATCH',body:JSON.stringify({name,businessType})});router.replace('/painel');router.refresh()}catch(e){E((e as Error).message)}finally{B(false)}}
 const theme=businessTheme(businessType as BusinessType);
 if(loading)return <main className="screen-loading"><RefreshCw className="spinner"/><p>Verificando cadastro...</p></main>;
 return <main className="completion-page"><div className="completion-card"><Brand/><div className="completion-step">ATUALIZAÇÃO OBRIGATÓRIA</div><h1>Vamos atualizar seu espaço</h1><p>O Vezora agora oferece experiências personalizadas por tipo de negócio. Escolha sua área para continuar usando o painel.</p><form className="form-grid" onSubmit={save}><label>Nome do estabelecimento<input value={name} onChange={e=>N(e.target.value)} required minLength={2}/></label><label>Tipo de negócio<select value={businessType} required onChange={e=>T(e.target.value)}><option value="" disabled>Selecione a área de atuação</option>{businessOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>{businessType&&<div className="business-type-preview" style={{'--business-primary':theme.primary,'--business-secondary':theme.secondary} as CSSProperties}><BusinessMotif type={theme.value}/><span><b>{theme.headline}</b><small>O visual se adapta à sua especialidade. Você ainda poderá escolher suas cores.</small></span></div>}{err&&<div className="alert error" role="alert">{err}</div>}<div className="signup-trial"><CheckCircle2 size={18}/> Seus serviços, profissionais e agendamentos existentes serão mantidos. Contas anteriores recebem 3 dias de teste após a atualização.</div><button disabled={busy} className="btn btn-primary wide">{busy?'Salvando...':'Atualizar e continuar'} <ArrowRight size={18}/></button></form></div></main>;
}
