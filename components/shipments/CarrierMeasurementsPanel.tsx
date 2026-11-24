'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { Ruler, Scale } from 'lucide-react'
import { RefreshIcon } from "@/components/ui/refresh-icon"
import { formatCarrierReading, latestCarrierReadings, type ShipmentMeasurementsSummary } from '@/lib/services/tracking/carrier-measurements'
import type { ParcelSummary } from '@/lib/services/shipments/parcel-summary'
import { parcelSummaryFromDetail } from '@/lib/services/shipments/parcel-summary'

export function CarrierMeasurementsPanel({ shipmentId, syncing = false, previous, onUpdated }: {
  shipmentId: string; syncing?: boolean; previous?: ParcelSummary | null; onUpdated?: (summary: ParcelSummary, adjustedPrice?: number) => void
}) {
  const [loaded, setLoaded] = useState<{ id: string; data: ShipmentMeasurementsSummary } | null>(null)
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const data = loaded?.id === shipmentId ? loaded.data : null
  const error = failure?.id === shipmentId ? failure.message : null
  const loading = !data && !error
  const onStoredSummary = useEffectEvent((summary: ShipmentMeasurementsSummary) => {
    const next = parcelSummaryFromDetail(summary, previous)
    if (JSON.stringify(previous?.carrierWeight ?? null) !== JSON.stringify(next.carrierWeight)) onUpdated?.(next, summary.weightAdjustment?.status === 'adjusted' ? summary.weightAdjustment.price : undefined)
  })

  useEffect(() => {
    if (!shipmentId || syncing) return
    const controller = new AbortController()
    fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/measurements`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Não foi possível carregar as medições.')
        const summary: ShipmentMeasurementsSummary = await response.json()
        if (!controller.signal.aborted) {
          setLoaded({ id: shipmentId, data: summary })
          setFailure(null)
          onStoredSummary(summary)
        }
      })
      .catch(() => { if (!controller.signal.aborted) setFailure({ id: shipmentId, message: 'Não foi possível carregar as medições.' }) })
    return () => controller.abort()
  }, [shipmentId, syncing])

  async function refresh() {
    setRefreshing(true)
    setFailure(null)
    try {
      const response = await fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/measurements`, {
        method: 'POST', signal: AbortSignal.timeout(55000),
      })
      const summary = await response.json()
      if (!response.ok) throw new Error(summary.error || 'Não foi possível consultar a transportadora.')
      setLoaded({ id: shipmentId, data: summary })
      onUpdated?.(parcelSummaryFromDetail(summary, previous), summary.weightAdjustment?.status === 'adjusted' ? summary.weightAdjustment.price : undefined)
    } catch (cause) {
      setFailure({ id: shipmentId, message: cause instanceof Error ? cause.message : 'Não foi possível consultar a transportadora.' })
    } finally { setRefreshing(false) }
  }

  const carrier = data?.carrier === 'correos' ? 'Correos Express' : data?.carrier === 'ctt' ? 'CTT' : 'transportadora'
  const measured = data ? latestCarrierReadings(data.observations) : null
  const declaredWeight = data?.declared.weightKg
  const declaredDimensions = data && [data.declared.lengthCm, data.declared.widthCm, data.declared.heightCm]
  const dimensions = measured && [measured.length, measured.width, measured.height]
  const unitKnown = dimensions?.every(value => value?.unit === 'cm')
  const number = (value: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 3 }).format(value)
  const consulted = data?.observations[0]?.retrieved_at
  const row = (label: string, value: string) => <div className="flex items-start justify-between gap-4 text-xs"><dt className="text-[var(--text-secondary)]">{label}</dt><dd className="text-right font-medium tabular-nums text-[var(--text-primary)]">{value}</dd></div>

  return <section aria-label="Pesos e medidas do envio" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-3.5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]"><Scale className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />Pesos e medidas</h3>
      <button type="button" onClick={() => void refresh()} disabled={refreshing || loading || syncing} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] disabled:opacity-50">
        <RefreshIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />{refreshing ? 'A consultar…' : `Consultar ${carrier}`}
      </button>
    </div>
    {loading && !data ? <p role="status" className="text-xs text-[var(--text-secondary)]">A carregar pesos e medidas…</p> : data && <>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Declarado pelo cliente</p>
      <dl className="space-y-2">
        {row('Peso', declaredWeight ? `${number(declaredWeight)} kg` : 'Não registado')}
        {row('C × L × A', declaredDimensions?.every(value => value !== null) ? `${declaredDimensions.map(value => number(value!)).join(' × ')} cm` : 'Não registado')}
      </dl>
      <div className="my-3 border-t border-[var(--border-subtle)]" />
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]"><Ruler className="h-3 w-3" aria-hidden="true" />{data?.carrier === 'correos' ? 'Dados comunicados pela Correos Express' : 'Medições comunicadas pelos CTT'}</p>
      {measured ? <dl className="space-y-2">
        {row(data?.carrier === 'ctt' ? 'Peso real' : 'Peso comunicado', formatCarrierReading(measured.weight))}
        {data?.carrier === 'ctt' && row('Peso volumétrico', formatCarrierReading(measured.volumetricWeight))}
        {data?.carrier === 'correos' && measured.volume && row('Volume comunicado', formatCarrierReading(measured.volume))}
        {row('C × L × A', dimensions?.some(Boolean)
          ? `${dimensions.map(value => value ? number(value.value) : '—').join(' × ')}${unitKnown ? ' cm' : ' (unidade não indicada)'}` : 'Não comunicado')}
      </dl> : <p className="text-xs text-[var(--text-secondary)]">Ainda sem medições disponíveis. Consulte a transportadora para verificar.</p>}
      {consulted && <p className="mt-2 text-[10px] text-[var(--text-tertiary)]">Dados obtidos em {new Date(consulted).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' })}.</p>}
      {measured && <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-tertiary)]">{data?.carrier === 'correos'
        ? 'A API Correos não distingue valores declarados de medições físicas.'
        : 'Campos V3 apresentados como recebidos; as unidades aguardam confirmação CTT. O evento não confirma quando foi feita a pesagem.'} A cobrança usa apenas pesos com unidade validada e a tarifa original do envio.</p>}
    </>}
    {data?.weightAdjustment && (data.weightAdjustment.status === 'adjusted'
      ? <WeightAdjustmentComparison adjustment={data.weightAdjustment} carrier={carrier} />
      : <div role="status" className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-secondary)]">
        <p className="font-semibold text-[var(--text-primary)]">Ajuste de peso</p>
        <p className="mt-1">{data.weightAdjustment.message}</p>
      </div>)}
    {error && <p role="alert" className="mt-3 text-xs text-[var(--status-critical)]">{error}</p>}
  </section>
}

