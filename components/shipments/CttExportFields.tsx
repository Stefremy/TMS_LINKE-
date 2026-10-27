"use client"

import { useId } from "react"
import { CTT_EXPORT_TYPES, CTT_CONTENT_TYPES } from "@/lib/services/ctt/export-details"
import { requiresCttCustoms } from "@/lib/services/ctt/customs-declaration"
import { CttCustomsFields } from "./CttCustomsFields"

export function CttExportFields({ country, postalCode = "" }: { country: string; postalCode?: string }) {
  const id = useId()
  const isIceland = country.trim().toUpperCase() === "IS"
  const customsFields = requiresCttCustoms(country, postalCode)
    ? <CttCustomsFields key={`${country}-customs`} destinationName={isIceland ? "Islândia" : undefined} /> : null
  const inputClass = "mt-1.5 w-full min-w-0 rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] px-3 py-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
  return (
    <fieldset className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4">
      <legend className="px-1 text-sm font-semibold text-[var(--text-primary)]">Conteúdo do envio internacional</legend>
      <p className="mb-4 text-xs text-[var(--text-secondary)]">Dados exigidos pelos CTT para este destino. Indique o valor do conteúdo transportado.</p>
      {isIceland && customsFields}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="min-w-0">
          <label htmlFor={`${id}-export`} className="text-xs font-medium text-[var(--text-primary)]">Tipo de exportação *</label>
          <select id={`${id}-export`} name="ctt_export_type" required defaultValue="" className={inputClass}>
            <option value="" disabled>Selecionar…</option>
            {CTT_EXPORT_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-content`} className="text-xs font-medium text-[var(--text-primary)]">Tipo de conteúdo *</label>
          <select id={`${id}-content`} name="ctt_content_type" required defaultValue="" className={inputClass}>
            <option value="" disabled>Selecionar…</option>
            {CTT_CONTENT_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-value`} className="text-xs font-medium text-[var(--text-primary)]">Valor declarado do conteúdo (€) *</label>
          <input id={`${id}-value`} name="ctt_declared_value" type="number" inputMode="decimal" min="0" step="0.01" required placeholder="Ex.: 25,50" className={inputClass} />
        </div>
      </div>
      {!isIceland && customsFields}
    </fieldset>
  )
}
