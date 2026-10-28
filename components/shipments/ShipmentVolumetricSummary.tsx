import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { calculateChargeableWeight, getServiceVolumetricRule, type ParcelPricingDimensions } from "@/lib/pricing/chargeable-weight"

export function ShipmentVolumetricSummary({ service, country, postal, weightKg, ...parcel }: {
  service?: ServicoLinke | null
  country: string
  postal: string
  weightKg: number
} & ParcelPricingDimensions) {
  if (!service) return null
  let message = "Preencha o país, o código postal, o peso e as dimensões para calcular o peso volumétrico."
  let result: ReturnType<typeof calculateChargeableWeight> | null = null
  if (!getServiceVolumetricRule(service)) {
    message = "Este serviço não tem uma regra de peso volumétrico configurada."
  } else if (country && postal.trim()) {
    try { result = calculateChargeableWeight(weightKg, service, country, postal, parcel) }
    catch { /* Keep incomplete input editable; submission validates the full parcel. */ }
  }
  const kg = (value: number) => `${value.toLocaleString("pt-PT", { maximumFractionDigits: 3 })} kg`
  return (
    <div role="status" aria-live="polite" className="rounded-lg border border-[#d8e6db] bg-[#f3f8f4] p-3 text-xs text-[#3e5845]">
      {result?.volumetricWeightKg != null ? <>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <span>Peso real: {kg(result.declaredWeightKg)}</span>
          <span>Peso volumétrico: <strong>{kg(result.volumetricWeightKg)}</strong></span>
          <strong>Peso usado na tarifa: {kg(result.billableWeightKg)}</strong>
        </div>
        <p className="mt-2 text-[11px]">Divisor do serviço: {result.volumetricDivisor}{(parcel.volumesCount ?? 1) > 1 ? ` · Total dos ${parcel.volumesCount} volumes com as medidas indicadas.` : "."}</p>
      </> : <p>{message}</p>}
    </div>
  )
}
