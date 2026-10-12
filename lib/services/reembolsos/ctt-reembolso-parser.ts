import { XMLParser } from "fast-xml-parser"
import type { ReembolsoRawItem } from "./types"

export interface CttParseResult {
  carrier: "ctt"
  carrierAccount?: string
  carrierContract?: string
  destinationIban?: string
  totalItems: number
  totalAmount: number
  items: ReembolsoRawItem[]
}

function cleanCell(cell: any): string {
  if (cell === null || cell === undefined) return ""
  if (typeof cell === "object") {
    if (cell.Data !== undefined) {
      if (typeof cell.Data === "object") return String(cell.Data["#text"] ?? "").trim()
      return String(cell.Data).trim()
    }
    if (cell["#text"] !== undefined) return String(cell["#text"]).trim()
  }
  return String(cell).trim()
}

/**
 * Parses CTT Expresso COD / Reembolsos settlement files.
 * Supports:
 * - CTT XML Spreadsheet 2003 (.XLS with SpreadsheetML header)
 * - CSV with ; or , delimiters
 */
export function parseCttReembolsoFile(content: string): CttParseResult {
  const trimmed = content.trim()

  // 1. Detect SpreadsheetML XML format (the official CTT XLS format)
  if (trimmed.startsWith("<?xml") || trimmed.includes("urn:schemas-microsoft-com:office:spreadsheet")) {
    return parseCttXmlSpreadsheet(trimmed)
  }

  // 2. Fallback to CSV / TSV format
  return parseCttCsv(trimmed)
}

function parseCttXmlSpreadsheet(xmlString: string): CttParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  })

  const doc = parser.parse(xmlString)
  const worksheet = doc?.Workbook?.Worksheet
  const table = Array.isArray(worksheet) ? worksheet[0]?.Table : worksheet?.Table
  const rows = table?.Row || []

  let carrierAccount = ""
  let carrierContract = ""
  let destinationIban = ""
  const items: ReembolsoRawItem[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const cells = Array.isArray(row.Cell) ? row.Cell : row.Cell ? [row.Cell] : []
    const firstVal = cleanCell(cells[0])

    // Row 2 in standard CTT template: [Account, Contract, Destination IBAN]
    if (i === 1) {
      carrierAccount = cleanCell(cells[0])
      carrierContract = cleanCell(cells[1])
      destinationIban = cleanCell(cells[2])
      continue
    }

    // Skip non-item rows
    if (!firstVal || firstVal.toLowerCase().startsWith("valor total") || firstVal.toLowerCase().startsWith("quantidade")) {
      continue
    }

    const lineNum = parseInt(firstVal, 10)
    const tracking = cleanCell(cells[1])

    // An item line has either an integer line number or a valid tracking format
    const isCarrierTracking = /^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(tracking) || /^\d{16}$/.test(tracking)

    if (!isNaN(lineNum) && isCarrierTracking) {
      const rawAmountStr = cleanCell(cells[8]).replace(/\s/g, "").replace(",", ".")
      const amount = parseFloat(rawAmountStr) || 0

      const rawPayment = cleanCell(cells[9]).toUpperCase()
      const paymentMethod = rawPayment === "D" ? "Dinheiro" : rawPayment === "M" ? "Multibanco" : rawPayment || "Outro"

      items.push({
        lineNumber: lineNum,
        carrierTracking: tracking.toUpperCase(),
        deliveryDate: cleanCell(cells[2]),
        processingDate: cleanCell(cells[3]),
        recipientName: cleanCell(cells[4]),
        recipientAddress: cleanCell(cells[5]),
        recipientPostalCode: cleanCell(cells[6]),
        recipientCity: cleanCell(cells[7]),
        amount: Math.round(amount * 100) / 100,
        paymentMethod,
        clientReference: cleanCell(cells[10]),
        additionalInfo: cleanCell(cells[11]),
        clientNotes: cleanCell(cells[12]),
      })
    }
  }

  const totalAmount = Math.round(items.reduce((acc, it) => acc + it.amount, 0) * 100) / 100

  return {
    carrier: "ctt",
    carrierAccount,
    carrierContract,
    destinationIban,
    totalItems: items.length,
    totalAmount,
    items,
  }
}

function parseCttCsv(csvString: string): CttParseResult {
  const lines = csvString.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    return {
      carrier: "ctt",
      totalItems: 0,
      totalAmount: 0,
      items: [],
    }
  }

  // Detect delimiter
  const firstLine = lines[0]
  const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ","

  const items: ReembolsoRawItem[] = []
  let headerIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""))
    if (cols.some((c) => c.toLowerCase().includes("objeto") || c.toLowerCase().includes("número de linha"))) {
      headerIndex = i
      break
    }
  }

  const dataLines = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines

  for (let i = 0; i < dataLines.length; i++) {
    const cols = dataLines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""))
    if (cols.length < 3) continue

    const firstVal = cols[0]
    if (firstVal.toLowerCase().startsWith("valor total") || firstVal.toLowerCase().startsWith("quantidade")) {
      continue
    }

    const lineNum = parseInt(firstVal, 10) || i + 1
    const tracking = cols[1] || ""

    if (/^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(tracking) || /^\d{16}$/.test(tracking)) {
      const rawAmountStr = (cols[8] || cols[7] || "0").replace(/\s/g, "").replace(",", ".")
      const amount = parseFloat(rawAmountStr) || 0

      const rawPayment = (cols[9] || "").toUpperCase()
      const paymentMethod = rawPayment === "D" ? "Dinheiro" : rawPayment === "M" ? "Multibanco" : rawPayment || "Outro"

      items.push({
        lineNumber: lineNum,
        carrierTracking: tracking.toUpperCase(),
        deliveryDate: cols[2] || "",
        processingDate: cols[3] || "",
        recipientName: cols[4] || "",
        recipientAddress: cols[5] || "",
        recipientPostalCode: cols[6] || "",
        recipientCity: cols[7] || "",
        amount: Math.round(amount * 100) / 100,
        paymentMethod,
        clientReference: cols[10] || "",
        additionalInfo: cols[11] || "",
        clientNotes: cols[12] || "",
      })
    }
  }

  const totalAmount = Math.round(items.reduce((acc, it) => acc + it.amount, 0) * 100) / 100

  return {
    carrier: "ctt",
    totalItems: items.length,
    totalAmount,
    items,
  }
}