const euro = (value: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
const kg = (value: number) => `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 3 }).format(value)} kg`
// Same rounding as the wallet debit: VAT on each shipment total, to the cent.
const withVat = (net: number, vatPct: number) => Math.round(Math.round(net * 100) * (100 + vatPct) / 100) / 100

/** Original vs adjusted price after the carrier's weight moved the shipment to another tier. */
function WeightAdjustmentComparison({ adjustment: a, carrier }: { adjustment: NonNullable<ShipmentMeasurementsSummary['weightAdjustment']>; carrier: string }) {
  if (a.previousPrice == null || a.price == null || a.weightKg == null) return null
  const vat = a.vatPct ?? 0
  const before = withVat(a.previousPrice, vat), after = withVat(a.price, vat)
  const rows: [string, string, string][] = [
    ['Peso cobrado', a.previousWeightKg != null ? kg(a.previousWeightKg) : '—', `${kg(a.weightKg)}${a.chargedBy === 'volumetric' ? ' (volumétrico)' : ''}`],
    ...(a.previousTier || a.tier ? [['Escalão', a.previousTier || '—', a.tier || '—'] as [string, string, string]] : []),
    ['Preço s/ IVA', euro(a.previousPrice), euro(a.price)],
    [vat > 0 ? `Preço c/ IVA (${vat}%)` : 'Preço (isento de IVA)', euro(before), euro(after)],
  ]
  return <div role="status" className="mt-3 border-t border-[var(--border-subtle)] pt-3">
    <p className="text-xs font-semibold text-[var(--text-primary)]">Mudança de escalão pelo {a.chargedBy === 'volumetric' ? 'volume medido' : 'peso'} {carrier}</p>
    {a.chargedBy === 'volumetric' && <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">As dimensões medidas pela transportadora resultam num peso volumétrico superior ao declarado.</p>}
    <table className="mt-2 w-full text-xs tabular-nums">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
          <th scope="col" className="pb-1.5 text-left font-semibold"><span className="sr-only">Campo</span></th>
          <th scope="col" className="pb-1.5 text-right font-semibold">Original</th>
          <th scope="col" className="pb-1.5 text-right font-semibold text-[var(--accent)]">Ajustado</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--border-subtle)]">
        {rows.map(([label, from, to]) => <tr key={label}>
          <th scope="row" className="py-1.5 text-left font-normal text-[var(--text-secondary)]">{label}</th>
          <td className="py-1.5 text-right text-[var(--text-secondary)]">{from}</td>
          <td className="py-1.5 text-right font-semibold text-[var(--text-primary)]">{to}</td>
        </tr>)}
      </tbody>
    </table>
    <div className="mt-2 flex items-baseline justify-between gap-3 rounded-lg bg-[var(--status-warning-soft)] px-3 py-2 text-xs">
      <span className="font-semibold text-[var(--text-primary)]">{a.prepaid ? 'Diferença descontada do saldo' : 'Diferença a cobrar'}</span>
      <span className="text-right tabular-nums">
        <span className="font-bold text-[var(--text-primary)]">+{euro(after - before)}</span>
        {vat > 0 && <span className="ml-1.5 text-[10px] text-[var(--text-secondary)]">(+{euro(a.price - a.previousPrice)} s/ IVA)</span>}
      </span>
    </div>
  </div>
}
