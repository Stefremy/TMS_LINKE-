import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"

export type ClientServiceImportSource = Pick<Cliente, "id" | "code" | "short_name" | "assigned_linke_service_ids" | "default_linke_table_id" | "custom_tier_overrides" | "pricing">

export function importableClientServiceIds(source: ClientServiceImportSource, catalogue: ServicoLinke[], targetId?: string): string[] {
  const active = new Set(catalogue.filter(service => {
    const owner = (service as ServicoLinke & { client_id?: string }).client_id
    return service.is_active !== false && (!owner || owner === targetId)
  }).map(service => service.id))
  // Legacy client profiles have the same implicit authorizations as the client editor.
  return [...new Set(source.assigned_linke_service_ids ?? catalogue.map(service => service.id))].filter(id => active.has(id))
}

/** Copy only service settings into the draft; saving still uses the ordinary client action. */
export function importClientServices(target: Partial<Cliente>, source: ClientServiceImportSource, catalogue: ServicoLinke[], replaceExistingPrices = false) {
  if (target.id === source.id) throw new Error("Escolha outro cliente como origem.")
  const sourceIds = importableClientServiceIds(source, catalogue, target.id)
  if (!sourceIds.length) throw new Error("Este cliente não tem serviços ativos disponíveis para importar.")
  const targetIds = target.assigned_linke_service_ids ?? []
  const addedIds = sourceIds.filter(id => !targetIds.includes(id))
  const copiedIds = new Set(replaceExistingPrices ? sourceIds : addedIds)
  const belongsToCopiedService = (key: string) => [...copiedIds].some(id => key === id || key.startsWith(`${id}::`))
  const copyMap = <T>(current: Record<string, T> | undefined, incoming: Record<string, T> | undefined): Record<string, T> => ({
    ...Object.fromEntries(Object.entries(current || {}).filter(([key]) => !belongsToCopiedService(key))),
    ...structuredClone(Object.fromEntries(Object.entries(incoming || {}).filter(([key]) => belongsToCopiedService(key)))),
  })
  const assigned = [...new Set([...targetIds, ...addedIds])]
  const sourceDefault = source.default_linke_table_id && sourceIds.includes(source.default_linke_table_id) ? source.default_linke_table_id : ""
  return {
    client: {
      ...target,
      assigned_linke_service_ids: assigned,
      default_linke_table_id: target.default_linke_table_id || sourceDefault || addedIds[0] || "",
      custom_tier_overrides: copyMap(target.custom_tier_overrides, source.custom_tier_overrides),
      pricing: { ...target.pricing, service_tier_order: copyMap(target.pricing?.service_tier_order, source.pricing?.service_tier_order), service_weight_tiers: copyMap(target.pricing?.service_weight_tiers, source.pricing?.service_weight_tiers) } as Cliente["pricing"],
    },
    added: addedIds.length,
    updated: replaceExistingPrices ? sourceIds.length - addedIds.length : 0,
  }
}
