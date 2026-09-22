import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import * as fs from 'fs'
import * as path from 'path'

export interface CustomInvoiceItem {
  title: string
  description?: string
  qty: number
  unitPrice: number
  taxRate: number // 23, 13, 6, 0
  discountPct?: number
}

export interface CustomInvoicePdfData {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  paymentTerms?: string
  paymentMethod?: string
  notes?: string
  client: {
    name: string
    nif?: string
    address?: string
    postalCode?: string
    city?: string
    email?: string
    phone?: string
  }
  items: CustomInvoiceItem[]
}

const c = (r: number, g: number, b: number) => rgb(r, g, b)

export async function generateCustomInvoicePdfBuffer(data: CustomInvoicePdfData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const fontNormal = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  let logoImage: any = null
  try {
    const logoBytes = fs.readFileSync(path.join(process.cwd(), 'public/Linke-logo.png'))
    logoImage = await doc.embedPng(logoBytes)
  } catch (err) {
    console.warn("Could not load Linke logo for custom invoice PDF:", err)
  }

  // Cálculos financeiros
  let subtotal = 0
  let totalDiscount = 0
  const taxBreakdown: Record<number, { base: number; tax: number }> = {}

  const processedItems = data.items.map((it) => {
    const qty = Number(it.qty || 1)
    const unitPrice = Number(it.unitPrice || 0)
    const discountPct = Number(it.discountPct || 0)
    const lineGross = qty * unitPrice
    const lineDiscount = lineGross * (discountPct / 100)
    const lineNet = lineGross - lineDiscount
    const taxRate = Number(it.taxRate !== undefined ? it.taxRate : 23)
    const lineTax = lineNet * (taxRate / 100)
    const lineTotal = lineNet + lineTax

    subtotal += lineGross
    totalDiscount += lineDiscount

    if (!taxBreakdown[taxRate]) {
      taxBreakdown[taxRate] = { base: 0, tax: 0 }
    }
    taxBreakdown[taxRate].base += lineNet
    taxBreakdown[taxRate].tax += lineTax

    return {
      ...it,
      lineGross,
      lineDiscount,
      lineNet,
      taxRate,
      lineTax,
      lineTotal,
    }
  })

  const totalNet = subtotal - totalDiscount
  let totalTax = 0
  Object.values(taxBreakdown).forEach((t) => {
    totalTax += t.tax
  })
  const grandTotal = totalNet + totalTax

  const fmtCurrency = (val: number) => {
    return val.toFixed(2).replace('.', ',') + ' EUR'
  }

  // Altura dinâmica de página para acomodar múltiplos serviços
  const baseHeight = 841.89 // A4 padrão
  const rowHeight = 32
  const maxItemsBase = 6
  const extraHeight = Math.max(0, (processedItems.length - maxItemsBase) * rowHeight)
  const height = baseHeight + extraHeight
  const width = 595.28

  const page = doc.addPage([width, height])
  const y = (val: number) => val + extraHeight

  // 1. Cabeçalho / Barra Superior
  page.drawRectangle({
    x: 25,
    y: y(775),
    width: 545.28,
    height: 48,
    color: c(0.06, 0.09, 0.16),
  })

  if (logoImage) {
    const desiredLogoHeight = 32
    const logoScale = desiredLogoHeight / logoImage.height
    const logoDims = logoImage.scale(logoScale)
    page.drawImage(logoImage, {
      x: 35,
      y: y(775) + (48 - logoDims.height) / 2,
      width: logoDims.width,
      height: logoDims.height,
    })
  } else {
    page.drawText('LINKE', { x: 35, y: y(792), size: 16, font: fontBold, color: c(1, 1, 1) })
  }

  page.drawText('FATURAÇÃO DE SERVIÇOS & CONSULTORIA', {
    x: 230,
    y: y(793),
    size: 10,
    font: fontBold,
    color: c(0.9, 0.95, 1),
  })

  // 2. Cartão de Informação da Fatura (Esquerda) e Dados do Cliente (Direita)
  page.drawRectangle({
    x: 25,
    y: y(675),
    width: 265,
    height: 90,
    color: c(0.97, 0.98, 0.99),
    borderColor: c(0.85, 0.88, 0.92),
    borderWidth: 1,
  })

  page.drawText('DADOS DA FATURA', { x: 35, y: y(748), size: 9, font: fontBold, color: c(0.1, 0.15, 0.25) })
  page.drawText('Fatura Nº:', { x: 35, y: y(732), size: 8, font: fontBold, color: c(0.3, 0.35, 0.45) })
  page.drawText(data.invoiceNumber, { x: 95, y: y(732), size: 9, font: fontBold, color: c(0.06, 0.09, 0.16) })

  page.drawText('Data de Emissão:', { x: 35, y: y(716), size: 8, font: fontBold, color: c(0.3, 0.35, 0.45) })
  page.drawText(data.invoiceDate, { x: 115, y: y(716), size: 8, font: fontNormal, color: c(0.1, 0.1, 0.1) })

  page.drawText('Data Vencimento:', { x: 35, y: y(700), size: 8, font: fontBold, color: c(0.3, 0.35, 0.45) })
  page.drawText(data.dueDate, { x: 115, y: y(700), size: 8, font: fontNormal, color: c(0.1, 0.1, 0.1) })

  page.drawText('Condições:', { x: 35, y: y(685), size: 8, font: fontBold, color: c(0.3, 0.35, 0.45) })
  page.drawText(data.paymentTerms || 'Pronto Pagamento', { x: 95, y: y(685), size: 8, font: fontNormal, color: c(0.1, 0.1, 0.1) })

  // Cartão do Cliente (Direita)
  page.drawRectangle({
    x: 305,
    y: y(675),
    width: 265.28,
    height: 90,
    color: c(0.97, 0.98, 0.99),
    borderColor: c(0.85, 0.88, 0.92),
    borderWidth: 1,
  })

  page.drawText('FATURAR A (CLIENTE):', { x: 315, y: y(748), size: 9, font: fontBold, color: c(0.1, 0.15, 0.25) })
  page.drawText(data.client.name.slice(0, 36), { x: 315, y: y(732), size: 9, font: fontBold, color: c(0.06, 0.09, 0.16) })
  page.drawText(`NIF: ${data.client.nif || 'Consumidor Final'}`, { x: 315, y: y(716), size: 8, font: fontNormal, color: c(0.2, 0.25, 0.35) })
  
  const clientAddr = [data.client.address, data.client.postalCode, data.client.city].filter(Boolean).join(', ')
  page.drawText((clientAddr || 'Portugal').slice(0, 48), { x: 315, y: y(700), size: 8, font: fontNormal, color: c(0.3, 0.35, 0.45) })
  
  if (data.client.email) {
    page.drawText(`Email: ${data.client.email.slice(0, 38)}`, { x: 315, y: y(685), size: 8, font: fontNormal, color: c(0.4, 0.45, 0.55) })
  }

  // 3. Tabela de Serviços e Artigos
  const tableTop = y(580)
  page.drawRectangle({
    x: 25,
    y: tableTop,
    width: 545.28,
    height: 22,
    color: c(0.15, 0.20, 0.28),
  })

  const thOpts = { size: 8, font: fontBold, color: c(1, 1, 1) }
  page.drawText('SERVIÇO / DESCRIÇÃO', { x: 35, y: tableTop + 6, ...thOpts })
  page.drawText('QTD', { x: 315, y: tableTop + 6, ...thOpts })
  page.drawText('PREÇO UNIT.', { x: 355, y: tableTop + 6, ...thOpts })
  page.drawText('IVA', { x: 425, y: tableTop + 6, ...thOpts })
  page.drawText('TOTAL LÍQ.', { x: 485, y: tableTop + 6, ...thOpts })

  // Linhas da tabela
  let currentY = tableTop - 26
  processedItems.forEach((item, index) => {
    const isEven = index % 2 === 0
    page.drawRectangle({
      x: 25,
      y: currentY - 6,
      width: 545.28,
      height: 28,
      color: isEven ? c(1, 1, 1) : c(0.98, 0.98, 0.99),
      borderColor: c(0.92, 0.93, 0.95),
      borderWidth: 0.5,
    })

    // Título do serviço
    page.drawText(item.title.slice(0, 42), {
      x: 35,
      y: currentY + 10,
      size: 8.5,
      font: fontBold,
      color: c(0.1, 0.12, 0.18),
    })

    // Sub-descrição se existir
    if (item.description) {
      page.drawText(item.description.slice(0, 52), {
        x: 35,
        y: currentY - 1,
        size: 7.5,
        font: fontNormal,
        color: c(0.45, 0.5, 0.58),
      })
    }

    // Quantidade
    page.drawText(`${item.qty}`, {
      x: 320,
      y: currentY + 6,
      size: 8.5,
      font: fontNormal,
      color: c(0.1, 0.1, 0.1),
    })

    // Preço Unitário
    page.drawText(fmtCurrency(item.unitPrice), {
      x: 355,
      y: currentY + 6,
      size: 8.5,
      font: fontNormal,
      color: c(0.1, 0.1, 0.1),
    })

    // Taxa IVA
    page.drawText(`${item.taxRate}%`, {
      x: 425,
      y: currentY + 6,
      size: 8.5,
      font: fontNormal,
      color: c(0.1, 0.1, 0.1),
    })

    // Total Líquido
    page.drawText(fmtCurrency(item.lineNet), {
      x: 485,
      y: currentY + 6,
      size: 8.5,
      font: fontBold,
      color: c(0.06, 0.09, 0.16),
    })

    currentY -= 30
  })

  // 4. Caixa de Observações e Pagamento (Esquerda)
  const totalsY = currentY - 15
  page.drawRectangle({
    x: 25,
    y: totalsY - 95,
    width: 290,
    height: 105,
    color: c(0.97, 0.98, 0.99),
    borderColor: c(0.88, 0.90, 0.94),
    borderWidth: 1,
  })

  page.drawText('INFORMAÇÕES DE PAGAMENTO & NOTAS:', {
    x: 35,
    y: totalsY - 8,
    size: 8,
    font: fontBold,
    color: c(0.2, 0.25, 0.35),
  })

  page.drawText('IBAN Linke: PT50 0033 0000 8765 4321 0987 1', {
    x: 35,
    y: totalsY - 24,
    size: 8,
    font: fontNormal,
    color: c(0.1, 0.1, 0.1),
  })

  page.drawText('Banco: Millennium BCP | Beneficiário: Linke Logística Lda', {
    x: 35,
    y: totalsY - 38,
    size: 7.5,
    font: fontNormal,
    color: c(0.3, 0.35, 0.45),
  })

  if (data.notes) {
    page.drawText(`Obs: ${data.notes.slice(0, 95)}`, {
      x: 35,
      y: totalsY - 55,
      size: 7.5,
      font: fontNormal,
      color: c(0.2, 0.25, 0.35),
    })
  }

  // 5. Caixa de Totais e IVA (Direita)
  page.drawRectangle({
    x: 330,
    y: totalsY - 95,
    width: 240.28,
    height: 105,
    color: c(0.95, 0.97, 1),
    borderColor: c(0.8, 0.86, 0.96),
    borderWidth: 1,
  })

  page.drawText('Subtotal:', { x: 345, y: totalsY - 12, size: 8.5, font: fontNormal, color: c(0.3, 0.35, 0.45) })
  page.drawText(fmtCurrency(subtotal), { x: 475, y: totalsY - 12, size: 8.5, font: fontNormal, color: c(0.1, 0.1, 0.1) })

  if (totalDiscount > 0) {
    page.drawText('Descontos:', { x: 345, y: totalsY - 26, size: 8.5, font: fontNormal, color: c(0.7, 0.15, 0.15) })
    page.drawText(`-${fmtCurrency(totalDiscount)}`, { x: 475, y: totalsY - 26, size: 8.5, font: fontNormal, color: c(0.7, 0.15, 0.15) })
  }

  // Discriminação do IVA
  let taxRowY = totalsY - (totalDiscount > 0 ? 40 : 28)
  Object.entries(taxBreakdown).forEach(([rate, t]) => {
    page.drawText(`IVA (${rate}% sobre ${fmtCurrency(t.base)}):`, {
      x: 345,
      y: taxRowY,
      size: 8,
      font: fontNormal,
      color: c(0.3, 0.35, 0.45),
    })
    page.drawText(fmtCurrency(t.tax), {
      x: 475,
      y: taxRowY,
      size: 8,
      font: fontNormal,
      color: c(0.1, 0.1, 0.1),
    })
    taxRowY -= 14
  })

  // Linha de Total em destaque
  page.drawRectangle({
    x: 330,
    y: totalsY - 95,
    width: 240.28,
    height: 28,
    color: c(0.06, 0.09, 0.16),
  })

  page.drawText('TOTAL A PAGAR:', {
    x: 345,
    y: totalsY - 82,
    size: 10,
    font: fontBold,
    color: c(1, 1, 1),
  })

  page.drawText(fmtCurrency(grandTotal), {
    x: 465,
    y: totalsY - 82,
    size: 10.5,
    font: fontBold,
    color: c(0.2, 0.85, 0.5),
  })

  // Rodapé
  page.drawText('Linke Express & Logistics, Lda | NIF: 518 600 300 | Processado por Software Certificado', {
    x: 120,
    y: 25,
    size: 7.5,
    font: fontNormal,
    color: c(0.5, 0.55, 0.65),
  })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
