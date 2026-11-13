import type {Response} from 'express';
import path from 'path';
import fs from 'fs';
import type {financialSummary} from './finance';

type Report = ReturnType<typeof financialSummary>&{
  tenant:{id:string;name:string;slug:string;timezone:string};
  period:{from:string;to:string};generatedAt:Date;
};
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100);
const day=(iso:string)=>iso.split('-').reverse().join('/');
const dark='#211E2B', purple='#774566', gold='#CFAC76', grey='#647084',light='#F4F0F5';
export function renderFinancialPdf(res:Response,r:Report):void {
  // pdfkit é importado em runtime; o logo é um PNG próprio, sem baixar imagens externas.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument=require('pdfkit') as any;
  const doc=new PDFDocument({size:'A4',margins:{top:44,bottom:52,left:44,right:44},bufferPages:true,info:{Title:`Vezora | Financeiro - ${r.tenant.name}`,Author:'Vezora',Subject:'Relatório financeiro gerencial'}});
  doc.on('error',(e:Error)=>{console.error('Erro ao gerar PDF financeiro',e);if(!res.headersSent)res.status(500).end('Falha ao gerar PDF');else res.end();});
  doc.pipe(res);
  const W=doc.page.width, left=44, wide=W-88;
  const icon=path.resolve(process.cwd(),'vezora-icon.png');
  function banner(first:boolean){
    doc.rect(0,0,W,first?122:74).fill(dark);
    if(fs.existsSync(icon))doc.image(icon,left,first?25:17,{width:35,height:35});
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(23).text('vezora.',89,first?27:20,{lineBreak:false});
    doc.fillColor(gold).font('Helvetica-Bold').fontSize(9).text('RELATÓRIO FINANCEIRO',left,first?83:58,{lineBreak:false});
    if(first){
      doc.fillColor(dark).font('Helvetica-Bold').fontSize(20).text(r.tenant.name,left,145,{width:wide});
      doc.fillColor(grey).font('Helvetica').fontSize(10).text(`Período dos atendimentos: ${day(r.period.from)} a ${day(r.period.to)}`,left,175);
      doc.text(`Gerado em ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:r.tenant.timezone}).format(r.generatedAt)}`,left,191);
      doc.y=216;
    }else doc.y=91;
  }
  function space(n=14){doc.y+=n;}
  function section(txt:string){if(doc.y>684){doc.addPage();banner(false);}doc.fillColor(dark).font('Helvetica-Bold').fontSize(12).text(txt,left,doc.y,{width:wide});space(8);}
  function card(x:number,y:number,w:number,title:string,val:string){
    doc.roundedRect(x,y,w,77,8).fill(light);
    doc.fillColor(grey).font('Helvetica').fontSize(8.5).text(title,x+12,y+14,{width:w-24});
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(16).text(val,x+12,y+38,{width:w-24});
  }
  function table(headers:string[],rows:string[][],widths:number[]){
    const baseHeight=23;const start=left;
    function rowHead(){
      if(doc.y>715){doc.addPage();banner(false);}
      const yy=doc.y;
      doc.rect(start,yy,wide,26).fill('#E9E3ED');
      let col=start+7;headers.forEach((h,i)=>{doc.fillColor(dark).font('Helvetica-Bold').fontSize(8).text(h,col,yy+8,{width:widths[i]-10,ellipsis:true,lineBreak:false});col+=widths[i];});
      doc.y=yy+26;
    }
    rowHead();
    if(!rows.length){doc.fillColor(grey).font('Helvetica').fontSize(9).text('Sem registros no período.',start+6,doc.y+7);doc.y+=27;return;}
    for(let n=0;n<rows.length;n++){
      if(doc.y>718)rowHead();
      const yy=doc.y;
      if(n%2===1)doc.rect(start,yy,wide,baseHeight).fill('#FAF9FB');
      let x=start+7;
      rows[n].forEach((cell,i)=>{doc.fillColor(dark).font('Helvetica').fontSize(8).text(String(cell),x,yy+7,{width:widths[i]-10,ellipsis:true,lineBreak:false});x+=widths[i];});
      doc.y=yy+baseHeight;
    }
  }
  banner(true);
  const cards=[
    ['Faturamento dos concluídos',money(r.totals.completedRevenueCents)],
    ['Recebimentos registrados',money(r.totals.collectedCents)],
    ['Saldo não recebido',money(r.totals.outstandingCents)],
    ['Comissões previstas',money(r.totals.commissionsCents)],
  ];
  const half=(wide-12)/2;
  const cardsStart=doc.y;
  cards.forEach(([label,value],i)=>card(left+(i%2)*(half+12),cardsStart+Math.floor(i/2)*88,half,label,value));
  doc.y=cardsStart+177;
  section('Resumo de movimentações');
  table(['Indicador','Valor'],[
    ['Atendimentos concluídos',String(r.totals.completed)],
    ['Agendamentos confirmados (a realizar)',String(r.totals.confirmed)],
    ['Agendamentos cancelados',String(r.totals.cancelled)],
    ['Recebido antecipadamente por sinal',money(r.totals.depositsConfirmedCents)],
    ['Recebido e registrado no estabelecimento',money(r.totals.manualReceivedCents)],
    ['Receita prevista de reservas confirmadas',money(r.totals.scheduledRevenueCents)],
    ['Salários mensais cadastrados (referência)',money(r.totals.monthlySalariesCents)],
  ],[wide*.67,wide*.33]);
  space(18);
  section('Serviços concluídos');
  table(['Serviço','Atendimentos','Faturamento'],r.byService.map(x=>[x.name,String(x.count),money(x.revenueCents)]),[wide*.50,wide*.20,wide*.30]);
  space(18);
  section('Profissionais — produção e comissões');
  table(['Profissional','Atendimentos','Produção','Comissão'],r.byProfessional.map(x=>[x.name,String(x.count),money(x.revenueCents),money(x.commissionCents)]),[wide*.40,wide*.15,wide*.23,wide*.22]);
  space(18);
  section('Recebimentos lançados por forma de pagamento');
  const methods:{[k:string]:string}={CASH:'Dinheiro',PIX:'Pix',CREDIT_CARD:'Crédito',DEBIT_CARD:'Débito',TRANSFER:'Transferência',OTHER:'Outro'};
  table(['Forma (manual)','Valor'],r.byMethod.map(x=>[methods[x.method]||x.method,money(x.amountCents)]),[wide*.65,wide*.35]);
  space(18);
  section('Atendimentos concluídos — detalhamento');
  table(['Data','Serviço / cliente','Valor','Recebido','Pendente'],r.lines.map(x=>[
    new Intl.DateTimeFormat('pt-BR',{timeZone:r.tenant.timezone,day:'2-digit',month:'2-digit',year:'2-digit'}).format(x.startAt),
    `${x.serviceName} / ${x.clientName}`,money(x.priceCents),money(x.receivedCents),money(x.dueCents)
  ]),[wide*.15,wide*.37,wide*.16,wide*.16,wide*.16]);
  space(14);
  if(doc.y>685){doc.addPage();banner(false);}
  doc.fillColor(grey).font('Helvetica').fontSize(8).text(
    'Notas: Este é um relatório gerencial, não um comprovante fiscal ou extrato bancário. Receitas são agrupadas pela data do atendimento concluído; pagamentos manuais dependem de lançamento do lojista. Salários são valores mensais cadastrados, não despesas comprovadamente pagas. Comissões são previstas, não repasses realizados.',
    left,doc.y,{width:wide,align:'left'});
  if(r.totals.legacyUnpricedCount||r.totals.legacyCommissionCount){space(5);doc.fillColor('#9A5A23').fontSize(8).text(`Atenção: ${r.totals.legacyUnpricedCount} reserva(s) antigas sem preço histórico e ${r.totals.legacyCommissionCount} sem comissão histórica. Esses dados usam a configuração atual como estimativa.`,left,doc.y,{width:wide});}
  const range=doc.bufferedPageRange();
  for(let i=range.start;i<range.start+range.count;i++){
    doc.switchToPage(i);
    doc.strokeColor('#E5DCE5').lineWidth(0.6).moveTo(left,doc.page.height-38).lineTo(W-left,doc.page.height-38).stroke();
    doc.fillColor(grey).font('Helvetica').fontSize(8).text('Vezora • Relatório financeiro • Uso interno do estabelecimento',left,doc.page.height-31,{width:wide-50,lineBreak:false});
    doc.text(`${i-range.start+1}/${range.count}`,W-80,doc.page.height-31,{width:35,align:'right',lineBreak:false});
  }
  doc.end();
}
