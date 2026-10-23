import { formatDeclaredWeight, formatListCarrierWeight, type ParcelSummary } from '@/lib/services/shipments/parcel-summary'

export function ShipmentParcelWeight({ summary }: { summary?: ParcelSummary | null }) {
  const carrier = formatListCarrierWeight(summary?.carrierWeight)
  return <div className="flex flex-col items-start gap-0.5 whitespace-normal">
    {summary?.volumeCount && <span className="text-[11px] font-semibold text-[var(--text-primary)]">{summary.volumeCount} Vol.</span>}
    <span className="text-[10px] font-medium text-[var(--text-tertiary)]" title="Peso declarado pelo cliente">{formatDeclaredWeight(summary?.declaredWeightKg)}</span>
    {carrier && <span className="text-[10px] font-semibold text-[var(--status-success)]" title={carrier.title}>{carrier.text}</span>}
  </div>
}
