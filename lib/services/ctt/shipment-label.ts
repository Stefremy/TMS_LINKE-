import type { CTTShipmentDataOutput } from "./ctt-types"
import type { CarrierLabel } from "../shipments/label-bundle"

/** Select carrier-provided transport labels, including the PDF documents returned by CE. */
export function getCttShipmentLabel(shipment?: Partial<CTTShipmentDataOutput>): { data: string; format: "pdf" | "zpl" } | null {
  const labels = getCttShipmentLabels(shipment)
  if (labels.length && labels.every(label => label.format === "zpl")) return { data: labels.map(label => label.data).join("\n"), format: "zpl" }
  return labels[0] || null
}

export function getCttShipmentLabels(shipment?: Partial<CTTShipmentDataOutput>): CarrierLabel[] {
  const labels: CarrierLabel[] = []
  for (const label of shipment?.LabelList || []) {
    const data = label.Label?.trim()
    if (!data) continue
    if (data.startsWith("^XA")) { labels.push({ data, format: "zpl" }); continue }
    if (data.startsWith("JVBERi0")) { labels.push({ data, format: "pdf" }); continue }
    const decoded = Buffer.from(data.replace(/\s/g, ""), "base64").toString("utf8").trimStart()
    labels.push(decoded.startsWith("^XA") ? { data: decoded, format: "zpl" }
      : { data, format: label.FileName?.toLowerCase().endsWith(".pdf") ? "pdf" : "zpl" })
  }
  if (labels.length) return labels

  const documents = (shipment?.DocumentsList || []).filter(document => {
    const name = document.FileName || ""
    // Customs invoices, acceptance certificates and declarations are separate documents.
    return document.File?.replace(/\s/g, "").startsWith("JVBERi0") &&
      !/cn\s*2[23]|customs|aduan|invoice|fatura|factura|certific|acceptance|declar/i.test(name)
  })
  const transport = documents.filter(document =>
    /label|etiqueta|r[oó]tulo|guia|transport|waybill|porte/i.test(document.FileName) ||
    /(?:^|[^A-Z0-9])[A-Z]{2}\d{9}[A-Z]{2}(?:[^A-Z0-9]|$)/i.test(document.FileName) ||
    Boolean(shipment?.FirstObject && document.FileName.includes(shipment.FirstObject)))
  const selected = transport.length ? transport : documents.length === 1 ? documents : []
  return selected.map(document => ({ data: document.File.replace(/\s/g, ""), format: "pdf" }))
}
