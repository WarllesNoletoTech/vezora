'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {
  Activity,ArrowRight,BarChart3,Ban,CalendarDays,Check,ChevronLeft,ChevronRight,Clock3,
  CreditCard,ExternalLink,LayoutDashboard,LogOut,Menu,MessageCircle,RefreshCw,Search,
  Settings2,ShieldCheck,Store,Users,Wallet,X,AlertTriangle,Phone,Receipt,CalendarPlus
} from 'lucide-react';
import Brand from '@/components/Brand';
import {api,brl,whatsappUrl} from '@/lib/api';
import {businessOptions} from '@/lib/business';
import {parseBrlCents} from '@/lib/money';

type Page<T>={items:T[];page:number;pageSize:number;total:number};
type Status='ACTIVE'|'TRIAL'|'EXPIRED'|'SUSPENDED'|'ONBOARDING';
type TenantRow={id:string;name:string;slug:string;businessType:string|null;whatsapp:string;createdAt:string;trialStartsAt:string|null;trialExtensionDays:number;subscriptionEndsAt:string|null;suspendedAt:string|null;suspensionReason:string;billingStatus:Status;owner:{id:string;name:string;email:string;phone:string};_count:{services:number;professionals:number;bookings:number}};
type TenantDetail=TenantRow&{bio:string;address:string;paymentAccount:{sellerUserId:string}|null;subscriptionPayments:{id:string;amountCents:number;status:string;paidAt:string|null;createdAt:string}[]};
type Owner={id:string;name:string;email:string;phone:string;role:'LOJISTA'|'SUPERADMIN';createdAt:string;tenant:{id:string;name:string;slug:string}|null};
type Paid={id:string;status:string;amountCents:number;createdAt:string;paidAt:string|null;expiresAt:string;tenant:{id:string;name:string;slug:string;owner:{name:string;email:string}}};
type Log={id:string;actorId:string;action:string;details:string;tenantId:string|null;createdAt:string};
type Summary={totalTenants:number;totalOwners:number;totalBookings:number;newTenants30:number;monthlyPriceCents:number;receivedTotalCents:number;received30Cents:number;paidPaymentCount:number;statusCounts:Record<string,number>;types:Record<string,number>;latestPayments:{id:string;status:string;amountCents:number;createdAt:string;tenant:{name:string}}[]};
type Settings={monthlyPriceCents:number;updatedAt:string;pixConfigured:boolean;paymentIntegrationConfigured:boolean};
type Tab='overview'|'tenants'|'owners'|'payments'|'settings'|'audit';
const statusLabel:Record<string,string>={ACTIVE:'Assinatura ativa',TRIAL:'Teste grátis',EXPIRED:'Vencido',SUSPENDED:'Suspenso',ONBOARDING:'Cadastro incompleto',PENDING:'Pendente',PAID:'Pago',CANCELLED:'Cancelado'};
const menu:[Tab,string,typeof LayoutDashboard][]=[['overview','Visão geral',LayoutDashboard],['tenants','Estabelecimentos',Store],['owners','Lojistas',Users],['payments','Cobranças Pix',CreditCard],['settings','Configurações',Settings2],['audit','Auditoria',Activity]];
const dt=(value:string|null|undefined)=>value?new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
const statusClass=(status:string)=>status==='ACTIVE'||status==='PAID'?'good':status==='TRIAL'?'trial':status==='SUSPENDED'||status==='EXPIRED'?'bad':'neutral';
function Badge({value}:{value:string}){return <span className={`ad-badge ${statusClass(value)}`}>{statusLabel[value]||value}</span>}
function Pager({page,total,per=15,onChange}:{page:number;total:number;per?:number;onChange:(n:number)=>void}){
 const pages=Math.max(1,Math.ceil(total/per));return <div className="ad-pager"><small>{total.toLocaleString('pt-BR')} registros · Página {page} de {pages}</small><div><button aria-label="Página anterior" disabled={page<=1} onClick={()=>onChange(page-1)}><ChevronLeft size={17}/></button><button aria-label="Próxima página" disabled={page>=pages} onClick={()=>onChange(page+1)}><ChevronRight size={17}/></button></div></div>;
}
export default function AdminPage(){
 const router=useRouter();
 const [gate,G]=useState<'checking'|'ready'|'denied'>('checking');
 const [myName,N]=useState('Administrador');
 const [tab,T]=useState<Tab>('overview');
 const [nav,NAV]=useState(false);
 const [busy,B]=useState(false),[loading,L]=useState(false),[error,E]=useState(''),[notice,MSG]=useState('');
 const [summary,S]=useState<Summary|null>(null),[settings,SET]=useState<Settings|null>(null);
 const [price,PRICE]=useState('');
 const [tenants,TS]=useState<Page<TenantRow>|null>(null),[owners,US]=useState<Page<Owner>|null>(null),[payments,PS]=useState<Page<Paid>|null>(null),[audits,AS]=useState<Page<Log>|null>(null);
 const [detail,D]=useState<TenantDetail|null>(null);
 const [search,SEARCH]=useState(''),[appliedSearch,APPLIED]=useState(''),[category,CAT]=useState('TODOS'),[payStatus,PAY]=useState('TODOS');
 const [page,PAGE]=useState(1);
 useEffect(()=>{api<{user:{name:string;role:string}}>('/me').then(v=>{if(v.user.role!=='SUPERADMIN'){G('denied');return;}N(v.user.name);G('ready');}).catch(()=>router.replace('/entrar'))},[router]);
 const load=useCallback(async()=>{
  L(true);E('');try{
   if(tab==='overview')S(await api<Summary>('/admin/summary'));
   if(tab==='settings'){const x=await api<Settings>('/admin/settings');SET(x);PRICE((x.monthlyPriceCents/100).toFixed(2).replace('.',','));}
   if(tab==='tenants')TS(await api<Page<TenantRow>>(`/admin/tenants?page=${page}&search=${encodeURIComponent(appliedSearch)}&businessType=${encodeURIComponent(category)}`));
   if(tab==='owners')US(await api<Page<Owner>>(`/admin/users?page=${page}&search=${encodeURIComponent(appliedSearch)}`));
   if(tab==='payments')PS(await api<Page<Paid>>(`/admin/payments?page=${page}&status=${payStatus}`));
   if(tab==='audit')AS(await api<Page<Log>>(`/admin/audit?page=${page}`));
  }catch(err){E((err as Error).message)}finally{L(false)}
 },[tab,page,appliedSearch,category,payStatus]);
 useEffect(()=>{if(gate==='ready')void load()},[gate,load]);
 function selectTab(next:Tab){T(next);PAGE(1);E('');MSG('');NAV(false);D(null)}
 async function mutation(task:()=>Promise<unknown>,done:string){B(true);E('');MSG('');try{await task();MSG(done);await load();if(detail)D(await api<TenantDetail>(`/admin/tenants/${detail.id}`));}catch(err){E((err as Error).message)}finally{B(false)}}
 async function openTenant(id:string){B(true);E('');try{D(await api<TenantDetail>(`/admin/tenants/${id}`))}catch(e){E((e as Error).message)}finally{B(false)}}
 function changeSuspension(t:TenantRow){
  const suspended=!t.suspendedAt;
  const reason=suspended?window.prompt(`Motivo da suspensão de ${t.name} (mínimo 8 caracteres):`):'Reativado pelo administrador';
  if(reason===null)return;
  if(suspended&&!window.confirm('Suspender este estabelecimento? O agendamento público ficará bloqueado.'))return;
  void mutation(()=>api(`/admin/tenants/${t.id}/suspension`,{method:'PATCH',body:JSON.stringify({suspended,reason})}),suspended?'Estabelecimento suspenso.':'Estabelecimento reativado.');
 }
 function changeDays(t:TenantRow,mode:'trial'|'grant'){
  const raw=window.prompt(mode==='trial'?'Quantos dias adicionais de teste (1 a 30)?':'Quantos dias de acesso conceder manualmente (1 a 365)?');
  if(raw===null)return;
  const days=Number(raw);
  if(!Number.isInteger(days)||days<1||days>(mode==='trial'?30:365)){E('Quantidade de dias inválida.');return;}
  const reason=window.prompt('Justificativa obrigatória (mínimo 8 caracteres):');
  if(reason===null)return;
  if(mode==='grant'&&!window.confirm('Essa concessão NÃO registra receita nem pagamento Pix. Confirmar?'))return;
  void mutation(()=>api(`/admin/tenants/${t.id}/${mode}`,{method:'POST',body:JSON.stringify({days,reason})}),mode==='trial'?'Teste estendido.':'Dias de acesso concedidos (sem receita registrada).');
 }
 function fixPhone(u:Owner){const phone=window.prompt(`Atualizar contato de ${u.name}:`,u.phone);if(phone===null)return;const reason=window.prompt('Justificativa da correção (mínimo 8 caracteres):');if(reason===null)return;void mutation(()=>api(`/admin/users/${u.id}/phone`,{method:'PATCH',body:JSON.stringify({phone,reason})}),'Telefone atualizado.');}
 async function savePrice(){const cents=parseBrlCents(price);
 if(cents===null){E('Informe um valor válido: 39,90, 39.90 ou 0,00 para desativar.');return;}
 if(!window.confirm(`Confirmar a mensalidade em ${brl(cents)}? O novo preço será usado nas próximas cobranças, não nas já emitidas.`))return;
 await mutation(()=>api('/admin/settings',{method:'PATCH',body:JSON.stringify({monthlyPriceCents:cents})}),'Mensalidade alterada com sucesso.');
 }
 const types=useMemo(()=>businessOptions.reduce<Record<string,string>>((acc,x)=>({...acc,[x.value]:x.label}),{}),[]);
 if(gate==='checking')return <div className="screen-loading"><RefreshCw className="spinner"/><p>Validando acesso de administrador...</p></div>;
 if(gate==='denied')return <main className="ad-denied"><ShieldCheck size={38}/><h1>Acesso restrito</h1><p>Esta área exige permissão de superadministrador, concedida pelo servidor.</p><Link href="/painel" className="btn btn-primary">Voltar ao meu painel</Link></main>;
 return <div className="ad-shell">
  <aside className={`ad-sidebar ${nav?'expanded':''}`}>
   <div className="ad-sidebar-top"><Brand light/><span className="ad-admin-pill"><ShieldCheck size={13}/> Administração</span></div>
   <div className="ad-profile"><span className="ad-avatar">{myName.charAt(0).toUpperCase()}</span><div><strong>{myName}</strong><small>Superadministrador</small></div></div>
   <nav aria-label="Menu administrativo">{menu.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>selectTab(id)}><Icon size={18}/>{label}</button>)}</nav>
   <div className="ad-sidebar-bottom"><Link href="/" target="_blank"><ExternalLink size={16}/> Ver site</Link><button onClick={async()=>{await api('/auth/logout',{method:'POST'});router.replace('/entrar')}}><LogOut size={17}/> Sair da conta</button></div>
  </aside>
  {nav&&<button className="ad-overlay" onClick={()=>NAV(false)} aria-label="Fechar menu"/>}
  <main className="ad-main">
   <header className="ad-topbar"><button className="ad-mobile-menu" aria-label="Abrir menu" onClick={()=>NAV(true)}><Menu size={22}/></button><div><small>CONTROLE DA PLATAFORMA</small><h1>{menu.find(([id])=>id===tab)?.[1]}</h1></div><div className="ad-top-actions"><span className="ad-online"><i/> Ambiente administrativo</span><button onClick={()=>void load()} disabled={loading} title="Atualizar dados"><RefreshCw size={18} className={loading?'spinner':''}/></button></div></header>
   <div className="ad-content">
    {error&&<div className="alert error" role="alert"><AlertTriangle size={18}/>{error}<button onClick={()=>E('')} aria-label="Fechar"><X size={15}/></button></div>}
    {notice&&<div className="alert success" role="status"><Check size={17}/>{notice}<button onClick={()=>MSG('')} aria-label="Fechar"><X size={15}/></button></div>}
    {tab==='overview'&&<>
      <div className="ad-heading"><div><h2>Seu Vezora em números</h2><p>Indicadores reais dos estabelecimentos e dos pagamentos registrados.</p></div><button className="ad-action" onClick={()=>selectTab('settings')}><Settings2 size={17}/> Configurar mensalidade</button></div>
      <div className="ad-stat-grid">
       <Stat label="Estabelecimentos" value={summary?.totalTenants.toLocaleString('pt-BR')||'—'} icon={<Store/>} hint={`${summary?.newTenants30||0} novos nos últimos 30 dias`}/>
       <Stat label="Assinaturas ativas" value={summary?.statusCounts.ACTIVE.toLocaleString('pt-BR')||'—'} icon={<ShieldCheck/>} hint="Período pago vigente"/>
       <Stat label="Em teste grátis" value={summary?.statusCounts.TRIAL.toLocaleString('pt-BR')||'—'} icon={<Clock3/>} hint="Teste de 3 dias"/>
       <Stat label="Recebido nos últimos 30 dias" value={summary?brl(summary.received30Cents):'—'} icon={<Wallet/>} hint="Somente Pix confirmado"/>
       <Stat label="Receita Pix acumulada" value={summary?brl(summary.receivedTotalCents):'—'} icon={<Receipt/>} hint={`${summary?.paidPaymentCount||0} pagamentos aprovados`}/>
       <Stat label="Agendamentos registrados" value={summary?.totalBookings.toLocaleString('pt-BR')||'—'} icon={<CalendarDays/>} hint="Em todos os estabelecimentos"/>
      </div>
      <div className="ad-two-panels">
       <section className="ad-panel"><div className="ad-panel-heading"><h3>Situação dos estabelecimentos</h3><button onClick={()=>selectTab('tenants')}>Ver todos <ArrowRight size={16}/></button></div><div className="ad-status-grid">{(['ACTIVE','TRIAL','EXPIRED','SUSPENDED','ONBOARDING'] as const).map(st=><div key={st}><Badge value={st}/><strong>{summary?.statusCounts[st]||0}</strong></div>)}</div></section>
       <section className="ad-panel"><div className="ad-panel-heading"><h3>Últimas cobranças</h3><button onClick={()=>selectTab('payments')}>Ver histórico <ArrowRight size={16}/></button></div>{summary?.latestPayments.length?summary.latestPayments.map(p=><div className="ad-simple-row" key={p.id}><div><strong>{p.tenant.name}</strong><small>{dt(p.createdAt)}</small></div><div><strong>{brl(p.amountCents)}</strong><Badge value={p.status}/></div></div>):<p className="ad-empty">Nenhuma cobrança registrada ainda.</p>}</section>
      </div>
      <section className="ad-panel"><div className="ad-panel-heading"><h3>Segmentos cadastrados</h3><span className="ad-muted">Distribuição de negócios</span></div><div className="ad-category-grid">{summary&&Object.entries(summary.types).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k}><span>{types[k]||'Não informado'}</span><div className="ad-bar-track"><span style={{width:`${summary.totalTenants?100*v/summary.totalTenants:0}%`}}/></div><strong>{v}</strong></div>)}</div></section>
     </>}
    {tab==='tenants'&&<>
      <div className="ad-heading"><div><h2>Gerenciar estabelecimentos</h2><p>Filtre, consulte, suspenda, reative e ajuste o acesso dos lojistas.</p></div><a className="ad-action" href="/api/admin/export/tenants"><Receipt size={17}/> Exportar CSV</a></div>
      <div className="ad-filters"><form onSubmit={e=>{e.preventDefault();PAGE(1);APPLIED(search)}}><Search size={17}/><input placeholder="Nome, slug, e-mail ou telefone" value={search} onChange={e=>SEARCH(e.target.value)}/><button>Pesquisar</button></form><select aria-label="Tipo de negócio" value={category} onChange={e=>{CAT(e.target.value);PAGE(1)}}><option value="TODOS">Todas as categorias</option>{businessOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
      <section className="ad-panel ad-table-wrap"><table className="ad-table"><thead><tr><th>Estabelecimento</th><th>Proprietário</th><th>Situação</th><th>Agendamentos</th><th>Ações</th></tr></thead><tbody>{tenants?.items.map(t=><tr key={t.id}><td><strong>{t.name}</strong><small>/{t.slug} · {types[t.businessType||'']||'Não definido'}</small></td><td><strong>{t.owner.name}</strong><small>{t.owner.phone||'Sem telefone'} · {t.owner.email}</small></td><td><Badge value={t.billingStatus}/></td><td>{t._count.bookings}</td><td><button className="ad-link" onClick={()=>void openTenant(t.id)}>Gerenciar <ChevronRight size={16}/></button></td></tr>)}</tbody></table>{!tenants?.items.length&&<p className="ad-empty">Nenhum estabelecimento encontrado.</p>}<Pager page={page} total={tenants?.total||0} onChange={PAGE}/></section>
     </>}
    {tab==='owners'&&<>
      <div className="ad-heading"><div><h2>Lojistas e usuários</h2><p>Dados de contato registrados no cadastro. Apenas administradores podem acessar esta lista.</p></div></div>
      <div className="ad-filters"><form onSubmit={e=>{e.preventDefault();PAGE(1);APPLIED(search)}}><Search size={17}/><input value={search} onChange={e=>SEARCH(e.target.value)} placeholder="Buscar nome, e-mail ou telefone"/><button>Pesquisar</button></form></div>
      <section className="ad-panel ad-table-wrap"><table className="ad-table"><thead><tr><th>Nome e e-mail</th><th>WhatsApp</th><th>Estabelecimento</th><th>Criado em</th><th>Ações</th></tr></thead><tbody>{owners?.items.map(u=><tr key={u.id}><td><strong>{u.name}</strong><small>{u.email}</small></td><td>{u.phone||<span className="ad-muted">A atualizar</span>}</td><td>{u.tenant?.name||'Administrador'}</td><td>{dt(u.createdAt)}</td><td><div className="ad-cell-actions">{u.phone&&<a className="ad-icon-link" title="Abrir WhatsApp" href={whatsappUrl(u.phone,`Olá, ${u.name}. Aqui é da administração do Vezora.`)} target="_blank" rel="noreferrer"><MessageCircle size={17}/></a>}<button className="ad-link" disabled={busy} onClick={()=>fixPhone(u)}>Corrigir número</button></div></td></tr>)}</tbody></table>{!owners?.items.length&&<p className="ad-empty">Nenhum usuário encontrado.</p>}<Pager page={page} total={owners?.total||0} onChange={PAGE}/></section>
     </>}
    {tab==='payments'&&<>
      <div className="ad-heading"><div><h2>Histórico de cobranças Pix</h2><p>Os valores pagos são confirmados pelo Mercado Pago. Concessões manuais não aparecem como receita.</p></div><a className="ad-action" href="/api/admin/export/payments"><Receipt size={17}/> Exportar CSV</a></div>
      <div className="ad-filters"><select value={payStatus} onChange={e=>{PAY(e.target.value);PAGE(1)}} aria-label="Filtrar pagamentos"><option value="TODOS">Todos os pagamentos</option><option value="PAID">Pagos</option><option value="PENDING">Pendentes</option><option value="EXPIRED">Expirados</option><option value="CANCELLED">Cancelados</option></select></div>
      <section className="ad-panel ad-table-wrap"><table className="ad-table"><thead><tr><th>Estabelecimento</th><th>Valor</th><th>Estado</th><th>Emissão</th><th>Pago em</th></tr></thead><tbody>{payments?.items.map(p=><tr key={p.id}><td><strong>{p.tenant.name}</strong><small>{p.tenant.owner.email}</small></td><td><strong>{brl(p.amountCents)}</strong></td><td><Badge value={p.status}/></td><td>{dt(p.createdAt)}</td><td>{dt(p.paidAt)}</td></tr>)}</tbody></table>{!payments?.items.length&&<p className="ad-empty">Nenhuma cobrança encontrada.</p>}<Pager page={page} total={payments?.total||0} onChange={PAGE}/></section>
     </>}
    {tab==='settings'&&<>
      <div className="ad-heading"><div><h2>Configurações comerciais</h2><p>Defina a mensalidade diretamente no painel. O valor é salvo no MongoDB.</p></div></div>
      <div className="ad-two-panels"><section className="ad-panel ad-settings-card"><div className="ad-panel-heading"><h3>Mensalidade dos lojistas</h3><CreditCard size={22}/></div><label>Valor da assinatura por 30 dias (R$)<input value={price} onChange={e=>PRICE(e.target.value)} inputMode="decimal" placeholder="Ex.: 39,90"/></label><p>Use <b>0,00</b> para desativar novas cobranças. Alterações não modificam Pix já emitidos, e assinaturas existentes mantêm sua data de vencimento.</p><button className="ad-primary" disabled={busy} onClick={()=>void savePrice()}><Check size={17}/>{busy?'Salvando...':'Salvar mensalidade'}</button></section>
      <section className="ad-panel ad-settings-card"><div className="ad-panel-heading"><h3>Integração de cobrança</h3><Wallet size={22}/></div><div className="ad-setting-row"><span>Preço configurado</span><strong>{settings?brl(settings.monthlyPriceCents):'—'}</strong></div><div className="ad-setting-row"><span>Mercado Pago da plataforma</span><Badge value={settings?.paymentIntegrationConfigured?'ACTIVE':'ONBOARDING'}/></div><div className="ad-setting-row"><span>Emissão de Pix</span><Badge value={settings?.pixConfigured?'ACTIVE':'EXPIRED'}/></div><p>Credenciais secretas continuam exclusivamente no Heroku. Somente o preço é gerenciado aqui.</p><div className="ad-info"><ShieldCheck size={19}/>O acesso é renovado apenas após pagamento aprovado pelo Mercado Pago ou concessão administrativa auditada.</div></section></div>
     </>}
    {tab==='audit'&&<>
      <div className="ad-heading"><div><h2>Registro de auditoria</h2><p>Histórico de ajustes de preços, suspensões, concessões de acesso e alterações de contato.</p></div></div>
      <section className="ad-panel ad-table-wrap"><table className="ad-table"><thead><tr><th>Data</th><th>Ação</th><th>Justificativa / detalhe</th><th>Estabelecimento ID</th></tr></thead><tbody>{audits?.items.map(a=><tr key={a.id}><td>{dt(a.createdAt)}</td><td><strong>{a.action.replaceAll('_',' ')}</strong></td><td>{a.details}</td><td><small>{a.tenantId||'Plataforma'}</small></td></tr>)}</tbody></table>{!audits?.items.length&&<p className="ad-empty">Ainda não há ações administrativas registradas.</p>}<Pager page={page} total={audits?.total||0} onChange={PAGE}/></section>
     </>}
   </div>
  </main>
  {detail&&<div className="ad-detail-backdrop" onClick={()=>D(null)}><aside className="ad-detail" onClick={e=>e.stopPropagation()} aria-label="Detalhes do estabelecimento"><div className="ad-detail-head"><div><small>GERENCIAMENTO DO LOJISTA</small><h2>{detail.name}</h2></div><button onClick={()=>D(null)} aria-label="Fechar"><X size={20}/></button></div><div className="ad-detail-content"><Badge value={detail.billingStatus}/><p className="ad-muted">/{detail.slug} · {types[detail.businessType||'']||'Categoria pendente'}</p>
    <div className="ad-detail-box"><h3>Proprietário</h3><p><Users size={16}/> {detail.owner.name}</p><p>{detail.owner.email}</p><p><Phone size={16}/> {detail.owner.phone||'WhatsApp não informado'}</p>{detail.owner.phone&&<a className="ad-action" href={whatsappUrl(detail.owner.phone,`Olá, ${detail.owner.name}! Aqui é do suporte Vezora.`)} target="_blank" rel="noreferrer"><MessageCircle size={16}/> Conversar no WhatsApp</a>}</div>
    <div className="ad-detail-box"><h3>Dados operacionais</h3><div className="ad-setting-row"><span>Serviços</span><strong>{detail._count.services}</strong></div><div className="ad-setting-row"><span>Profissionais</span><strong>{detail._count.professionals}</strong></div><div className="ad-setting-row"><span>Reservas</span><strong>{detail._count.bookings}</strong></div><div className="ad-setting-row"><span>Teste iniciado</span><strong>{dt(detail.trialStartsAt)}</strong></div><div className="ad-setting-row"><span>Vencimento pago</span><strong>{dt(detail.subscriptionEndsAt)}</strong></div><div className="ad-setting-row"><span>Extensão de teste</span><strong>{detail.trialExtensionDays??0} dias</strong></div><div className="ad-setting-row"><span>Mercado Pago</span><strong>{detail.paymentAccount?'Conectado':'Não conectado'}</strong></div></div>
    <div className="ad-detail-box"><h3>Gerenciamento de acesso</h3><p className="ad-muted">Todas as alterações são registradas em auditoria. Não geram pagamento fictício.</p><div className="ad-detail-actions"><button disabled={busy} onClick={()=>changeDays(detail,'trial')}><Clock3 size={17}/> Estender teste</button><button disabled={busy} onClick={()=>changeDays(detail,'grant')}><CalendarPlus size={17}/> Conceder acesso</button><button className={detail.suspendedAt?'ad-restore':'ad-danger'} disabled={busy} onClick={()=>changeSuspension(detail)}>{detail.suspendedAt?<Check size={17}/>:<Ban size={17}/>} {detail.suspendedAt?'Reativar estabelecimento':'Suspender estabelecimento'}</button><Link target="_blank" href={`/${detail.slug}`}><ExternalLink size={17}/> Abrir página pública</Link></div>{detail.suspensionReason&&<p className="ad-error-note">Motivo da suspensão: {detail.suspensionReason}</p>}</div>
    <div className="ad-detail-box"><h3>Últimas cobranças</h3>{detail.subscriptionPayments.length?detail.subscriptionPayments.map(p=><div className="ad-setting-row" key={p.id}><div><strong>{brl(p.amountCents)}</strong><small>{dt(p.createdAt)}</small></div><Badge value={p.status}/></div>):<p className="ad-muted">Nenhuma cobrança registrada.</p>}</div>
  </div></aside></div>}
 </div>;
}
function Stat({label,value,hint,icon}:{label:string;value:string;hint:string;icon:ReactNode}){return <article className="ad-stat"><div className="ad-stat-head"><span>{label}</span><span className="ad-stat-icon">{icon}</span></div><strong>{value}</strong><small>{hint}</small></article>}
