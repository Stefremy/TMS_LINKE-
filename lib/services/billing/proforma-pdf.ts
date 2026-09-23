import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib'
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
  weight_kg?: number
  base_price?: number
  fuel_tax_amount?: number
  special_fees_amount?: number
  special_fees_description?: string
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

// Color palette — modern dark + amber accent
const COL = {
  ink:      c(0.10, 0.10, 0.12),
  muted:    c(0.45, 0.45, 0.50),
  light:    c(0.90, 0.90, 0.93),
  bg:       c(0.975, 0.975, 0.985),
  white:    c(1, 1, 1),
  accent:   c(0.95, 0.55, 0.05),
  accentDk: c(0.60, 0.32, 0.01),
  dark:     c(0.10, 0.10, 0.15),
  tagFuel:  c(0.98, 0.85, 0.20),
  tagSpec:  c(0.70, 0.50, 0.95),
}

function drawLine(page: PDFPage, x1: number, y: number, x2: number, color = COL.light, thickness = 0.5) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color })
}

function fillRect(page: PDFPage, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width: w, height: h, color })
}

export async function generateProFormaPdfBuffer(data: BillingStatementPdfData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const fontR = await doc.embedFont(StandardFonts.Helvetica)
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold)

  const logoBytes = fs.readFileSync(path.join(process.cwd(), 'public/Linke-logo.png'))
  const logo = await doc.embedPng(logoBytes)

  const docNum = data.statementNumber || `PF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  const dateStr = data.dateStr || new Date().toLocaleDateString('pt-PT')
  const shipments = data.shipments || []
  const subtotal = Number(data.totalValue || 0)
  const iva = subtotal * 0.23
  const total = subtotal + iva

  const fmt = (v: number) => v.toFixed(2).replace('.', ',') + ' \u20AC'

  // Build line items (breakdown per shipment)
  type LineItem = {
    description: string
    detail: string
    amount: number
    tag?: 'fuel' | 'special'
  }
  const lines: LineItem[] = []

  shipments.forEach(s => {
    const trackRef = s.tracking_number || s.reference || `ENV-${(s.id || '').slice(0, 8).toUpperCase()}`
    const service = s.service_type || 'Transporte / Logistica'
    const dest = [s.recipient_name, s.recipient_city].filter(Boolean).join(' - ') || '-'
    const fuelAmt = Number(s.fuel_tax_amount || 0)
    const specialAmt = Number(s.special_fees_amount || 0)
    const baseAmt = Number(s.base_price || 0) || (Number(s.sell_price || 0) - fuelAmt - specialAmt)

    lines.push({ description: trackRef, detail: `${service} - ${dest}`, amount: baseAmt })

    if (fuelAmt > 0) {
      lines.push({ description: 'Taxa de Combustivel', detail: `Sobretaxa aplicada ao envio ${trackRef}`, amount: fuelAmt, tag: 'fuel' })
    }

    if (specialAmt > 0) {
      const specDesc = s.special_fees_description || 'Taxa Especial'
      lines.push({ description: specDesc, detail: `Taxa adicional aplicada ao envio ${trackRef}`, amount: specialAmt, tag: 'special' })
    }
  })

  // --- Page dimensions ---
  const W = 595.28
  const MARGIN = 44
  const CONTENT_W = W - MARGIN * 2
  const ROW_H = 30
  const HEADER_H = 110
  const META_H = 108
  const TBL_HDR_H = 26
  const FOOTER_H = 50
  const GUTTER = 20

  const tableBodyH = Math.max(lines.length, 4) * ROW_H
  const PAGE_H = Math.max(841.89, HEADER_H + META_H + GUTTER + TBL_HDR_H + tableBodyH + 200 + FOOTER_H)

  const page = doc.addPage([W, PAGE_H])

  // ── HEADER ────────────────────────────────────────────────────────────────

  fillRect(page, 0, PAGE_H - HEADER_H, W, HEADER_H, COL.dark)
  // Amber right accent stripe
  fillRect(page, W - 6, PAGE_H - HEADER_H, 6, HEADER_H, COL.accent)

  // Logo
  const logoH = 34
  const logoScale = logoH / logo.height
  const logoDims = logo.scale(logoScale)
  page.drawImage(logo, {
    x: MARGIN,
    y: PAGE_H - HEADER_H + (HEADER_H - logoDims.height) / 2,
    width: logoDims.width,
    height: logoDims.height,
  })

  // "FATURA" on right of header
  page.drawText('FATURA', {
    x: W - MARGIN - 75,
    y: PAGE_H - 50,
    size: 17,
    font: fontB,
    color: COL.white,
  })
  page.drawText('Nao tem validade fiscal - emitido para efeitos de pagamento', {
    x: W - MARGIN - 228,
    y: PAGE_H - 68,
    size: 7,
    font: fontR,
    color: c(0.55, 0.55, 0.60),
  })

  // ── META BLOCK ────────────────────────────────────────────────────────────

  const metaTop = PAGE_H - HEADER_H - GUTTER
  const halfX = MARGIN + CONTENT_W / 2 + 16

  // Left: document details
  page.drawText('DOCUMENTO', { x: MARGIN, y: metaTop - 16, size: 7.5, font: fontR, color: COL.muted })
  page.drawText(docNum, { x: MARGIN, y: metaTop - 32, size: 14, font: fontB, color: COL.ink })

  page.drawText('DATA DE EMISSAO', { x: MARGIN, y: metaTop - 54, size: 7.5, font: fontR, color: COL.muted })
  page.drawText(dateStr, { x: MARGIN, y: metaTop - 68, size: 10, font: fontB, color: COL.ink })

  page.drawText('NUM. ENVIOS', { x: MARGIN + 150, y: metaTop - 54, size: 7.5, font: fontR, color: COL.muted })
  page.drawText(`${shipments.length}`, { x: MARGIN + 150, y: metaTop - 68, size: 10, font: fontB, color: COL.ink })

  // Right: Bill To
  page.drawText('FATURAR A', { x: halfX, y: metaTop - 16, size: 7.5, font: fontB, color: COL.muted })
  page.drawText((data.clientName || '-').slice(0, 38), { x: halfX, y: metaTop - 32, size: 13, font: fontB, color: COL.ink })

  let infoY = metaTop - 50
  if (data.clientNif) {
    page.drawText(`NIF: ${data.clientNif}`, { x: halfX, y: infoY, size: 8.5, font: fontR, color: COL.muted })
    infoY -= 15
  }
  const addr = [data.clientAddress, data.clientCity].filter(Boolean).join(', ')
  if (addr) {
    page.drawText(addr.slice(0, 50), { x: halfX, y: infoY, size: 8.5, font: fontR, color: COL.muted })
    infoY -= 14
  }
  if (data.clientEmail) {
    page.drawText(data.clientEmail.slice(0, 50), { x: halfX, y: infoY, size: 8, font: fontR, color: COL.muted })
  }

  const divY = metaTop - META_H + 6
  drawLine(page, MARGIN, divY, W - MARGIN, COL.light, 0.8)

  // ── TABLE HEADER ─────────────────────────────────────────────────────────

  const tblTop = divY - 8
  fillRect(page, MARGIN, tblTop - TBL_HDR_H, CONTENT_W, TBL_HDR_H, COL.dark)

  const thY = tblTop - TBL_HDR_H + 9
  const cDesc = MARGIN + 8
  const cDetail = MARGIN + 190
  const cAmt = W - MARGIN - 8

  page.drawText('DESCRICAO / SERVICO', { x: cDesc, y: thY, size: 7.5, font: fontB, color: COL.white })
  page.drawText('DETALHE', { x: cDetail, y: thY, size: 7.5, font: fontB, color: c(0.60, 0.60, 0.65) })
  page.drawText('VALOR S/ IVA', { x: cAmt - 60, y: thY, size: 7.5, font: fontB, color: COL.white })

  // ── TABLE ROWS ────────────────────────────────────────────────────────────

  let rowY = tblTop - TBL_HDR_H - ROW_H

  lines.forEach((line, i) => {
    fillRect(page, MARGIN, rowY, CONTENT_W, ROW_H, i % 2 === 0 ? COL.bg : COL.white)
    drawLine(page, MARGIN, rowY, W - MARGIN, COL.light, 0.3)

    const textY = rowY + ROW_H * 0.37

    if (line.tag === 'fuel') {
      fillRect(page, cDesc, textY - 1, 72, 13, COL.tagFuel)
      page.drawText('Taxa Combustivel', { x: cDesc + 4, y: textY + 1, size: 7, font: fontB, color: c(0.38, 0.26, 0.00) })
    } else if (line.tag === 'special') {
      fillRect(page, cDesc, textY - 1, 70, 13, COL.tagSpec)
      page.drawText(line.description.slice(0, 16), { x: cDesc + 4, y: textY + 1, size: 7, font: fontB, color: COL.white })
    } else {
      page.drawText(line.description.slice(0, 34), { x: cDesc, y: textY, size: 9, font: fontB, color: COL.ink })
    }

    page.drawText(line.detail.slice(0, 52), { x: cDetail, y: textY, size: 7.5, font: fontR, color: COL.muted })

    const amtStr = fmt(line.amount)
    page.drawText(amtStr, {
      x: cAmt - fontB.widthOfTextAtSize(amtStr, 9),
      y: textY,
      size: 9,
      font: fontB,
      color: line.tag ? COL.accentDk : COL.ink,
    })

    rowY -= ROW_H
  })

  drawLine(page, MARGIN, rowY + ROW_H, W - MARGIN, COL.ink, 0.6)

  // ── SUMMARY ──────────────────────────────────────────────────────────────

  const sumTop = rowY + ROW_H - 14
  const sumLabelX = W - MARGIN - 200
  const sumValX = W - MARGIN

  const subY = sumTop - 22
  page.drawText('Subtotal (s/ IVA)', { x: sumLabelX, y: subY, size: 9, font: fontR, color: COL.muted })
  const subStr = fmt(subtotal)
  page.drawText(subStr, { x: sumValX - fontB.widthOfTextAtSize(subStr, 9), y: subY, size: 9, font: fontB, color: COL.ink })

  const ivaY = subY - 20
  page.drawText('IVA (23%)', { x: sumLabelX, y: ivaY, size: 9, font: fontR, color: COL.muted })
  const ivaStr = fmt(iva)
  page.drawText(ivaStr, { x: sumValX - fontR.widthOfTextAtSize(ivaStr, 9), y: ivaY, size: 9, font: fontR, color: COL.muted })

  drawLine(page, sumLabelX, ivaY - 14, W - MARGIN, COL.ink, 0.5)

  // Total box
  const totBoxY = ivaY - 52
  fillRect(page, sumLabelX - 10, totBoxY - 4, W - MARGIN - sumLabelX + 14, 40, COL.accent)

  page.drawText('TOTAL A PAGAR', {
    x: sumLabelX + 2,
    y: totBoxY + 18,
    size: 7.5,
    font: fontB,
    color: c(0.22, 0.12, 0.00),
  })
  const totStr = fmt(total)
  page.drawText(totStr, {
    x: sumValX - fontB.widthOfTextAtSize(totStr, 17),
    y: totBoxY + 13,
    size: 17,
    font: fontB,
    color: c(0.15, 0.08, 0.00),
  })

  // ── NOTE ─────────────────────────────────────────────────────────────────

  const noteY = sumTop - 22
  page.drawText('Nota:', { x: MARGIN, y: noteY, size: 7.5, font: fontB, color: COL.accentDk })
  page.drawText('Este documento e uma Pro-Forma para referencia de pagamento e nao tem validade fiscal.', {
    x: MARGIN,
    y: noteY - 14,
    size: 7.5,
    font: fontR,
    color: COL.muted,
  })
  page.drawText('A fatura definitiva certificada pela AT sera emitida apos confirmacao do pagamento.', {
    x: MARGIN,
    y: noteY - 27,
    size: 7.5,
    font: fontR,
    color: COL.muted,
  })

  // ── FOOTER ────────────────────────────────────────────────────────────────

  drawLine(page, MARGIN, 48, W - MARGIN, COL.light, 0.5)
  page.drawText('Linke Logistics \u2014 TMS Sistema de Gestao de Transportes', {
    x: MARGIN,
    y: 32,
    size: 7.5,
    font: fontR,
    color: COL.muted,
  })
  const footRight = `${docNum}  \u00B7  ${dateStr}`
  page.drawText(footRight, {
    x: W - MARGIN - fontR.widthOfTextAtSize(footRight, 7.5),
    y: 32,
    size: 7.5,
    font: fontR,
    color: COL.muted,
  })
  // Amber accent dot
  fillRect(page, W / 2 - 3, 30, 6, 6, COL.accent)

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}

export async function generateProFormaPdfBase64(data: BillingStatementPdfData): Promise<string> {
  const buf = await generateProFormaPdfBuffer(data)
  return buf.toString('base64')
}

