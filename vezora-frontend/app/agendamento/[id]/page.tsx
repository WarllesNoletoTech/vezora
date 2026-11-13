'use client';
import {useCallback,useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {CheckCircle2,Clock3,CreditCard,AlertCircle,RefreshCw,ArrowRight} from 'lucide-react';
import {api,brl} from '@/lib/api';
type BookingStatus={status:string;startAt:string;depositCents:number;paymentStatus:string|null;checkoutUrl:string|null;expiresAt:string|null};
export default function Status(){const {id}=useParams<{id:string}>();const [b,B]=useState<BookingStatus|null>(null),[e,E]=useState(''),[busy,S]=useState(false);
 const refresh=useCallback(async()=>{S(true);try{B(await api<BookingStatus>(`/booking-status/${id}`));E('')}catch(x){E((x as Error).message)}finally{S(false)}},[id]);
 useEffect(()=>{refresh()},[refresh]);
 return <main className="status-page"><div className="status-card"><Link href="/" className="brand"><span className="brand-symbol">v</span>vezora<span className="brand-dot">.</span></Link>{!b?<div className="empty-state">{e||'Consultando sua reserva...'}</div>:<><div className={`status-big-icon ${b.status==='CONFIRMED'?'ok':b.status==='PENDING_PAYMENT'?'pending':'warn'}`}>{b.status==='CONFIRMED'?<CheckCircle2 size={35}/>:b.status==='PENDING_PAYMENT'?<Clock3 size={35}/>:<AlertCircle size={35}/>}</div><h1>{b.status==='CONFIRMED'?'Agendamento confirmado!':b.status==='PENDING_PAYMENT'?'Aguardando pagamento':b.status==='NEEDS_REVIEW'?'Pagamento em análise':b.status==='COMPLETED'?'Atendimento concluído':b.status==='EXPIRED'?'Reserva expirada':'Reserva não confirmada'}</h1><p>{b.status==='PENDING_PAYMENT'?'Quando seu sinal for aprovado pelo Mercado Pago, o horário será confirmado automaticamente.':'Esta página mostra o status atualizado da sua reserva.'}</p><div className="status-details"><div><span>Data</span><b>{new Date(b.startAt).toLocaleString('pt-BR',{dateStyle:'long',timeStyle:'short'})}</b></div><div><span>Sinal</span><b>{brl(b.depositCents)}</b></div><div><span>Status do pagamento</span><b>{b.paymentStatus||'Não informado'}</b></div></div>{b.status==='PENDING_PAYMENT'&&b.checkoutUrl&&<a href={b.checkoutUrl} className="btn btn-primary wide">Ir para o pagamento <CreditCard size={18}/></a>}<button className="btn btn-outline wide" onClick={refresh} disabled={busy}><RefreshCw size={16}/>{busy?'Atualizando...':'Atualizar status'}</button></>}</div></main>
}
