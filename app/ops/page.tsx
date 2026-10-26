import * as React from "react"
import Link from "next/link"
import { 
  Package, 
  ClipboardList, 
  ReceiptEuro, 
  PieChart, 
  TrendingUp,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowRight,
  PlusCircle,
  Truck,
  AlertTriangle,
  Activity
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { createAdminClient } from "@/lib/supabase/server"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getClientesAction } from "@/app/actions/clientes"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { filterStatisticsInvoices, summarizeBillingStatistics } from "@/lib/billing/statistics"
import { loadBillingStatistics } from "@/lib/billing/statistics-data"

import { OpsDashboardClientSync } from "./components/OpsDashboardClientSync"
import { ProfitComparisonChart } from "./components/ProfitComparisonChart"
import { DateRangePicker } from "./components/DateRangePicker"
import { LatestNewsWidget } from "./components/LatestNewsWidget"
import { DashboardWidgets } from "./components/DashboardWidgets"
import { FloatingCalculatorWidget } from "./components/FloatingCalculatorWidget"
import { LocalWeather } from "./components/LocalWeather"
import { HeaderClockDate } from "./components/HeaderClockDate"
import { DashboardBillingPanel } from "./components/DashboardBillingPanel"
import { DashboardCalendarWidget } from "./components/DashboardCalendarWidget"
import { lisbonDate } from "@/lib/billing/recurring-periods"

function getMonthName(date: Date) {
  return date.toLocaleString('pt-PT', { month: 'long', year: 'numeric' })
}

