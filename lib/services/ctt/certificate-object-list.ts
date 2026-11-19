import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export interface CertificateObjectRow {
  objectCode: string
  guia?: string | null
  recipient?: string | null
  destination?: string | null
  volumes?: number | null
  weightKg?: number | null
}

// Helvetica (WinAnsi) only encodes Latin-1; anything else would make pdf-lib throw.
const latin1 = (value: unknown) => String(value ?? '').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?').trim()

function fit(font: PDFFont, text: string, size: number, maxWidth: number) {
  let value = latin1(text)
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > maxWidth) value = value.slice(0, -1)
  return `${value}...`
}

/**
 * The CTT "Certificado de Aceitação" returned by CloseShipment leaves its body empty: it only prints
 * totals. Stamp the list of objects into that blank area (page 1) so the driver and the sender can
 * check which parcels were handed over. Extra rows continue on appended pages.
 * The archived CTT original is never modified; on any failure the original is returned untouched.
 */
export async function stampCertificateObjectList(base64: string, rows: CertificateObjectRow[]): Promise<string> {
  if (!base64 || !rows.length) return base64
  try {
    const pdf = await PDFDocument.load(Buffer.from(base64, 'base64'), { updateMetadata: false })
    const first = pdf.getPage(0)
    const { width, height } = first.getSize()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

    const left = width * 0.04, right = width * 0.96
    // Blank band between the "Expedição Nº / Data" line and the totals footer of the CTT layout.
    const bandTop = height * 0.69, bandBottom = height * 0.25
    const rowHeight = 13, size = 8
    const columns = [
      { title: '#', width: 0.04 },
      { title: 'Objeto CTT', width: 0.17 },
      { title: 'Guia Linke', width: 0.13 },
      { title: 'Destinatário', width: 0.27 },
      { title: 'Destino', width: 0.25 },
      { title: 'Vol.', width: 0.05 },
      { title: 'Peso', width: 0.09 },
    ]
    const span = right - left
    const xs = columns.reduce<number[]>((acc, col, i) => [...acc, i ? acc[i - 1] + columns[i - 1].width * span : left], [])

    const drawHeader = (page: PDFPage, top: number, title: string) => {
      page.drawText(latin1(title), { x: left, y: top, size: 9, font: bold, color: rgb(0, 0, 0) })
      const y = top - 16
      page.drawRectangle({ x: left, y: y - 3, width: span, height: rowHeight, color: rgb(0.92, 0.92, 0.92) })
      columns.forEach((col, i) => page.drawText(col.title, { x: xs[i] + 2, y, size, font: bold, color: rgb(0, 0, 0) }))
      return y - rowHeight
    }

    const totalVolumes = rows.reduce((sum, row) => sum + (Number(row.volumes) || 1), 0)
    let page = first
    let y = drawHeader(page, bandTop, `Objetos incluídos neste certificado: ${rows.length} envio(s) · ${totalVolumes} volume(s)`)
    let bottom = bandBottom
    rows.forEach((row, index) => {
      if (y < bottom) {
        page = pdf.addPage([width, height])
        y = drawHeader(page, height - 50, 'Certificado de Aceitação CTT: continuação da lista de objetos')
        bottom = 40
      }
      if (index % 2 === 1) page.drawRectangle({ x: left, y: y - 3, width: span, height: rowHeight, color: rgb(0.97, 0.97, 0.97) })
      const weight = row.weightKg ? `${Number(row.weightKg).toFixed(2).replace('.', ',')} kg` : ''
      const values = [String(index + 1), row.objectCode, row.guia || '', row.recipient || '', row.destination || '', String(row.volumes || 1), weight]
      values.forEach((value, i) => page.drawText(fit(i === 1 ? bold : font, value, size, columns[i].width * span - 4), { x: xs[i] + 2, y, size, font: i === 1 ? bold : font, color: rgb(0, 0, 0) }))
      y -= rowHeight
    })
    return Buffer.from(await pdf.save()).toString('base64')
  } catch {
    return base64
  }
}
