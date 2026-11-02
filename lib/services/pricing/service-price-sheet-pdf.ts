import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { ServicePriceSheet } from "./service-price-sheet"

const W = 595.28, H = 841.89, M = 44, WIDTH = W - 2 * M, WEIGHT_WIDTH = 155
const colors = {
  ink: rgb(.065, .18, .18), green: rgb(.17, .40, .36), muted: rgb(.43, .49, .49),
  line: rgb(.88, .92, .90), pale: rgb(.965, .978, .97), white: rgb(1, 1, 1),
  mint: rgb(.77, .90, .83), header: rgb(.91, .95, .93), ornament: rgb(.26, .47, .42),
}
const money = (value: number) => new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " €"
const SELLING_POINTS = [
  "Resolução automática de incidentes com IA",
  "Comunicação omnicanal (email, chat, redes sociais)",
  "Seguro incluído e suporte proativo",
  "Redução até 40% no tempo de resposta ao cliente",
  "Diagnóstico gratuito e integração sem custos",
  "Notificações automáticas de envio",
]

export async function generateServicePriceSheetPdf(sheet: ServicePriceSheet, issuedAt = new Date()): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  doc.setTitle(`Tabela de preços - ${sheet.serviceName}`)
  doc.setAuthor("Linke")
  doc.setSubject("Preços base de transporte")
  const logo = await readFile(join(process.cwd(), "public", "Linke-logo.png")).then(bytes => doc.embedPng(bytes)).catch(() => null)
  const date = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon" }).format(issuedAt)

  function clean(value: string): string {
    return [...value.normalize("NFC").replace(/[–—‑]/g, "-").replace(/\s+/g, " ")].filter(char => {
      try { normal.encodeText(char); return true } catch { return false }
    }).join("").trim()
  }
  function lines(value: string, width: number, size: number, font = normal): string[] {
    const result: string[] = []
    let line = ""
    for (const word of clean(value).split(" ")) {
      if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > width) { result.push(line); line = "" }
      for (const char of (line ? " " : "") + word) {
        if (font.widthOfTextAtSize(line + char, size) > width) { result.push(line); line = "" }
        line += char
      }
    }
    if (line) result.push(line)
    return result
  }
  function text(page: PDFPage, value: string, x: number, y: number, size = 10, font = normal, color = colors.ink) {
    page.drawText(clean(value), { x, y, size, font, color })
  }
  function right(page: PDFPage, value: string, edge: number, y: number, size = 10, font = normal, color = colors.ink) {
    const label = clean(value)
    text(page, label, edge - font.widthOfTextAtSize(label, size), y, size, font, color)
  }
  function card(page: PDFPage, x: number, y: number, width: number, height: number, radius: number, color: typeof colors.ink) {
    page.drawRectangle({ x: x + radius, y, width: width - 2 * radius, height, color })
    page.drawRectangle({ x, y: y + radius, width, height: height - 2 * radius, color })
    for (const cx of [x + radius, x + width - radius]) for (const cy of [y + radius, y + height - radius]) {
      page.drawCircle({ x: cx, y: cy, size: radius, color })
    }
  }

  // Destinations with identical weight bands share a table, up to three price columns.
  const groups: ServicePriceSheet["zones"][] = []
  const signature = (zone: ServicePriceSheet["zones"][number]) => JSON.stringify(zone.rows.map(({ weight, detail, perKg }) => [weight, detail, perKg]))
  for (const zone of sheet.zones) {
    const group = groups.find(items => items.length < 3 && signature(items[0]) === signature(zone))
    if (group) group.push(zone)
    else groups.push([zone])
  }
  for (const group of groups) {
    let rowIndex = 0
    const colWidth = (WIDTH - WEIGHT_WIDTH) / group.length
    do {
      const page = doc.addPage([W, H])
      page.drawRectangle({ x: M, y: H - 7, width: 35, height: 7, color: colors.green })
      if (logo) page.drawImage(logo, { x: M, y: 765, width: 114, height: 114 * logo.height / logo.width })
      else text(page, "Linke", M, 786, 28, bold, colors.green)
      right(page, "TRANSPORTE & LOGÍSTICA", W - M, 805, 7.5, bold, colors.green)
      right(page, `Emitida em ${date}`, W - M, 786, 8, normal, colors.muted)

      card(page, M, 635, WIDTH, 108, 12, colors.ink)
      text(page, "TABELA COMERCIAL", M + 22, 721, 7, bold, colors.mint)
      text(page, "Tabela de preços", M + 22, 691, 27, bold, colors.white)
      const nameLines = lines(sheet.serviceName, WIDTH - 150, 10.5, normal)
      nameLines.slice(0, 2).forEach((value, index) => text(page, index === 1 && nameLines.length > 2 ? value.slice(0, -3) + "..." : value, M + 22, 670 - index * 14, 10.5, normal, colors.mint))
      // The paired chevrons echo the Linke mark and suggest movement.
      for (const offset of [0, 23]) {
        const x = W - M - 75 + offset
        page.drawLine({ start: { x, y: 665 }, end: { x: x + 21, y: 686 }, thickness: 3, color: colors.ornament })
        page.drawLine({ start: { x: x + 21, y: 686 }, end: { x, y: 707 }, thickness: 3, color: colors.ornament })
      }

      card(page, M, 599, 48, 22, 6, colors.header)
      text(page, "EUR", M + 14, 607, 8, bold, colors.green)
      text(page, "PREÇOS BASE", M + 61, 607, 7.5, bold, colors.muted)
      right(page, rowIndex ? "Continuação" : `${group.length} ${group.length === 1 ? "destino" : "destinos"}`, W - M, 607, 8, normal, colors.muted)

      const headers = group.map(zone => lines(zone.name, colWidth - 24, 10, bold))
      const headerHeight = Math.max(48, 21 + Math.max(...headers.map(header => header.length)) * 13)
      const top = 583, headerBottom = top - headerHeight
      card(page, M, headerBottom, WIDTH, headerHeight, 7, colors.header)
      text(page, "PESO", M + 14, headerBottom + 18, 8, bold, colors.green)
      headers.forEach((header, col) => header.forEach((value, index) =>
        right(page, value, M + WEIGHT_WIDTH + colWidth * (col + 1) - 14, top - 20 - index * 13, 10, bold, colors.green)))

      let y = headerBottom
      for (; rowIndex < group[0].rows.length; rowIndex++) {
        const row = group[0].rows[rowIndex]
        const weightLines = lines(row.weight, WEIGHT_WIDTH - 28, 10, bold)
        const details = row.detail ? lines(row.detail, WEIGHT_WIDTH - 28, 7.5) : []
        const compact = group[0].rows.length > 10
        const height = Math.max(compact ? 24 : 36, 12 + weightLines.length * 13 + details.length * 10)
        const baseline = y - (height === 24 ? 17 : 23)
        if (y - height < 238) break
        if (row.perKg || rowIndex % 2 === 0) page.drawRectangle({ x: M, y: y - height, width: WIDTH, height, color: colors.pale })
        weightLines.forEach((value, index) => text(page, value, M + 14, baseline - index * 13, 10, bold))
        details.forEach((value, index) => text(page, value, M + 14, baseline - weightLines.length * 13 - index * 10, 7.5, normal, colors.muted))
        group.forEach((zone, col) => {
          const price = money(zone.rows[rowIndex].price) + (row.perKg ? "/kg" : "")
          const preferredSize = row.perKg ? 11 : compact ? 12 : 13.5
          const size = Math.min(preferredSize, preferredSize * (colWidth - 28) / bold.widthOfTextAtSize(clean(price), preferredSize))
          right(page, price, M + WEIGHT_WIDTH + colWidth * (col + 1) - 14, baseline, size, bold, colors.green)
        })
        page.drawLine({ start: { x: M, y: y - height }, end: { x: W - M, y: y - height }, thickness: .4, color: colors.line })
        y -= height
      }
      card(page, M, 104, WIDTH, 112, 8, colors.pale)
      text(page, "PORQUÊ ESCOLHER A LINKE", M + 18, 198, 8.5, bold, colors.green)
      const sellingColumnWidth = (WIDTH - 36) / 2
      SELLING_POINTS.forEach((point, index) => {
        const x = M + 18 + (index % 2) * sellingColumnWidth
        const y = 179 - Math.floor(index / 2) * 28
        page.drawCircle({ x: x + 3, y: y + 3, size: 4, color: colors.header })
        page.drawLine({ start: { x: x + 1, y: y + 3 }, end: { x: x + 2.5, y: y + 1.5 }, thickness: .8, color: colors.green })
        page.drawLine({ start: { x: x + 2.5, y: y + 1.5 }, end: { x: x + 5, y: y + 5 }, thickness: .8, color: colors.green })
        lines(point, sellingColumnWidth - 24, 8.5).forEach((value, line) => text(page, value, x + 14, y - line * 11, 8.5, normal, colors.ink))
      })
      text(page, "Preços base em euros. Não incluem IVA, taxa de combustível ou serviços adicionais.", M, 83, 7.5, normal, colors.muted)
    } while (rowIndex < group[0].rows.length)
  }
  for (const [index, page] of doc.getPages().entries()) {
    page.drawLine({ start: { x: M, y: 66 }, end: { x: W - M, y: 66 }, thickness: .7, color: colors.line })
    text(page, "LINKE", M, 47, 8.5, bold, colors.green)
    text(page, "geral@linke.pt  /  linke.pt", M + 47, 47, 7.5, normal, colors.muted)
    card(page, W - M - 40, 40, 40, 20, 5, colors.header)
    right(page, `${index + 1} / ${doc.getPageCount()}`, W - M - 9, 47, 8, bold, colors.green)
  }
  return Buffer.from(await doc.save())
}
