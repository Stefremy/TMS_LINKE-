import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { calculateShipmentQuote } from "./calculate-shipment-quote"
import type { ParcelPricingDimensions } from "./chargeable-weight"

/** Display-only estimate from published selling prices. Never use this for persistence.
 * Client service payloads deliberately omit carrier costs and margins. Supply neutral
 * internal fields so the shared tier, fuel, override and extras rules can still run;
 * the server continues to calculate the authoritative quote from its complete table.
 */
export function calculateClientShipmentPreview(
  weightKg: number,
  client: Partial<Cliente>,
  service: ServicoLinke,
  country: string,
  postal: string,
  specialCodes: string[] = [],
  codValue: number = 0,
  parcel?: ParcelPricingDimensions,
) {
  const displayService: ServicoLinke = {
    ...service,
    zones: service.zones.map(zone => ({
      ...zone,
      tiers: zone.tiers.map(tier => ({ ...tier, cost_price: 0, margin_pct: 0 })),
    })),
  }
  const quote = calculateShipmentQuote(weightKg, client, displayService, country, postal, specialCodes, codValue, parcel)
  return {
    basePrice: quote.basePrice,
    fuelSurchargeAmount: quote.fuelSurchargeAmount,
    specialFeesAmount: quote.specialFeesAmount,
    specialItems: quote.specialItems,
    totalPrice: quote.totalPrice,
    billableWeightKg: quote.billableWeightKg,
    volumetricWeightKg: quote.volumetricWeightKg,
    volumetricDivisor: quote.volumetricDivisor,
  }
}