export default async function OpsDashboardPage(props: { searchParams?: Promise<{ month?: string, year?: string, from?: string, to?: string }> }) {
  const searchParams = await props.searchParams || {}
  const supabase = createAdminClient()

  // Fetch real data from DB & persistent actions (share clients promise to avoid duplicate queries)
  const clientsPromise = getClientesAction()
  const [shipments, recolhasResult, clients, billingData] = await Promise.all([
    getShipmentsAction({ includeLabels: false }),
    supabase
      .from("recolhas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    clientsPromise,
    clientsPromise.then((loadedClients) => loadBillingStatistics(loadedClients)).catch(() => null)
  ])

  const recolhas = recolhasResult.data || []
  const billingStart = billingData ? `${billingData.today.slice(0, 4)}-01-01` : ""
  const billingInvoices = billingData
    ? filterStatisticsInvoices(billingData.invoices, { start: billingStart, end: billingData.today, client: "", state: "all" })
    : []
  const billingSummary = billingData ? summarizeBillingStatistics(
    billingInvoices, billingData.today, billingStart, billingData.today
  ) : null
  const orderedBillingInvoices = [...billingInvoices]
    .sort((a, b) => b.issuedDate.localeCompare(a.issuedDate) || b.id.localeCompare(a.id, "en", { numeric: true }))
  const recentBillingInvoices = {
    billed: orderedBillingInvoices.slice(0, 3),
    paid: orderedBillingInvoices.filter(invoice => invoice.paid).slice(0, 3),
    open: orderedBillingInvoices.filter(invoice => !invoice.paid && invoice.state !== "credited").slice(0, 3),
    overdue: orderedBillingInvoices.filter(invoice => invoice.state === "overdue").slice(0, 3),
  }

  // Create client map
  const clientMap = new Map<string, string>()
  clients.forEach((c: any) => {
    clientMap.set(c.id, c.short_name || c.legal_name || c.name)
    if (c.code) clientMap.set(c.code, c.short_name || c.legal_name)
  })

  // Date bounds for selected or current month
  const now = new Date()
  let targetMonth = now.getMonth()
  let targetYear = now.getFullYear()
  
  let currentMonthStart = new Date(targetYear, targetMonth, 1)
  let currentMonthEnd = new Date(targetYear, targetMonth + 1, 0)
  
  if (searchParams.month && searchParams.year) {
    const m = parseInt(searchParams.month, 10)
    const y = parseInt(searchParams.year, 10)
    if (!isNaN(m) && !isNaN(y)) {
      targetMonth = m
      targetYear = y
      currentMonthStart = new Date(targetYear, targetMonth, 1)
      currentMonthEnd = new Date(targetYear, targetMonth + 1, 0)
    }
  }

  const isCustomRange = Boolean(searchParams.from && searchParams.to)
  if (isCustomRange) {
    currentMonthStart = new Date(searchParams.from!)
    currentMonthEnd = new Date(searchParams.to!)
    currentMonthEnd.setHours(23, 59, 59, 999) // end of the day
  }
  
  const targetDate = new Date(targetYear, targetMonth, 1)
  
  // Filter shipments for KPIs to ONLY the target month/range
  const currentMonthShipments = shipments.filter((s: any) => {
    const d = new Date(s.created_at)
    return d >= currentMonthStart && d <= currentMonthEnd
  })
  
  const motherAccountId = clients.find((c: any) => c.code === "CL001")?.id
  const clientShipments = motherAccountId 
    ? shipments.filter((s: any) => s.client_id !== motherAccountId)
    : shipments
    
  const currentMonthClientShipments = clientShipments.filter((s: any) => {
    const d = new Date(s.created_at)
    return d >= currentMonthStart && d <= currentMonthEnd
  })

  const totalShipments = currentMonthShipments.length
  const pendingRecolhas = recolhas.filter((r: any) => r.status === "pendente" || r.status === "rascunho").length
  
  const clientRevenue = currentMonthClientShipments.reduce((acc: number, s: any) => acc + (Number(s.sell_price) || 0), 0)
  const clientCost = currentMonthClientShipments.reduce((acc: number, s: any) => acc + (Number(s.buy_price) || 0), 0)
  const clientMargin = clientRevenue - clientCost

  const deliveredShipments = currentMonthShipments.filter((s: any) => s.status === "entregue")
  const deliveredCount = deliveredShipments.length
  const deliveryRate = totalShipments > 0 ? Math.round((deliveredCount / totalShipments) * 100) : 0

  // Calculate Avg Transit Time (days)
  let totalTransitDays = 0
  deliveredShipments.forEach((s: any) => {
    const created = new Date(s.created_at)
    const updated = new Date(s.updated_at || s.created_at)
    const diffTime = Math.abs(updated.getTime() - created.getTime())
    const diffDays = diffTime / (1000 * 60 * 60 * 24)
    totalTransitDays += diffDays
  })
  const avgTransitTime = deliveredCount > 0 ? (totalTransitDays / deliveredCount).toFixed(1) : "0"

  // Check for incidents in delivered shipments to calculate 1st attempt rate
  const deliveredIds = deliveredShipments.map((s: any) => s.id)
  let deliveredWithIncidents = 0
  if (deliveredIds.length > 0) {
    // Chunk the IN() list: thousands of ids in one request exceed the PostgREST URL limit
    const CHUNK = 200
    const incidentShipmentIds = new Set<string>()
    const chunks: string[][] = []
    for (let i = 0; i < deliveredIds.length; i += CHUNK) chunks.push(deliveredIds.slice(i, i + CHUNK))
    const results = await Promise.all(
      chunks.map((ids) =>
        supabase
          .from("tracking_events")
          .select("shipment_id")
          .in("shipment_id", ids)
          .in("event_code", ["EMH", "EMN", "EDF"])
      )
    )
    results.forEach(({ data }) => (data || []).forEach((e: any) => incidentShipmentIds.add(e.shipment_id)))
    deliveredWithIncidents = incidentShipmentIds.size
  }
  const firstAttemptCount = deliveredCount - deliveredWithIncidents
  const firstAttemptRate = deliveredCount > 0 ? Math.round((firstAttemptCount / deliveredCount) * 100) : 0

  // Breakdown by status
  const statusCounts = {
    pendente: 0,
    em_transito: 0,
    em_distribuicao: 0,
    incidencia: 0,
    entregue: deliveredCount,
    devolvido: 0
  }
  currentMonthShipments.forEach((s: any) => {
    if (s.status === "pendente" || s.status === "rascunho") statusCounts.pendente++
    else if (s.status === "em transito" || s.status === "em_transito") statusCounts.em_transito++
    else if (s.status === "em_distribuicao") statusCounts.em_distribuicao++
    else if (s.status === "incidencia") statusCounts.incidencia++
    else if (s.status === "devolvido") statusCounts.devolvido++
  })

  // Profit Chart Data (Accumulated by Day for 4 months)
  const chartData: any[] = []
  const monthData: Record<number, number[]> = {}
  
  for (let i = 0; i < 4; i++) {
    monthData[i] = new Array(31).fill(0)
    const mStart = new Date(targetDate.getFullYear(), targetDate.getMonth() - i, 1)
    const mEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() - i + 1, 0)
    
    // Group client shipments by day for this month
    const mShipments = clientShipments.filter((s: any) => {
      const d = new Date(s.created_at)
      return d >= mStart && d <= mEnd
    })
    
    mShipments.forEach((s: any) => {
      const day = new Date(s.created_at).getDate()
      const profit = (Number(s.sell_price) || 0) - (Number(s.buy_price) || 0)
      monthData[i][day - 1] += profit
    })
    
    // Accumulate
    let sum = 0
    for (let day = 0; day < 31; day++) {
      sum += monthData[i][day]
      monthData[i][day] = sum
    }
  }
  
  // If target is current month, only show actual up to today. Otherwise, show full month.
  const isCurrentMonth = targetMonth === now.getMonth() && targetYear === now.getFullYear()
  const cutoffDay = isCurrentMonth ? now.getDate() : 31
  
  for (let day = 1; day <= 31; day++) {
    chartData.push({
      day,
      actual: day <= cutoffDay ? monthData[0][day - 1] : null,
      prev1: monthData[1][day - 1],
      prev2: monthData[2][day - 1],
      prev3: monthData[3][day - 1]
    })
  }

  const stats = [
    { 
      label: "Envios Registados", 
      value: totalShipments.toLocaleString("pt-PT"), 
      icon: Package, 
      subtext: `${deliveredCount} entregues` 
    },
    { 
      label: "Entregas à 1ª", 
      value: `${firstAttemptRate}%`, 
      icon: CheckCircle2, 
      subtext: `${firstAttemptCount} envios sem incidência` 
    },
    { 
      label: "Tempo Médio", 
      value: `${avgTransitTime}d`, 
      icon: Clock, 
      subtext: "Tempo médio de trânsito" 
    },
    { 
      label: "Taxa de Entrega", 
      value: `${deliveryRate}%`, 
      icon: PieChart, 
      subtext: totalShipments > 0 ? `${deliveredCount} de ${totalShipments} envios` : "Sem envios finalizados" 
    },
    {
      label: "Receitas",
      value: `${clientRevenue.toFixed(2)}€`,
      icon: ReceiptEuro,
      subtext: "Total faturado"
    },
    {
      label: "Margem",
      value: `${clientMargin.toFixed(2)}€`,
      icon: TrendingUp,
      subtext: "Lucro estimado"
    },
  ]

  const recentShipments = shipments.slice(0, 5)
  const latestActiveShipment = shipments.find((s: any) => s.status !== "entregue" && s.status !== "devolvido") || shipments[0] || null

  const activeIds = shipments
    .filter((s: any) => s.status !== "entregue" && s.status !== "devolvido" && s.status !== "cancelado")
    .map((s: any) => s.id)

  const primaryStats = [
    { ...stats[4], color: "#155EEF" },
    { ...stats[5], color: "#008A4B" },
    { ...stats[0], color: "#FA8072" },
    { ...stats[3], color: "#007F8B" },
  ]
  const secondaryStats = [stats[1], stats[2]]

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
      <OpsDashboardClientSync activeIds={activeIds} />
      
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">Visão geral</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {isCustomRange ? "Resumo do período selecionado" : `Resumo de ${getMonthName(targetDate)}`}
            </p>
          </div>
          <LocalWeather />
          <HeaderClockDate />
          <FloatingCalculatorWidget placement="inline" />
          <DashboardCalendarWidget initialDate={lisbonDate(now)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker
            defaultFrom={isCustomRange ? searchParams.from! : currentMonthStart.toISOString().split('T')[0]}
            defaultTo={isCustomRange ? searchParams.to! : currentMonthEnd.toISOString().split('T')[0]}
          />
        </div>
      </header>

      <DashboardWidgets showClock={false} showLinkeMetrics={false} />

      <section aria-label="Indicadores principais" className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
        <div className="grid grid-cols-2 xl:grid-cols-4 divide-x divide-y xl:divide-y-0 divide-[var(--border-subtle)]">
          {primaryStats.map((stat) => (
            <div key={stat.label} className="min-w-0 border-t-4 p-4 sm:p-5" style={{ borderTopColor: stat.color }}>
              <div className="flex items-center gap-2.5 text-sm font-medium text-[var(--text-primary)]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: stat.color }}>
                  <stat.icon aria-hidden="true" className="w-4 h-4" strokeWidth={2} />
                </span>
                {stat.label}
              </div>
              <div className="mt-3 text-2xl sm:text-[28px] leading-none font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">
                {stat.value}
              </div>
              <p className="mt-2 text-xs text-[var(--text-tertiary)] truncate">{stat.subtext}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/60">
          {secondaryStats.map((stat, index) => (
            <div key={stat.label} className={`flex items-center justify-between gap-3 px-4 py-3 sm:px-5 ${index ? "border-l border-[var(--border-subtle)]" : ""}`}>
              <span className="text-xs text-[var(--text-secondary)]">{stat.label}</span>
              <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums">{stat.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Estado dos envios - Linha horizontal */}
      <section aria-label="Estado dos envios" className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
        <div className="flex flex-col lg:flex-row lg:items-center">
          <div className="px-4 py-2.5 lg:py-3 border-b lg:border-b-0 lg:border-r border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 shrink-0 flex items-center justify-between lg:justify-start gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#21734d] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Activity className="w-3.5 h-3.5" strokeWidth={2.2} />
            </span>
            <h2 className="text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap">Estado dos envios</h2>
            <span className="text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">· {getMonthName(targetDate)}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-[var(--border-subtle)] flex-1">
            {[
              { 
                label: "Pendentes", 
                value: statusCounts.pendente, 
                icon: Clock,
                badgeBg: "bg-amber-500",
                tone: "text-amber-600 dark:text-amber-400",
                href: "/ops/envios?status=Pendente"
              },
              { 
                label: "Em Trânsito", 
                value: statusCounts.em_transito, 
                icon: Truck,
                badgeBg: "bg-blue-600",
                tone: "text-blue-600 dark:text-blue-400",
                href: "/ops/envios?status=Em Trânsito"
              },
              { 
                label: "Em Distrib.", 
                value: statusCounts.em_distribuicao, 
                icon: MapPin,
                badgeBg: "bg-violet-600",
                tone: "text-violet-600 dark:text-violet-400",
                href: "/ops/envios?status=Em Distribuição"
              },
              { 
                label: "Incidências", 
                value: statusCounts.incidencia, 
                icon: AlertTriangle,
                badgeBg: "bg-rose-600",
                tone: "text-rose-600 dark:text-rose-400",
                href: "/ops/incidencias"
              },
              { 
                label: "Entregues", 
                value: statusCounts.entregue, 
                icon: CheckCircle2,
                badgeBg: "bg-emerald-600",
                tone: "text-emerald-600 dark:text-emerald-400",
                href: "/ops/envios?status=Entregue"
              },
              { 
                label: "Envios no mês", 
                value: totalShipments, 
                icon: Package,
                badgeBg: "bg-slate-700 dark:bg-slate-600",
                tone: "text-slate-900 dark:text-slate-100",
                href: "/ops/envios"
              }
            ].map((s, i) => (
              <Link
                key={i}
                href={s.href}
                className="group flex items-center justify-between gap-2.5 px-3.5 py-2.5 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 shadow-xs ${s.badgeBg} text-white`}>
                    <s.icon className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
                  </span>
                  <span className="text-xs font-semibold truncate text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">{s.label}</span>
                </div>
                <span className={`text-sm font-bold tabular-nums ${s.tone}`}>{s.value}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2 [&>div]:h-full">
          <ProfitComparisonChart data={chartData} targetMonth={targetDate.getMonth()} />
        </div>
        <DashboardBillingPanel totals={billingSummary?.totals ?? null} recent={recentBillingInvoices} />
      </div>

      {/* Table & Widgets Grid */}
      <div className="flex flex-col xl:flex-row gap-5">
        
        {/* Envios Recentes Table */}
        <div className="flex-[2] bg-[var(--surface-bg)] rounded-lg border border-[var(--border-subtle)] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Envios recentes</h2>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Últimos transportes registados</p>
            </div>
            <Link 
              href="/ops/envios" 
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-md transition-colors flex items-center gap-1.5 border border-blue-600"
            >
              Ver todos ({totalShipments}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentShipments.length === 0 ? (
            <div className="py-12 px-4 text-center bg-[var(--surface-muted)] rounded-lg border border-dashed border-[var(--border-strong)]">
              <Package className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3 opacity-50" />
              <p className="text-sm font-semibold text-[var(--text-secondary)]">Nenhum envio registado ainda</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-sm mx-auto">
                Crie novos envios através do módulo de operações ou através da Área de Cliente.
              </p>
              <Link 
                href="/ops/envios" 
                className="mt-4 inline-flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-md text-xs font-semibold transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Criar Envio
              </Link>
            </div>
          ) : (
            <div>
              {/* Mobile Cards View */}
              <div className="md:hidden divide-y divide-[var(--border-subtle)]">
                {recentShipments.map((envio: any) => {
                  const clientName = envio.sender_name || (envio.client_id && clientMap.get(envio.client_id)) || "Cliente Direto"
                  const isRealCtt = (val?: string) => val && /^(DA|DB|DD|EA|EQ|EG)/i.test(val.trim())
                  
                  const cttCode = isRealCtt(envio.ctt_object_id) 
                    ? envio.ctt_object_id 
                    : isRealCtt(envio.tracking_number) 
                    ? envio.tracking_number 
                    : envio.ctt_object_id

                  const linkeRef = (envio.reference?.startsWith("LTK") ? envio.reference : null)
                    || (envio.tracking_number?.startsWith("LTK") ? envio.tracking_number : null)
                    || (envio.ctt_label_base64?.match(/Ref:\s*(LTK\d+)/i)?.[1])
                    || envio.reference
                    || null

                  const displayRef = linkeRef || envio.tracking_number || envio.id
                  const secondaryCode = cttCode && cttCode !== displayRef ? cttCode : null
                  const carrierLogo = getCarrierLogo(envio.service_type || "ctt")

                  return (
                    <div key={envio.id} className="py-3 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-xs text-[var(--accent)] block truncate">
                            {displayRef}
                          </span>
                          {secondaryCode && (
                            <span className="text-[10px] text-[var(--text-tertiary)] block truncate">
                              CTT: {secondaryCode}
                            </span>
                          )}
                        </div>
                        <Badge variant={
                          envio.status === "entregue" ? "success" :
                          envio.status === "pendente" ? "warning" : "info"
                        } className="shrink-0 text-[10px]">
                          {envio.status === "em transito" ? "Em Trânsito" : 
                           envio.status.charAt(0).toUpperCase() + envio.status.slice(1)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--text-primary)] truncate">{clientName}</div>
                          <div className="text-[var(--text-tertiary)] truncate">Para: {envio.recipient_name || "Destinatário"}</div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {carrierLogo ? (
                            <div className="w-4 h-4 rounded bg-white border border-[var(--border-subtle)] p-0.5 flex items-center justify-center overflow-hidden shadow-2xs">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={carrierLogo} alt="Carrier" className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : null}
                          <span className="font-medium text-[var(--text-secondary)]">{envio.service_type || "CTT Expresso"}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]/60 text-[11px]">
                        <span className="font-mono font-bold text-[var(--text-primary)]">
                          {envio.sell_price ? `${Number(envio.sell_price).toFixed(2)}€` : "0.00€"}
                        </span>
                        <Link 
                          href={`/ops/envios?q=${encodeURIComponent(displayRef)}`}
                          className="font-bold text-[var(--accent)] hover:underline flex items-center gap-1"
                        >
                          Ver no Ops <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider">
                    <th className="pb-2.5">Guia / Ref</th>
                    <th className="pb-2.5">Cliente / Destinatário</th>
                    <th className="pb-2.5">Transportadora</th>
                    <th className="pb-2.5">Estado</th>
                    <th className="pb-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
                  {recentShipments.map((envio: any) => {
                    const clientName = envio.sender_name || (envio.client_id && clientMap.get(envio.client_id)) || "Cliente Direto"
                    const isRealCtt = (val?: string) => val && /^(DA|DB|DD|EA|EQ|EG)/i.test(val.trim())
                    
                    const cttCode = isRealCtt(envio.ctt_object_id) 
                      ? envio.ctt_object_id 
                      : isRealCtt(envio.tracking_number) 
                      ? envio.tracking_number 
                      : envio.ctt_object_id

                    const linkeRef = (envio.reference?.startsWith("LTK") ? envio.reference : null)
                      || (envio.tracking_number?.startsWith("LTK") ? envio.tracking_number : null)
                      || (envio.ctt_label_base64?.match(/Ref:\s*(LTK\d+)/i)?.[1])
                      || envio.reference
                      || null

                    const displayRef = linkeRef || envio.tracking_number || envio.id
                    const secondaryCode = cttCode && cttCode !== displayRef ? cttCode : null
                    const isCtt = envio.service_type?.includes("ctt") || !envio.service_type

                    return (
                      <tr key={envio.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                        <td className="py-3">
                          <div className="font-semibold text-[var(--text-primary)]">{displayRef}</div>
                          {secondaryCode && (
                            <div className="text-[10px] font-medium text-[var(--text-tertiary)] mt-0.5" title="Objeto CTT Expresso">
                              {secondaryCode}
                            </div>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="font-medium text-[var(--text-primary)]">{clientName}</div>
                          <div className="text-[11px] text-[var(--text-tertiary)] truncate max-w-[180px] mt-0.5">
                            Para: {envio.recipient_name || "Destinatário"}
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {getCarrierLogo(envio.service_type || "ctt") ? (
                              <div className="w-5 h-5 rounded bg-white border border-[var(--border-subtle)] p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                  src={getCarrierLogo(envio.service_type || "ctt")!} 
                                  alt={envio.service_type || "Transportadora"} 
                                  className="max-w-full max-h-full object-contain" 
                                />
                              </div>
                            ) : (
                              <span className={`w-2 h-2 rounded-full ${isCtt ? 'bg-[var(--status-critical)]' : 'bg-[var(--status-info)]'}`} />
                            )}
                            <span className="font-medium text-[var(--text-secondary)]">{envio.service_type || "CTT Expresso"}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge variant={
                            envio.status === "entregue" ? "success" :
                            envio.status === "pendente" ? "warning" : "info"
                          }>
                            {envio.status === "em transito" ? "Em Trânsito" : 
                             envio.status.charAt(0).toUpperCase() + envio.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="py-3 text-right font-medium text-[var(--text-primary)]">
                          {envio.sell_price ? `${Number(envio.sell_price).toFixed(2)}€` : "0.00€"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>

        {/* Right side - Rastreamento Widget */}
        <div className="flex-1 flex flex-col">
          <div className="bg-[var(--surface-bg)] rounded-lg border border-[var(--border-subtle)] p-5 flex-1 flex flex-col">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] text-base">Último rastreamento</h3>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">Estado mais recente</p>
                  </div>
                </div>
                <Link href="/ops/envios" className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
                  Ver envios <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {latestActiveShipment ? (() => {
                const latestLinkeRef = (latestActiveShipment.reference?.startsWith("LTK") ? latestActiveShipment.reference : null)
                  || (latestActiveShipment.tracking_number?.startsWith("LTK") ? latestActiveShipment.tracking_number : null)
                  || (latestActiveShipment.ctt_label_base64?.match(/Ref:\s*(LTK\d+)/i)?.[1])
                  || latestActiveShipment.reference
                  || latestActiveShipment.tracking_number
                  || latestActiveShipment.id

                const isRealCtt = (val?: string) => val && /^(DA|DB|DD|EA|EQ|EG)/i.test(val.trim())
                const cttCandidate = isRealCtt(latestActiveShipment.ctt_object_id) 
                  ? latestActiveShipment.ctt_object_id 
                  : isRealCtt(latestActiveShipment.tracking_number) 
                  ? latestActiveShipment.tracking_number 
                  : latestActiveShipment.ctt_object_id

                const latestCttCode = cttCandidate && cttCandidate !== latestLinkeRef ? cttCandidate : null

                return (
                <div className="space-y-4">
                  <div className="bg-[var(--surface-muted)] p-3 rounded-lg border border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-[var(--text-secondary)]">Guia:</span>
                      <div className="flex items-center gap-1.5">
                        {getCarrierLogo(latestActiveShipment.service_type || "ctt") ? (
                          <div className="w-4 h-4 rounded bg-white border border-[var(--border-subtle)] p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={getCarrierLogo(latestActiveShipment.service_type || "ctt")!} 
                              alt="Logo" 
                              className="max-w-full max-h-full object-contain" 
                            />
                          </div>
                        ) : null}
                        <span className="font-semibold text-[var(--status-info)]">
                          {latestLinkeRef}
                        </span>
                        {latestCttCode && (
                          <span className="text-[10px] font-medium text-[var(--text-secondary)] bg-[var(--surface-bg)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]" title="Objeto CTT Expresso">
                            {latestCttCode}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      Destino: <strong className="text-[var(--text-primary)]">{latestActiveShipment.recipient_name || "Destinatário"}</strong>
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 font-medium">
                      Serviço: <span>{latestActiveShipment.service_type || "CTT Expresso 24H"}</span>
                    </div>
                  </div>

                  {/* Dynamic Status Progression */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] mb-2">
                      <span>Progresso do Envio</span>
                      <Badge variant={
                        latestActiveShipment.status === "entregue" ? "success" :
                        latestActiveShipment.status === "pendente" ? "warning" : "info"
                      }>
                        {latestActiveShipment.status}
                      </Badge>
                    </div>

                    <div className="w-full bg-[var(--surface-muted)] rounded-full h-1.5 overflow-hidden border border-[var(--border-subtle)]">
                      <div 
                        className="bg-[var(--accent)] h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: latestActiveShipment.status === "entregue" ? "100%" :
                                 latestActiveShipment.status === "em transito" ? "65%" :
                                 latestActiveShipment.status === "pendente" ? "35%" : "15%"
                        }}
                      />
                    </div>
                  </div>
                </div>
                )
              })() : (
                <div className="py-8 text-center bg-[var(--surface-muted)] rounded-lg border border-dashed border-[var(--border-strong)] my-auto">
                  <Truck className="w-6 h-6 text-[var(--text-tertiary)] mx-auto mb-2 opacity-60" />
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">Sem envios ativos</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                    O acompanhamento do último envio ativo aparecerá aqui.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[var(--border-subtle)] mt-4">
              <Link 
                href="/ops/envios" 
                className="w-full py-2 bg-[var(--text-primary)] hover:bg-[#202420] text-white rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Aceder à Gestão de Envios</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
        
      </div>

      <section className="rounded-lg border border-[var(--border-subtle)] px-4 sm:px-5" style={{ backgroundColor: "color-mix(in srgb, var(--surface-bg) 86%, #B45309 14%)" }}>
        <LatestNewsWidget />
      </section>

    </div>
  )
}
