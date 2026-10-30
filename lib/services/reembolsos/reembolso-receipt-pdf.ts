import 'server-only'
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface CodReceiptData {
  requestId:string; requestedAt:string; generatedAt:string; state:'requested'|'paid'|'review'; paidAt?:string; paymentRef?:string
  client:{name:string;code?:string;nif?:string;address?:string;city?:string;email?:string}
  amountCents:number
  items:{shipmentId:string;tracking:string;amountCents:number;date:string|null}[]
}
const clean=(value:string)=>value.normalize('NFKC').replace(/[^\x20-\x7e\xa0-\xff\u20ac]/g,' ').trim()
const money=(cents:number)=>(cents/100).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})+' EUR'
const date=(value:string|null|undefined)=>value?new Date(value.length===10?`${value}T12:00:00Z`:value).toLocaleDateString('pt-PT',{timeZone:'Europe/Lisbon'}):'Não registada'

/** TMS reimbursement detail, using the same A4/navy/table visual language as invoice statements. */
export async function generateCodReceiptPdf(data:CodReceiptData):Promise<Buffer> {
  if(!data.items.length||!Number.isSafeInteger(data.amountCents)||data.amountCents<=0||data.items.some(i=>!Number.isSafeInteger(i.amountCents)||i.amountCents<=0)||data.items.reduce((sum,i)=>sum+i.amountCents,0)!==data.amountCents) throw new Error('Os valores do comprovativo não coincidem com o pedido.')
  const doc=await PDFDocument.create(),normal=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold)
  const navy=rgb(.06,.09,.16),muted=rgb(.39,.43,.49),green=rgb(.08,.40,.24),line=rgb(.85,.88,.91),pale=rgb(.97,.98,.99),white=rgb(1,1,1)
  let logo:PDFImage|undefined
  try {logo=await doc.embedPng(await readFile(join(process.cwd(),'public/Linke-logo.png')))} catch { /* The text brand remains when the image is unavailable. */ }
  const status=data.state==='paid'?'PAGO AO CLIENTE':data.state==='review'?'EM REVISÃO - PAGAMENTO NÃO CONFIRMADO':'SOLICITADO - AGUARDA PAGAMENTO'
  const title=data.state==='paid'?'COMPROVATIVO DE REEMBOLSO':'DETALHE DO PEDIDO DE REEMBOLSO'
  const docRef=`REEMB-${data.requestId}`
  doc.setTitle(`${title} | ${docRef}`);doc.setAuthor('Linke TMS');doc.setSubject('Discriminação de cobranças e devolução ao cliente')
  function fit(text:string,width:number,size:number,font:PDFFont=normal) {
    let value=clean(text)
    if(font.widthOfTextAtSize(value,size)<=width)return value
    while(value&&font.widthOfTextAtSize(value+'...',size)>width)value=value.slice(0,-1)
    return value+'...'
  }
  function wrap(text:string,width:number,size:number,font:PDFFont=normal) {
    const output:string[]=[];let current=''
    for(const char of clean(text)) {
      if(current&&font.widthOfTextAtSize(current+char,size)>width){output.push(current.trimEnd());current=''}
      current+=char
    }
    if(current)output.push(current.trim())
    return output
  }
  const right=(page:PDFPage,text:string,y:number,size=9,font=normal)=>page.drawText(text,{x:560-font.widthOfTextAtSize(text,size),y,size,font,color:navy})
  function header(page:PDFPage,continuation:boolean) {
    page.drawRectangle({x:0,y:0,width:595.28,height:841.89,color:white})
    page.drawRectangle({x:30,y:770,width:535,height:42,color:navy})
    if(logo){const scale=28/logo.height;page.drawImage(logo,{x:40,y:777,width:logo.width*scale,height:28})}
    else page.drawText('LINKE TMS',{x:40,y:785,size:13,font:bold,color:white})
    page.drawText(title,{x:190,y:786,size:9,font:bold,color:white})
    page.drawText(clean(docRef),{x:30,y:752,size:8,font:bold,color:navy})
    right(page,`Gerado em ${date(data.generatedAt)}`,752,8)
    if(continuation){page.drawText(fit(data.client.name,530,10,bold),{x:30,y:730,size:10,font:bold,color:navy});return 704}
    const clientLines=[...wrap(data.client.name,290,10,bold),...[data.client.code?`Código: ${data.client.code}`:'',data.client.nif?`NIF: ${data.client.nif}`:'',data.client.address||'',data.client.city||'',data.client.email||''].filter(Boolean).flatMap(value=>wrap(value,290,8))]
    const bottom=738-Math.max(138,clientLines.length*13+38)
    page.drawRectangle({x:30,y:bottom,width:535,height:738-bottom,color:pale,borderColor:line,borderWidth:.7})
    page.drawText('CLIENTE',{x:42,y:720,size:8,font:bold,color:muted})
    let cy=703
    for(const [index,value] of clientLines.entries()){page.drawText(value,{x:42,y:cy,size:index===0?10:8,font:index===0?bold:normal,color:navy});cy-=13}
    page.drawText('PEDIDO',{x:355,y:720,size:8,font:bold,color:muted})
    page.drawText(`Data: ${date(data.requestedAt)}`,{x:355,y:703,size:9,font:normal,color:navy})
    page.drawText(`${data.items.length} guia(s)`,{x:355,y:686,size:9,font:normal,color:navy})
    page.drawText(money(data.amountCents),{x:355,y:665,size:17,font:bold,color:green})
    page.drawText('VALOR DAS COBRANÇAS',{x:355,y:650,size:7,font:normal,color:muted})
    page.drawText(status,{x:30,y:bottom-20,size:9,font:bold,color:data.state==='paid'?green:rgb(.48,.35,.16)})
    page.drawText(data.state==='paid'?`Pagamento registado em ${date(data.paidAt)}`:'Este documento não confirma uma transferência efetuada.',{x:30,y:bottom-37,size:9,font:normal,color:muted})
    let y=bottom-54
    if(data.paymentRef){for(const value of wrap(`Referência: ${data.paymentRef}`,530,8)){page.drawText(value,{x:30,y,size:8,font:normal,color:navy});y-=12}}
    return y-17
  }
  function tableHeader(page:PDFPage,y:number) {
    page.drawRectangle({x:30,y:y-5,width:535,height:23,color:navy})
    for(const [text,x] of [['#',40],['DATA DO ENVIO',65],['GUIA / TRACKING',165]] as const) page.drawText(text,{x,y:y+3,size:8,font:bold,color:white})
    const label='VALOR À COBRANÇA';page.drawText(label,{x:555-bold.widthOfTextAtSize(label,8),y:y+3,size:8,font:bold,color:white})
    return y-24
  }
  let page=doc.addPage([595.28,841.89]),y=tableHeader(page,header(page,false))
  for(const [index,item] of data.items.entries()) {
    const trackingLines=wrap(item.tracking,255,8,bold),height=Math.max(28,trackingLines.length*12+12)
    if(y-height<90){page=doc.addPage([595.28,841.89]);y=tableHeader(page,header(page,true))}
    if(index%2===0)page.drawRectangle({x:30,y:y-height+7,width:535,height,color:pale})
    page.drawText(String(index+1),{x:40,y:y-7,size:8,font:normal,color:muted})
    page.drawText(date(item.date),{x:65,y:y-7,size:8,font:normal,color:navy})
    trackingLines.forEach((value,n)=>page.drawText(value,{x:165,y:y-7-n*12,size:8,font:bold,color:navy}))
    right(page,money(item.amountCents),y-7,9,bold)
    y-=height
  }
  if(y<155){page=doc.addPage([595.28,841.89]);y=header(page,true)}
  page.drawLine({start:{x:30,y:y-8},end:{x:565,y:y-8},color:line,thickness:1})
  page.drawText('TOTAL DO REEMBOLSO',{x:30,y:y-33,size:10,font:bold,color:navy});right(page,money(data.amountCents),y-33,16,bold)
  page.drawText('Valores de cobranças dos envios. Os portes não estão incluídos neste total.',{x:30,y:y-55,size:8,font:normal,color:muted})
  for(const [index,p] of doc.getPages().entries()) {
    p.drawLine({start:{x:30,y:49},end:{x:565,y:49},color:line,thickness:.6})
    p.drawText('LINKE TMS | Detalhe de reembolsos | Documento de controlo interno',{x:30,y:35,size:7,font:normal,color:muted})
    right(p,`Página ${index+1} de ${doc.getPageCount()}`,35,7)
  }
  return Buffer.from(await doc.save())
}
