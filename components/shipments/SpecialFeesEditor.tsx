"use client"

import { useState } from "react"
import type { ClientSpecialServiceFee } from "@/app/ops/entidades/clientes/types"
import { CORREOS_INCLUDED_SERVICES, isCorreosConfigurationOnly } from "@/lib/services/correos/complementary-services"
import { inheritStandardSpecialFees } from "@/lib/pricing/special-fees"
import { codDestinationsForFee, isCodFee, codRateForZone, type CodRate, type CodDestination } from "@/lib/pricing/cod-destination-rates"

type Props = {
  fees: ClientSpecialServiceFee[]
  onChange: (fees: ClientSpecialServiceFee[]) => void
  standards?: ClientSpecialServiceFee[]
  mode: "standard" | "client"
  disabled?: boolean
}

export function SpecialFeesEditor({ fees, onChange, standards = [], mode, disabled = false }: Props) {
  const [carrier, setCarrier] = useState<"ctt" | "correos">("ctt")
  const [search, setSearch] = useState("")
  const isCorreos = (fee: ClientSpecialServiceFee) => fee.special_service_code.startsWith("correos_")
  const visible = fees.filter(fee => isCorreos(fee) === (carrier === "correos")
    && `${fee.special_service_name} ${fee.description}`.toLocaleLowerCase("pt-PT").includes(search.trim().toLocaleLowerCase("pt-PT")))
  const change = (code: string, patch: Partial<ClientSpecialServiceFee>) => onChange(fees.map(fee => fee.special_service_code === code
    ? { ...fee, ...(mode === "client" ? { use_standard: false } : {}), ...patch } : fee))
  const inputClass = "rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-2 text-xs font-medium tabular-nums disabled:opacity-50"
  const rateInputs = (rate: Pick<ClientSpecialServiceFee, "fee_type" | "fixed_value" | "percentage_value" | "min_value">, label: string, update: (patch: Partial<CodRate>) => void) => (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block text-[10px] font-semibold text-[var(--text-secondary)]">Cálculo
        <select aria-label={`Cálculo de ${label}`} disabled={disabled} value={rate.fee_type}
          onChange={event => update({ fee_type: event.target.value as "fixed" | "percentage", fixed_value: rate.fixed_value ?? 0,
            percentage_value: rate.percentage_value ?? 0, min_value: rate.min_value ?? 0 })} className={`${inputClass} mt-1 block w-32`}>
          <option value="fixed">Fixo (€)</option><option value="percentage">Percentagem</option>
        </select>
      </label>
      {rate.fee_type === "percentage" ? <>
        <label className="block text-[10px] font-semibold text-[var(--text-secondary)]">Taxa (%)
          <input aria-label={`Percentagem de ${label}`} type="number" min="0" step="0.01" required disabled={disabled} value={rate.percentage_value ?? 0}
            onChange={event => update({ percentage_value: Number(event.target.value) })} className={`${inputClass} mt-1 block w-24`} />
        </label>
        <label className="block text-[10px] font-semibold text-[var(--text-secondary)]">Mínimo (€)
          <input aria-label={`Mínimo de ${label}`} type="number" min="0" step="0.01" required disabled={disabled} value={rate.min_value ?? 0}
            onChange={event => update({ min_value: Number(event.target.value) })} className={`${inputClass} mt-1 block w-24`} />
        </label>
      </> : <label className="block text-[10px] font-semibold text-[var(--text-secondary)]">Valor (€)
        <input aria-label={`Valor de ${label}`} type="number" min="0" step="0.01" required disabled={disabled} value={rate.fixed_value ?? 0}
          onChange={event => update({ fixed_value: Number(event.target.value) })} className={`${inputClass} mt-1 block w-24`} />
      </label>}
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" aria-label="Transportadora">
          {(["ctt", "correos"] as const).map(value => <button key={value} type="button" aria-pressed={carrier === value}
            onClick={() => setCarrier(value)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${carrier === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border-subtle)]"}`}>
            {value === "ctt" ? "CTT Expresso" : "Correos Express"} · {fees.filter(fee => isCorreos(fee) === (value === "correos")).length}
          </button>)}
        </div>
        {mode === "client" && <button type="button" disabled={disabled} onClick={() => onChange(inheritStandardSpecialFees(standards))}
          className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Usar standard em todas</button>}
      </div>
      <input type="search" aria-label="Pesquisar taxas suplementares" placeholder="Pesquisar serviço ou suplemento…" value={search} onChange={event => setSearch(event.target.value)}
        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm" />
      {carrier === "correos" && <details className="rounded-xl bg-[var(--surface-muted)] p-3 text-xs">
        <summary className="cursor-pointer font-semibold">Serviços incluídos no frete Correos Express</summary>
        <ul className="mt-2 space-y-1 text-[var(--text-secondary)]">{CORREOS_INCLUDED_SERVICES.map(item => <li key={item}>✓ {item}</li>)}</ul>
      </details>}
      <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
        {visible.length === 0 && <p className="p-5 text-sm text-[var(--text-secondary)]">Nenhuma taxa corresponde à pesquisa.</p>}
        {visible.map(fee => {
          const configurationOnly = isCorreosConfigurationOnly(fee.special_service_code)
          const standard = standards.find(row => row.special_service_code === fee.special_service_code)
          const destinations = codDestinationsForFee(fee.special_service_code)
          const rates = Object.fromEntries(destinations.map(({ code }) => {
            const rate = codRateForZone(fee, code)
            return [code, { ...rate, use_standard: rate.use_standard ?? fee.use_standard === true }]
          })) as Record<CodDestination, CodRate>
          const followsStandard = fee.use_standard === true && (!isCodFee(fee.special_service_code) || destinations.every(({ code }) => rates[code].use_standard === true))
          return <div key={fee.special_service_code} className="flex flex-wrap items-start justify-between gap-4 p-4">
            <div className="flex min-w-0 flex-1 items-start gap-3 basis-64">
              <input type="checkbox" aria-label={`Ativar ${fee.special_service_name}`} checked={fee.is_enabled} disabled={disabled || configurationOnly}
                onChange={event => change(fee.special_service_code, { is_enabled: event.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
              <div className="min-w-0">
                <p className="text-xs font-semibold">{fee.special_service_name}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{fee.description}</p>
                {configurationOnly && <p className="mt-2 text-[11px] text-amber-700">Preço de referência · ativação na emissão pendente; não é cobrado nos envios.</p>}
                {mode === "client" && <div className="mt-2 flex items-center gap-3 text-[11px]">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${followsStandard ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"}`}>
                    {followsStandard ? "Standard" : "Personalizado"}
                  </span>
                  {!followsStandard && standard && <button type="button" disabled={disabled}
                    onClick={() => onChange(fees.map(row => row.special_service_code === fee.special_service_code ? { ...standard, use_standard: true } : row))}
                    className="font-semibold text-[var(--accent)] underline">Voltar ao standard</button>}
                </div>}
              </div>
            </div>
            {!isCodFee(fee.special_service_code) ? rateInputs(fee, fee.special_service_name, patch => change(fee.special_service_code, patch)) : (
              <div className="w-full space-y-3">
                <p className="text-xs text-[var(--text-secondary)]">Cobrança calculada pelo país e código postal do destinatário. A percentagem incide sobre o valor a cobrar.</p>
                <div className="grid gap-3 xl:grid-cols-2">{destinations.map(({ code, label }) => <div key={code} className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">{label}</p>
                    {mode === "client" && <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{rates[code].use_standard ? "Standard" : "Personalizado"}</span>}
                  </div>
                  {rateInputs(rates[code], `${fee.special_service_name} · ${label}`, patch => change(fee.special_service_code, {
                    use_standard: fee.use_standard === true,
                    cod_destination_rates: { ...rates, [code]: { ...rates[code], ...patch, ...(mode === "client" ? { use_standard: false } : {}) } },
                  }))}
                  {mode === "client" && !rates[code].use_standard && standard && <button type="button" disabled={disabled}
                    onClick={() => change(fee.special_service_code, { use_standard: fee.use_standard === true,
                      cod_destination_rates: { ...rates, [code]: { ...codRateForZone(standard, code), use_standard: true } } })}
                    className="text-[11px] font-semibold text-[var(--accent)] underline">Usar standard em {label}</button>}
                </div>)}</div>
                <details className="text-xs text-[var(--text-secondary)]"><summary className="cursor-pointer">Valor base das zonas sem taxa específica</summary>
                  <div className="mt-3">{rateInputs(fee, fee.special_service_name, patch => change(fee.special_service_code, patch))}</div>
                </details>
              </div>
            )}
          </div>
        })}
      </div>
    </div>
  )
}
