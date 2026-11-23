/**
 * Imported web-store order → "Novo Envio" prefill. Shared by Integrações and Encomendas Web,
 * and read back by the client's new-shipment page, so both ends agree on every field.
 */

export type ImportedOrderForShipment = {
  order_number: string
  customer_name: string
  customer_company?: string
  customer_email?: string
  customer_phone?: string
  shipping_address: string
  shipping_city: string
  shipping_postal: string
  shipping_country?: string
  customer_note?: string
  total_weight_kg?: number
  is_cod?: boolean
  cod_amount?: number
}

export type ShipmentPrefill = {
  recipientName: string
  recipientAddress: string
  recipientPostal: string
  recipientCity: string
  recipientCountry: string
  recipientPhone: string
  recipientEmail: string
  codValue: number
  selectedSpecialServices: string[]
  observations: string
  reference?: string
  weightKg?: number
}

const OBSERVATIONS_MAX = 500
const NAME_MAX = 200

export const orderReference = (orderNumber: string) => orderNumber.trim().replace(/^#/, "")

/** Recipient line: company and person together, as carriers print a single name. */
export function recipientDisplayName(name: string, company?: string) {
  const person = name.trim(), firm = (company || "").trim()
  const value = !firm || fold(person).includes(fold(firm)) ? person || firm : person && person !== "Cliente" ? `${firm} (${person})` : firm
  return value.slice(0, NAME_MAX)
}

/**
 * "Encomenda <ref>" must stay first: after emission it is how the shipment is matched back to the
 * store order (tracking and automatic completion). The customer's note follows, within the limit.
 */
export function orderObservations(orderNumber: string, note?: string) {
  const head = `Encomenda ${orderReference(orderNumber)}`
  const extra = (note || "").replace(/\s+/g, " ").trim()
  return (extra ? `${head} · ${extra}` : head).slice(0, OBSERVATIONS_MAX)
}

export function orderToShipmentParams(order: ImportedOrderForShipment): URLSearchParams {
  const params = new URLSearchParams()
  const set = (key: string, value: unknown) => {
    const text = value === undefined || value === null ? "" : String(value).trim()
    if (text) params.set(key, text)
  }
  set("dest_name", order.customer_name)
  set("dest_company", order.customer_company)
  set("dest_address", order.shipping_address)
  set("dest_postal", order.shipping_postal)
  set("dest_city", order.shipping_city)
  set("dest_country", (order.shipping_country || "PT").toUpperCase())
  set("dest_phone", order.customer_phone)
  set("dest_email", order.customer_email)
  set("dest_ref", orderReference(order.order_number))
  if (order.is_cod && Number(order.cod_amount) > 0) set("dest_cod", Number(order.cod_amount).toFixed(2))
  if (Number(order.total_weight_kg) > 0) set("dest_weight", Number(order.total_weight_kg))
  set("dest_note", order.customer_note)
  return params
}

/** Reads the query string of the new-shipment page; supports the older short parameter names too. */
export function shipmentPrefillFromParams(params: Pick<URLSearchParams, "get">): ShipmentPrefill | undefined {
  const get = (...keys: string[]) => keys.map(key => params.get(key)).find(value => value && value.trim())?.trim() || ""
  const name = get("dest_name", "name"), address = get("dest_address", "address"), phone = get("dest_phone", "phone"), ref = get("dest_ref", "ref")
  if (!name && !address && !phone && !ref) return undefined
  const cod = Number.parseFloat(get("dest_cod", "cod"))
  const weight = Number.parseFloat(get("dest_weight", "weight"))
  const note = get("dest_note", "note")
  return {
    recipientName: recipientDisplayName(name, get("dest_company", "company")),
    recipientAddress: address,
    recipientPostal: get("dest_postal", "postal"),
    recipientCity: get("dest_city", "city"),
    recipientCountry: (get("dest_country", "country") || "PT").toUpperCase(),
    recipientPhone: phone,
    recipientEmail: get("dest_email", "email"),
    codValue: Number.isFinite(cod) && cod > 0 ? cod : 0,
    selectedSpecialServices: Number.isFinite(cod) && cod > 0 ? ["cod"] : [],
    observations: ref ? orderObservations(ref, note) : (get("obs") || note).slice(0, OBSERVATIONS_MAX),
    ...(ref ? { reference: orderReference(ref).slice(0, 100) } : {}),
    ...(Number.isFinite(weight) && weight > 0 ? { weightKg: Math.min(weight, 2000) } : {}),
  }
}

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}
