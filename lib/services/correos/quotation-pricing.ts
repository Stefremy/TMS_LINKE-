import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import type { ParcelPricingDimensions } from "@/lib/pricing/chargeable-weight"
import { calculateClientShipmentPreview } from "@/lib/pricing/calculate-client-shipment-preview"
import { COUNTRY_TO_ZONE_MAP } from "@/lib/services/geo/international-zones"
import { detectCarrierGroup } from "@/lib/pricing/carrier-zone-templates"
import { isCorreosQuotationService, requiresCorreosQuotation } from "./shipment-policy"
import products from "./product-catalog.json"
import { getServiceVolumetricRule } from "@/lib/pricing/chargeable-weight"
import { getServiceParcelLimitProduct } from "@/lib/pricing/oversize-surcharge"

/** Request-only reference. It never grants permission to emit a shipment with this table. */
export function generalCorreosQuotationReference(services: (ServicoLinke & { client_id?: string })[]): ServicoLinke {
  const product = products.find(product => product.api === "90")!
  const candidates = services.filter(service => !service.client_id && isCorreosQuotationService(service) &&
    (service.id === product.id || service.code?.trim().toUpperCase() === product.code))
  const table = candidates.find(service => service.id === product.id) || (candidates.length === 1 ? candidates[0] : undefined)
  return {
    id: product.id, code: product.code, name: product.title, description: product.description, category: "Internacional",
    color: "#0284c7", pricing_profile: "Standard / Geral", preferred_carrier_id: "", preferred_carrier_name: "Correos Express",
    transit_time_label: product.transit, global_markup_pct: 0, created_at: "", zones: [],
    ...table, is_active: true, carrier_group: "correos", webservice_service_code: "90", single_parcel_only: true,
    // An absent, deleted or disabled tariff still allows a request, without a fabricated price.
    allowed_zones: table?.allowed_zones?.length ? table.allowed_zones : undefined,
    ...(table?.allowed_zones?.length === 0 ? { zones: [] } : {}),
  }
}

/** Use the general selling prices and standard fuel, independently of negotiated client tables. */
export function generalCorreosQuotationClient(client: Partial<Cliente>, service: ServicoLinke, fuelSurchargePct?: number): Cliente {
  return { ...client, assigned_linke_service_ids: [service.id], custom_tier_overrides: undefined,
    pricing: { standard_fuel_surcharge_pct: fuelSurchargePct } } as Cliente
}

/** Explicit customer DTO: no partner costs, margins, credentials or other clients' tables. */
export function publicCorreosQuotationReference(service: ServicoLinke): ServicoLinke {
  return { id: service.id, code: service.code, name: service.name, is_active: true, carrier_group: "correos", single_parcel_only: true,
    allowed_zones: service.allowed_zones, fuel_surcharge_pct: service.fuel_surcharge_pct,
    volumetric_rule: getServiceVolumetricRule(service), parcel_limit_product: getServiceParcelLimitProduct(service),
    zones: service.zones.map(zone => ({ zone_code: zone.zone_code, zone_name: zone.zone_name,
      tiers: zone.tiers.map(tier => ({ id: tier.id, label: tier.label, weight_max: tier.weight_max, sell_price: tier.sell_price,
        enabled: tier.enabled, additional_weight_step: tier.additional_weight_step, delivery_time: tier.delivery_time })) })) } as ServicoLinke
}

/** Permission to ask Linke for a quote is separate from a published tariff or confirmed carrier coverage. */
export function canRequestCorreosQuotation(service: ServicoLinke, country: string): boolean {
  const iso = country.trim().toUpperCase()
  return service.is_active !== false && service.allowed_zones?.length !== 0 &&
    !!(COUNTRY_TO_ZONE_MAP[iso] || COUNTRY_TO_ZONE_MAP[`${iso}_ISO`]) &&
    requiresCorreosQuotation(detectCarrierGroup(service) || "", iso, service)
}

/** Strict, display-only estimate: existing client tiers/fuel, with no fallback price or COD. */
export function correosQuotationEstimate(client: Partial<Cliente>, service: ServicoLinke, country: string, postal: string,
  weightKg: number, parcel?: ParcelPricingDimensions) {
  if (!canRequestCorreosQuotation(service, country)) return null
  try {
    return calculateClientShipmentPreview(weightKg, client, service, country, postal, [], 0, parcel)
  } catch {
    // A missing zone/tier or unsupported parcel count requires an individual quotation.
    return null
  }
}
