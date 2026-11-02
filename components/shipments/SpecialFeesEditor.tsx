"use client"

import { useState } from "react"
import type { ClientSpecialServiceFee } from "@/app/ops/entidades/clientes/types"
import { CORREOS_INCLUDED_SERVICES, isCorreosConfigurationOnly } from "@/lib/services/correos/complementary-services"
import { inheritStandardSpecialFees } from "@/lib/pricing/special-fees"

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
    ? { ...fee, ...patch, ...(mode === "client" ? { use_standard: false } : {}) } : fee))
  const inputClass = "rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-2 text-xs font-medium tabular-nums disabled:opacity-50"
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
          return <div key={fee.special_service_code} className="flex flex-wrap items-start justify-between gap-4 p-4">
            <div className="flex min-w-0 flex-1 items-start gap-3 basis-64">
              <input type="checkbox" aria-label={`Ativar ${fee.special_service_name}`} checked={fee.is_enabled} disabled={disabled || configurationOnly}
                onChange={event => change(fee.special_service_code, { is_enabled: event.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
              <div className="min-w-0">
                <p className="text-xs font-semibold">{fee.special_service_name}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{fee.description}</p>
                {configurationOnly && <p className="mt-2 text-[11px] text-amber-700">Preço de referência · ativação na emissão pendente; não é cobrado nos envios.</p>}
                {mode === "client" && <div className="mt-2 flex items-center gap-3 text-[11px]">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${fee.use_standard === true ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"}`}>
                    {fee.use_standard === true ? "Standard" : "Personalizado"}
                  </span>
                  {fee.use_standard !== true && standard && <button type="button" disabled={disabled}
                    onClick={() => onChange(fees.map(row => row.special_service_code === fee.special_service_code ? { ...standard, use_standard: true } : row))}
                    className="font-semibold text-[var(--accent)] underline">Voltar ao standard</button>}
                </div>}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)]">Cálculo
                <select aria-label={`Cálculo de ${fee.special_service_name}`} disabled={disabled} value={fee.fee_type}
                  onChange={event => change(fee.special_service_code, { fee_type: event.target.value as "fixed" | "percentage",
                    fixed_value: fee.fixed_value ?? 0, percentage_value: fee.percentage_value ?? 0, min_value: fee.min_value ?? 0 })} className={`${inputClass} mt-1 block w-32`}>
                  <option value="fixed">Fixo (€)</option><option value="percentage">Percentagem</option>
                </select>
              </label>
              {fee.fee_type === "percentage" ? <>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)]">Taxa (%)
                  <input aria-label={`Percentagem de ${fee.special_service_name}`} type="number" min="0" step="0.01" required disabled={disabled} value={fee.percentage_value ?? 0}
                    onChange={event => change(fee.special_service_code, { percentage_value: Number(event.target.value) })} className={`${inputClass} mt-1 block w-24`} />
                </label>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)]">Mínimo (€)
                  <input aria-label={`Mínimo de ${fee.special_service_name}`} type="number" min="0" step="0.01" required disabled={disabled} value={fee.min_value ?? 0}
                    onChange={event => change(fee.special_service_code, { min_value: Number(event.target.value) })} className={`${inputClass} mt-1 block w-24`} />
                </label>
              </> : <label className="block text-[10px] font-semibold text-[var(--text-secondary)]">Valor (€)
                <input aria-label={`Valor de ${fee.special_service_name}`} type="number" min="0" step="0.01" required disabled={disabled} value={fee.fixed_value ?? 0}
                  onChange={event => change(fee.special_service_code, { fixed_value: Number(event.target.value) })} className={`${inputClass} mt-1 block w-24`} />
              </label>}
            </div>
          </div>
        })}
      </div>
    </div>
  )
}
