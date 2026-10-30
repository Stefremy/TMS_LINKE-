import 'server-only'
import * as XLSX from 'xlsx'
import { billingDay } from '@/lib/billing/statistics'
import type { CodReceiptData } from './reembolso-receipt-pdf'

const currency='#,##0.00 "EUR"'
function excelDate(value:string|null|undefined):Date|string {
  const day=billingDay(value)
  return day?new Date(`${day}T12:00:00Z`):'Não registada'
}

/** Export the same immutable request detail used by the PDF; never infer a new amount or payment. */
export function generateCodReceiptExcel(data:CodReceiptData):Buffer {
  if(!data.items.length||!Number.isSafeInteger(data.amountCents)||data.amountCents<=0||data.items.some(item=>!Number.isSafeInteger(item.amountCents)||item.amountCents<=0)||data.items.reduce((sum,item)=>sum+item.amountCents,0)!==data.amountCents) throw new Error('Os valores do extrato não coincidem com o pedido.')
  const status=data.state==='paid'?'Reembolsado':data.state==='review'?'Em revisão — pagamento não confirmado':'Por reembolsar — aguarda pagamento'
  const rows:(string|number|Date|null)[][]=[
    [data.state==='paid'?'LINKE | COMPROVATIVO DE REEMBOLSO':'LINKE | DETALHE DO PEDIDO DE REEMBOLSO'],
    [`REEMB-${data.requestId}`],
    [],
    ['Cliente',null,data.client.name],
    ['Código / NIF',null,[data.client.code,data.client.nif].filter(Boolean).join(' / ')],
    ['Morada',null,[data.client.address,data.client.city].filter(Boolean).join(', ')],
    ['Email',null,data.client.email||''],
    ['Estado',null,status],
    ['Data do pedido',null,excelDate(data.requestedAt)],
    ['Data do reembolso',null,data.state==='paid'?excelDate(data.paidAt):'Pagamento não registado'],
    ['Referência do pagamento',null,data.paymentRef||'Não registada'],
    ['Gerado em',null,excelDate(data.generatedAt)],
    [data.state==='paid'?'Pagamento registado no TMS.':'Este documento não confirma uma transferência efetuada.'],
    [],
    ['#','Data do envio','Guia / Tracking','Valor do reembolso (EUR)'],
    ...data.items.map((item,index)=>[index+1,excelDate(item.date),item.tracking,item.amountCents/100]),
    ['TOTAL DO REEMBOLSO',null,null,data.amountCents/100],
    [],
    ['Valores de cobrança dos envios. Os portes não estão incluídos neste total.'],
  ]
  const sheet=XLSX.utils.aoa_to_sheet(rows,{dateNF:'dd/mm/yyyy'})
  const firstData=16,lastData=15+data.items.length,totalRow=lastData+1
  sheet[`D${totalRow}`]={t:'n',f:`SUM(D${firstData}:D${lastData})`,v:data.amountCents/100,z:currency}
  for(let row=firstData;row<=lastData;row++)sheet[`D${row}`].z=currency
  for(const address of ['C9','C10','C12',...data.items.map((_,i)=>`B${i+firstData}`)]) {
    if(sheet[address]?.t==='n')sheet[address].z='dd/mm/yyyy'
  }
  sheet['!cols']=[{wch:9},{wch:24},{wch:54},{wch:28}]
  sheet['!rows']=rows.map((_,index)=>({hpt:index===0?30:index===5?36:22}))
  sheet['!merges']=[
    ...[0,1,12,rows.length-1].map(row=>({s:{r:row,c:0},e:{r:row,c:3}})),
    ...Array.from({length:9},(_,i)=>i+3).flatMap(row=>[{s:{r:row,c:0},e:{r:row,c:1}},{s:{r:row,c:2},e:{r:row,c:3}}]),
    {s:{r:totalRow-1,c:0},e:{r:totalRow-1,c:2}},
  ]
  sheet['!autofilter']={ref:`A15:D${lastData}`}
  const workbook=XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook,sheet,'Reembolso')
  workbook.Props={Title:`Reembolso ${data.requestId}`,Author:'Linke TMS',Subject:'Extrato discriminativo das guias do pedido de reembolso'}
  return XLSX.write(workbook,{type:'buffer',bookType:'xlsx',compression:true}) as Buffer
}
