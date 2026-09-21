/**
 * Gerador de Extrato de Conta Corrente / Faturação TMS em formato PDF 1.4.
 * Formato padrão A4 (595.28 x 841.89 pontos).
 * Gera um documento executivo limpo com identificação do cliente, tabela de envios,
 * subtotal, IVA e total a pagar, pronto para impressão ou download imediato.
 */

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

export function generateStatementPdfBuffer(data: BillingStatementPdfData): Buffer {
  const statementNum = data.statementNumber || `EXT-${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`
  const dateStr = data.dateStr || new Date().toLocaleDateString("pt-PT")
  const shipments = data.shipments || []
  
  const totalShipments = shipments.length
  const subtotal = Number(data.totalValue || 0)
  const iva = subtotal * 0.23
  const totalWithIva = subtotal + iva

  // Normalização e escape de texto para compatibilidade com Helvetica PDF
  const esc = (text?: string) => {
    if (!text) return ""
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
  }

  const fmtCurrency = (val: number) => {
    return val.toFixed(2).replace(".", ",") + " EUR"
  }

  // A4 Dimensions in points
  const width = 595.28
  const height = 841.89

  // Construir Linhas da Tabela
  let tableRowsStream = ""
  let currentY = 575
  const rowHeight = 22

  // Limitar visualização na página 1 a até 16 envios
  shipments.slice(0, 16).forEach((item, index) => {
    const isEven = index % 2 === 0
    const bgRow = isEven 
      ? `0.98 0.98 0.99 rg 25 ${currentY - 3} 545.28 ${rowHeight} re f 0 0 0 rg\n` 
      : `1 1 1 rg 25 ${currentY - 3} 545.28 ${rowHeight} re f 0 0 0 rg\n`

    const itemDate = item.created_at ? new Date(item.created_at).toLocaleDateString("pt-PT") : dateStr
    const trackingBase = item.tracking_number || item.reference || `ENV-${item.id.slice(0, 8).toUpperCase()}`
    const tracking = item.service_type ? `[${item.service_type.slice(0, 15)}] ${trackingBase}` : trackingBase
    const destName = (item.recipient_name || "Destinatario").slice(0, 22)
    const destCity = item.recipient_city ? ` (${item.recipient_city.slice(0, 14)})` : ""
    const destFull = `${destName}${destCity}`
    const priceStr = fmtCurrency(Number(item.sell_price || 0))

    tableRowsStream += `
      ${bgRow}
      0.90 0.90 0.92 RG
      0.5 w
      25 ${currentY - 3} 545.28 ${rowHeight} re S
      0 0 0 rg
      BT
      /F2 8 Tf
      32 ${currentY + 4} Td
      (${index + 1}) Tj
      52 ${currentY + 4} Td
      /F1 8 Tf
      (${esc(itemDate)}) Tj
      115 ${currentY + 4} Td
      /F2 8 Tf
      (${esc(tracking)}) Tj
      245 ${currentY + 4} Td
      /F1 8 Tf
      (${esc(destFull)}) Tj
      /F2 8 Tf
      505 ${currentY + 4} Td
      (${esc(priceStr)}) Tj
      ET
    `
    currentY -= rowHeight
  })

  // Se houver mais envios que o limite da página
  if (shipments.length > 16) {
    tableRowsStream += `
      BT
      /F1 8 Tf
      0.5 0.5 0.5 rg
      35 ${currentY - 2} Td
      (... e mais ${shipments.length - 16} envios incluidos no apuramento deste extrato) Tj
      ET
    `
    currentY -= 15
  }

  const contentStream = `
    0.5 w
    0 0 0 RG
    0 0 0 rg

    % Top Header Banner (Brand)
    0.06 0.09 0.16 rg
    25 780 545.28 42 re f

    1 1 1 rg
    BT
    /F2 16 Tf
    38 795 Td
    (LINKE LOGISTICS) Tj
    /F1 9 Tf
    190 796 Td
    (SISTEMA DE GESTAO DE TRANSPORTES | CONTA CORRENTE) Tj
    ET

    % Document Info Card (Header Direito / Esquerdo)
    0.96 0.97 0.98 rg
    25 690 545.28 78 re f
    0.85 0.87 0.90 RG
    25 690 545.28 78 re S
    0 0 0 rg

    BT
    /F2 11 Tf
    35 748 Td
    (EXTRATO DE FATURACAO) Tj
    /F2 9 Tf
    35 730 Td
    (Documento: ) Tj
    /F1 9 Tf
    95 730 Td
    (${esc(statementNum)}) Tj
    /F2 9 Tf
    35 712 Td
    (Data de Emissao: ) Tj
    /F1 9 Tf
    115 712 Td
    (${esc(dateStr)}) Tj
    /F2 9 Tf
    35 696 Td
    (Total de Envios: ) Tj
    /F1 9 Tf
    115 696 Td
    (${totalShipments} objeto(s)) Tj

    % Dados do Cliente
    310 748 Td
    /F2 10 Tf
    (DADOS DO CLIENTE:) Tj
    310 730 Td
    /F2 9 Tf
    (${esc(data.clientName || "Cliente Linke")}) Tj
    310 712 Td
    /F1 9 Tf
    (NIF: ${esc(data.clientNif || "Consumidor Final")}) Tj
    310 696 Td
    /F1 8 Tf
    (${esc(data.clientAddress || data.clientCity || "Portugal")}) Tj
    ET

    % Table Header
    0.15 0.20 0.28 rg
    25 600 545.28 20 re f
    1 1 1 rg
    BT
    /F2 8 Tf
    32 606 Td
    (#) Tj
    52 606 Td
    (DATA) Tj
    115 606 Td
    (TRACKING / REFERENCIA) Tj
    245 606 Td
    (DESTINATARIO / DESTINO) Tj
    505 606 Td
    (VALOR S/ IVA) Tj
    ET
    0 0 0 rg

    % Linhas de envios
    ${tableRowsStream}

    % Resumo Financeiro Box (Totais)
    0.97 0.98 0.99 rg
    320 85 250.28 90 re f
    0.80 0.82 0.86 RG
    320 85 250.28 90 re S
    0 0 0 rg

    BT
    /F1 9 Tf
    335 155 Td
    (Subtotal Incidencia:) Tj
    470 155 Td
    /F2 9 Tf
    (${esc(fmtCurrency(subtotal))}) Tj

    /F1 9 Tf
    335 137 Td
    (IVA (Taxa Normal 23%):) Tj
    470 137 Td
    /F2 9 Tf
    (${esc(fmtCurrency(iva))}) Tj

    /F2 10 Tf
    0.06 0.09 0.16 rg
    335 105 Td
    (TOTAL A LIQUIDAR:) Tj
    465 105 Td
    /F2 11 Tf
    (${esc(fmtCurrency(totalWithIva))}) Tj
    ET

    % Notas e Termos de Pagamento
    0.97 0.98 0.99 rg
    25 85 285 90 re f
    0.80 0.82 0.86 RG
    25 85 285 90 re S
    0 0 0 rg

    BT
    /F2 8 Tf
    35 155 Td
    (TERMOS E CONDICOES DE CONTA CORRENTE:) Tj
    /F1 8 Tf
    35 140 Td
    (- Este documento resume os envios faturados na presente data.) Tj
    35 126 Td
    (- Para liquidacao via transferencia bancaria ou debito em conta.) Tj
    35 112 Td
    (- O suporte oficial AT (Fatura-Recibo) podera ser emitido via Moloni.) Tj
    35 98 Td
    (- Para esclarecimentos: financeiro@linkelogistics.pt) Tj
    ET

    % Page Footer
    BT
    /F1 8 Tf
    0.5 0.5 0.5 rg
    25 35 Td
    (Processado por computador - TMS LINKE Logistics Software. Todos os direitos reservados.) Tj
    490 35 Td
    (Pagina 1 de 1) Tj
    ET
  `

  const streamLength = Buffer.byteLength(contentStream, "utf8")

  const pdf = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 ${width} ${height}]
  /Resources <<
    /Font <<
      /F1 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica
      >>
      /F2 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica-Bold
      >>
    >>
  >>
  /Contents 4 0 R
>>
endobj
4 0 obj
<<
  /Length ${streamLength}
>>
stream
${contentStream}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000370 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
${400 + streamLength}
%%EOF`

  return Buffer.from(pdf, "utf8")
}

export function generateStatementPdfBase64(data: BillingStatementPdfData): string {
  return generateStatementPdfBuffer(data).toString("base64")
}
