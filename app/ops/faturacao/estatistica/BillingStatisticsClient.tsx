"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BarChart3, Download, RefreshCw, FileText, CheckCircle2, Clock, AlertCircle, ArrowRight, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { billingStatisticsCsv, filterStatisticsInvoices, summarizeBillingStatistics, type BillingStatisticsData, type BillingStatisticsFilters } from "@/lib/billing/statistics"

const money = (cents: number) => (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-PT", { timeZone: "UTC" })
const monthLabel = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-PT", { month: "short", year: "2-digit", timeZone: "UTC" })
const panel = "rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-sm"
const input = "min-h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#155EEF]"
const agingColors = ["#007F8B", "#B45309", "#D3483A", "#A52A35", "#667085"]

export function BillingStatisticsClient({ data }: { data: BillingStatisticsData }) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [filters, setFilters] = useState<BillingStatisticsFilters>({ start: `${data.today.slice(0, 4)}-01-01`, end: data.today, client: "", state: "all" })
  const [page, setPage] = useState(1)
  const [showAllClients, setShowAllClients] = useState(false)
  const setFilter = <K extends keyof BillingStatisticsFilters>(key: K, value: BillingStatisticsFilters[K]) => {
    setFilters(previous => ({ ...previous, [key]: value })); setPage(1)
  }
  const invalidRange = Boolean(filters.start && filters.end && filters.start > filters.end)
  const selected = useMemo(() => invalidRange ? [] : filterStatisticsInvoices(data.invoices, filters), [data.invoices, filters, invalidRange])
  const summary = useMemo(() => summarizeBillingStatistics(selected, data.today, filters.start, filters.end), [selected, data.today, filters.start, filters.end])
  const clientOptions = useMemo(() => [...new Map(data.invoices.map(invoice => [invoice.clientKey, { key: invoice.clientKey, name: invoice.clientName, vat: invoice.clientVat }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-PT")), [data.invoices])
  const ordered = useMemo(() => [...selected].sort((a, b) => b.issuedDate.localeCompare(a.issuedDate) || a.reference.localeCompare(b.reference)), [selected])
  const pages = Math.max(1, Math.ceil(ordered.length / 10)), activePage = Math.min(page, pages)
  const visibleInvoices = ordered.slice((activePage - 1) * 10, activePage * 10)
  const unknownDue = selected.filter(invoice => !invoice.paid && !invoice.dueDate).length
  const reviewReceipts = selected.filter(invoice => invoice.receiptNeedsReview).length
  const chartMonths = summary.months.map(month => ({ ...month, billed: !month.known && month.missing ? null : month.billed, paid: !month.known && month.missing ? null : month.paid }))
  const knownAmounts = selected.length - summary.totals.missingAmounts
  const cards = [
    { label: "Faturado", value: summary.totals.billed, note: `${selected.length} fatura(s) registada(s)`, color: "#155EEF", Icon: FileText },
    { label: "Liquidado no TMS", value: summary.totals.paid, note: "Recibo ou estado pago registado", color: "#008A4B", Icon: CheckCircle2 },
    { label: "Por liquidar", value: summary.totals.open, note: "Sem liquidação registada", color: "#007F8B", Icon: Clock },
    { label: "Vencido", value: summary.totals.overdue, note: "Prazo registado anterior a hoje", color: "#C2413B", Icon: AlertCircle },
  ]
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([billingStatisticsCsv(selected)], { type: "text/csv;charset=utf-8;" }))
    const link = document.createElement("a")
    link.href = url; link.download = `Faturacao_${filters.start || "inicio"}_${filters.end || data.today}.csv`
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
  }
  function preset(start: string) { setFilters(previous => ({ ...previous, start, end: data.today })); setPage(1) }

  return <div className="mx-auto max-w-[1600px] space-y-5 pb-8 text-[var(--text-primary)]">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#155EEF] text-white"><BarChart3 aria-hidden="true" className="h-5 w-5" /></span>
        <div><h1 className="text-2xl font-bold tracking-tight">Estatísticas de Faturação</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Transporte e serviços avulsos · Valores sem IVA · Liquidação atual no TMS</p></div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => startRefresh(() => router.refresh())} disabled={refreshing} className={`${input} inline-flex items-center gap-2 disabled:opacity-50`}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Atualizar</button>
        <button onClick={exportCsv} disabled={!selected.length || invalidRange} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#155EEF] px-4 text-sm font-semibold text-white hover:bg-[#124BC0] disabled:opacity-50"><Download aria-hidden="true" className="h-4 w-4" />Exportar CSV</button>
      </div>
    </header>

    <section aria-label="Filtros da faturação" className={`${panel} p-4`}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium">Emitidas desde<input aria-label="Emitidas desde" type="date" value={filters.start} max={filters.end || undefined} onChange={e => setFilter("start", e.target.value)} className={input} /></label>
        <label className="flex flex-col gap-1.5 text-xs font-medium">Até<input aria-label="Emitidas até" type="date" value={filters.end} min={filters.start || undefined} max={data.today} onChange={e => setFilter("end", e.target.value)} className={input} /></label>
        <label className="flex w-full min-w-0 flex-col gap-1.5 text-xs font-medium sm:w-auto sm:min-w-48 sm:flex-1">Cliente<select value={filters.client} onChange={e => setFilter("client", e.target.value)} className={`${input} w-full min-w-0`}><option value="">Todos os clientes</option>{clientOptions.map(client => <option key={client.key} value={client.key}>{client.name}{client.vat ? ` · ${client.vat}` : ""}</option>)}</select></label>
        <label className="flex flex-col gap-1.5 text-xs font-medium">Estado no TMS<select value={filters.state} onChange={e => setFilter("state", e.target.value as BillingStatisticsFilters["state"])} className={input}><option value="all">Todos os estados</option><option value="paid">Liquidadas</option><option value="open">Por liquidar</option><option value="overdue">Vencidas</option></select></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {[{ label: "Este mês", start: `${data.today.slice(0, 7)}-01` }, { label: "Este ano", start: `${data.today.slice(0, 4)}-01-01` }, { label: "Todo o histórico", start: "" }].map(item => <button key={item.label} onClick={() => preset(item.start)} aria-pressed={filters.start === item.start && filters.end === data.today} className={`rounded-md border px-3 py-1.5 font-medium ${filters.start === item.start && filters.end === data.today ? "border-[#155EEF] bg-[#155EEF] text-white" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"}`}>{item.label}</button>)}
        <span className="ml-auto text-[var(--text-tertiary)]">Atualizado às {new Date(data.updatedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" })} · Lisboa</span>
      </div>
      {invalidRange && <p role="alert" className="mt-3 text-sm text-[#C2413B]">A data final deve ser igual ou posterior à data inicial.</p>}
    </section>

    <section aria-label="Totais do período selecionado" className="grid grid-cols-2 divide-x divide-y divide-[var(--border-subtle)] overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] xl:grid-cols-4 xl:divide-y-0">
      {cards.map(({ label, value, note, color, Icon }) => <div key={label} className="min-w-0 border-t-4 p-4 sm:p-5" style={{ borderTopColor: color }}>
        <div className="flex items-center gap-2.5 text-sm font-medium text-[var(--text-primary)]"><span style={{ backgroundColor: color }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white"><Icon aria-hidden="true" className="h-4 w-4" /></span><h2 className="truncate">{label}</h2></div>
        <p className="mt-3 break-words text-2xl font-semibold leading-none tracking-tight tabular-nums">{selected.length && !knownAmounts ? "Sem dados" : money(value)}</p><p className="mt-2 text-xs text-[var(--text-tertiary)]">{note}</p>
      </div>)}
    </section>
    {(unknownDue > 0 || summary.totals.missingAmounts > 0 || data.cyclesUnavailable || reviewReceipts > 0) && <div role="status" className={`${panel} flex items-start gap-2 px-4 py-3 text-xs text-[var(--text-secondary)]`}><AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" /><div>
      {reviewReceipts > 0 && <p>{reviewReceipts} fatura(s) com o próprio PDF guardado como recibo. Sem outra confirmação, ficam por liquidar nesta análise; confirme o pagamento.</p>}
      {unknownDue > 0 && <p>{unknownDue} fatura(s) por liquidar sem vencimento registado; o valor fica fora do total vencido.</p>}
      {summary.totals.missingAmounts > 0 && <p>{summary.totals.missingAmounts} fatura(s) sem valor líquido conhecido; aparecem na lista e ficam fora dos totais monetários.</p>}
      {data.cyclesUnavailable && <p>Os vencimentos dos ciclos automáticos estão indisponíveis; são usados apenas os prazos guardados nas faturas.</p>}
    </div></div>}

    {!selected.length ? <div className={`${panel} p-10 text-center`}><FileText className="mx-auto mb-3 h-8 w-8 text-[var(--text-tertiary)]" /><h2 className="font-semibold">Sem faturas neste filtro</h2><p className="mt-2 text-sm text-[var(--text-secondary)]">Experimente outro período ou cliente. Os totais incluem faturas com emissão Moloni registada.</p></div> : <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className={`${panel} min-w-0 p-4 sm:p-5`}>
          <h2 className="text-sm font-semibold">Faturado e liquidado por mês de emissão</h2>
          <p className="mb-4 mt-1 text-xs text-[var(--text-secondary)]">Liquidação atual das faturas de cada mês; não representa a data do pagamento.</p>
          <div className="h-72 w-full overflow-hidden" role="img" aria-label="Gráfico mensal dos valores faturados e liquidados sem IVA">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={chartMonths} margin={{ top: 10, right: 5, left: 0, bottom: 4 }} accessibilityLayer>
              <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: "var(--text-secondary)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis width={65} tickFormatter={value => `${(Number(value) / 100).toLocaleString("pt-PT", { notation: "compact" })} €`} tick={{ fill: "var(--text-secondary)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "var(--surface-muted)" }} labelFormatter={value => monthLabel(String(value))} formatter={value => money(Number(value))} contentStyle={{ background: "var(--surface-bg)", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="billed" name="Faturado" fill="#155EEF" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="paid" name="Liquidado no TMS" fill="#008A4B" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart></ResponsiveContainer>
          </div>
          <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium text-[var(--text-secondary)]">Ver valores mensais</summary><div className="mt-2 overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="py-2">Mês</th><th className="text-right">Faturado</th><th className="text-right">Liquidado</th></tr></thead><tbody>{summary.months.map(month => <tr key={month.month} className="border-t border-[var(--border-subtle)]"><td className="py-2">{monthLabel(month.month)}</td><td className="text-right tabular-nums">{!month.known && month.missing ? "Sem dados" : money(month.billed)}</td><td className="text-right tabular-nums">{!month.known && month.missing ? "Sem dados" : money(month.paid)}</td></tr>)}</tbody></table></div></details>
        </section>
        <section className={`${panel} p-4 sm:p-5`}>
          <h2 className="text-sm font-semibold">Antiguidade do valor por liquidar</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">Situação em {dateLabel(data.today)} · Sem IVA</p>
          <div className="mt-6 space-y-5">{summary.aging.map((bucket, index) => <div key={bucket.id}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span>{bucket.label}<span className="ml-1 text-[var(--text-tertiary)]">({bucket.count})</span></span><strong className="whitespace-nowrap tabular-nums">{money(bucket.amount)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full" style={{ backgroundColor: agingColors[index], width: `${summary.totals.open ? bucket.amount / summary.totals.open * 100 : 0}%` }} /></div></div>)}</div>
        </section>
      </div>

      <section className={`${panel} relative overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4"><h2 className="text-sm font-semibold">Faturação por cliente <span className="ml-1 text-xs font-normal text-[var(--text-tertiary)]">({summary.clients.length})</span></h2><span className="text-xs text-[var(--text-secondary)]">Ordenado pelo valor por liquidar · Sem IVA</span></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]"><tr><th className="px-5 py-3">Cliente</th><th className="px-4 py-3 text-right">Faturas</th><th className="px-4 py-3 text-right">Faturado</th><th className="px-4 py-3 text-right">Liquidado</th><th className="px-4 py-3 text-right">Por liquidar</th><th className="px-4 py-3 text-right">Vencido</th><th className="px-4 py-3"><span className="sr-only">Consultar</span></th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{(showAllClients ? summary.clients : summary.clients.slice(0, 8)).map(client => <tr key={client.key} className="hover:bg-[var(--surface-muted)]"><td className="px-5 py-3"><div className="font-semibold">{client.name}</div><div className="mt-0.5 text-[var(--text-tertiary)]">{client.vat || "Sem NIF registado"}{client.missing ? ` · ${client.missing} sem valor líquido` : ""}</div></td><td className="px-4 py-3 text-right">{client.count}</td>{[client.billed, client.paid, client.open, client.overdue].map((value, index) => <td key={index} className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${index === 3 && value > 0 ? "font-semibold text-[#C2413B]" : ""}`}>{client.count === client.missing ? "Sem dados" : money(value)}</td>)}<td className="px-4 py-3"><button onClick={() => setFilter("client", client.key)} aria-label={`Ver documentos de ${client.name}`} className="rounded-md p-2 text-[#155EEF] hover:bg-[var(--surface-muted)]"><ArrowRight className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
        {summary.clients.length > 8 && <button onClick={() => setShowAllClients(!showAllClients)} className="m-4 text-xs font-semibold text-[#155EEF]">{showAllClients ? "Mostrar menos" : `Ver os ${summary.clients.length} clientes`}</button>}
      </section>

      <section className={`${panel} relative overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4"><h2 className="text-sm font-semibold">Documentos do período <span className="ml-1 text-xs font-normal text-[var(--text-tertiary)]">({selected.length})</span></h2><div className="flex gap-4 text-xs font-medium text-[#155EEF]"><Link href="/ops/faturacao/contas-corrente">Contas correntes</Link><Link href="/ops/faturacao/clientes">Faturas avulsas</Link></div></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]"><tr><th className="px-5 py-3">Fatura / referência</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Emissão / registo</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Estado no TMS</th><th className="px-4 py-3 text-right">Sem IVA</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{visibleInvoices.map(invoice => <tr key={invoice.id} className="hover:bg-[var(--surface-muted)]"><td className="px-5 py-3"><div className="font-semibold">{invoice.pdfUrl ? <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#155EEF]">{invoice.reference}<ExternalLink aria-hidden="true" className="h-3 w-3" /></a> : invoice.reference}</div><div className="mt-1 text-[var(--text-tertiary)]">{invoice.kind === "transport" ? "Transporte" : "Serviço avulso"}</div></td><td className="px-4 py-3">{invoice.clientName}</td><td className="whitespace-nowrap px-4 py-3">{dateLabel(invoice.issuedDate)}</td><td className="whitespace-nowrap px-4 py-3">{invoice.dueDate ? dateLabel(invoice.dueDate) : "Sem prazo registado"}</td><td className="px-4 py-3"><span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold text-white" style={{ backgroundColor: invoice.state === "paid" ? "#008A4B" : invoice.state === "overdue" ? "#C2413B" : "#007F8B" }}>{invoice.state === "paid" ? "Liquidada" : invoice.state === "overdue" ? "Vencida" : "Por liquidar"}</span>{invoice.receiptNeedsReview && <p className="mt-1 text-[10px] text-[#B45309]">Recibo por confirmar</p>}</td><td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{invoice.amountCents === null ? "Sem dados" : money(invoice.amountCents)}</td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-5 py-3 text-xs text-[var(--text-secondary)]"><span>Página {activePage} de {pages}</span><div className="flex gap-2"><button aria-label="Página anterior" disabled={activePage <= 1} onClick={() => setPage(activePage - 1)} className="rounded-md border border-[var(--border-subtle)] p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button><button aria-label="Página seguinte" disabled={activePage >= pages} onClick={() => setPage(activePage + 1)} className="rounded-md border border-[var(--border-subtle)] p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button></div></div>
      </section>
    </>}

    <details className={`${panel} p-4 text-xs text-[var(--text-secondary)]`}><summary className="cursor-pointer font-semibold">Como são calculados estes valores</summary><div className="mt-3 space-y-2 leading-relaxed">
      <p>Fonte: faturas de transporte e faturas avulsas registadas no TMS com identificação Moloni. Cada documento fiscal conta uma vez. Extratos internos, pró-formas e tentativas sem confirmação ficam fora da faturação.</p>
      <p>Valores sem IVA: preço líquido guardado no TMS. Faturado = liquidado + por liquidar; vencido é a parte por liquidar com data de vencimento anterior a hoje. Os filtros usam a data de emissão ou, quando falta, a data de registo.</p>
      <p>Liquidado significa recibo ou estado pago guardado no TMS. Um PDF de recibo igual à fatura, sem ID de recibo ou estado pago, requer confirmação e não prova liquidação. Pagamentos parciais e alterações feitas apenas no Moloni podem não estar refletidos. O gráfico usa o mês de emissão das faturas, porque os registos antigos nem sempre guardam a data do pagamento.</p>
      <p>Sem vencimento guardado, o documento não é classificado como vencido. Faturas avulsas sem cliente associado são agrupadas por NIF válido; sem identidade segura, aparecem individualmente.</p>
      <p>{data.coverage.internal} registo(s) interno(s), pró-forma ou anulado(s) excluído(s) · {data.coverage.duplicates} duplicado(s) ignorado(s) · {data.coverage.invalidDates} sem data válida · {data.coverage.registrationDates} fatura(s) com data de registo usada.</p>
    </div></details>
  </div>
}
