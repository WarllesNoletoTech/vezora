'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {AlertTriangle,BarChart3,Download,FileText,RefreshCw,Wallet} from 'lucide-react';
import {api,brl,type Tenant} from '@/lib/api';

type Receipt={id:string;amountCents:number;method:string;note:string;createdAt:string;voidedAt:string|null;voidReason:string|null};
type Line={id:string;startAt:string;clientName:string;serviceName:string;professionalName:string;priceCents:number;receivedCents:number;dueCents:number;commissionCents:number;receipts:Receipt[]};
type Report={tenant:{name:string;timezone:string};period:{from:string;to:string};totals:{completed:number;confirmed:number;cancelled:number;completedRevenueCents:number;scheduledRevenueCents:number;depositsConfirmedCents:number;manualReceivedCents:number;collectedCents:number;outstandingCents:number;commissionsCents:number;monthlySalariesCents:number;legacyUnpricedCount:number;legacyCommissionCount:number};byService:{id:string;name:string;count:number;revenueCents:number}[];byProfessional:{id:string;name:string;count:number;revenueCents:number;commissionCents:number}[];byMethod:{method:string;amountCents:number}[];lines:Line[];payroll:{id:string;name:string;role:string;salaryEnabled:boolean;salaryCents:number;commissionMode:string;commissionValue:number}[]};
const methods:Record<string,string>={CASH:'Dinheiro',PIX:'Pix',CREDIT_CARD:'Cartão de crédito',DEBIT_CARD:'Cartão de débito',TRANSFER:'Transferência',OTHER:'Outro'};
const roles:Record<string,string>={OWNER:'Dono(a)',EMPLOYEE:'Funcionário(a)',CONTRACTOR:'Autônomo(a)'};
function initialPeriod(){const today=new Date();const y=today.getFullYear(),m=String(today.getMonth()+1).padStart(2,'0');return {from:`${y}-${m}-01`,to:`${y}-${m}-${String(today.getDate()).padStart(2,'0')}`};}
const initial=initialPeriod();
function toCents(text:string){const amount=Number(text.replace(',','.'));return Number.isFinite(amount)?Math.round(amount*100):0;}
export default function FinancialReport({tenant,onChanged}:{tenant:Tenant;onChanged:()=>Promise<void>}){
 const [from,F]=useState(initial.from),[to,T]=useState(initial.to);
 const [report,R]=useState<Report|null>(null),[loading,L]=useState(false),[busy,S]=useState(false),[error,E]=useState(''),[message,M]=useState('');
 const [editId,EI]=useState<string|null>(null),[amount,A]=useState(''),[method,PM]=useState('PIX'),[note,N]=useState('');
 const query=useMemo(()=>new URLSearchParams({from,to}).toString(),[from,to]);
 const load=useCallback(async()=>{L(true);E('');try{R(await api<Report>(`/reports/financial?${query}`));}catch(e){E((e as Error).message);}finally{L(false)}},[query]);
 useEffect(()=>{void load()},[load]);
 async function pdf(){S(true);E('');try{
   const res=await fetch(`/api/reports/financial.pdf?${query}`,{cache:'no-store',credentials:'same-origin'});
   if(!res.ok){const body=await res.json().catch(()=>({error:`Erro ${res.status}`}));throw new Error(body.error||`Erro ${res.status}`)}
   const blob=await res.blob();if(!blob.size)throw new Error('O arquivo veio vazio');
   const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=`Vezora-Relatorio-${from}-a-${to}.pdf`;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(u),5000);
 }catch(e){E((e as Error).message)}finally{S(false)}}
 async function receipt(e:FormEvent){e.preventDefault();if(!editId)return;S(true);E('');M('');try{
   await api(`/bookings/${editId}/receipts`,{method:'POST',body:JSON.stringify({amountCents:toCents(amount),method,note})});
   EI(null);A('');N('');M('Recebimento registrado!');await load();await onChanged();
 }catch(err){E((err as Error).message)}finally{S(false)}}
 async function voidReceipt(bookingId:string,receiptId:string){const reason=prompt('Informe o motivo do estorno deste lançamento (mínimo 8 caracteres):');if(reason===null)return;S(true);E('');try{
   await api(`/bookings/${bookingId}/receipts/${receiptId}/void`,{method:'PATCH',body:JSON.stringify({reason})});M('Lançamento estornado e mantido no histórico.');await load();await onChanged();
 }catch(e){E((e as Error).message)}finally{S(false)}}
 const day=(value:string)=>new Date(value).toLocaleDateString('pt-BR',{timeZone:tenant.timezone,day:'2-digit',month:'2-digit',year:'numeric'});
 return <div className="vz-finance">
  <section className="panel"><div className="panel-title"><div><h3>Relatórios financeiros</h3><p>Faturamento, recebimentos, comissões e equipe.</p></div><BarChart3 size={22}/></div>
   <div className="vz-report-filters"><label>Data inicial<input type="date" value={from} max={to} onChange={e=>F(e.target.value)}/></label><label>Data final<input type="date" value={to} min={from} onChange={e=>T(e.target.value)}/></label><button type="button" className="btn btn-outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> Atualizar</button><button type="button" className="btn btn-primary" disabled={busy||loading||!report} onClick={()=>void pdf()}><Download size={16}/>{busy?'Gerando...':'Baixar PDF Vezora'}</button></div>
   <p className="muted small">Valores associados aos atendimentos realizados no período selecionado. Saldos são registrados manualmente; sinais aprovados são conciliados pelo Mercado Pago.</p>
  </section>
  {error&&<div role="alert" className="alert error"><AlertTriangle size={18}/>{error}</div>}{message&&<div role="status" className="alert success">{message}</div>}
  {loading&&<div className="panel" role="status">Atualizando informações financeiras...</div>}
  {report&&!loading&&<>
   <div className="vz-report-stats">
     <div className="vz-report-stat"><span>Faturamento concluído</span><b>{brl(report.totals.completedRevenueCents)}</b><small>{report.totals.completed} atendimentos</small></div>
     <div className="vz-report-stat"><span>Recebimentos registrados</span><b>{brl(report.totals.collectedCents)}</b><small>{brl(report.totals.depositsConfirmedCents)} em sinais</small></div>
     <div className="vz-report-stat"><span>Saldo a receber</span><b>{brl(report.totals.outstandingCents)}</b><small>De atendimentos concluídos</small></div>
     <div className="vz-report-stat"><span>Comissões previstas</span><b>{brl(report.totals.commissionsCents)}</b><small>Não indica repasse pago</small></div>
   </div>
   <div className="vz-report-columns">
     <section className="panel"><div className="panel-title"><div><h3>Produção por serviço</h3><p>Atendimentos concluídos</p></div></div><div className="vz-table-scroll"><table className="vz-report-table"><thead><tr><th>Serviço</th><th>Qtd.</th><th>Faturamento</th></tr></thead><tbody>{report.byService.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.count}</td><td>{brl(x.revenueCents)}</td></tr>)}{!report.byService.length&&<tr><td colSpan={3}>Nenhum atendimento concluído.</td></tr>}</tbody></table></div></section>
     <section className="panel"><div className="panel-title"><div><h3>Produção e comissão</h3><p>Por profissional</p></div></div><div className="vz-table-scroll"><table className="vz-report-table"><thead><tr><th>Profissional</th><th>Produção</th><th>Comissão</th></tr></thead><tbody>{report.byProfessional.map(x=><tr key={x.id}><td>{x.name}<small> {x.count} atend.</small></td><td>{brl(x.revenueCents)}</td><td>{brl(x.commissionCents)}</td></tr>)}{!report.byProfessional.length&&<tr><td colSpan={3}>Sem produção no período.</td></tr>}</tbody></table></div></section>
   </div>
   <section className="panel"><div className="panel-title"><div><h3>Recebimentos e pagamentos</h3><p>Detalhes dos valores recebidos pela loja</p></div><Wallet size={20}/></div>
    <div className="vz-mini-summary"><div><span>Sinais aprovados</span><strong>{brl(report.totals.depositsConfirmedCents)}</strong></div><div><span>Recebimentos manuais</span><strong>{brl(report.totals.manualReceivedCents)}</strong></div><div><span>Reservas confirmadas (previsto)</span><strong>{brl(report.totals.scheduledRevenueCents)}</strong></div></div>
    <div className="vz-table-scroll"><table className="vz-report-table"><thead><tr><th>Forma registrada</th><th>Total</th></tr></thead><tbody>{report.byMethod.map(x=><tr key={x.method}><td>{methods[x.method]||x.method}</td><td>{brl(x.amountCents)}</td></tr>)}{!report.byMethod.length&&<tr><td colSpan={2}>Nenhum lançamento manual neste período.</td></tr>}</tbody></table></div>
   </section>
   <section className="panel"><div className="panel-title"><div><h3>Controle de recebimentos por atendimento</h3><p>Registre o saldo recebido na loja depois de concluir o atendimento.</p></div><FileText size={20}/></div>
    <div className="vz-table-scroll"><table className="vz-report-table"><thead><tr><th>Data / Cliente</th><th>Serviço</th><th>Valor</th><th>Registrado</th><th>Pendente</th><th>Ações</th></tr></thead><tbody>{report.lines.map(x=><tr key={x.id}><td>{day(x.startAt)}<small>{x.clientName}</small></td><td>{x.serviceName}<small>{x.professionalName}</small></td><td>{brl(x.priceCents)}</td><td>{brl(x.receivedCents)}</td><td>{brl(x.dueCents)}</td><td>{x.dueCents>0?<button type="button" className="btn btn-outline btn-small" onClick={()=>{EI(x.id);A((x.dueCents/100).toFixed(2));PM('PIX');N('')}}>Registrar</button>:<span className="vz-paid">Recebido</span>}{x.receipts.filter(a=>!a.voidedAt).map(v=><div className="vz-receipt-line" key={v.id}>{methods[v.method]||v.method}: {brl(v.amountCents)} <button className="vz-void" type="button" disabled={busy} onClick={()=>void voidReceipt(x.id,v.id)}>Estornar</button></div>)}</td></tr>)}{!report.lines.length&&<tr><td colSpan={6}>Conclua um atendimento para registrar recebimentos.</td></tr>}</tbody></table></div>
   </section>
   <section className="panel"><div className="panel-title"><div><h3>Salários mensais da equipe</h3><p>Valores contratados cadastrados, não pagamentos realizados.</p></div></div>
     <div className="vz-table-scroll"><table className="vz-report-table"><thead><tr><th>Profissional</th><th>Vínculo</th><th>Salário por mês</th><th>Comissão acordada</th></tr></thead><tbody>{report.payroll.map(x=><tr key={x.id}><td>{x.name}</td><td>{roles[x.role]||x.role}</td><td>{x.salaryEnabled?brl(x.salaryCents):'Não recebe salário'}</td><td>{x.commissionMode==='PERCENT'?`${x.commissionValue}%`:x.commissionMode==='FIXED'?brl(x.commissionValue):'Sem comissão'}</td></tr>)}</tbody></table></div>
     <div className="vz-salary-total"><span>Valor mensal cadastrado para salários</span><strong>{brl(report.totals.monthlySalariesCents)}</strong></div>
   </section>
   {(report.totals.legacyUnpricedCount>0||report.totals.legacyCommissionCount>0)&&<div className="alert info"><AlertTriangle size={18}/>Existem atendimentos anteriores à atualização: {report.totals.legacyUnpricedCount} sem preço histórico e {report.totals.legacyCommissionCount} sem comissão histórica. Para esses registros, a estimativa usa os valores atuais.</div>}
   <p className="muted small vz-footnote">Relatório gerencial: não substitui documentos fiscais ou extratos bancários. Comissões e salários são previsões, não comprovantes de pagamento.</p>
  </>}
  {editId&&<div className="modal-backdrop" onClick={()=>EI(null)}><div className="modal" role="dialog" aria-modal="true" aria-label="Registrar recebimento" onClick={e=>e.stopPropagation()}><div className="modal-heading"><h2>Registrar recebimento</h2><button aria-label="Fechar" type="button" className="icon-button" onClick={()=>EI(null)}>×</button></div><form className="form-grid" onSubmit={receipt}><label>Valor recebido (R$)<input type="number" required min="0.01" step="0.01" value={amount} onChange={e=>A(e.target.value)}/></label><label>Forma de pagamento<select value={method} onChange={e=>PM(e.target.value)}>{Object.entries(methods).map(([key,text])=><option key={key} value={key}>{text}</option>)}</select></label><label>Observação (opcional)<input value={note} maxLength={140} onChange={e=>N(e.target.value)} placeholder="Ex.: pagamento na recepção"/></label><p className="muted small">Registre apenas pagamentos realmente recebidos. Sinais já aprovados pelo Mercado Pago são contabilizados automaticamente.</p><button type="submit" disabled={busy} className="btn btn-primary wide">{busy?'Registrando...':'Confirmar recebimento'}</button></form></div></div>}
 </div>
}
