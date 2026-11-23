import { formatDeclaredWeight, formatListCarrierWeight, type ParcelSummary } from '@/lib/services/shipments/parcel-summary'

/** `large` is used by the Ops shipments list, which uses a bigger type size than the client portal. */
export function ShipmentParcelWeight({ summary, large = false }: { summary?: ParcelSummary | null; large?: boolean }) {
  const carrier = formatListCarrierWeight(summary?.carrierWeight)
  const main = large ? 'text-[13px]' : 'text-[11px]'
  const sub = large ? 'text-[12px]' : 'text-[10px]'
  return <div className="flex flex-col items-start gap-0.5 whitespace-normal">
    {summary?.volumeCount && <span className={`${main} font-semibold text-[var(--text-primary)]`}>{summary.volumeCount} Vol.</span>}
    <span className={`${sub} font-medium text-[var(--text-tertiary)]`} title="Peso declarado pelo cliente">{formatDeclaredWeight(summary?.declaredWeightKg)}</span>
    {carrier && <span className={`${sub} font-semibold text-[var(--status-success)]`} title={carrier.title}>{carrier.text}</span>}
  </div>
}
