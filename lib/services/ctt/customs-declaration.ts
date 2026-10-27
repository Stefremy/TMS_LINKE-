import { ShipmentPricingError } from "@/lib/pricing/shipment-pricing-errors"

export type CttCustomsItem = {
  description: string
  quantity: number
  value: number // Total value of this line, EUR
  weightKg: number // Total net weight of this line
  harmonizedCode: string
  originCountry: string
}
export type CttCustomsDeclaration = {
  items: CttCustomsItem[]
  nonDeliveryCase: "GiveBack" | "ToAbandon"
  sachetDocumentation: boolean
  vatExportDeclaration: boolean
  vatRate: boolean
  commercialInvoice: string
  invoiceDate: string // Calendar date, YYYY-MM-DD; no timezone conversion
  receiverTIN?: string
}

// CTT: /empresas/encomendas-e-correio/enviar/regras-e-cuidados-para-envios/envios-internacionais
const euCountries = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" "))
export function requiresCttCustoms(country: string, postalCode = ""): boolean {
  country = country.trim().toUpperCase()
  const postal = postalCode.replace(/\s/g, "")
  if (!euCountries.has(country)) return true
  return (country === "ES" && /^(35|38|51|52)/.test(postal)) ||
    (country === "FI" && /^22/.test(postal)) ||
    (country === "FR" && /^(97|98)/.test(postal)) ||
    (country === "DE" && ["78266", "27498"].includes(postal)) ||
    (country === "IT" && postal === "23030") || (country === "GR" && postal === "63086")
}

function fail(message: string): never { throw new ShipmentPricingError(message) }
export function validateCttCustoms(input: unknown, declaredValue: number, shipmentWeightKg?: number): CttCustomsDeclaration {
  if (!input || typeof input !== "object") fail("Este destino exige uma declaração aduaneira. Preencha os artigos e as instruções aduaneiras do envio.")
  const data = input as Partial<CttCustomsDeclaration>
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 50) fail("Indique entre 1 e 50 artigos na declaração aduaneira.")
  const items = data.items.map((raw: unknown, index) => {
    if (!raw || typeof raw !== "object") fail(`Artigo aduaneiro ${index + 1} inválido.`)
    const item = raw as Partial<CttCustomsItem>
    const description = typeof item.description === "string" ? item.description.trim() : ""
    const originCountry = typeof item.originCountry === "string" ? item.originCountry.trim().toUpperCase() : ""
    const harmonizedCode = typeof item.harmonizedCode === "string" ? item.harmonizedCode.trim() : ""
    if (!description || description.length > 50) fail(`Indique a descrição do artigo ${index + 1}, até 50 caracteres.`)
    if (!Number.isSafeInteger(item.quantity) || item.quantity! < 1) fail(`Indique a quantidade do artigo ${index + 1}.`)
    if (typeof item.value !== "number" || !Number.isFinite(item.value) || item.value < 0 || !Number.isSafeInteger(Math.round(item.value * 100))) fail(`Indique o valor do artigo ${index + 1}, em euros.`)
    if (typeof item.weightKg !== "number" || !Number.isFinite(item.weightKg) || item.weightKg < 0.001) fail(`Indique o peso do artigo ${index + 1}, em kg (mínimo 0,001).`)
    if (!/^(?:\d{6}|\d{8}|\d{10})$/.test(harmonizedCode)) fail(`Indique o código pautal do artigo ${index + 1} (6, 8 ou 10 dígitos).`)
    if (!/^[A-Z]{2}$/.test(originCountry)) fail(`Indique o país de origem do artigo ${index + 1} (ex.: PT).`)
    return { description, quantity: item.quantity!, value: Number(item.value.toFixed(2)), weightKg: item.weightKg, harmonizedCode, originCountry }
  })
  if (Math.round(items.reduce((sum, item) => sum + item.value, 0) * 100) !== Math.round(declaredValue * 100)) fail("A soma dos valores dos artigos deve corresponder ao valor declarado do conteúdo.")
  if (shipmentWeightKg !== undefined && items.reduce((sum, item) => sum + Math.round(item.weightKg * 1000), 0) > Math.round(shipmentWeightKg * 1000)) fail("O peso dos artigos aduaneiros não pode exceder o peso total do envio.")
  if (!["GiveBack", "ToAbandon"].includes(data.nonDeliveryCase || "")) fail("Escolha o que fazer em caso de não entrega do envio aduaneiro.")
  if ([data.sachetDocumentation, data.vatExportDeclaration, data.vatRate].some(value => typeof value !== "boolean")) fail("Confirme as opções de documentação e IVA da declaração aduaneira.")
  const text = (value: unknown, label: string) => {
    if (value === undefined || value === "") return undefined
    if (typeof value !== "string" || value.trim().length > 50) fail(`${label}: máximo de 50 caracteres.`)
    return value.trim() || undefined
  }
  const commercialInvoice = text(data.commercialInvoice, "Fatura")
  if (!commercialInvoice) fail("Indique o número da fatura comercial na declaração aduaneira.")
  const invoiceDate = typeof data.invoiceDate === "string" ? data.invoiceDate.trim() : ""
  const parsedDate = new Date(`${invoiceDate}T00:00:00Z`)
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(invoiceDate) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== invoiceDate) {
    fail("Indique uma data válida da fatura comercial na declaração aduaneira.")
  }
  return { items, nonDeliveryCase: data.nonDeliveryCase!, sachetDocumentation: data.sachetDocumentation!, vatExportDeclaration: data.vatExportDeclaration!, vatRate: data.vatRate!, commercialInvoice, invoiceDate, receiverTIN: text(data.receiverTIN, "NIF do destinatário") }
}

export function readCttCustomsForm(form: FormData): CttCustomsDeclaration | undefined {
  if (form.get("ctt_customs_present") !== "1") return undefined
  const values = (name: string) => form.getAll(`ctt_customs_${name}`)
  const number = (value: FormDataEntryValue | undefined) => typeof value === "string" && value.trim() !== "" ? Number(value) : NaN
  const quantity = values("quantity"), value = values("value"), weight = values("weight"), hs = values("hs"), origin = values("origin")
  const choice = (name: string) => form.get(`ctt_customs_${name}`) === "true" ? true : form.get(`ctt_customs_${name}`) === "false" ? false : undefined
  return {
    items: values("description").map((description, index) => ({ description: String(description), quantity: number(quantity[index]), value: number(value[index]), weightKg: number(weight[index]), harmonizedCode: String(hs[index] || ""), originCountry: String(origin[index] || "") })),
    nonDeliveryCase: form.get("ctt_customs_non_delivery") as CttCustomsDeclaration["nonDeliveryCase"],
    sachetDocumentation: choice("sachet") as boolean,
    vatExportDeclaration: choice("vat_export") as boolean,
    vatRate: choice("vat_rate") as boolean,
    commercialInvoice: String(form.get("ctt_customs_invoice") || ""),
    invoiceDate: String(form.get("ctt_customs_invoice_date") || ""),
    receiverTIN: String(form.get("ctt_customs_tin") || ""),
  }
}
