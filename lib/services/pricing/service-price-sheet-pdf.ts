import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { ServicePriceSheet } from "./service-price-sheet"

const W = 595.28, H = 841.89, M = 44, WIDTH = W - 2 * M, WEIGHT_WIDTH = 155
const colors = {
  ink: rgb(.09, .15, .19), green: rgb(.20, .45, .42), muted: rgb(.42, .48, .51),
  line: rgb(.86, .90, .89), pale: rgb(.96, .98, .97), white: rgb(1, 1, 1),
}
const money = (value: number) => new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " €"

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
      page.drawRectangle({ x: 0, y: H - 5, width: W, height: 5, color: colors.green })
      if (logo) page.drawImage(logo, { x: M, y: 765, width: 114, height: 114 * logo.height / logo.width })
      else text(page, "Linke", M, 786, 28, bold, colors.green)
      right(page, "TABELA COMERCIAL", W - M, 805, 8, bold, colors.green)
      right(page, `Emitida em ${date}`, W - M, 786, 8, normal, colors.muted)
      page.drawLine({ start: { x: M, y: 743 }, end: { x: W - M, y: 743 }, thickness: .7, color: colors.line })
      text(page, "Tabela de preços", M, 704, 28, bold)
      const nameLines = lines(sheet.serviceName, WIDTH, 12, normal)
      nameLines.slice(0, 2).forEach((value, index) => text(page, index === 1 && nameLines.length > 2 ? value.slice(0, -3) + "..." : value, M, 681 - index * 16, 12, normal, colors.muted))
      text(page, "PREÇOS BASE  /  EUR", M, 640, 8, bold, colors.green)
      if (rowIndex) right(page, "Continuação", W - M, 640, 8, normal, colors.muted)

      const headers = group.map(zone => lines(zone.name, colWidth - 24, 10, bold))
      const headerHeight = Math.max(48, 21 + Math.max(...headers.map(header => header.length)) * 13)
      const top = 622, headerBottom = top - headerHeight
      page.drawRectangle({ x: M, y: headerBottom, width: WIDTH, height: headerHeight, color: colors.green })
      text(page, "PESO", M + 14, headerBottom + 18, 9, bold, colors.white)
      headers.forEach((header, col) => header.forEach((value, index) =>
        right(page, value, M + WEIGHT_WIDTH + colWidth * (col + 1) - 14, top - 20 - index * 13, 10, bold, colors.white)))

      let y = headerBottom
      for (; rowIndex < group[0].rows.length; rowIndex++) {
        const row = group[0].rows[rowIndex]
        const weightLines = lines(row.weight, WEIGHT_WIDTH - 28, 10, bold)
        const details = row.detail ? lines(row.detail, WEIGHT_WIDTH - 28, 7.5) : []
        const height = Math.max(36, 16 + weightLines.length * 13 + details.length * 10)
        if (y - height < 146) break
        if (rowIndex % 2 === 0) page.drawRectangle({ x: M, y: y - height, width: WIDTH, height, color: colors.pale })
        weightLines.forEach((value, index) => text(page, value, M + 14, y - 23 - index * 13, 10, bold))
        details.forEach((value, index) => text(page, value, M + 14, y - 23 - weightLines.length * 13 - index * 10, 7.5, normal, colors.muted))
        group.forEach((zone, col) => {
          const price = money(zone.rows[rowIndex].price) + (row.perKg ? "/kg" : "")
          const size = Math.min(12, 12 * (colWidth - 28) / bold.widthOfTextAtSize(clean(price), 12))
          right(page, price, M + WEIGHT_WIDTH + colWidth * (col + 1) - 14, y - 23, size, bold)
        })
        page.drawLine({ start: { x: M, y: y - height }, end: { x: W - M, y: y - height }, thickness: .4, color: colors.line })
        y -= height
      }
      text(page, "Preços base de transporte em euros.", M, 111, 9, bold, colors.green)
      text(page, "Não incluem IVA, taxa de combustível ou serviços adicionais.", M, 95, 8.5, normal, colors.muted)
    } while (rowIndex < group[0].rows.length)
  }
  for (const [index, page] of doc.getPages().entries()) {
    page.drawLine({ start: { x: M, y: 66 }, end: { x: W - M, y: 66 }, thickness: .7, color: colors.line })
    text(page, "LINKE  |  geral@linke.pt  |  linke.pt", M, 47, 7.5, normal, colors.muted)
    right(page, `${index + 1} / ${doc.getPageCount()}`, W - M, 47, 8, normal, colors.muted)
  }
  return Buffer.from(await doc.save())
}
