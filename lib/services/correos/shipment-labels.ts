import type { CorreosShipmentOutput } from "./types"
import type { CarrierLabel } from "../shipments/label-bundle"

/** The API may return numbered labels, one per array entry, or one combined PDF. */
export function getCorreosShipmentLabels(result: CorreosShipmentOutput): CarrierLabel[] {
  const numbered = (result.etiqueta || []).flatMap(entry => Object.entries(entry)
    .filter(([key, value]) => /^etiqueta\d*$/i.test(key) && typeof value === "string" && value.trim())
    .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
    .map(([, value]) => value))
  const parse = (raw: string[]) => raw.flatMap<CarrierLabel>(value => {
    let data = value.trim().replace(/^data:[^,]*;base64,/i, "")
    // Older API versions encode PDF/ZPL twice unless codificacionUnicaB64=1.
    for (let depth = 0; depth < 3; depth++) {
      if (data.startsWith("^XA")) return [{ data, format: "zpl" as const }]
      if (data.startsWith("JVBERi0")) return [{ data: data.replace(/\s/g, ""), format: "pdf" as const }]
      data = Buffer.from(data, "base64").toString("utf8").trim()
    }
    return []
  })
  const labels = parse(numbered)
  return labels.length ? labels : parse((result.listaInformacionAdicional || []).map(entry => entry.etiquetaPDF || ""))
}
