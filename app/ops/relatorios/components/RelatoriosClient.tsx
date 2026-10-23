"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, ArrowUpRight, CheckCircle2, Download, Lightbulb, Package, Printer, Truck } from "lucide-react"
import { RefreshIcon } from "@/components/ui/refresh-icon"
import { getRelatoriosDataAction } from "@/app/actions/relatorios"
import { REPORT_PERIODS } from "@/lib/reports/operational-reports"
import type { OperationalReport, ReportGroup } from "@/lib/reports/operational-reports"
import { reportCsv } from "@/lib/reports/report-csv"

const euro = (value: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value)
const timestamp = (value: string) => new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" }).format(new Date(value))
const dateOnly = (value: string) => new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short" }).format(new Date(value))
const panel = "rounded-2xl border border-slate-200 bg-white shadow-xs"
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
const tabs = [
  { id: "overview", label: "Visão geral" }, { id: "carriers", label: "Transportadoras" },
  { id: "clients", label: "Clientes" }, { id: "services", label: "Serviços" }, { id: "finance", label: "Financeiro" },
] as const

type Tab = typeof tabs[number]["id"]

function GroupTable({ groups, title, clients = false }: { groups: ReportGroup[]; title: string; clients?: boolean }) {
  return <section className={panel}>
    <div className="border-b border-slate-100 p-5">
      <h2 className="font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">Comparação de volume com a mesma duração no período anterior. Margem estimada com os preços guardados.</p>
    </div>
    {groups.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Sem envios para estes filtros.</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs">
        <thead className="bg-slate-50 text-slate-500"><tr>
          <th className="px-5 py-3">{clients ? "Cliente" : "Designação"}</th><th className="p-3">Envios</th>
          <th className="p-3">Anterior</th><th className="p-3">Variação</th><th className="p-3">Entregues</th>
          <th className="p-3">Em incidência</th><th className="p-3">Valor de venda</th><th className="p-3">Margem estimada</th><th className="p-3">Cobertura da margem</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">{groups.map(group => {
          const growth = group.previousVolume ? Math.round((group.volume - group.previousVolume) / group.previousVolume * 100) : null
          return <tr key={group.id} className="hover:bg-slate-50">
            <td className="px-5 py-4 font-semibold text-slate-800">{clients && group.id !== "unassigned" ?
              <Link className="hover:text-emerald-700" href={`/ops/entidades/clientes?search=${encodeURIComponent(group.name)}`}>{group.name}</Link> : group.name}</td>
            <td className="p-3 font-semibold">{group.volume}</td><td className="p-3">{group.previousVolume}</td>
            <td className="p-3 whitespace-nowrap">{growth === null ? (group.volume ? "Sem base anterior" : "—") : `${growth > 0 ? "+" : ""}${growth}%`}</td>
            <td className="p-3">{group.delivered}</td><td className="p-3">{group.incidents}</td>
            <td className="p-3 whitespace-nowrap">{euro(group.revenue)}</td>
            <td className={`p-3 whitespace-nowrap font-semibold ${group.margin < 0 ? "text-rose-700" : "text-emerald-700"}`}>{group.pricedCount ? euro(group.margin) : "Sem dados"}</td>
            <td className="p-3 text-slate-500">{group.pricedCount} de {group.volume} envios</td>
          </tr>
        })}</tbody>
      </table></div>}
  </section>
}

