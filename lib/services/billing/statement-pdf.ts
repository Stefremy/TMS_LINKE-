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

    // Extract special fees description
    let specialDesc = ""
    if (s.special_fees_description) {
      if (typeof s.special_fees_description === "string" && s.special_fees_description.startsWith("[")) {
        try {
          const parsed = JSON.parse(s.special_fees_description)
          if (Array.isArray(parsed) && parsed.length > 0) {
            specialDesc = parsed.map((p: { name?: string; service?: string }) => p.name || p.service || "Extra").join(", ")
          }
        } catch {
          specialDesc = s.special_fees_description
        }
      } else {
        specialDesc = s.special_fees_description
      }
    }
    if (specialFees > 0 && !specialDesc) {
      specialDesc = "Taxa Especial"
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
      recipientName: safeStr((s.recipient_name || "Destinatario").slice(0, 22)),
      recipientCity: safeStr((s.recipient_city || "").slice(0, 16)),
      basePrice,
      fuelTax,
      specialFees,
      hasBase: !isPeriodStatement || s.base_price != null,
      hasFuel: !isPeriodStatement || s.fuel_tax_amount != null,
      hasSpecial: !isPeriodStatement || s.special_fees_amount != null,
      specialDesc: safeStr(specialDesc.slice(0, 20)),
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
  const rowHeight = 23
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
    page.drawText(`EXTRATO DISCRIMINATIVO ${statementNum}  |  ${safeStr((data.clientName || "").slice(0, 30))}`, {
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

  let currentY = tableTopY - rowHeight

  // Minimum bottom boundary when summary is on this page vs not on this page
  const minBoundaryWithSummary = summaryBoxHeight + footerReservedHeight + 15
  const minBoundaryWithoutSummary = footerReservedHeight + 10

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const remainingItems = items.length - i
    const neededSpaceForSummary = remainingItems <= 1 ? minBoundaryWithSummary : minBoundaryWithoutSummary

    // Need new page?
    if (currentY < neededSpaceForSummary) {
      currentPage = doc.addPage([pageWidth, pageHeight])
      pages.push(currentPage)
      drawSubsequentPageHeader(currentPage)
      tableTopY = 765
      drawTableHeader(currentPage, tableTopY)
      currentY = tableTopY - rowHeight
    }

    // Draw Row Background
    const isEven = i % 2 === 0
    currentPage.drawRectangle({
      x: 25,
      y: currentY,
      width: 545.28,
      height: rowHeight,
      color: isEven ? c(1, 1, 1) : c(0.97, 0.98, 0.99),
      borderColor: c(0.90, 0.92, 0.94),
      borderWidth: 0.5
    })

    const line1Y = currentY + 12
    const line2Y = currentY + 3.5
    const midY = currentY + 7.5

    // Col 1: #
    currentPage.drawText(String(item.index), { x: 29, y: midY, size: 7.5, font: fontBold, color: c(0.06, 0.09, 0.16) })

    // Col 2: Date
    currentPage.drawText(item.date, { x: 48, y: midY, size: 7, font: fontNormal, color: c(0.35, 0.40, 0.48) })

    // Col 3: Tracking / Service
    currentPage.drawText(item.tracking, { x: 96, y: line1Y, size: 7.5, font: fontBold, color: c(0.06, 0.09, 0.16) })
    const servWithWeight = `${item.service}${item.weightKg ? ` (${item.weightKg}kg)` : ""}`
    currentPage.drawText(servWithWeight.slice(0, 26), { x: 96, y: line2Y, size: 6.5, font: fontNormal, color: c(0.48, 0.52, 0.58) })

    // Col 4: Recipient / Destination
    currentPage.drawText(item.recipientName, { x: 236, y: line1Y, size: 7.5, font: fontNormal, color: c(0.12, 0.15, 0.20) })
    if (item.recipientCity) {
      currentPage.drawText(item.recipientCity, { x: 236, y: line2Y, size: 6.5, font: fontNormal, color: c(0.48, 0.52, 0.58) })
    }

    // Col 5: Base Tabela
    drawRightText(currentPage, item.hasBase ? fmtCurrency(item.basePrice) : "-", 395, midY, 7.5, fontNormal, c(0.15, 0.18, 0.22))

    // Col 6: Taxa Combustível
    drawRightText(currentPage, item.hasFuel ? fmtCurrency(item.fuelTax) : "-", 450, midY, 7.5, fontNormal, c(0.15, 0.18, 0.22))

    // Col 7: Extras
    if (item.specialFees > 0) {
      drawRightText(currentPage, fmtCurrency(item.specialFees), 502, line1Y, 7.5, fontBold, c(0.15, 0.18, 0.22))
      if (item.specialDesc) {
        drawRightText(currentPage, item.specialDesc, 502, line2Y, 6, fontNormal, c(0.45, 0.50, 0.56))
      }
    } else {
      drawRightText(currentPage, "-", 502, midY, 7.5, fontNormal, c(0.55, 0.58, 0.62))
    }

    // Col 8: Total Líquido
    drawRightText(currentPage, fmtCurrency(item.sellPrice), 562, midY, 8, fontBold, c(0.06, 0.09, 0.16))

    currentY -= rowHeight
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
