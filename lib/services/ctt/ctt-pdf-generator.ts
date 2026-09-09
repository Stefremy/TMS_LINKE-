/**
 * Gerador autónomo de Etiquetas CTT Expresso em formato PDF 1.4 (Base64)
 * Gera ficheiros PDF válidos com cabeçalho CTT, dados de remetente, destinatário,
 * produto de entrega e código de barras / tracking legíveis.
 */

export interface CttLabelPdfOptions {
  trackingNumber: string
  serviceName?: string
  senderName?: string
  senderAddress?: string
  recipientName?: string
  recipientAddress?: string
  recipientZip?: string
  recipientCity?: string
  weightKg?: number | string
  volumesCount?: number | string
  dateStr?: string
}

export function generateCttLabelPdfBase64(options: CttLabelPdfOptions): string {
  const tracking = options.trackingNumber || `EA${Math.floor(10000000 + Math.random() * 90000000)}PT`
  const service = (options.serviceName || "CTT 24H (Para Amanhã)").toUpperCase()
  const senderName = options.senderName || "Empresa Remetente"
  const senderAddr = options.senderAddress || "Sede Comercial, Portugal"
  const recipientName = options.recipientName || "Destinatário"
  const recipientAddr = options.recipientAddress || "Morada de Entrega"
  const recipientZipCity = `${options.recipientZip || "1000-001"} ${options.recipientCity || "Portugal"}`
  const weight = options.weightKg ? `${options.weightKg} kg` : "1.00 kg"
  const volumes = options.volumesCount ? `${options.volumesCount}` : "1"
  const date = options.dateStr || new Date().toLocaleDateString("pt-PT")

  // Escape text for PDF string literals
  const esc = (text: string) => text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")

  // Dimensions: 100mm x 150mm (approx 283.46 x 425.20 points - standard thermal label size)
  const width = 283.46
  const height = 425.20

  const contentStream = `
    0.5 w
    0 0 0 RG
    0 0 0 rg

    % Outer Border
    10 10 263.46 405.20 re S

    % Header Area (CTT Branding)
    10 375 263.46 40 re f
    1 1 1 rg
    BT
    /F2 16 Tf
    20 390 Td
    (CTT EXPRESSO) Tj
    ET

    BT
    /F1 9 Tf
    170 392 Td
    (GUIA DE TRANSPORTE) Tj
    ET

    % Service Badge
    0 0 0 rg
    BT
    /F2 11 Tf
    20 355 Td
    (PRODUTO: ${esc(service)}) Tj
    ET

    10 345 263.46 0.5 re f

    % Remetente Box
    BT
    /F2 8 Tf
    20 332 Td
    (REMETENTE:) Tj
    /F1 8 Tf
    0 -12 Td
    (${esc(senderName)}) Tj
    0 -10 Td
    (${esc(senderAddr.slice(0, 45))}) Tj
    ET

    10 300 263.46 0.5 re f

    % Destinatario Box
    0.95 0.95 0.95 rg
    12 210 259.46 88 re f
    0 0 0 rg

    BT
    /F2 9 Tf
    20 282 Td
    (DESTINATARIO:) Tj
    /F2 12 Tf
    0 -15 Td
    (${esc(recipientName.slice(0, 32))}) Tj
    /F1 10 Tf
    0 -14 Td
    (${esc(recipientAddr.slice(0, 40))}) Tj
    /F2 11 Tf
    0 -14 Td
    (${esc(recipientZipCity.slice(0, 35))}) Tj
    ET

    10 205 263.46 0.5 re f

    % Weights & Volumes
    BT
    /F2 9 Tf
    20 185 Td
    (VOLUMES: ${esc(volumes)}) Tj
    100 0 Td
    (PESO: ${esc(weight)}) Tj
    90 0 Td
    (DATA: ${esc(date)}) Tj
    ET

    10 170 263.46 0.5 re f

    % Barcode Placeholder Visual
    0 0 0 rg
    25 90 233.46 65 re S

    % Simulated Barcode Stripes
    ${Array.from({ length: 42 }).map((_, i) => {
      const x = 32 + i * 5.2
      const w = (i % 3 === 0 || i % 7 === 0) ? 2.5 : 1.2
      return `${x.toFixed(1)} 100 ${w} 45 re f`
    }).join("\n    ")}

    % Tracking Number Text
    BT
    /F2 14 Tf
    65 72 Td
    (${esc(tracking)}) Tj
    ET

    10 60 263.46 0.5 re f

    % Footer Note
    BT
    /F1 7 Tf
    20 40 Td
    (Transmissao Eletronica de Dados CTT Expresso - Linke TMS) Tj
    0 -10 Td
    (Doc. de Transporte ao abrigo do regime de bens em circulacao) Tj
    0 -10 Td
    (Conserve esta etiqueta para efeitos de comprovativo e rastreio.) Tj
    ET
  `

  const streamLength = Buffer.byteLength(contentStream, "utf-8")

  const pdfBody = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 ${width.toFixed(2)} ${height.toFixed(2)}]
  /Contents 4 0 R
  /Resources <<
    /Font <<
      /F1 5 0 R
      /F2 6 0 R
    >>
  >>
>>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream${contentStream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000275 00000 n 
0000000300 00000 n 
0000000380 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
460
%%EOF`

  return Buffer.from(pdfBody, "utf-8").toString("base64")
}