export function RelatoriosClient({ initialData }: { initialData: OperationalReport }) {
  const [data, setData] = React.useState(initialData)
  const [tab, setTab] = React.useState<Tab>("overview")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const requestId = React.useRef(0)
  const refresh = async (filters = data.filters) => {
    const id = ++requestId.current
    setLoading(true); setError("")
    try {
      const updated = await getRelatoriosDataAction(filters.period, { clientId: filters.clientId, carrier: filters.carrier, service: filters.service })
      if (id === requestId.current) setData(updated)
    } catch {
      if (id === requestId.current) setError("Não foi possível atualizar. Os dados abaixo mantêm o período e os filtros da última consulta concluída.")
    } finally { if (id === requestId.current) setLoading(false) }
  }
  const changeFilter = (key: "clientId" | "carrier" | "service", value: string) => refresh({ ...data.filters, [key]: value || undefined })
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob(["\uFEFF", reportCsv(data)], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url; link.download = `relatorios_linke_${data.filters.period}_${data.updatedAt.slice(0, 10)}.csv`
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
  }
  const t = data.totals
  const coverage = t.volume ? Math.round(t.pricedCount / t.volume * 100) : 0
  const maxVolume = Math.max(1, ...data.timeline.map(day => day.volume))
  const hasExtraFilters = Boolean(data.filters.clientId || data.filters.carrier || data.filters.service)
  const filters: { key: "clientId" | "carrier" | "service"; label: string; options: { id: string; name: string }[] }[] = [
    { key: "clientId", label: "Cliente", options: data.options.clients },
    { key: "carrier", label: "Transportadora", options: data.options.carriers.map(name => ({ id: name, name })) },
    { key: "service", label: "Serviço", options: data.options.services.map(name => ({ id: name, name })) },
  ]
  return <div className="space-y-5 pb-12">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Relatórios da operação</h1>
        <p className="mt-1 text-sm text-slate-500">Envios, clientes e margem estimada a partir dos registos do TMS.</p>
        <p className="mt-2 text-xs text-slate-500">Atualizado em {timestamp(data.updatedAt)} · Hora de Lisboa</p></div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <button className={button} disabled={loading} onClick={() => refresh()}><RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{loading ? "A atualizar…" : "Atualizar"}</button>
        <button className={button} disabled={loading} onClick={exportCsv}><Download className="h-4 w-4" />Exportar CSV</button>
        <button className={button} disabled={loading} onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir</button>
      </div>
    </header>
    <section className={`${panel} space-y-4 p-4 print:hidden`} aria-label="Filtros do relatório">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Filtros do relatório</h2>
        <p className="mt-0.5 text-xs text-slate-500">Escolhe o período e, se necessário, filtra por cliente, transportadora ou serviço.</p>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Período</p>
        <div className="flex flex-wrap gap-2" aria-label="Período do relatório">{REPORT_PERIODS.map(period =>
          <button key={period.id} disabled={loading} aria-pressed={data.filters.period === period.id}
            className={`${button} ${data.filters.period === period.id ? "border-emerald-700 bg-emerald-50 text-emerald-800" : ""}`}
            onClick={() => refresh({ period: period.id })}>{period.label}</button>)}</div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Detalhar resultados</p>
        <div className="grid gap-3 sm:grid-cols-3">{filters.map(filter => <label key={filter.key} className="space-y-1.5 text-xs font-semibold text-slate-600">
          <span>{filter.label}</span><select aria-label={filter.label} disabled={loading} value={data.filters[filter.key] || ""}
            onChange={event => changeFilter(filter.key, event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-slate-800">
            <option value="">Todos</option>{filter.options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select></label>)}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Envios criados entre {timestamp(data.range.start)} e {timestamp(data.range.end)}.</span>
        {hasExtraFilters && <button className="font-semibold text-emerald-700 disabled:opacity-50" disabled={loading} onClick={() => refresh({ period: data.filters.period })}>Limpar filtros adicionais</button>}
      </div>
    </section>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    <nav aria-label="Secções dos relatórios" className="flex flex-wrap gap-2 print:hidden">{tabs.map(item => <button key={item.id} aria-pressed={tab === item.id}
      className={`${button} ${tab === item.id ? "bg-slate-900 text-white hover:bg-slate-800" : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
    <main aria-busy={loading} className={`space-y-5 ${loading ? "opacity-60" : ""}`}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Envios no período", value: String(t.volume), detail: `${t.delivered} entregues · ${t.inTransit} em trânsito`, icon: Package },
          { label: "Valor de venda dos envios", value: t.volume > t.missingSellCount ? euro(t.revenue) : "Sem dados", detail: `${t.volume - t.missingSellCount} de ${t.volume} com preço válido`, icon: Truck },
          { label: "Custo previsto guardado", value: t.volume > t.missingCostCount ? euro(t.cost) : "Sem dados", detail: `${t.volume - t.missingCostCount} de ${t.volume} com custo válido`, icon: CheckCircle2 },
          { label: "Margem estimada", value: t.pricedCount ? euro(t.margin) : "Sem dados", detail: `${t.pricedCount} de ${t.volume} envios · ${coverage}% de cobertura`, icon: Lightbulb },
        ].map(card => <section key={card.label} className={`${panel} p-5`}>
          <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-semibold text-slate-500">{card.label}</h2><card.icon className="h-4 w-4 text-emerald-700" /></div>
          <p className={`mt-3 text-2xl font-bold ${card.label === "Margem estimada" && t.margin < 0 ? "text-rose-700" : "text-slate-900"}`}>{card.value}</p>
          <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
        </section>)}
      </div>
      <details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-800">Como interpretar os indicadores</summary>
        <p className="mt-2 leading-relaxed">Excluímos {data.excluded.drafts} rascunhos e {data.excluded.cancelled} envios anulados/cancelados. O valor de venda não confirma faturação nem recebimento. A margem é estimada com envios que têm venda e custo válidos, incluindo perdas, e deve ser conferida com as faturas das transportadoras.</p>
      </details>
      {tab === "overview" && <>
        <section className={`${panel} p-5`}>
        <div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-600" /><h2 className="font-bold text-slate-900">Sugestões para a operação</h2></div>
        <p className="mt-1 text-xs text-slate-500">Baseadas no período e nos filtros selecionados. As decisões continuam contigo.</p>
        {data.suggestions.length === 0 ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{t.volume ? "Nenhum alerta pelas regras atuais. Isto não substitui a revisão dos envios e dos custos." : "Sem envios neste período para gerar sugestões."}</p> :
          <div className="mt-4 grid gap-3 md:grid-cols-2">{data.suggestions.map(s => <article key={s.id} className={`rounded-xl border p-4 ${s.priority === "atenção" ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/40"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.priority}</p><h3 className="mt-1 text-sm font-bold text-slate-900">{s.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{s.detail}</p>
            <Link href={s.href} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-800">{s.action}<ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </article>)}</div>}
        </section>
        <section className={`${panel} p-5`}>
        <h2 className="font-bold text-slate-900">Estado atual dos envios deste período</h2>
        <p className="mt-1 text-xs text-slate-500">Entrega confirmada não significa entrega dentro do prazo. Os estados refletem a última atualização guardada.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{[
          ["Entregues", t.delivered], ["Em trânsito", t.inTransit], ["Pendentes", t.pending], ["Em incidência", t.incidents], ["Devolvidos", t.returned], ["Outros estados", t.other],
        ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>)}</div>
        </section>
        <details className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold text-slate-800"><AlertTriangle className="h-4 w-4" />Indicadores que ainda não estão disponíveis</summary>
        <p className="mt-2 leading-relaxed">Entregas no prazo, primeira tentativa e tempo de resolução dependem dos eventos de tracking e dos prazos de cada serviço. O mapa de destinos depende de país e localidade guardados de forma consistente. Não apresentamos estimativas de demonstração para estes indicadores.</p>
        </details>
      </>}
      {tab === "finance" && <section className={`${panel} p-5`}>
        <h2 className="font-bold text-slate-900">Evolução dos envios</h2>
        <p className="mt-1 text-xs text-slate-500">Volume por dia de criação, no período selecionado. Dias sem envios ficam a zero.</p>
        <div className="mt-5 flex h-40 items-end gap-1 overflow-x-auto border-b border-slate-200" role="img" aria-label="Gráfico de volume diário; valores detalhados na tabela abaixo">
          {data.timeline.map(day => <div key={day.date} className="flex h-full min-w-5 flex-1 flex-col items-center justify-end gap-1" title={`${day.date}: ${day.volume} envios`}>
            <span className="text-[10px] text-slate-500">{day.volume || ""}</span><div className="w-full max-w-10 rounded-t bg-emerald-600" style={{ height: `${day.volume / maxVolume * 110}px` }} />
            <span className="pb-1 text-[9px] text-slate-500">{day.date.slice(-2)}</span></div>)}
        </div>
        <div className="mt-4 max-h-64 overflow-auto"><table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-white text-slate-500"><tr><th className="py-2">Dia</th><th>Envios</th><th>Margem estimada</th><th>Cobertura</th></tr></thead>
          <tbody>{data.timeline.map(day => <tr key={day.date} className="border-t border-slate-100"><td className="py-2">{dateOnly(`${day.date}T12:00:00Z`)}</td><td>{day.volume}</td>
            <td className={day.margin < 0 ? "text-rose-700" : "text-emerald-700"}>{day.pricedCount ? euro(day.margin) : "—"}</td><td>{day.pricedCount} de {day.volume}</td></tr>)}</tbody>
        </table></div>
      </section>}
      {tab === "carriers" && <><p className="text-xs text-slate-500">Período de comparação: {timestamp(data.range.previousStart)} até {timestamp(data.range.previousEnd)}. Sem volume anterior, não calculamos crescimento percentual.</p><GroupTable title="Comparação de transportadoras" groups={data.carriers} /></>}
      {tab === "clients" && <><p className="text-xs text-slate-500">Período de comparação: {timestamp(data.range.previousStart)} até {timestamp(data.range.previousEnd)}. Sem volume anterior, não calculamos crescimento percentual.</p><GroupTable title="Atividade dos clientes" groups={data.clients} clients /></>}
      {tab === "services" && <><p className="text-xs text-slate-500">Período de comparação: {timestamp(data.range.previousStart)} até {timestamp(data.range.previousEnd)}. Sem volume anterior, não calculamos crescimento percentual.</p><GroupTable title="Serviços utilizados" groups={data.services} /></>}
    </main>
  </div>
}
