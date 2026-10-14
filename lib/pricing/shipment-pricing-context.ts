import type { AuthContext } from "@/lib/auth/context"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { resolveClientTable } from "./calculate-shipment-price"
import { ShipmentPricingError, ShipmentPricingUnavailableError } from "./shipment-pricing-errors"
import { isTemporarilyWithdrawnService } from "@/lib/services/service-availability"
export { ShipmentPricingError, ShipmentPricingUnavailableError } from "./shipment-pricing-errors"

export function validateShipmentPricingInput(input: {
  weightKg: number; volumesCount?: number; lengthCm?: number; widthCm?: number; heightCm?: number;
  codValue?: number; selectedSpecialServices?: string[]
}) {
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    throw new ShipmentPricingError("Peso inválido. Indique um peso superior a zero.")
  }
  if (input.volumesCount !== undefined && (!Number.isSafeInteger(input.volumesCount) || input.volumesCount < 1)) {
    throw new ShipmentPricingError("Número de volumes inválido.")
  }
  for (const dimension of [input.lengthCm, input.widthCm, input.heightCm]) {
    if (dimension !== undefined && (!Number.isFinite(dimension) || dimension < 0)) {
      throw new ShipmentPricingError("Dimensões inválidas.")
    }
  }
  if (input.codValue !== undefined && (!Number.isFinite(input.codValue) || input.codValue < 0 ||
      !Number.isSafeInteger(Math.round(input.codValue * 100)))) {
    throw new ShipmentPricingError("Valor de cobrança inválido.")
  }
  const specials = input.selectedSpecialServices
  if (specials !== undefined && (!Array.isArray(specials) || specials.some(s => typeof s !== "string") ||
      new Set(specials).size !== specials.length || specials.length > 20)) {
    throw new ShipmentPricingError("Serviços especiais inválidos.")
  }
  if (specials?.some(s => s === "cod" || s === "correos_cod") && !(input.codValue && input.codValue > 0)) {
    throw new ShipmentPricingError("Indique um valor de cobrança superior a zero.")
  }
}

/** Read persisted, tenant-scoped pricing. Display defaults are never authoritative. */
export async function loadShipmentPricingContext(
  supabase: SupabaseClient,
  ctx: AuthContext,
  clientId: string | null | undefined,
  selection: { serviceId?: string; serviceName?: string } = {}
): Promise<{ client: Cliente; service: ServicoLinke }> {
  if (!clientId || !ctx.tenant_id || (ctx.role === "client" && ctx.client_id !== clientId)) {
    throw new ShipmentPricingError("Cliente inválido ou inacessível.")
  }

  const [clientResult, clientLogResult, deletedClientResult, serviceResult, serviceLogResult, deletedServiceResult] =
    await Promise.all([
      supabase.from("clients").select("*").eq("tenant_id", ctx.tenant_id).eq("id", clientId).maybeSingle(),
      supabase.from("audit_log").select("details").eq("tenant_id", ctx.tenant_id).eq("action", "client_data")
        .eq("details->>id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("audit_log").select("id").eq("tenant_id", ctx.tenant_id).eq("action", "deleted_client")
        .eq("details->>id", clientId).limit(1).maybeSingle(),
      supabase.from("servicos_linke").select("*").eq("tenant_id", ctx.tenant_id).limit(2000),
      supabase.from("audit_log").select("details").eq("tenant_id", ctx.tenant_id).eq("action", "servicos_linke_data")
        .order("created_at", { ascending: false }).limit(2000),
      supabase.from("audit_log").select("details").eq("tenant_id", ctx.tenant_id).eq("action", "deleted_servico_linke").limit(2000),
    ])

  for (const result of [clientResult, clientLogResult, deletedClientResult, serviceLogResult, deletedServiceResult]) {
    if (result.error) throw new ShipmentPricingUnavailableError()
  }
  // Legacy installations keep services only in audit_log, or lack a tenant column.
  // Only an explicit missing-schema error permits that compatibility path.
  if (serviceResult.error && !["42P01", "42703", "PGRST205", "PGRST204"].includes(serviceResult.error.code)) {
    throw new ShipmentPricingUnavailableError()
  }
  if (!clientResult.data || deletedClientResult.data) throw new ShipmentPricingError("Cliente inválido ou inacessível.")
  const client = { ...clientResult.data, ...clientLogResult.data?.details, id: clientResult.data.id } as Cliente
  if (client.is_active === false) throw new ShipmentPricingError("Conta de cliente inativa.")

  if ([serviceResult, serviceLogResult, deletedServiceResult].some(result => (result.data?.length ?? 0) >= 2000)) {
    throw new ShipmentPricingUnavailableError()
  }
  const services = new Map<string, ServicoLinke & { client_id?: string }>()
  for (const service of serviceResult.data || []) services.set(service.id, service)
  const seen = new Set<string>()
  for (const log of serviceLogResult.data || []) {
    if (log.details?.id && !seen.has(log.details.id)) {
      services.set(log.details.id, log.details)
      seen.add(log.details.id)
    }
  }
  for (const log of deletedServiceResult.data || []) services.delete(log.details?.id)
  const available = [...services.values()].filter(service => service.is_active !== false && !isTemporarilyWithdrawnService(service) &&
    (!service.client_id || service.client_id === clientId))
  const service = selection.serviceId ? available.find(s => s.id === selection.serviceId)
    : selection.serviceName ? available.find(s => s.name === selection.serviceName)
    : client.default_linke_table_id ? available.find(s => s.id === client.default_linke_table_id)
    : resolveClientTable(client, available)
  if (!service || (ctx.role === "client" && Array.isArray(client.assigned_linke_service_ids) &&
      !client.assigned_linke_service_ids.includes(service.id))) {
    throw new ShipmentPricingError("Serviço inexistente ou não autorizado para este cliente.")
  }
  return { client, service }
}
