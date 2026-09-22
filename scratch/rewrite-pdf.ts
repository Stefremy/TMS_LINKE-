import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import * as fs from 'fs'
import * as path from 'path'

export interface BillingStatementPdfShipment {
  id: string
  tracking_number?: string
  reference?: string
  recipient_name?: string
  recipient_city?: string
  created_at?: string
  sell_price?: number
  service_type?: string
}

export interface BillingStatementPdfData {
  statementNumber: string
  clientName: string
  clientNif?: string
  clientAddress?: string
  clientCity?: string
  clientEmail?: string
  dateStr?: string
  totalValue: number
  shipments: BillingStatementPdfShipment[]
}

const c = (r: number, g: number, b: number) => rgb(r, g, b)

export async function generateStatementPdfBuffer(data: BillingStatementPdfData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const fontNormal = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  
  const logoBytes = fs.readFileSync(path.join(process.cwd(), 'public/Linke-logo.png'))
  const logo = await doc.embedPng(logoBytes)

  const statementNum = data.statementNumber || `EXT-${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`
  const dateStr = data.dateStr || new Date().toLocaleDateString("pt-PT")
  const shipments = data.shipments || []
  
  const totalShipments = shipments.length
  const subtotal = Number(data.totalValue || 0)
  const iva = subtotal * 0.23
  const totalWithIva = subtotal + iva

  const fmtCurrency = (val: number) => {
    return val.toFixed(2).replace(".", ",") + " EUR"
  }

  // Calculate dynamic height
  const baseHeight = 841.89
  const rowHeight = 22
  const maxRowsBase = 16
  const extraHeight = Math.max(0, (shipments.length - maxRowsBase) * rowHeight)
  const height = baseHeight + extraHeight
  const width = 595.28

  const page = doc.addPage([width, height])
  
  // Helpers
  const y = (val: number) => val + extraHeight
  
  // Top Banner
  page.drawRectangle({ x: 25, y: y(780), width: 545.28, height: 42, color: c(0.06, 0.09, 0.16) })
  
  // Logo in Banner
  const logoDims = logo.scale(0.12)
  page.drawImage(logo, { x: 35, y: y(780) + (42 - logoDims.height) / 2, width: logoDims.width, height: logoDims.height })
  
  page.drawText("SISTEMA DE GESTAO DE TRANSPORTES | LISTAGEM DE SERVICOS", { x: 190, y: y(796), size: 9, font: fontNormal, color: c(1, 1, 1) })

  // Document Info Card
  page.drawRectangle({ x: 25, y: y(690), width: 545.28, height: 78, color: c(0.96, 0.97, 0.98), borderColor: c(0.85, 0.87, 0.90), borderWidth: 1 })
  
  page.drawText("LISTAGEM DE SERVICOS / ENVIOS", { x: 35, y: y(748), size: 11, font: fontBold, color: c(0,0,0) })
  page.drawText("Documento:", { x: 35, y: y(730), size: 9, font: fontBold, color: c(0,0,0) })
  page.drawText(statementNum, { x: 95, y: y(730), size: 9, font: fontNormal, color: c(0,0,0) })
  
  page.drawText("Data de Emissao:", { x: 35, y: y(712), size: 9, font: fontBold, color: c(0,0,0) })
  page.drawText(dateStr, { x: 115, y: y(712), size: 9, font: fontNormal, color: c(0,0,0) })
  
  page.drawText("Total de Envios:", { x: 35, y: y(696), size: 9, font: fontBold, color: c(0,0,0) })
  page.drawText(`${totalShipments} objeto(s)`, { x: 115, y: y(696), size: 9, font: fontNormal, color: c(0,0,0) })

  // Client Info
  page.drawText("DADOS DO CLIENTE:", { x: 310, y: y(748), size: 10, font: fontBold, color: c(0,0,0) })
  page.drawText(data.clientName || "Cliente Linke", { x: 310, y: y(730), size: 9, font: fontBold, color: c(0,0,0) })
  page.drawText(`NIF: ${data.clientNif || "Consumidor Final"}`, { x: 310, y: y(712), size: 9, font: fontNormal, color: c(0,0,0) })
  page.drawText(data.clientAddress || data.clientCity || "Portugal", { x: 310, y: y(696), size: 8, font: fontNormal, color: c(0,0,0) })

  // Table Header
  page.drawRectangle({ x: 25, y: y(600), width: 545.28, height: 20, color: c(0.15, 0.20, 0.28) })
  const thY = y(606)
  const headerOpts = { size: 8, font: fontBold, color: c(1,1,1) }
  page.drawText("#", { x: 32, y: thY, ...headerOpts })
  page.drawText("DATA", { x: 52, y: thY, ...headerOpts })
  page.drawText("TRACKING / REFERENCIA", { x: 115, y: thY, ...headerOpts })
  page.drawText("DESTINATARIO / DESTINO", { x: 245, y: thY, ...headerOpts })
  page.drawText("VALOR C/ TAXAS", { x: 505, y: thY, ...headerOpts })

  // Table Rows
  let currentY = y(575)
  shipments.forEach((item, index) => {
    const isEven = index % 2 === 0
    page.drawRectangle({
      x: 25, y: currentY - 3, width: 545.28, height: rowHeight,
      color: isEven ? c(0.98, 0.98, 0.99) : c(1,1,1),
      borderColor: c(0.90, 0.90, 0.92),
      borderWidth: 0.5
    })

    const itemDate = item.created_at ? new Date(item.created_at).toLocaleDateString("pt-PT") : dateStr
    const trackingBase = item.tracking_number || item.reference || `ENV-${item.id.slice(0, 8).toUpperCase()}`
    const tracking = item.service_type ? `[${item.service_type.slice(0, 15)}] ${trackingBase}` : trackingBase
    const destName = (item.recipient_name || "Destinatario").slice(0, 22)
    const destCity = item.recipient_city ? ` (${item.recipient_city.slice(0, 14)})` : ""
    const destFull = `${destName}${destCity}`
    
    const priceWithIva = Number(item.sell_price || 0) * 1.23
    const priceStr = fmtCurrency(priceWithIva)

    const trY = currentY + 4
    page.drawText(String(index + 1), { x: 32, y: trY, size: 8, font: fontBold, color: c(0,0,0) })
    page.drawText(itemDate, { x: 52, y: trY, size: 8, font: fontNormal, color: c(0,0,0) })
    page.drawText(tracking, { x: 115, y: trY, size: 8, font: fontBold, color: c(0,0,0) })
    page.drawText(destFull, { x: 245, y: trY, size: 8, font: fontNormal, color: c(0,0,0) })
    page.drawText(priceStr, { x: 505, y: trY, size: 8, font: fontBold, color: c(0,0,0) })
    
    currentY -= rowHeight
  })

  // Summary Box
  page.drawRectangle({ x: 320, y: 85, width: 250.28, height: 90, color: c(0.97, 0.98, 0.99), borderColor: c(0.80, 0.82, 0.86), borderWidth: 1 })
  page.drawText("Subtotal s/ Taxas:", { x: 335, y: 155, size: 9, font: fontNormal, color: c(0,0,0) })
  page.drawText(fmtCurrency(subtotal), { x: 470, y: 155, size: 9, font: fontBold, color: c(0,0,0) })
  page.drawText("Taxas / IVA:", { x: 335, y: 137, size: 9, font: fontNormal, color: c(0,0,0) })
  page.drawText(fmtCurrency(iva), { x: 470, y: 137, size: 9, font: fontBold, color: c(0,0,0) })
  
  page.drawRectangle({ x: 325, y: 100, width: 240, height: 20, color: c(0.06, 0.09, 0.16) })
  page.drawText("VALOR TOTAL:", { x: 335, y: 105, size: 10, font: fontBold, color: c(1,1,1) })
  page.drawText(fmtCurrency(totalWithIva), { x: 465, y: 105, size: 11, font: fontBold, color: c(1,1,1) })

  // Notes Box
  page.drawRectangle({ x: 25, y: 85, width: 285, height: 90, color: c(0.97, 0.98, 0.99), borderColor: c(0.80, 0.82, 0.86), borderWidth: 1 })
  page.drawText("TERMOS DE LISTAGEM:", { x: 35, y: 155, size: 8, font: fontBold, color: c(0,0,0) })
  page.drawText("- Este documento demonstra os servicos e respetivos precos.", { x: 35, y: 140, size: 8, font: fontNormal, color: c(0,0,0) })
  page.drawText("- Nao substitui a Fatura Oficial AT com validade fiscal.", { x: 35, y: 126, size: 8, font: fontNormal, color: c(0,0,0) })
  page.drawText("- Para liquidacao via transferencia bancaria ou debito em conta.", { x: 35, y: 112, size: 8, font: fontNormal, color: c(0,0,0) })
  page.drawText("- Para esclarecimentos: geral@linke.pt", { x: 35, y: 98, size: 8, font: fontNormal, color: c(0,0,0) })

  // Footer
  page.drawText("Processado por computador - TMS LINKE Logistics Software. Todos os direitos reservados.", { x: 25, y: 35, size: 8, font: fontNormal, color: c(0.5, 0.5, 0.5) })
  page.drawText("Pagina 1 de 1", { x: 490, y: 35, size: 8, font: fontNormal, color: c(0.5, 0.5, 0.5) })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}

export async function generateStatementPdfBase64(data: BillingStatementPdfData): Promise<string> {
  const buf = await generateStatementPdfBuffer(data)
  return buf.toString("base64")
}
