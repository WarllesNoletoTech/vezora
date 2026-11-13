'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import Script from 'next/script';
import {useRouter} from 'next/navigation';
import {BadgeCheck,CheckCircle2,Copy,CreditCard,LockKeyhole,RefreshCw,ShieldCheck,Wallet,ArrowLeft} from 'lucide-react';
import Brand from '@/components/Brand';
import {api,brl} from '@/lib/api';

type Billing={status:string;trialEndsAt:string|null;subscriptionEndsAt:string|null;daysRemaining:number;monthlyPriceCents:number;pixConfigured:boolean;cardConfigured:boolean};
type Pix={invoiceId:string;amountCents:number;qrCode:string;qrCodeBase64:string;ticketUrl:string;expiresAt:string};
type Card={configured:boolean;status:string;checkoutUrl:string|null;amountCents:number|null;preapprovalId:string|null};
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('pt-BR'):'—';
// O Mercado Pago exige o atributo HTML `view=checkout` no security.js.
// O Next.js Script renderiza atributos extras, mas não declara `view` em ScriptProps.
const mercadoPagoSecurityAttributes = { view: 'checkout' } as const;
export default function Subscription(){
 const router=useRouter();
 const [document,D]=useState(''),[state,S]=useState<Billing|null>(null),[invoice,I]=useState<Pix|null>(null);
 const [card,CARD]=useState<Card|null>(null),[method,METHOD]=useState<'pix'|'card'>('pix');
 const [loading,L]=useState(true),[busy,B]=useState(false),[error,E]=useState(''),[notice,N]=useState('');
 const load=useCallback(async()=>{
  try{
   const me=await api<{user:{role:string};onboardingRequired:boolean}>('/me');
   if(me.user.role==='SUPERADMIN'){router.replace('/admin');return;}
   if(me.onboardingRequired){router.replace('/atualizar-cadastro');return;}
   const [billing,cardInfo]=await Promise.all([api<Billing>('/billing/status'),api<Card>('/billing/card/status').catch(()=>null)]);
   S(billing);if(cardInfo)CARD(cardInfo);
  }catch(e){if((e as Error).message.includes('Entre na sua conta'))router.replace('/entrar');else E((e as Error).message)}
  finally{L(false)}
 },[router]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{if(!invoice)return;const timer=window.setInterval(async()=>{try{const x=await api<Billing&{paymentStatus:string}>(`/billing/check/${invoice.invoiceId}`,{method:'POST'});if(x.status==='ACTIVE'){I(null);S(x);N('Pix aprovado! Assinatura ativada.');}}catch{}},12000);return()=>clearInterval(timer)},[invoice]);
 useEffect(()=>{if(typeof window==='undefined'||new URLSearchParams(window.location.search).get('cartao')!=='retorno')return;
  N('Você voltou do Mercado Pago. Vamos conferir o status do cartão e os pagamentos aprovados.');
  void refreshCard();
 },[]); // eslint-disable-line react-hooks/exhaustive-deps
 async function createPix(){B(true);E('');N('');try{const candidate=(window as Window & {MP_DEVICE_SESSION_ID?: unknown}).MP_DEVICE_SESSION_ID;const deviceId=(typeof candidate==='string' && /^[A-Za-z0-9._:-]{8,200}$/.test(candidate))?candidate:undefined;I(await api<Pix>('/billing/pix',{method:'POST',body:JSON.stringify({document,...(deviceId?{deviceId}:{})})}))}catch(e){E((e as Error).message)}finally{B(false)}}
 async function confirmPix(){if(!invoice)return;B(true);E('');try{const x=await api<Billing&{paymentStatus:string}>(`/billing/check/${invoice.invoiceId}`,{method:'POST'});S(x);if(x.paymentStatus==='PAID'){I(null);N('Pagamento aprovado. Período de acesso atualizado!');}else N('Pagamento ainda pendente. O acesso será liberado após confirmação do Mercado Pago.')}catch(e){E((e as Error).message)}finally{B(false)}}
 async function startCard(){B(true);E('');N('');try{const x=await api<{checkoutUrl:string}>('/billing/card/start',{method:'POST'});if(!/^https:\/\/[^/]*mercadopago\.com(?:\.br)?\//.test(x.checkoutUrl))throw new Error('O Mercado Pago retornou um link de autorização inválido.');window.location.assign(x.checkoutUrl)}catch(e){E((e as Error).message);B(false)}}
 async function refreshCard(){B(true);E('');try{const c=await api<Card>('/billing/card/status');CARD(c);const billing=await api<Billing>('/billing/status');S(billing);N(billing.status==='ACTIVE'?'Pagamento confirmado: assinatura ativa.':c.status==='AUTHORIZED'?'Cartão autorizado. Aguardando a aprovação da cobrança pelo Mercado Pago.':'Status atualizado. Acesso somente após pagamento aprovado.');}catch(e){E((e as Error).message)}finally{B(false)}}
 async function cancelCard(){if(!window.confirm('Cancelar a renovação automática no cartão? Um período já pago continuará válido até seu vencimento.'))return;B(true);E('');try{await api('/billing/card/cancel',{method:'POST'});await refreshCard();N('Renovação automática cancelada.');}catch(e){E((e as Error).message)}finally{B(false)}}
 if(loading)return <div className="screen-loading"><span className="spinner"/><p>Verificando assinatura do Vezora...</p></div>;
 const active=state?.status==='ACTIVE';const trial=state?.status==='TRIAL';const suspended=state?.status==='SUSPENDED';
 return <main className="subscription-page"><Script src="https://www.mercadopago.com/v2/security.js" strategy="afterInteractive" {...mercadoPagoSecurityAttributes}/><section className="subscription-card subscription-card-wide">
  <div className="subscription-top"><Brand/><Link href="/painel" className="subscription-back"><ArrowLeft size={15}/> Voltar ao painel</Link></div>
  <div className="subscription-icon"><LockKeyhole size={26}/></div>
  <h1>Minha assinatura Vezora</h1>
  <p>Controle o acesso ao sistema e escolha o pagamento. O dinheiro da assinatura vai para a plataforma Vezora, não para a conta de sinais do seu estabelecimento.</p>
  <div className="subscription-status" role="status"><BadgeCheck size={19}/><div><b>{active?'Assinatura ativa':trial?'Teste grátis em andamento':suspended?'Estabelecimento suspenso':'Assinatura pendente ou vencida'}</b><small>{active?`Vencimento: ${date(state?.subscriptionEndsAt||null)}`:trial?`Teste até ${date(state?.trialEndsAt||null)} · ${state?.daysRemaining} dia(s) restante(s)`:suspended?'Contate a administração do Vezora.':'Escolha Pix ou cartão para continuar.'}</small></div></div>
  <div className="subscription-price"><span>Plano Vezora — cobrança mensal</span><strong>{state?.monthlyPriceCents?brl(state.monthlyPriceCents):'A definir'}</strong><small>Pix: pagamento avulso de 30 dias. Cartão: autorização de cobrança mensal automática pelo Mercado Pago.</small></div>
  <div className="signup-trial"><ShieldCheck size={18}/> O Vezora não recebe nem armazena número ou código de segurança do cartão. O pagamento acontece no Mercado Pago.</div>
  {suspended?<div className="alert error">Seu estabelecimento está suspenso. Solicite a liberação ao administrador.</div>:<>
   <div className="payment-methods" role="group" aria-label="Escolha a forma de pagamento">
    <button type="button" className={method==='pix'?'payment-method selected':'payment-method'} onClick={()=>{METHOD('pix');E('');}}><Wallet size={22}/><span><b>Pix</b><small>Pagamento avulso · confirmação automática</small></span></button>
    <button type="button" className={method==='card'?'payment-method selected':'payment-method'} onClick={()=>{METHOD('card');E('');}}><CreditCard size={22}/><span><b>Cartão de crédito</b><small>Cadastro no Mercado Pago · cobrança recorrente</small></span></button>
   </div>
   {method==='pix'&&<div className="payment-content">
    {!state?.pixConfigured?<div className="alert info">Pix indisponível: confira o preço no painel administrativo e as credenciais Mercado Pago de assinaturas no Heroku.</div>
    :!invoice?<div className="form-grid"><label>CPF ou CNPJ do pagador<input value={document} onChange={e=>D(e.target.value)} inputMode="numeric" maxLength={18} placeholder="Somente números"/></label><button className="btn btn-primary wide" disabled={busy||![11,14].includes(document.replace(/\D/g,'').length)} onClick={createPix}><Wallet size={18}/>{busy?'Gerando...':'Gerar Pix da assinatura'}</button><small className="muted">O documento é usado apenas na operação de pagamento, sem salvar no cadastro do Vezora.</small></div>
    :<div className="pix-box"><b>Escaneie o QR Code ou copie o código Pix</b>{invoice.qrCodeBase64&&<img className="pix-qr" src={`data:image/png;base64,${invoice.qrCodeBase64}`} alt="QR Code Pix do pagamento Vezora"/>}<label>Pix copia e cola<textarea readOnly rows={4} value={invoice.qrCode}/></label><button className="btn btn-primary wide" onClick={()=>navigator.clipboard.writeText(invoice.qrCode).then(()=>N('Código Pix copiado')).catch(()=>E('Selecione o código e copie manualmente.'))}><Copy size={17}/> Copiar Pix</button>{invoice.ticketUrl&&<a className="btn btn-outline wide" href={invoice.ticketUrl} target="_blank" rel="noreferrer">Abrir pagamento Mercado Pago</a>}<button className="btn btn-outline wide" disabled={busy} onClick={confirmPix}><RefreshCw size={17}/> Já paguei — verificar</button></div>}
   </div>}
   {method==='card'&&<div className="payment-content card-subscription-content">
    {!state?.cardConfigured?<div className="alert info">Cartão indisponível: confira as credenciais e o webhook da aplicação de assinaturas no Heroku.</div>:<>
     <p>Você será encaminhado ao Mercado Pago para autorizar as cobranças mensais. O cadastro do cartão é feito diretamente lá.</p>
     {card&&['PENDING','AUTHORIZED','PAUSED'].includes(card.status)?<div className="card-state"><b>{card.status==='AUTHORIZED'?'Cartão autorizado, aguardando cobrança aprovada':card.status==='PAUSED'?'Assinatura pausada':'Autorização pendente no Mercado Pago'}</b><div className="card-actions">{card.checkoutUrl&&<a className="btn btn-primary" href={card.checkoutUrl} rel="noopener noreferrer">Continuar no Mercado Pago</a>}<button className="btn btn-outline" disabled={busy} onClick={refreshCard}><RefreshCw size={16}/> Verificar pagamento</button><button className="btn btn-outline" disabled={busy} onClick={cancelCard}>Cancelar renovação</button></div></div>:<button className="btn btn-primary wide" disabled={busy} onClick={startCard}><CreditCard size={18}/>{busy?'Conectando...':'Cadastrar cartão no Mercado Pago'}</button>}
     <small className="muted">A autorização do cartão, isoladamente, não libera o sistema. O acesso é ativado somente após pagamento aprovado.</small>
    </>}
   </div>}
  </>}
  {notice&&<div className="alert success" role="status"><CheckCircle2 size={18}/>{notice}</div>}
  {error&&<div className="alert error" role="alert">{error}</div>}
  <Link href="/painel" className="subscription-footer">Voltar ao painel</Link>
 </section></main>;
}
