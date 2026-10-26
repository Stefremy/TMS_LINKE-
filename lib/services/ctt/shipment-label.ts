import type { CTTShipmentDataOutput } from "./ctt-types"

/** Select carrier-provided transport labels, including the PDF documents returned by CE. */
export function getCttShipmentLabel(shipment?: Partial<CTTShipmentDataOutput>): { data: string; format: "pdf" | "zpl" } | null {
  for (const label of shipment?.LabelList || []) {
    const data = label.Label?.trim()
    if (!data) continue
    if (data.startsWith("^XA")) return { data, format: "zpl" }
    if (data.startsWith("JVBERi0")) return { data, format: "pdf" }
    const decoded = Buffer.from(data.replace(/\s/g, ""), "base64").toString("utf8").trimStart()
    if (decoded.startsWith("^XA")) return { data: decoded, format: "zpl" }
    return { data, format: label.FileName?.toLowerCase().endsWith(".pdf") ? "pdf" : "zpl" }
  }

  const documents = (shipment?.DocumentsList || []).filter(document => {
    const name = document.FileName || ""
    // Customs invoices, acceptance certificates and declarations are separate documents.
    return document.File?.replace(/\s/g, "").startsWith("JVBERi0") &&
      !/cn\s*2[23]|customs|aduan|invoice|fatura|factura|certific|acceptance|declar/i.test(name)
  })
  const transport = documents.find(document =>
    /label|etiqueta|r[oó]tulo|guia|transport|waybill|porte/i.test(document.FileName) ||
    Boolean(shipment?.FirstObject && document.FileName.includes(shipment.FirstObject)))
  const selected = transport || (documents.length === 1 ? documents[0] : undefined)
  return selected ? { data: selected.File.replace(/\s/g, ""), format: "pdf" } : null
}
