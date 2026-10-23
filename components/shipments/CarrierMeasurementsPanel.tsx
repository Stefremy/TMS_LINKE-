'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Ruler, Scale } from 'lucide-react'
import { formatCarrierReading, latestCarrierReadings, type ShipmentMeasurementsSummary } from '@/lib/services/tracking/carrier-measurements'

export function CarrierMeasurementsPanel({ shipmentId, syncing = false }: { shipmentId: string; syncing?: boolean }) {
  const [loaded, setLoaded] = useState<{ id: string; data: ShipmentMeasurementsSummary } | null>(null)
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const data = loaded?.id === shipmentId ? loaded.data : null
  const error = failure?.id === shipmentId ? failure.message : null
  const loading = !data && !error

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
        <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />{refreshing ? 'A consultar…' : `Consultar ${carrier}`}
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
        : 'Campos V3 apresentados como recebidos; as unidades aguardam confirmação CTT. O evento não confirma quando foi feita a pesagem.'} Estes valores não confirmam o peso faturado nem alteram a cobrança.</p>}
    </>}
    {error && <p role="alert" className="mt-3 text-xs text-[var(--status-critical)]">{error}</p>}
  </section>
}
