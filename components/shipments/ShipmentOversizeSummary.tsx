import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import type { ParcelPricingDimensions } from "@/lib/pricing/chargeable-weight"
import { calculateOversizeSurcharge, getParcelLimits, getServiceParcelLimitProduct } from "@/lib/pricing/oversize-surcharge"

export function ShipmentOversizeSummary({ service, country, weightKg, weights, onWeightsChange, ...parcel }: {
  service?: ServicoLinke | null; country: string; weightKg: number
  weights: string[]; onWeightsChange: (weights: string[]) => void
} & ParcelPricingDimensions) {
  if (!service) return null
  const limits = getParcelLimits(service, country)
  if (!limits) return country && getServiceParcelLimitProduct(service) === "international"
    ? <p role="status" className="text-xs text-[#735b39]">Limites por volume não configurados para este destino. Contacte o suporte.</p> : null
  const count = parcel.volumesCount ?? 1
  const needsWeights = count > 1 && count <= 1000 && Number.isSafeInteger(count) && weightKg > limits.maxWeightKg
  let message = ""
  try {
    const result = calculateOversizeSurcharge(service, country, weightKg, parcel)
    if (result.count) message = `${result.count} volume(s) fora dos limites: +${result.amount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} € (69,90 € por volume).`
  } catch (err) { if (needsWeights) message = err instanceof Error ? err.message : "Indique os pesos por volume." }
  return <div className="space-y-3 text-xs text-[#735b39]">
    {needsWeights && <fieldset className="rounded-lg border border-[#dfd4bf] bg-[#faf7ef] p-3">
      <legend className="px-1 font-medium">Peso real de cada volume (kg)</legend>
      <p className="mb-2">Limite: {limits.maxWeightKg} kg por volume. A soma deve corresponder ao peso total do envio.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: count }, (_, i) => <label key={i} className="space-y-1">
        <span>Volume {i + 1}</span>
        <input name="parcel_weight_kg" type="number" min="0.001" step="0.001" value={weights[i] ?? ""}
          className="w-full rounded-lg border border-[#dfd4bf] bg-white px-3 py-2"
          onChange={e => { const next = Array.from({ length: count }, (_, n) => weights[n] ?? ""); next[i] = e.target.value; onWeightsChange(next) }} />
      </label>)}</div>
    </fieldset>}
    {message && <p role="status" className="rounded-lg border border-[#dfd4bf] bg-[#faf7ef] p-3">{message}</p>}
  </div>
}
