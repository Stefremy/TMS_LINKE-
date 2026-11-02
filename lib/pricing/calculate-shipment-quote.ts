import { DEFAULT_STANDARD_SPECIAL_FEES } from "./special-fee-catalogue"
import { isCorreosConfigurationOnly } from "@/lib/services/correos/complementary-services"
import { isCttSpecialServiceAvailable } from "@/lib/services/ctt/special-service-availability"
import { calculateOversizeSurcharge } from "./oversize-surcharge"
import type { Cliente, ClientSpecialServiceFee } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { calculateShipmentPrice, isCeTruckService } from "./calculate-shipment-price"
import { ShipmentPricingError } from "./shipment-pricing-errors"
import { calculateChargeableWeight, type ParcelPricingDimensions } from "./chargeable-weight"
import { resolveCodFee } from "./cod-destination-rates"

export function getClientSpecialFees(client: Partial<Cliente>): ClientSpecialServiceFee[] {
  const configured = client.pricing?.special_services_fees
  return (configured?.length ? configured : DEFAULT_STANDARD_SPECIAL_FEES).filter(fee => !isCorreosConfigurationOnly(fee.special_service_code))
}

export function resolveServiceCarrier(service: ServicoLinke): "ctt" | "correos" {
  if (service.preferred_carrier_name) {
    const carrier = service.preferred_carrier_name.toLowerCase()
    if (carrier.includes("correos")) return "correos"
    if (carrier.includes("ctt") || /ers|d\+/.test(carrier)) return "ctt"
    throw new ShipmentPricingError("Transportadora não suportada para este serviço.")
  }
  if (service.carrier_group === "correos" || service.carrier_group === "ctt") {
    return service.carrier_group
  }
  const code = (service.code || "").trim().toUpperCase()
  const name = (service.name || "").toLowerCase()
  if (code.startsWith("LK-COR") || code.startsWith("COR-") || name.includes("correos") || /paq\s?(24|48)|e-?paq/.test(name)) {
    return "correos"
  }
  if (
    isCeTruckService(service) ||
    /^LK-(CTT|DD|DB|EQ|MULT|EU|CE)/.test(code) ||
    name.includes("ctt") ||
    /ers|d\+|guia\s+(dd|db|eq|ce|ee)|ems|para amanh|em 2 dias|m[úu]ltiplo|europa terrestre/.test(name)
  ) {
    return "ctt"
  }
  throw new ShipmentPricingError("Transportadora não suportada para este serviço.")
}

/** Safe helper for client UI to distinguish Correos vs CTT tables even after redaction. */
export function isCorreosLinkeService(service?: Partial<ServicoLinke> | null): boolean {
  if (!service) return false
  if (service.carrier_group === "correos") return true
  if (service.carrier_group === "ctt") return false
  const carrier = (service.preferred_carrier_name || "").toLowerCase()
  if (carrier.includes("correos")) return true
  if (carrier.includes("ctt") || /ers|d\+/.test(carrier)) return false
  const code = (service.code || "").trim().toUpperCase()
  if (code.startsWith("LK-COR") || code.startsWith("COR-")) return true
  if (/^LK-(CTT|DD|DB|EQ|MULT|EU|CE)/.test(code)) return false
  const name = (service.name || "").toLowerCase()
  return name.includes("correos") || /paq\s?(24|48)|e-?paq/.test(name)
}

export function calculateShipmentSpecialFees(
  transportPrice: number,
  client: Partial<Cliente>,
  carrier: "ctt" | "correos",
  codes: string[] = [],
  codValue: number = 0,
  destination?: { country: string; postal: string },
) {
  if (!Array.isArray(codes) || codes.some(code => typeof code !== "string") ||
      new Set(codes).size !== codes.length || codes.length > 20) {
    throw new ShipmentPricingError("Serviços especiais inválidos.")
  }
  const fees = getClientSpecialFees(client)
  const items = codes.map(code => {
    if (!isCttSpecialServiceAvailable(code, destination?.country ?? "", destination?.postal ?? "")) {
      throw new ShipmentPricingError("AuthorizeReturn / Back (Logística Inversa) está disponível apenas para Portugal Continental.")
    }
    if (code.startsWith("correos_") !== (carrier === "correos")) {
      throw new ShipmentPricingError("Serviço especial não autorizado para esta transportadora.")
    }
    const configuredFee = fees.find(f => f.special_service_code === code && f.is_enabled)
    if (!configuredFee) throw new ShipmentPricingError("Serviço especial inexistente ou desativado.")
    const fee = resolveCodFee(configuredFee, destination?.country ?? "", destination?.postal ?? "")
    for (const amount of [fee.fixed_value, fee.percentage_value, fee.min_value]) {
      if (amount !== undefined && amount !== null && (!Number.isFinite(amount) || amount < 0)) {
        throw new ShipmentPricingError("Tarifa de serviço especial inválida.")
      }
    }
    if (fee.fee_type !== "fixed" && fee.fee_type !== "percentage") {
      throw new ShipmentPricingError("Tarifa de serviço especial inválida.")
    }
    const isCod = code === "cod" || code === "correos_cod"
    if (isCod && (!Number.isFinite(codValue) || codValue <= 0 || !Number.isSafeInteger(Math.round(codValue * 100)))) {
      throw new ShipmentPricingError("Indique um valor de cobrança superior a zero.")
    }
    const raw = fee.fee_type === "fixed" ? fee.fixed_value ?? 0
      : Math.max((isCod ? codValue : transportPrice) * ((fee.percentage_value ?? 0) / 100), fee.min_value ?? 0)
    const amount = Number(raw.toFixed(2))
    if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100))) {
      throw new ShipmentPricingError("Tarifa de serviço especial inválida.")
    }
    return { name: fee.special_service_name, amount }
  })
  const amount = Number(items.reduce((total, item) => total + item.amount, 0).toFixed(2))
  const totalPrice = Number((transportPrice + amount).toFixed(2))
  if (!Number.isFinite(totalPrice) || totalPrice <= 0 || !Number.isSafeInteger(Math.round(totalPrice * 100))) {
    throw new ShipmentPricingError("Tarifa inválida. Contacte o suporte.")
  }
  return { amount, items, totalPrice }
}

/** Same calculation for previews and persisted shipments; no additional discount. */
export function calculateShipmentQuote(
  weightKg: number,
  client: Partial<Cliente>,
  service: ServicoLinke,
  country: string,
  postal: string,
  specialCodes: string[] = [],
  codValue: number = 0,
  parcel?: ParcelPricingDimensions,
) {
  const weight = calculateChargeableWeight(weightKg, service, country, postal, parcel)
  const transport = calculateShipmentPrice(weight.billableWeightKg, { ...client, default_linke_table_id: service.id },
    [service], country, postal, { requireConfiguredTariff: true })
  const oversize = calculateOversizeSurcharge(service, country, weightKg, parcel)
  const specials = calculateShipmentSpecialFees(transport.sellPrice, client, resolveServiceCarrier(service), specialCodes, codValue, { country, postal })
  return { ...transport, ...weight, oversizeSurcharge: oversize, specialFeesAmount: Number((specials.amount + oversize.amount).toFixed(2)), specialItems: [...specials.items, ...oversize.items], totalPrice: Number((specials.totalPrice + oversize.amount).toFixed(2)) }
}

