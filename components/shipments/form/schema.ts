import { z } from "zod"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import { isDestinationPostalReady } from "@/lib/services/shipment-service-options"
import { requiresShipmentDimensions } from "@/lib/services/shipments/parcel-dimensions"

const required = (label: string, max = 100) => z.string().trim().min(1, `Indique ${label}.`).max(max, `Use até ${max} caracteres.`)
const phone = z.string().trim().refine(value => !value || /^\+?[\d\s().-]{7,22}$/.test(value), "Indique um contacto telefónico válido.")
const positive = (label: string, min = 0.001) => z.number({ error: `Indique ${label}.` }).finite().min(min, `Indique ${label} superior ou igual a ${min.toLocaleString("pt-PT")}.`)

/** Shared input contract. No customer prices, costs or routing credentials belong here. */
export const shipmentBaseSchema = z.object({
  senderName: required("o nome do remetente"), senderAddress: required("a morada do remetente", 200),
  senderCity: required("a localidade do remetente"),
  senderPostal: z.string().trim().regex(/^\d{4}-\d{3}$/, "Indique o código postal do remetente no formato 0000-000."),
  senderPhone: phone.refine(value => value.length > 0, "Indique o telefone do remetente."),
  recipientName: required("o nome do destinatário"), recipientAddress: required("a morada do destinatário", 200),
  recipientCity: required("a localidade do destinatário"), recipientCountry: z.string().regex(/^[A-Z]{2}$/, "Selecione o país de destino."),
  recipientPostal: required("o código postal do destinatário", 20), recipientPhone: phone,
  recipientEmail: z.union([z.literal(""), z.email({ error: "Indique um endereço de email válido." })]),
  weightKg: positive("o peso total").max(2000, "O peso total não pode exceder 2000 kg."), volumesCount: positive("o número de volumes", 1).int("Indique um número inteiro de volumes.").max(1000, "O limite é de 1000 volumes."),
  lengthCm: positive("o comprimento", 0).max(500, "O comprimento não pode exceder 500 cm."), widthCm: positive("a largura", 0).max(300, "A largura não pode exceder 300 cm."), heightCm: positive("a altura", 0).max(300, "A altura não pode exceder 300 cm."),
  parcelWeightsKg: z.array(positive("o peso do volume").max(1000, "O peso por volume não pode exceder 1000 kg.")).max(1000),
  serviceId: required("o serviço de transporte"), islandTransportMode: z.enum(["", "air", "sea", "other"]),
  selectedSpecialServices: z.array(z.string()).max(20, "Selecione até 20 serviços especiais."),
  codValue: z.number({ error: "Indique um valor de cobrança válido." }).finite().min(0, "A cobrança não pode ser negativa."),
  observations: z.string().trim().max(500, "Use até 500 caracteres nas observações."), saveToAgenda: z.boolean(),
  exportFields: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
})

export const opsExtras = z.object({
  carrierOverride: z.enum(["", "ctt", "correos"]).optional(),
  internalNotes: z.string().trim().max(2000, "Use até 2000 caracteres nas notas internas.").optional(),
  // Prices remain defined by each client's table. Explicitly reject a forged price.
  manualPrice: z.never({ error: "O preço é definido pela tabela do cliente." }).optional(),
})
export const shipmentFormSchema = shipmentBaseSchema.extend(opsExtras.shape).superRefine((value, ctx) => {
  if (requiresShipmentDimensions(value.recipientCountry, value.recipientPostal)) {
    for (const [field, label] of [["lengthCm", "o comprimento"], ["widthCm", "a largura"], ["heightCm", "a altura"]] as const) {
      if (value[field] < 0.1) ctx.addIssue({ code: "custom", path: [field], message: `Indique ${label} superior ou igual a 0,1.` })
    }
  }
  if (!isDestinationPostalReady(value.recipientCountry, value.recipientPostal)) ctx.addIssue({ code: "custom", path: ["recipientPostal"], message: "Indique um código postal completo e válido para o país selecionado." })
  if (!value.recipientPhone && !value.recipientEmail) ctx.addIssue({ code: "custom", path: ["recipientPhone"], message: "Indique um telefone ou email do destinatário." })
  if (value.parcelWeightsKg.length && (value.parcelWeightsKg.length !== value.volumesCount || Math.abs(value.parcelWeightsKg.reduce((sum, weight) => sum + weight, 0) - value.weightKg) > 0.001)) ctx.addIssue({ code: "custom", path: ["parcelWeightsKg"], message: "Os pesos por volume devem somar o peso total e corresponder ao número de volumes." })
  if (value.selectedSpecialServices.some(code => code === "cod" || code === "correos_cod") && value.codValue <= 0) ctx.addIssue({ code: "custom", path: ["codValue"], message: "Indique um valor de cobrança superior a zero." })
  if (new Set(value.selectedSpecialServices).size !== value.selectedSpecialServices.length) ctx.addIssue({ code: "custom", path: ["selectedSpecialServices"], message: "Não repita serviços especiais." })
})
export type ShipmentFormValues = z.infer<typeof shipmentFormSchema>
export type ShipmentFormRole = "client" | "ops"
export type ShipmentFieldError = { field: keyof ShipmentFormValues | "root"; message: string }

export function shipmentDefaults(client: Partial<Cliente>, initial: Partial<ShipmentFormValues> = {}): ShipmentFormValues {
  return {
    senderName: client.short_name || client.legal_name || "", senderAddress: client.address || "", senderCity: client.city || "",
    senderPostal: client.postal_code || "", senderPhone: client.phone || client.mobile_phone || "",
    recipientName: "", recipientAddress: "", recipientCity: "", recipientPostal: "", recipientCountry: "PT", recipientPhone: "", recipientEmail: "",
    weightKg: 1, volumesCount: 1, lengthCm: 0, widthCm: 0, heightCm: 0, parcelWeightsKg: [], serviceId: "", islandTransportMode: "",
    selectedSpecialServices: [], codValue: 0, observations: "", saveToAgenda: false, exportFields: {}, ...initial,
  }
}

export const SHIPMENT_STEPS = ["Dados do envio", "Revisão"] as const
export const STEP_FIELDS: (keyof ShipmentFormValues)[][] = [
  ["senderName", "senderAddress", "senderCity", "senderPostal", "senderPhone", "recipientName", "recipientAddress", "recipientCity", "recipientCountry", "recipientPostal", "recipientPhone", "recipientEmail", "saveToAgenda", "weightKg", "volumesCount", "lengthCm", "widthCm", "heightCm", "parcelWeightsKg", "serviceId", "islandTransportMode", "selectedSpecialServices", "codValue", "exportFields", "carrierOverride", "internalNotes"],
  ["observations"],
]
export const stepForField = (field: string) => Math.max(0, STEP_FIELDS.findIndex(fields => fields.some(key => field === key || field.startsWith(`${key}.`))))
