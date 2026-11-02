import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { isZoneAllowedByService } from "@/lib/pricing/calculate-shipment-price"
import { detectCarrierGroup, getSubproductCompatibleZoneCodes, normalizeServiceZoneCode, ZONE_DISPLAY_NAMES } from "@/lib/pricing/carrier-zone-templates"
import { getTierDisplayEntries } from "@/lib/pricing/tier-display-order"
import { getClientServiceName } from "@/lib/services/client-service-label"

export class ServicePriceSheetError extends Error {}

export interface ServicePriceSheetRow {
  weight: string
  detail: string
  price: number
  perKg: boolean
}

export interface ServicePriceSheet {
  serviceName: string
  zones: { name: string; rows: ServicePriceSheetRow[] }[]
}

const kg = (value: number) => new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 3 }).format(value)

/** A deliberately small customer DTO. Never copy costs, margins, API configuration or supplements. */
export function buildServicePriceSheet(service: ServicoLinke): ServicePriceSheet {
  const compatible = new Set(getSubproductCompatibleZoneCodes(detectCarrierGroup(service) || "ctt", service.webservice_service_code))
  const seen = new Set<string>()
  const zones: ServicePriceSheet["zones"] = []
  for (const zone of service.zones || []) {
    const code = normalizeServiceZoneCode(zone.zone_code)
    if (!compatible.has(code) || !isZoneAllowedByService(service.allowed_zones, code)) continue
    const enabled = (zone.tiers || []).filter(tier => tier.enabled !== false)
    if (!enabled.length) continue
    if (seen.has(code)) throw new ServicePriceSheetError("Existem destinos duplicados na tabela. Reveja a configuração antes de exportar.")
    seen.add(code)
    for (const tier of enabled) {
      if (typeof tier.sell_price !== "number" || !Number.isFinite(tier.sell_price) || tier.sell_price < 0 ||
          !Number.isSafeInteger(Math.round(tier.sell_price * 100)) || !Number.isFinite(tier.weight_max) || tier.weight_max <= 0) {
        throw new ServicePriceSheetError("Existem preços ou pesos inválidos na tabela. Reveja os escalões antes de exportar.")
      }
    }
    const regular = enabled.filter(tier => tier.weight_max !== 999).sort((a, b) => a.weight_max - b.weight_max)
    const anchor = regular.filter(tier => tier.weight_max < 999).at(-1)
    const rows = getTierDisplayEntries(zone.tiers).filter(({ tier }) => tier.enabled !== false).map(({ tier }) => {
      if (tier.weight_max === 999) {
        const step = tier.additional_weight_step ?? (tier.id?.startsWith("intl_") && tier.id.endsWith("_extra") && anchor?.weight_max === 10.5 ? 0.5 : 1)
        if (!anchor || !Number.isFinite(step) || step <= 0) {
          throw new ServicePriceSheetError("Reveja o escalão base e a fração de peso dos quilos adicionais antes de exportar.")
        }
        return {
          weight: "Kg adicional",
          detail: `Acima de ${kg(anchor.weight_max)} kg${step !== 1 ? `; frações de ${kg(step)} kg` : ""}`,
          price: tier.sell_price,
          perKg: true,
        }
      }
      const index = regular.indexOf(tier)
      const lower = index > 0 ? regular[index - 1].weight_max : 0
      return { weight: lower ? `${kg(lower)} - ${kg(tier.weight_max)} kg` : `Até ${kg(tier.weight_max)} kg`, detail: "", price: tier.sell_price, perKg: false }
    })
    zones.push({ name: ZONE_DISPLAY_NAMES[code] || zone.zone_name || code, rows })
  }
  if (!zones.length) throw new ServicePriceSheetError("Esta tabela não tem destinos autorizados com preços configurados para exportar.")
  return { serviceName: getClientServiceName(service.name), zones }
}

export function servicePriceSheetFilename(serviceName: string): string {
  const slug = serviceName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90)
  return `linke-tabela-precos-${slug || "cliente"}.pdf`
}
