import { ShipmentPricingError } from "@/lib/pricing/shipment-pricing-errors"
import { requiresCttCustoms, validateCttCustoms, readCttCustomsForm, type CttCustomsDeclaration } from "./customs-declaration"

// SGEE V1.8, pages 25, 39 and 44–45. WCF expects enum names, not numbers.
export const CTT_EXPORT_TYPES = [
  { value: "Permanent", label: "Permanente" },
  { value: "TemporaryPassiveImprovement", label: "Temporária — aperfeiçoamento passivo" },
  { value: "TemporaryExhibition", label: "Temporária — exposição" },
] as const

export const CTT_CONTENT_TYPES = [
  { value: "Goods", label: "Mercadorias" },
  { value: "Documents", label: "Documentos" },
  { value: "Samples", label: "Amostras" },
  { value: "Devolution", label: "Devolução" },
  { value: "Others", label: "Outros" },
] as const

export type CttExportType = typeof CTT_EXPORT_TYPES[number]["value"]
export type CttContentType = typeof CTT_CONTENT_TYPES[number]["value"]
export type CttExportDetails = {
  exportType: CttExportType
  contentType: CttContentType
  declaredValue: number
  customs?: CttCustomsDeclaration
}

export function validateCttExportDetails(input: unknown, destination?: { country: string; postalCode?: string; weightKg?: number }): CttExportDetails {
  const value = input && typeof input === "object" ? input as Partial<CttExportDetails> : {}
  const exportType = CTT_EXPORT_TYPES.find(option => option.value === value.exportType)
  if (!exportType) {
    throw new ShipmentPricingError("Selecione o tipo de exportação para o envio internacional CTT.")
  }
  const contentType = CTT_CONTENT_TYPES.find(option => option.value === value.contentType)
  if (!contentType) {
    throw new ShipmentPricingError("Selecione o tipo de conteúdo do envio internacional CTT.")
  }
  if (typeof value.declaredValue !== "number" || !Number.isFinite(value.declaredValue) || value.declaredValue < 0 ||
      !Number.isSafeInteger(Math.round(value.declaredValue * 100))) {
    throw new ShipmentPricingError("Indique um valor declarado do conteúdo válido, em euros, igual ou superior a zero.")
  }
  const result: CttExportDetails = { exportType: exportType.value, contentType: contentType.value, declaredValue: Number(value.declaredValue.toFixed(2)) }
  const needsCustoms = destination ? requiresCttCustoms(destination.country, destination.postalCode) : value.customs !== undefined
  if (needsCustoms) result.customs = validateCttCustoms(value.customs, result.declaredValue, destination?.weightKg)
  return result
}

export function readCttExportForm(form: FormData, destination?: { country: string; postalCode?: string; weightKg?: number }): CttExportDetails {
  const amount = form.get("ctt_declared_value")
  return validateCttExportDetails({
    exportType: form.get("ctt_export_type"),
    contentType: form.get("ctt_content_type"),
    declaredValue: typeof amount === "string" && amount.trim() !== "" ? Number(amount) : undefined,
    customs: readCttCustomsForm(form),
  }, destination)
}
