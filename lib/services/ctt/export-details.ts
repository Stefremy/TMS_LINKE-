import { ShipmentPricingError } from "@/lib/pricing/shipment-pricing-errors"

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
}

export function validateCttExportDetails(input: unknown): CttExportDetails {
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
  return { exportType: exportType.value, contentType: contentType.value, declaredValue: Number(value.declaredValue.toFixed(2)) }
}

export function readCttExportForm(form: FormData): CttExportDetails {
  const amount = form.get("ctt_declared_value")
  return validateCttExportDetails({
    exportType: form.get("ctt_export_type"),
    contentType: form.get("ctt_content_type"),
    declaredValue: typeof amount === "string" && amount.trim() !== "" ? Number(amount) : undefined,
  })
}
