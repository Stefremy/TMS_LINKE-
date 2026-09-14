/**
 * Gerador de Manifesto de Carga / Guia de Transporte CTT em formato PDF 1.4 (Base64)
 * Formato padrão A4 (595.28 x 841.89 pontos).
 * Inclui cabeçalho de expedição, tabela de objetos, totais e caixas de assinatura para o motorista CTT.
 */

export interface ManifestPdfShipment {
  id: string
  trackingNumber: string
  reference?: string
  senderName?: string
  recipientName: string
  destinationCity?: string
  serviceType?: string
  weightKg?: number | string
  volumesCount?: number | string
}

export interface ManifestPdfOptions {
  deliveryNoteId: string
  carrierName?: string
  contractNumber?: string
  clientNumber?: string
  dateStr?: string
  shipments: ManifestPdfShipment[]
}

export function generateManifestPdfBase64(options: ManifestPdfOptions): string {
  const deliveryNote = options.deliveryNoteId || `MAN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`
  const dateStr = options.dateStr || new Date().toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })
  const shipments = options.shipments || []
  
  const totalShipments = shipments.length
  const totalVolumes = shipments.reduce((acc, s) => acc + (Number(s.volumesCount) || 1), 0)
  const totalWeight = shipments.reduce((acc, s) => acc + (Number(s.weightKg) || 1.0), 0).toFixed(2)

  // Escape text for PDF string literals
  const esc = (text?: string) => (text || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")

  // A4 Dimensions in points
  const width = 595.28
  const height = 841.89

  // Build Table Rows
  let tableRowsStream = ""
  let currentY = 620
  const rowHeight = 24

  shipments.slice(0, 18).forEach((item, index) => {
    const isEven = index % 2 === 0
    const bgRow = isEven 
      ? `0.97 0.98 0.99 rg 25 ${currentY - 4} 545.28 ${rowHeight} re f 0 0 0 rg\n` 
      : `1 1 1 rg 25 ${currentY - 4} 545.28 ${rowHeight} re f 0 0 0 rg\n`

    const refDisplay = item.reference || `LTK-${item.id.slice(0, 8).toUpperCase()}`
    const cttDisplay = item.trackingNumber
    const destDisplay = `${item.recipientName.slice(0, 20)} (${(item.destinationCity || "PT").slice(0, 14)})`
    const srvDisplay = (item.serviceType || "CTT 24H").slice(0, 18)
    const volWeightDisplay = `${item.volumesCount || 1} vol / ${Number(item.weightKg || 1).toFixed(1)}kg`

    tableRowsStream += `
      ${bgRow}
      0.85 0.85 0.85 RG
      0.5 w
      25 ${currentY - 4} 545.28 ${rowHeight} re S
      0 0 0 rg
      BT
      /F2 9 Tf
      32 ${currentY + 4} Td
      (${index + 1}) Tj
      55 ${currentY + 4} Td
      (${esc(refDisplay)}) Tj
      155 ${currentY + 4} Td
      (${esc(cttDisplay)}) Tj
      270 ${currentY + 4} Td
      /F1 9 Tf
      (${esc(destDisplay)}) Tj
      /F1 8 Tf
      430 ${currentY + 4} Td
      (${esc(srvDisplay)}) Tj
      /F2 8 Tf
      515 ${currentY + 4} Td
      (${esc(volWeightDisplay)}) Tj
      ET
    `
    currentY -= rowHeight
  })

  const contentStream = `
    0.5 w
    0 0 0 RG
    0 0 0 rg

    % Outer Header Banner
    0.90 0.10 0.15 rg
    25 780 545.28 40 re f

    1 1 1 rg
    BT
    /F2 16 Tf
    35 795 Td
    (CTT EXPRESSO) Tj
    /F1 10 Tf
    170 796 Td
    (MANIFESTO DE EXPEDICAO E GUIA DE TRANSPORTE) Tj
    ET

    % Meta info box
    0.96 0.96 0.97 rg
    25 700 545.28 70 re f
    0.8 0.8 0.8 RG
    25 700 545.28 70 re S
    0 0 0 rg

    BT
    /F2 10 Tf
    35 750 Td
    (N. Manifesto / Guia CTT: ${esc(deliveryNote)}) Tj
    35 733 Td
    /F1 9 Tf
    (Operador Logistico: TMS LINKE LOGISTICA | Remetente Autorizado) Tj
    35 715 Td
    (Data / Hora de Fecho: ${esc(dateStr)}) Tj
    
    380 750 Td
    /F2 10 Tf
    (Total Envios: ${totalShipments}) Tj
    380 733 Td
    /F2 9 Tf
    (Total Volumes: ${totalVolumes}) Tj
    380 715 Td
    /F2 9 Tf
    (Peso Total: ${totalWeight} kg) Tj
    ET

    % Table Header
    0.15 0.20 0.28 rg
    25 645 545.28 22 re f
    1 1 1 rg
    BT
    /F2 9 Tf
    32 652 Td
    (#) Tj
    55 652 Td
    (REF. LINKE) Tj
    155 652 Td
    (OBJETO CTT EXPRESSO) Tj
    270 652 Td
    (DESTINATARIO / CIDADE) Tj
    430 652 Td
    (SERVICO) Tj
    515 652 Td
    (VOLS / PESO) Tj
    ET
    0 0 0 rg

    % Shipment Rows
    ${tableRowsStream}

    % Bottom Signature Area
    0.95 0.95 0.95 rg
    25 60 545.28 110 re f
    0.8 0.8 0.8 RG
    25 60 545.28 110 re S
    0 0 0 rg

    BT
    /F2 10 Tf
    35 150 Td
    (VALIDACAO E TERMO DE ACEITACAO DE CARGA) Tj
    /F1 8 Tf
    35 136 Td
    (Declara-se que os volumes acima discriminados foram devidamente conferidos e entregues a transportadora.) Tj
    ET

    % Expedidor Box
    0.8 0.8 0.8 RG
    35 72 245 50 re S
    BT
    /F2 8 Tf
    42 110 Td
    (ENTREGUE POR (Expedidor TMS LINKE):) Tj
    /F1 8 Tf
    42 80 Td
    (Assinatura: _______________________________) Tj
    ET

    % Transportadora Box
    300 72 260 50 re S
    BT
    /F2 8 Tf
    308 110 Td
    (RECEBIDO POR (Motorista / Aceitacao CTT):) Tj
    /F1 8 Tf
    308 80 Td
    (Nome/Matricula: ________________  Ass: ________) Tj
    ET

    % Page Footer
    BT
    /F1 8 Tf
    0.5 0.5 0.5 rg
    25 35 Td
    (Documento gerado automaticamente pelo TMS LINKE. Valido como guia de acompanhamento de transporte rodoviario.) Tj
    480 35 Td
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

  return Buffer.from(pdf).toString("base64")
}
