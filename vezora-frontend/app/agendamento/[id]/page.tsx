'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import Brand from '@/components/Brand';
import {CheckCircle2,Clock3,CreditCard,AlertCircle,RefreshCw} from 'lucide-react';
import {api,brl} from '@/lib/api';

type BookingStatus={status:string;startAt:string;depositCents:number;paymentStatus:string|null;checkoutUrl:string|null;expiresAt:string|null;tenant?:{timezone:string;slug:string;name:string}};
type ReconcileResult={status:string|null;paymentStatus:string|null;verified:boolean;outcome:string};
export default function Status(){
  const {id}=useParams<{id:string}>();
  const checkedCheckoutReturn=useRef(false);
  const [b,B]=useState<BookingStatus|null>(null),[error,E]=useState(''),[message,M]=useState(''),[busy,S]=useState(false),[checking,C]=useState(false);
  const refresh=useCallback(async()=>{S(true);try{B(await api<BookingStatus>(`/booking-status/${id}`));E('')}catch(x){E((x as Error).message)}finally{S(false)}},[id]);
  const checkPayment=useCallback(async()=>{
    C(true);E('');M('');
    try {
      const result=await api<ReconcileResult>(`/booking-status/${id}/reconcile`,{method:'POST'});
      await refresh();
      if(result.status==='CONFIRMED')M('Pagamento confirmado pelo Mercado Pago. Seu horário está reservado.');
      else if(result.verified&&result.status==='NEEDS_REVIEW')M('Pagamento localizado, mas a reserva precisa de revisão do estabelecimento. Não pague novamente.');
      else M('Ainda não encontramos um pagamento aprovado vinculado a esta reserva. Se você já pagou, não pague novamente e contate o estabelecimento.');
    } catch(x){E((x as Error).message)} finally {C(false)}
  },[id,refresh]);
  useEffect(()=>{void refresh()},[refresh]);
  // O retorno do Checkout Pro nunca prova pagamento. Ele só aciona uma consulta
  // ao backend, que valida o pagamento na conta OAuth do lojista.
  useEffect(()=>{
    if(!b || checkedCheckoutReturn.current || !['PENDING_PAYMENT','EXPIRED','NEEDS_REVIEW'].includes(b.status))return;
    const p=new URLSearchParams(window.location.search);
    const returned=p.get('origem')==='mercadopago'||['payment_id','collection_id','merchant_order_id','collection_status','preference_id','status'].some(key=>p.has(key));
    if(!returned)return;
    checkedCheckoutReturn.current=true;
    void checkPayment();
  },[b,checkPayment]);
  useEffect(()=>{if(b?.status!=='PENDING_PAYMENT')return;const timer=setInterval(()=>{void refresh()},12000);return()=>clearInterval(timer)},[b?.status,refresh]);
  const pending=b?.status==='PENDING_PAYMENT',attention=b?.status==='NEEDS_REVIEW',expired=b?.status==='EXPIRED';
  return <main className="status-page"><div className="status-card"><Brand/>{!b?<div className="empty-state">{error||'Consultando sua reserva...'}</div>:<>
  <div className={`status-big-icon ${['CONFIRMED','COMPLETED'].includes(b.status)?'ok':pending?'pending':'warn'}`}>{['CONFIRMED','COMPLETED'].includes(b.status)?<CheckCircle2 size={35}/>:pending?<Clock3 size={35}/>:<AlertCircle size={35}/>}</div>
  <h1>{b.status==='CONFIRMED'?'Agendamento confirmado!':pending?'Aguardando confirmação do pagamento':attention?'Pagamento em revisão':b.status==='COMPLETED'?'Atendimento concluído':expired?'Reserva expirada':'Reserva não confirmada'}</h1>
  <p>{pending?'Se já pagou o sinal, não faça outro pagamento. Confira abaixo se o Mercado Pago confirmou a transação.':attention?'O estabelecimento deve conferir o horário e o pagamento antes de confirmar o atendimento.':'Esta página mostra o status atualizado da sua reserva.'}</p>
  <div className="status-details"><div><span>Data</span><b>{new Date(b.startAt).toLocaleString('pt-BR',{dateStyle:'long',timeStyle:'short',timeZone:b.tenant?.timezone||'America/Sao_Paulo'})}</b></div><div><span>Sinal</span><b>{brl(b.depositCents)}</b></div><div><span>Status do pagamento</span><b>{b.paymentStatus||'Não informado'}</b></div></div>
  {(pending||expired||attention)&&b.depositCents>0&&<button className="btn btn-primary wide" onClick={()=>void checkPayment()} disabled={checking||busy}><RefreshCw size={18}/>{checking?'Consultando Mercado Pago...':'Já paguei — conferir pagamento'}</button>}
  {pending&&b.checkoutUrl&&<a href={b.checkoutUrl} className="btn btn-outline wide" target="_blank" rel="noreferrer">Ir para o pagamento <CreditCard size={18}/></a>}
  <button className="btn btn-outline wide" onClick={()=>void refresh()} disabled={busy||checking}><RefreshCw size={16}/>{busy?'Atualizando...':'Atualizar status'}</button>
  {b.tenant?.slug&&<Link href={`/${b.tenant.slug}`} className="btn btn-outline wide">Voltar à página de {b.tenant.name}</Link>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  </>}</div></main>
}
