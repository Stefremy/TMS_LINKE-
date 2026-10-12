import * as XLSX from "xlsx"

export interface CttParsedItem {
  id: string
  cttPrice: number
  cttDate: string
  refCliente?: string
  senderName?: string
  recipientName?: string
  serviceType?: string
}

export function normalizeParcelId(v: any): string {
  return String(v || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase()
}

export function parsePrice(v: any): number {
  if (typeof v === "number") return v
  if (!v) return 0
  const cleaned = String(v)
    .replace(/[€$\s]/g, "")
    .replace(",", ".")
    .trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export function isValidParcelCode(id: string): boolean {
  if (!id || id.length < 5) return false
  if (/^(TOTAL|SUM|SOMA|SUBTOTAL)/i.test(id)) return false
  return true
}

export function findCol(sampleRow: Record<string, any>, candidates: string[]): string | undefined {
  const keys = Object.keys(sampleRow)
  // 1. Procurar correspondência exata primeiro
  for (const c of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase() === c.toLowerCase())
    if (found) return found
  }
  // 2. Procurar substring excluindo colunas ambíguas como 'agrupado' e 'cobrança'
  for (const c of candidates) {
    const found = keys.find(
      (k) =>
        k.toLowerCase().includes(c.toLowerCase()) &&
        !k.toLowerCase().includes("agrupado") &&
        !k.toLowerCase().includes("cobrança") &&
        !k.toLowerCase().includes("dados de")
    )
    if (found) return found
  }
  return undefined
}

export function parseCttItemsFromWorkbook(wb: XLSX.WorkBook): CttParsedItem[] {
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  if (!ws) return []

  let headerRowIndex = 0
  if (ws["!ref"]) {
    const range = XLSX.utils.decode_range(ws["!ref"])
    for (let R = range.s.r; R <= Math.min(range.e.r, 25); ++R) {
      const rowVals: string[] = []
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
        rowVals.push(cell ? String(cell.v).trim() : "")
      }
      const nonEmpty = rowVals.filter(Boolean)
      const hasIdCol = rowVals.some(
        (v) =>
          /código do objeto|codigo do objeto|nº objeto|no objeto|nr objeto|referência|referencia|objeto/i.test(v) &&
          !v.toLowerCase().includes("dados de")
      )
      const hasPriceOrAmount = rowVals.some((v) =>
        /valor sem iva|preço líquido|preco liquido|líquido|liquido|s\/ iva/i.test(v)
      )
      if (nonEmpty.length >= 3 && hasIdCol && hasPriceOrAmount) {
        headerRowIndex = R
        break
      }
    }
  }

  const json: any[] = XLSX.utils.sheet_to_json(ws, { range: headerRowIndex, defval: "" })
  if (!json.length) return []

  const sample = json[0] || {}

  const cttIdVariants = [
    "Código do Objeto",
    "Codigo do Objeto",
    "Nº Objeto",
    "No Objeto",
    "Referência",
    "Nr Objeto",
    "Envio",
    "Object Code",
    "ID",
    "tracking",
    "code",
    "Objeto"
  ]
  const cttPriceVariants = [
    "Valor sem IVA",
    "Preço Líquido",
    "Preco Liquido",
    "Líquido",
    "Liquido",
    "Total",
    "Net Amount",
    "preco",
    "net",
    "amount",
    "valorsiva",
    "S/ IVA",
    "Valor",
    "Price",
    "Montante"
  ]

  const cttIdCol = findCol(sample, cttIdVariants) || "Código do Objeto"
  const cttPriceCol = findCol(sample, cttPriceVariants) || "Valor sem IVA"

  const grouped: Record<string, CttParsedItem> = {}

  json.forEach((row) => {
    const id = normalizeParcelId(row[cttIdCol])
    if (!id || !isValidParcelCode(id)) return

    const linePrice = parsePrice(row[cttPriceCol])
    const current = grouped[id]

    if (!current) {
      grouped[id] = {
        id,
        cttPrice: linePrice,
        cttDate: row["Data do Objeto"] || row["Data"] || "",
        refCliente: normalizeParcelId(row["Referência de Cliente"] || row["Referencia"] || row["Ref Cliente"] || ""),
        senderName: row["Remetente"] || row["Nome do Remetente"] || "",
        recipientName: row["Destinatário"] || row["Nome do Destinatário"] || "",
        serviceType: row["Produto"] || ""
      }
    } else {
      current.cttPrice = +(current.cttPrice + linePrice).toFixed(4)
      const dest = row["Destinatário"] || row["Nome do Destinatário"]
      if (dest && !current.recipientName) {
        current.recipientName = dest
      }
      const ref = row["Referência de Cliente"] || row["Referencia"] || row["Ref Cliente"]
      if (ref && !current.refCliente) {
        current.refCliente = normalizeParcelId(ref)
      }
    }
  })

  return Object.values(grouped).map((i) => ({
    ...i,
    cttPrice: +i.cttPrice.toFixed(2)
  }))
}
