"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, Globe2, Map, Plane, Search, Truck, X } from "lucide-react"
import { filterDistributionZones, type DistributionZoneGroup } from "@/lib/services/geo/distribution-zones"

export function DistributionZonesClient({ groups }: { groups: DistributionZoneGroup[] }) {
  const [selectedGroupId, setSelectedGroupId] = React.useState(groups[0]?.id)
  const [search, setSearch] = React.useState("")
  const group = groups.find(item => item.id === selectedGroupId) || groups[0]
  const visibleZones = React.useMemo(() => filterDistributionZones(group?.zones || [], search), [group, search])
  if (!group) return null
  const countryCount = new Set(group.zones.flatMap(zone => zone.countries.map(country => country.code))).size
  const resultCount = visibleZones.reduce((count, zone) => count + zone.countries.length, 0)

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Map className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Zonas de envio</h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Consulte os países abrangidos por cada zona e serviço de transporte.</p>
          </div>
        </div>
        <Link href="/ops/configuracao/servicos" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]">
          Tabelas de preços e serviços <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div role="group" aria-label="Transportadora e serviço" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {groups.map(item => {
          const selected = item.id === group.id
          const Icon = item.id === "ctt_road" ? Truck : item.id === "ctt_air" ? Plane : Globe2
          return (
            <button key={item.id} type="button" aria-pressed={selected} onClick={() => setSelectedGroupId(item.id)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]" : "border-[var(--border-subtle)] bg-[var(--surface-bg)] hover:border-[var(--border-strong)]"}`}>
              <Icon className="h-5 w-5 shrink-0 text-[var(--accent)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--text-primary)]">{item.carrier}</span>
                <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{item.service}</span>
              </span>
              <span className="shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)]">{item.zones.length} zonas</span>
            </button>
          )
        })}
      </div>

      <section aria-label={`Zonas ${group.carrier} — ${group.service}`} className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">{group.service}</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{group.description} <span className="font-medium">{countryCount} países e territórios.</span></p>
          </div>
          <div className="relative w-full sm:w-80">
            <label htmlFor="zone-country-search" className="sr-only">Pesquisar país, código ISO ou zona</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input id="zone-country-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar país, código ou zona..."
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-bg)] py-2.5 pl-9 pr-9 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]" />
            {search && <button type="button" aria-label="Limpar pesquisa" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"><X className="h-3.5 w-3.5" /></button>}
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)]" role="status">{visibleZones.length} de {group.zones.length} zonas · {resultCount} países e territórios apresentados</p>

        {visibleZones.length ? (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {visibleZones.map(zone => (
              <section key={`${group.id}-${zone.code}`} aria-label={`${group.carrier} — ${zone.code}`} className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                  <div><h3 className="text-sm font-semibold text-[var(--text-primary)]">{zone.code}</h3><p className="mt-0.5 text-xs text-[var(--text-secondary)]">{zone.name}</p></div>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--text-secondary)]">{zone.countries.length} destinos</span>
                </div>
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">Países e territórios da {zone.code} — {group.carrier}</caption>
                  <thead className="border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                    <tr><th scope="col" className="px-4 py-2.5 font-medium">País / território</th><th scope="col" className="w-24 px-4 py-2.5 text-right font-medium">Código ISO</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {zone.countries.map(country => <tr key={country.code} className="hover:bg-[var(--surface-muted)]/50">
                      <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{country.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[var(--text-secondary)]">{country.code}</td>
                    </tr>)}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-bg)] px-5 py-10 text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">Nenhum destino encontrado</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Pesquise outro país, código ISO ou zona, ou selecione outro serviço de transporte.</p>
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">A cobertura apresentada segue as tabelas de transporte de cada serviço. Os serviços autorizados, os escalões de peso e os preços de cada cliente são definidos em Tabelas de preços e serviços.</p>
      </section>
    </div>
  )
}
