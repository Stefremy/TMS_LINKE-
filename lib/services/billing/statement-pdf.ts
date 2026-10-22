import { PDFDocument, rgb, StandardFonts, PDFPage, type PDFImage, type PDFFont, type Color } from 'pdf-lib'
import * as fs from 'fs'
import * as path from 'path'

export interface BillingStatementPdfShipment {
  id: string
  tracking_number?: string
  reference?: string
  recipient_name?: string
  recipient_city?: string
  recipient_address?: string
  created_at?: string
  sell_price?: number
  service_type?: string
  weight_kg?: number
  base_price?: number
  fuel_tax_amount?: number
  fuel_rate_pct?: number
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
  periodLabel?: string
  totalValue: number
  shipments: BillingStatementPdfShipment[]
}

const c = (r: number, g: number, b: number) => rgb(r, g, b)

const safeStr = (str?: string) => {
  if (!str) return ""
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .trim()
}

const fmtCurrency = (val: number) => {
  return (Number(val) || 0).toFixed(2).replace(".", ",") + " EUR"
}

export async function generateStatementPdfBuffer(data: BillingStatementPdfData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const fontNormal = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  
  let logo: PDFImage | null = null
  try {
    const logoPath = path.join(process.cwd(), 'public/Linke-logo.png')
    if (fs.existsSync(logoPath)) {
      const logoBytes = fs.readFileSync(logoPath)
      logo = await doc.embedPng(logoBytes)
    }
  } catch (err) {
    console.warn("Logo not embedded in statement PDF:", err)
  }

  const statementNum = data.statementNumber || `EXT-${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`
  const dateStr = data.dateStr || new Date().toLocaleDateString("pt-PT")
  const shipments = data.shipments || []
  const totalShipments = shipments.length
  const isPeriodStatement = Boolean(data.periodLabel)

  // Breakdown normalization for every shipment
  const items = shipments.map((s, idx) => {
    const sellPrice = Number(s.sell_price || 0)
    const specialFees = Number(s.special_fees_amount || 0)
    let basePrice = s.base_price != null ? Number(s.base_price) : 0
    let fuelTax = s.fuel_tax_amount != null ? Number(s.fuel_tax_amount) : 0

    // Itemize only when the recorded descriptions reconcile with the saved extra total.
    // Legacy text remains visible in full, without inventing a per-service price.
    let specialDetails: { name: string; amount?: number }[] = []
    const description = s.special_fees_description?.trim() || ""
    if (specialFees > 0 && description.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(description)
        if (Array.isArray(parsed) && parsed.length) {
          const entries = parsed.map((value: unknown) => {
            if (!value || typeof value !== "object") throw new Error("Invalid supplement")
            const item = value as { name?: unknown; service?: unknown; amount?: unknown }
            const amount = typeof item.amount === "number" ? item.amount : NaN
            if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid supplement amount")
            const name = typeof item.name === "string" ? item.name : typeof item.service === "string" ? item.service : "Servico adicional"
            return { name: safeStr(name), amount }
          })
          if (entries.reduce((total, entry) => total + Math.round(entry.amount * 100), 0) === Math.round(specialFees * 100)) {
            specialDetails = entries
          } else {
            specialDetails = entries.map(entry => ({ name: entry.name }))
          }
        }
      } catch { /* Display legacy descriptions below without changing any amounts. */ }
    }
    if (specialFees > 0 && !specialDetails.length) {
      specialDetails = [{ name: safeStr(description || "Servicos adicionais") }]
    }

    // Fallback: reverse engineer base price and fuel tax from sell_price if not explicitly stored
    if (!isPeriodStatement && (basePrice === 0 || fuelTax === 0) && sellPrice > 0) {
      const fuelRate = (s.fuel_rate_pct != null && s.fuel_rate_pct > 0 ? s.fuel_rate_pct : 12.5) / 100
      const netBaseFuel = Math.max(0, sellPrice - specialFees)
      if (basePrice === 0 && fuelTax === 0) {
        basePrice = Math.round((netBaseFuel / (1 + fuelRate)) * 100) / 100
        fuelTax = Math.round((netBaseFuel - basePrice) * 100) / 100
      } else if (basePrice === 0) {
        basePrice = Math.max(0, Math.round((netBaseFuel - fuelTax) * 100) / 100)
      } else if (fuelTax === 0) {
        fuelTax = Math.max(0, Math.round((netBaseFuel - basePrice) * 100) / 100)
      }
    }

    return {
      index: idx + 1,
      id: s.id,
      date: s.created_at ? new Date(s.created_at).toLocaleDateString("pt-PT") : dateStr,
      tracking: safeStr(s.tracking_number || s.reference || `ENV-${(s.id || "").slice(0, 8).toUpperCase()}`),
      service: safeStr(s.service_type || "Transporte"),
      weightKg: s.weight_kg ? Number(s.weight_kg) : undefined,
      recipientName: safeStr(s.recipient_name || "Destinatario"),
      recipientCity: safeStr(s.recipient_city || ""),
      basePrice,
      fuelTax,
      specialFees,
      hasBase: !isPeriodStatement || s.base_price != null,
      hasFuel: !isPeriodStatement || s.fuel_tax_amount != null,
      hasSpecial: !isPeriodStatement || s.special_fees_amount != null,
      specialDetails,
      sellPrice
    }
  })

  // Totals calculations
  const totalBase = Math.round(items.reduce((sum, item) => sum + item.basePrice, 0) * 100) / 100
  const totalFuel = Math.round(items.reduce((sum, item) => sum + item.fuelTax, 0) * 100) / 100
  const totalSpecial = Math.round(items.reduce((sum, item) => sum + item.specialFees, 0) * 100) / 100
  const subtotalNet = Number(data.totalValue || (totalBase + totalFuel + totalSpecial))
  const iva = Math.round(subtotalNet * 0.23 * 100) / 100
  const totalWithIva = Math.round((subtotalNet + iva) * 100) / 100

  // Page geometry
  const pageWidth = 595.28
  const pageHeight = 841.89
  const rowHeight = 32
  const tableHeaderHeight = 20
  const summaryBoxHeight = 100
  const footerReservedHeight = 45

  // Helper for right-aligned text
  const drawRightText = (page: PDFPage, text: string, rightX: number, textY: number, size: number, font: PDFFont, color: Color) => {
    const textWidth = font.widthOfTextAtSize(text, size)
    page.drawText(text, { x: rightX - textWidth, y: textY, size, font, color })
  }

  // Draw table header
  const drawTableHeader = (page: PDFPage, yPos: number) => {
    page.drawRectangle({
      x: 25,
      y: yPos,
      width: 545.28,
      height: tableHeaderHeight,
      color: c(0.06, 0.09, 0.16)
    })
    const thY = yPos + 6
    const opts = { size: 7.5, font: fontBold, color: c(1, 1, 1) }

    page.drawText("#", { x: 30, y: thY, ...opts })
    page.drawText("DATA", { x: 48, y: thY, ...opts })
    page.drawText("TRACKING / SERVICO", { x: 96, y: thY, ...opts })
    page.drawText("DESTINATARIO / LOCAL", { x: 236, y: thY, ...opts })
    drawRightText(page, "BASE TABELA", 395, thY, 7.5, fontBold, c(1, 1, 1))
    drawRightText(page, "TAXA COMB.", 450, thY, 7.5, fontBold, c(1, 1, 1))
    drawRightText(page, "EXTRAS", 502, thY, 7.5, fontBold, c(1, 1, 1))
    drawRightText(page, "TOTAL LIQ.", 562, thY, 7.5, fontBold, c(1, 1, 1))
  }

  // Helper to draw Page 1 full header
  const drawPage1Header = (page: PDFPage) => {
    // 1. Top Banner
    page.drawRectangle({ x: 25, y: 785, width: 545.28, height: 42, color: c(0.06, 0.09, 0.16) })
    if (logo) {
      const desiredLogoHeight = 30
      const logoScale = desiredLogoHeight / logo.height
      const logoDims = logo.scale(logoScale)
      page.drawImage(logo, { x: 35, y: 785 + (42 - logoDims.height) / 2, width: logoDims.width, height: logoDims.height })
    } else {
      page.drawText("LINKE TMS", { x: 35, y: 800, size: 12, font: fontBold, color: c(1, 1, 1) })
    }
    page.drawText("SISTEMA DE GESTAO DE TRANSPORTES | EXTRATO DISCRIMINATIVO", {
      x: 185,
      y: 801,
      size: 8.5,
      font: fontNormal,
      color: c(1, 1, 1)
    })

    // 2. Info Cards Block
    page.drawRectangle({
      x: 25,
      y: 700,
      width: 545.28,
      height: 75,
      color: c(0.97, 0.98, 0.99),
      borderColor: c(0.85, 0.88, 0.92),
      borderWidth: 1
    })

    // Left card details
    page.drawText("DOCUMENTO:", { x: 35, y: 756, size: 8, font: fontBold, color: c(0.35, 0.40, 0.48) })
    page.drawText(statementNum, { x: 100, y: 756, size: 9, font: fontBold, color: c(0.06, 0.09, 0.16) })

    page.drawText("EMISSAO:", { x: 35, y: 738, size: 8, font: fontBold, color: c(0.35, 0.40, 0.48) })
    page.drawText(dateStr, { x: 100, y: 738, size: 8.5, font: fontNormal, color: c(0.06, 0.09, 0.16) })

    page.drawText("TOTAL ENVIOS:", { x: 35, y: 720, size: 8, font: fontBold, color: c(0.35, 0.40, 0.48) })
    page.drawText(`${totalShipments} objeto(s)`, { x: 110, y: 720, size: 8.5, font: fontBold, color: c(0.06, 0.09, 0.16) })
    if (data.periodLabel) {
      page.drawText(`PERIODO: ${safeStr(data.periodLabel)}`, { x: 35, y: 691, size: 7.5, font: fontBold, color: c(0.06, 0.40, 0.22) })
    }

    // Right card details (client)
    page.drawText("DADOS DO CLIENTE:", { x: 320, y: 756, size: 8, font: fontBold, color: c(0.35, 0.40, 0.48) })
    page.drawText(safeStr((data.clientName || "Cliente Linke").slice(0, 36)), { x: 320, y: 740, size: 9.5, font: fontBold, color: c(0.06, 0.09, 0.16) })
    page.drawText(`NIF: ${safeStr(data.clientNif || "Consumidor Final")}`, { x: 320, y: 726, size: 8, font: fontNormal, color: c(0.20, 0.24, 0.30) })
    const addr = safeStr([data.clientAddress, data.clientCity].filter(Boolean).join(", "))
    page.drawText(addr.slice(0, 48) || "Portugal", { x: 320, y: 712, size: 7.5, font: fontNormal, color: c(0.40, 0.44, 0.50) })
  }

  // Helper to draw subsequent page header
  const drawSubsequentPageHeader = (page: PDFPage) => {
    page.drawRectangle({ x: 25, y: 795, width: 545.28, height: 32, color: c(0.06, 0.09, 0.16) })
    if (logo) {
      const desiredLogoHeight = 22
      const logoScale = desiredLogoHeight / logo.height
      const logoDims = logo.scale(logoScale)
      page.drawImage(logo, { x: 35, y: 795 + (32 - logoDims.height) / 2, width: logoDims.width, height: logoDims.height })
    }
    page.drawText(fitText(`EXTRATO DISCRIMINATIVO ${statementNum}  |  ${safeStr(data.clientName)}`, 400, 8, fontBold), {
      x: 160,
      y: 806,
      size: 8,
      font: fontBold,
      color: c(1, 1, 1)
    })
  }

  // Draw Summary & Totals Box
  const drawSummaryBox = (page: PDFPage, bottomY: number) => {
    // 1. Left Card: Breakdown dos Custos
    page.drawRectangle({
      x: 25,
      y: bottomY,
      width: 285,
      height: summaryBoxHeight,
      color: c(0.97, 0.98, 0.99),
      borderColor: c(0.85, 0.88, 0.92),
      borderWidth: 1
    })

    page.drawText(isPeriodStatement ? "VALORES REGISTADOS (SEM ESTIMATIVAS)" : "DISCRIMINACAO DOS CUSTOS (RESUMO)", {
      x: 35,
      y: bottomY + 82,
      size: 8.5,
      font: fontBold,
      color: c(0.06, 0.09, 0.16)
    })

    const rowY1 = bottomY + 64
    page.drawText("Custo Base Tabela (Servicos):", { x: 35, y: rowY1, size: 8, font: fontNormal, color: c(0.30, 0.35, 0.42) })
    drawRightText(page, items.every(i => i.hasBase) ? fmtCurrency(totalBase) : "-", 295, rowY1, 8, fontBold, c(0.06, 0.09, 0.16))

    const rowY2 = bottomY + 47
    page.drawText("Taxa de Combustivel:", { x: 35, y: rowY2, size: 8, font: fontNormal, color: c(0.30, 0.35, 0.42) })
    drawRightText(page, items.every(i => i.hasFuel) ? fmtCurrency(totalFuel) : "-", 295, rowY2, 8, fontBold, c(0.06, 0.09, 0.16))

    const rowY3 = bottomY + 30
    page.drawText("Extras & Servicos Adicionais:", { x: 35, y: rowY3, size: 8, font: fontNormal, color: c(0.30, 0.35, 0.42) })
    drawRightText(page, items.every(i => i.hasSpecial) ? fmtCurrency(totalSpecial) : "-", 295, rowY3, 8, fontBold, c(0.06, 0.09, 0.16))

    const rowY4 = bottomY + 13
    page.drawText("Total de Objetos / Envios:", { x: 35, y: rowY4, size: 8, font: fontNormal, color: c(0.30, 0.35, 0.42) })
    drawRightText(page, `${totalShipments} objeto(s)`, 295, rowY4, 8, fontBold, c(0.06, 0.09, 0.16))

    // 2. Right Card: Totais de Faturação
    page.drawRectangle({
      x: 320,
      y: bottomY,
      width: 250.28,
      height: summaryBoxHeight,
      color: c(0.97, 0.98, 0.99),
      borderColor: c(0.85, 0.88, 0.92),
      borderWidth: 1
    })

    page.drawText(isPeriodStatement ? "TOTAIS DO EXTRATO" : "TOTAIS DE FATURACAO", {
      x: 332,
      y: bottomY + 82,
      size: 8.5,
      font: fontBold,
      color: c(0.06, 0.09, 0.16)
    })

    const rTotY1 = bottomY + 64
    page.drawText("Subtotal Liquido s/ IVA:", { x: 332, y: rTotY1, size: 8, font: fontNormal, color: c(0.30, 0.35, 0.42) })
    drawRightText(page, fmtCurrency(subtotalNet), 558, rTotY1, 8.5, fontBold, c(0.06, 0.09, 0.16))

    const rTotY2 = bottomY + 47
    page.drawText(isPeriodStatement ? "Impostos conforme a fatura oficial." : "IVA (23%):", { x: 332, y: rTotY2, size: 8, font: fontNormal, color: c(0.30, 0.35, 0.42) })
    if (!isPeriodStatement) drawRightText(page, fmtCurrency(iva), 558, rTotY2, 8.5, fontBold, c(0.06, 0.09, 0.16))

    // Dark Bottom Banner
    page.drawRectangle({
      x: 326,
      y: bottomY + 8,
      width: 238,
      height: 28,
      color: c(0.06, 0.09, 0.16)
    })
    page.drawText(isPeriodStatement ? "TOTAL DOS ENVIOS:" : "TOTAL A PAGAR:", { x: 336, y: bottomY + 18, size: 9.5, font: fontBold, color: c(1, 1, 1) })
    drawRightText(page, fmtCurrency(isPeriodStatement ? subtotalNet : totalWithIva), 556, bottomY + 18, 10.5, fontBold, c(1, 1, 1))
  }

  // Build Pages Dynamically
  const pages: PDFPage[] = []

  // Page 1
  let currentPage = doc.addPage([pageWidth, pageHeight])
  pages.push(currentPage)
  drawPage1Header(currentPage)

  let tableTopY = 668
  drawTableHeader(currentPage, tableTopY)

  // currentY is the top of the next row, so variable-height details cannot overlap.
  let currentY = tableTopY
  const bottomBoundary = footerReservedHeight + 10
  const nextTablePage = () => {
    currentPage = doc.addPage([pageWidth, pageHeight])
    pages.push(currentPage)
    drawSubsequentPageHeader(currentPage)
    tableTopY = 765
    drawTableHeader(currentPage, tableTopY)
    currentY = tableTopY
  }
  const fitText = (text: string, width: number, size: number, font = fontNormal) => {
    if (font.widthOfTextAtSize(text, size) <= width) return text
    let fitted = text
    while (fitted && font.widthOfTextAtSize(fitted + "...", size) > width) fitted = fitted.slice(0, -1)
    return fitted + "..."
  }
  const wrapText = (text: string, width: number, size: number) => {
    const lines: string[] = []
    let line = ""
    // Character-level wrapping also handles long references with no spaces.
    for (const word of text.split(/\s+/)) {
      if (line && fontNormal.widthOfTextAtSize(line + " " + word, size) <= width) {
        line += " " + word
        continue
      }
      if (line) { lines.push(line); line = "" }
      for (const char of word) {
        if (line && fontNormal.widthOfTextAtSize(line + char, size) > width) {
          lines.push(line); line = ""
        }
        line += char
      }
    }
    if (line) lines.push(line)
    return lines.length ? lines : ["Servico adicional"]
  }
  const drawDetailsHeading = (tracking: string, continuation: boolean) => {
    currentPage.drawText(fitText(continuation ? `SERVICOS ADICIONAIS - ${tracking} (continuacao)` : "SERVICOS ADICIONAIS", 466, 7, fontBold), {
      x: 96, y: currentY - 12, size: 7, font: fontBold, color: c(0.30, 0.35, 0.42),
    })
    currentY -= 20
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const detailRows = item.specialDetails.flatMap(detail => wrapText(detail.name, 370, 8).map((text, index) => ({
      text, amount: index === 0 ? detail.amount : undefined,
    })))
    const detailHeight = detailRows.length ? 28 + detailRows.length * 13 : 0
    // Keep a whole shipment together when it fits on a fresh page. Oversized
    // supplement lists flow across pages with their shipment reference repeated.
    const blockHeight = rowHeight + detailHeight
    const required = blockHeight <= 765 - bottomBoundary ? blockHeight : rowHeight + 33
    if (currentY - required < bottomBoundary) nextTablePage()
    const rowBottom = currentY - rowHeight
    currentPage.drawRectangle({ x: 25, y: rowBottom, width: 545.28, height: rowHeight,
      color: i % 2 === 0 ? c(1, 1, 1) : c(0.97, 0.98, 0.99),
      borderColor: c(0.90, 0.92, 0.94), borderWidth: 0.5 })
    const line1Y = currentY - 12
    const line2Y = currentY - 24
    const midY = currentY - 18
    currentPage.drawText(String(item.index), { x: 29, y: midY, size: 7.5, font: fontBold, color: c(0.06, 0.09, 0.16) })
    currentPage.drawText(item.date, { x: 48, y: midY, size: 7, font: fontNormal, color: c(0.35, 0.40, 0.48) })
    currentPage.drawText(fitText(item.tracking, 130, 7.5, fontBold), { x: 96, y: line1Y, size: 7.5, font: fontBold, color: c(0.06, 0.09, 0.16) })
    const service = `${item.service}${item.weightKg ? ` (${item.weightKg}kg)` : ""}`
    currentPage.drawText(fitText(service, 130, 7), { x: 96, y: line2Y, size: 7, font: fontNormal, color: c(0.40, 0.44, 0.50) })
    currentPage.drawText(fitText(item.recipientName, 98, 7.5), { x: 236, y: line1Y, size: 7.5, font: fontNormal, color: c(0.12, 0.15, 0.20) })
    if (item.recipientCity) currentPage.drawText(fitText(item.recipientCity, 98, 7), { x: 236, y: line2Y, size: 7, font: fontNormal, color: c(0.40, 0.44, 0.50) })
    drawRightText(currentPage, item.hasBase ? fmtCurrency(item.basePrice) : "-", 395, midY, 7.5, fontNormal, c(0.15, 0.18, 0.22))
    drawRightText(currentPage, item.hasFuel ? fmtCurrency(item.fuelTax) : "-", 450, midY, 7.5, fontNormal, c(0.15, 0.18, 0.22))
    drawRightText(currentPage, item.specialFees > 0 ? fmtCurrency(item.specialFees) : "-", 502, midY, 7.5, fontBold, c(0.15, 0.18, 0.22))
    drawRightText(currentPage, fmtCurrency(item.sellPrice), 562, midY, 8, fontBold, c(0.06, 0.09, 0.16))
    currentY = rowBottom
    if (detailRows.length) {
      drawDetailsHeading(item.tracking, false)
      for (const row of detailRows) {
        if (currentY - 13 < bottomBoundary) {
          nextTablePage()
          drawDetailsHeading(item.tracking, true)
        }
        currentPage.drawText(row.text, { x: 104, y: currentY - 9, size: 8, font: fontNormal, color: c(0.25, 0.30, 0.36) })
        if (row.amount !== undefined) drawRightText(currentPage, fmtCurrency(row.amount), 562, currentY - 9, 8, fontNormal, c(0.25, 0.30, 0.36))
        currentY -= 13
      }
      currentY -= 8
      currentPage.drawLine({ start: { x: 96, y: currentY + 3 }, end: { x: 562, y: currentY + 3 }, thickness: 0.5, color: c(0.85, 0.88, 0.92) })
    }
  }

  // Draw Summary Box
  // Check if summary box fits on current page
  if (currentY - summaryBoxHeight < footerReservedHeight + 10) {
    currentPage = doc.addPage([pageWidth, pageHeight])
    pages.push(currentPage)
    drawSubsequentPageHeader(currentPage)
    currentY = 740
  }

  // Render Summary Box at bottom of the last page
  const summaryBottomY = Math.max(footerReservedHeight + 10, currentY - summaryBoxHeight - 15)
  drawSummaryBox(currentPage, summaryBottomY)

  // Draw Footer on all pages
  const totalPages = pages.length
  pages.forEach((p, idx) => {
    if (isPeriodStatement) p.drawText("Documento interno de movimentos. Nao substitui uma fatura.", { x: 25, y: 43, size: 7, font: fontNormal, color: c(0.40, 0.44, 0.50) })
    p.drawText("Processado por computador - TMS LINKE Logistics Software. Todos os direitos reservados.", {
      x: 25,
      y: 28,
      size: 7,
      font: fontNormal,
      color: c(0.50, 0.54, 0.60)
    })
    drawRightText(p, `Pagina ${idx + 1} de ${totalPages}`, 570, 28, 7, fontNormal, c(0.50, 0.54, 0.60))
  })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}

export async function generateStatementPdfBase64(data: BillingStatementPdfData): Promise<string> {
  const buf = await generateStatementPdfBuffer(data)
  return buf.toString("base64")
}
