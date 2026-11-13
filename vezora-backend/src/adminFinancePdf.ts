/** PDF financeiro administrativo: não contém clientes ou segredos dos lojistas. */
import type {Response} from 'express';
import fs from 'fs';
import path from 'path';
import type {createAdminFinanceReport} from './adminFinance';
export function renderAdminFinancePdf(res:Response,report:Awaited<ReturnType<typeof createAdminFinanceReport>>):void{
 const PDFDocument=require('pdfkit') as any;
 const doc=new PDFDocument({size:'A4',margins:{top:46,left:42,right:42,bottom:48},bufferPages:true,info:{Title:'Vezora | Relatório administrativo',Author:'Vezora'}});
 doc.on('error',(e:Error)=>{console.error('PDF admin:',e);if(!res.headersSent)res.status(500).end();else res.end();});
 doc.pipe(res);
 const W=doc.page.width,wide=W-84;const gold='#D0A969',purple='#312338',ink='#262D39',soft='#F7F4F8',muted='#617081';
 const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100);
 const date=(s:string)=>s.split('-').reverse().join('/');
 const logo=path.resolve(process.cwd(),'vezora-icon.png');
 function header(first=false){doc.rect(0,0,W,first?120:71).fill(purple);
  if(fs.existsSync(logo))doc.image(logo,42,first?21:12,{width:37,height:37});
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(22).text('vezora.',91,first?27:19);
  if(first){doc.fillColor(gold).font('Helvetica-Bold').fontSize(10).text('RELATÓRIO FINANCEIRO • ADMINISTRAÇÃO',42,85);
   doc.fillColor(ink).fontSize(17).text('Resumo consolidado de estabelecimentos',42,147,{width:wide});
   doc.fillColor(muted).font('Helvetica').fontSize(9).text(`Período: ${date(report.period.from)} a ${date(report.period.to)} • Fuso: Brasília`,42,176);
   doc.y=207;
  }else doc.y=91;
 }
 function pageCheck(h=30){if(doc.y+h>doc.page.height-65){doc.addPage();header();}}
 function heading(label:string){pageCheck(35);doc.moveDown(.7);doc.fillColor(ink).font('Helvetica-Bold').fontSize(12).text(label,42,doc.y,{width:wide});doc.moveDown(.4);}
 function table(cols:string[],rows:string[][],widths:number[]){
  function head(){pageCheck(50);const y=doc.y;doc.rect(42,y,wide,25).fill('#EDE7F0');let x=47;
   cols.forEach((v,i)=>{doc.font('Helvetica-Bold').fontSize(8).fillColor(ink).text(v,x,y+8,{width:widths[i]-10,lineBreak:false,ellipsis:true});x+=widths[i]});doc.y=y+25;}
  head();if(!rows.length){doc.fillColor(muted).font('Helvetica').fontSize(9).text('Sem informações no período.',48,doc.y+7);doc.y+=26;return;}
  rows.forEach((row,i)=>{if(doc.y+26>doc.page.height-65)head();const y=doc.y;if(i%2)doc.rect(42,y,wide,24).fill(soft);let x=47;
   row.forEach((v,j)=>{doc.fillColor(ink).font('Helvetica').fontSize(8).text(String(v),x,y+7,{width:widths[j]-10,lineBreak:false,ellipsis:true});x+=widths[j];});doc.y=y+24;});
 }
 header(true);
 const t=report.totals;
 const cards:[string,string][]=[['Produção concluída',money(t.completedRevenueCents)],['Recebimentos informados',money(t.collectedCents)],['Saldo pendente',money(t.outstandingCents)],['Assinaturas Vezora recebidas',money(t.subscriptionReceivedCents)]];
 const half=(wide-12)/2;const base=doc.y;
 cards.forEach(([label,value],i)=>{const x=42+(i%2)*(half+12),y=base+Math.floor(i/2)*82;doc.roundedRect(x,y,half,72,8).fill(soft);doc.fillColor(muted).font('Helvetica').fontSize(9).text(label,x+12,y+13,{width:half-24});doc.fillColor(ink).font('Helvetica-Bold').fontSize(17).text(value,x+12,y+37,{width:half-24});});
 doc.y=base+175;
 heading('Visão operacional');
 table(['Indicador','Total'],[
  ['Estabelecimentos no relatório',String(report.items.length)],['Atendimentos concluídos',String(t.completed)],
  ['Confirmados',String(t.confirmed)],['Cancelados',String(t.cancelled)],
  ['Comissões previstas',money(t.commissionsCents)],['Salários mensais cadastrados (referência)',money(t.monthlySalariesCents)],
  ['Sinais pagos (atendimentos concluídos)',money(t.depositsCents)],['Recebimentos informados manualmente',money(t.manualCents)]
 ],[wide*.70,wide*.30]);
 heading('Faturamento por estabelecimento');
 const list=report.items.slice(0,80);
 table(['Estabelecimento','Concluídos','Produção','Recebido','Pendente'],list.map(s=>[s.name,String(s.completed),money(s.completedRevenueCents),money(s.collectedCents),money(s.outstandingCents)]),[wide*.34,wide*.12,wide*.18,wide*.18,wide*.18]);
 if(report.items.length>80){doc.font('Helvetica').fontSize(9).fillColor(muted).text(`Exibidos os 80 maiores de ${report.items.length} estabelecimentos. O CSV contém a lista completa.`,42,doc.y+5,{width:wide});doc.moveDown(1);}
 heading('Notas de conferência');
 doc.font('Helvetica').fontSize(8.5).fillColor(muted).text(
 'Relatório gerencial, não fiscal. A produção é apurada pela data do atendimento concluído; valores informados manualmente dependem do registro do lojista. Não equivale a extrato bancário. Assinaturas da plataforma não integram o faturamento dos lojistas. Comissões e salários cadastrados não representam comprovantes de pagamento.',42,doc.y,{width:wide});
 if(t.legacyPriceCount||t.legacyCommissionCount){doc.moveDown(.5);doc.fillColor('#9C662B').text(`Dados históricos: ${t.legacyPriceCount} reservas sem preço original e ${t.legacyCommissionCount} sem comissão original. Nesses casos, foram utilizadas estimativas conforme cadastro atual.`,42,doc.y,{width:wide});}
 const pages=doc.bufferedPageRange();for(let p=pages.start;p<pages.start+pages.count;p++){doc.switchToPage(p);doc.strokeColor('#e5ddea').lineWidth(.6).moveTo(42,doc.page.height-37).lineTo(W-42,doc.page.height-37).stroke();doc.font('Helvetica').fillColor(muted).fontSize(8).text('Vezora • Uso interno do superadministrador',42,doc.page.height-29,{width:wide-55,lineBreak:false});doc.text(`${p-pages.start+1}/${pages.count}`,W-75,doc.page.height-29,{width:30,align:'right',lineBreak:false});}
 doc.end();
}
