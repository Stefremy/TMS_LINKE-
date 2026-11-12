import { z } from "zod"

export { PICKUP_REQUEST_ACTION, PICKUP_REQUEST_PERMISSION } from "./pickup-request-notifications"
export const PICKUP_REQUEST_PAGE_SIZE = 25
export const CTT_PICKUP_PERIODS = ["09:00-19:00"] as const
export const CORREOS_PICKUP_PERIODS = ["08:00-10:00", "10:00-13:00", "13:00-16:00", "16:00-19:00", "19:00-22:00"] as const
export const PICKUP_PERIODS = [...CTT_PICKUP_PERIODS, ...CORREOS_PICKUP_PERIODS] as const
export function pickupRequestToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}
const text = (label: string, max = 100) => z.string().trim().min(1, `Indique ${label}.`).max(max)
export const pickupRequestSchema = z.object({
  date: z.string().refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value && value >= pickupRequestToday(), "Indique uma data válida, a partir de hoje."),
  period: z.enum(PICKUP_PERIODS),
  carrier: z.enum(["ctt_expresso", "correos_express"]),
  volumes: z.number().int().min(1).max(1000), weightKg: z.number().finite().positive().max(20000),
  heaviestWeightKg: z.number().finite().positive().max(20000),
  name: text("o nome do local"), address: text("a morada", 200), city: text("a localidade"),
  postal: z.string().trim().regex(/^\d{4}-?\d{3}$/, "Indique o código postal no formato 0000-000."),
  contact: text("o contacto"), phone: z.string().trim().regex(/^\+?[\d\s().-]{7,22}$/, "Indique um telefone válido."),
  email: z.union([z.literal(""), z.email()]), notes: z.string().trim().max(500),
}).strict().superRefine((value, ctx) => {
  const periods: readonly string[] = value.carrier === "ctt_expresso" ? CTT_PICKUP_PERIODS : CORREOS_PICKUP_PERIODS
  if (!periods.includes(value.period)) ctx.addIssue({ code: "custom", path: ["period"], message: "Selecione um período disponível para a transportadora." })
  if (value.heaviestWeightKg > value.weightKg || (value.volumes === 1 && value.heaviestWeightKg !== value.weightKg)) ctx.addIssue({ code: "custom", path: ["heaviestWeightKg"], message: "Confirme o peso do volume mais pesado e o peso total." })
})
export type ClientPickupInput = z.infer<typeof pickupRequestSchema>
export type ClientPickupRequest = {
  id: string; reference: string; client_id: string; client_name: string
  status: "pending" | "processing" | "completed"; pickup: ClientPickupInput
  created_at: string; completed_at?: string; carrier_reference?: string; carrier_name?: string
}
export type PickupRequestPage = { requests: ClientPickupRequest[]; total: number; page: number }
