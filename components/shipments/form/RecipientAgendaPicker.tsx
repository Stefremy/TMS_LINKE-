"use client"

import { useId, useMemo, useState } from "react"
import { Clock, Mail, Phone, Search, X } from "lucide-react"
import type { Destinatario } from "@/app/ops/entidades/destinatarios/types"

type Sort = "recent" | "frequent" | "name"

const SORTS: { key: Sort; label: string }[] = [
  { key: "recent", label: "Recentes" },
  { key: "frequent", label: "Mais usados" },
  { key: "name", label: "A–Z" },
]
const VISIBLE_LIMIT = 50

/** Accent- and case-insensitive text; phones compared by digits only. */
const fold = (value: unknown) => String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "")
const shortDate = (value?: string) => {
  const day = value?.slice(0, 10)
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day.split("-").reverse().join("/") : ""
}

function matches(row: Destinatario, query: string) {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = fold([row.name, row.address, row.postal_code, row.city, row.country, row.email, row.nif].join(" "))
  const phone = digits(row.phone)
  return words.every(word => haystack.includes(word) || (digits(word).length >= 3 && phone.includes(digits(word))))
}

function compare(sort: Sort) {
  const byName = (a: Destinatario, b: Destinatario) => a.name.localeCompare(b.name, "pt", { sensitivity: "base" })
  if (sort === "name") return byName
  if (sort === "frequent") return (a: Destinatario, b: Destinatario) => (b.total_shipments || 0) - (a.total_shipments || 0) || byName(a, b)
  return (a: Destinatario, b: Destinatario) =>
    String(b.last_shipment_date || b.created_at || "").localeCompare(String(a.last_shipment_date || a.created_at || "")) || byName(a, b)
}

/**
 * Searchable recipient agenda: filter by any field, sort by recency, use or name,
 * and pick with mouse or keyboard. Countries without authorized services stay visible but disabled.
 */
export function RecipientAgendaPicker({ recipients, loading, error, allowedCountries, onChoose, onClose }: {
  recipients: Destinatario[]
  loading: boolean
  error: string | null
  allowedCountries: string[]
  onChoose: (recipient: Destinatario) => void
  onClose: () => void
}) {
  const listId = useId()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<Sort>("recent")
  const [active, setActive] = useState(0)

  const allowed = useMemo(() => new Set(allowedCountries.map(code => code.toUpperCase())), [allowedCountries])
  const filtered = useMemo(() => recipients.filter(row => matches(row, query)).sort(compare(sort)), [recipients, query, sort])
  const visible = filtered.slice(0, VISIBLE_LIMIT)
  const isAllowed = (row: Destinatario) => allowed.has(row.country.trim().toUpperCase())
  const current = Math.min(active, Math.max(visible.length - 1, 0))

  const choose = (row?: Destinatario) => { if (row && isAllowed(row)) onChoose(row) }
  const move = (step: number) => setActive(Math.max(0, Math.min(visible.length - 1, current + step)))

  return <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
    <div className="flex items-center gap-2">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Procurar na agenda</span>
        <Search aria-hidden size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          autoFocus
          value={query}
          role="combobox"
          aria-expanded={visible.length > 0}
          aria-controls={listId}
          aria-activedescendant={visible[current] ? `${listId}-${visible[current].id}` : undefined}
          placeholder="Nome, localidade, código postal, telefone…"
          onChange={event => { setQuery(event.target.value); setActive(0) }}
          onKeyDown={event => {
            if (event.key === "ArrowDown") { event.preventDefault(); move(1) }
            else if (event.key === "ArrowUp") { event.preventDefault(); move(-1) }
            else if (event.key === "Enter") { event.preventDefault(); choose(visible[current]) }
            else if (event.key === "Escape") { event.preventDefault(); onClose() }
          }}
          className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white py-2 pl-8 pr-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
        />
      </label>
      <button type="button" onClick={onClose} aria-label="Fechar agenda" className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100">
        <X size={15} />
      </button>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label="Ordenar agenda" className="flex gap-1">
        {SORTS.map(option => <button key={option.key} type="button" aria-pressed={sort === option.key} onClick={() => { setSort(option.key); setActive(0) }}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${sort === option.key
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"}`}>{option.label}</button>)}
      </div>
      {!loading && !error && recipients.length > 0 && <span className="text-xs tabular-nums text-zinc-500">
        {filtered.length === recipients.length ? `${recipients.length} contactos` : `${filtered.length} de ${recipients.length}`}
      </span>}
    </div>

    {loading ? <p role="status" className="py-4 text-center text-sm text-zinc-500">A carregar destinatários…</p>
      : error ? <p role="alert" className="text-sm text-red-700">{error}</p>
      : !recipients.length ? <p className="py-4 text-center text-xs text-zinc-500">Ainda não existem destinatários nesta agenda. Marque “Guardar na agenda” ao criar um envio.</p>
      : !filtered.length ? <p className="py-4 text-center text-xs text-zinc-500">Nenhum contacto corresponde a “{query.trim()}”.</p>
      : <ul id={listId} role="listbox" aria-label="Destinatários guardados" className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
        {visible.map((row, index) => {
          const enabled = isAllowed(row), last = shortDate(row.last_shipment_date)
          const country = row.country.trim().toUpperCase()
          return <li key={row.id} id={`${listId}-${row.id}`} role="option" aria-selected={index === current} aria-disabled={!enabled}
            onMouseEnter={() => setActive(index)} onClick={() => choose(row)}
            className={`flex gap-3 px-3 py-2.5 ${enabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"} ${index === current && enabled ? "bg-emerald-50/70" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-900">
                {row.name}
                {country !== "PT" && <span className="ml-1.5 rounded border border-zinc-200 px-1 text-[10px] font-semibold text-zinc-500">{country}</span>}
              </p>
              <p className="truncate text-xs text-zinc-600">{[row.address, [row.postal_code, row.city].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}</p>
              {(row.phone || row.email) && <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-zinc-500">
                {row.phone && <span className="inline-flex items-center gap-1"><Phone aria-hidden size={11} />{row.phone}</span>}
                {row.email && <span className="inline-flex min-w-0 items-center gap-1 truncate"><Mail aria-hidden size={11} />{row.email}</span>}
              </p>}
              {!enabled && <p className="mt-0.5 text-[11px] text-amber-700">Sem serviços autorizados para este país.</p>}
            </div>
            <div className="shrink-0 text-right text-[11px] text-zinc-500">
              {row.total_shipments > 0 && <p className="font-medium tabular-nums text-zinc-700">{row.total_shipments} {row.total_shipments === 1 ? "envio" : "envios"}</p>}
              {last && <p className="inline-flex items-center gap-1 tabular-nums"><Clock aria-hidden size={10} />{last}</p>}
            </div>
          </li>
        })}
      </ul>}
    {filtered.length > VISIBLE_LIMIT && <p className="text-[11px] text-zinc-500">A mostrar {VISIBLE_LIMIT} de {filtered.length}. Escreva para refinar a pesquisa.</p>}
  </div>
}
