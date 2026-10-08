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
  Truck
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { createAdminClient } from "@/lib/supabase/server"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getClientesAction } from "@/app/actions/clientes"
import { getCarrierLogo } from "@/lib/carrier-logos"

import { OpsDashboardClientSync } from "./components/OpsDashboardClientSync"
import { ProfitComparisonChart } from "./components/ProfitComparisonChart"
import { DateRangePicker } from "./components/DateRangePicker"
import { DashboardWidgets } from "./components/DashboardWidgets"

function getMonthName(date: Date) {
  return date.toLocaleString('pt-PT', { month: 'long', year: 'numeric' })
}

export default async function OpsDashboardPage(props: { searchParams?: Promise<{ month?: string, year?: string, from?: string, to?: string }> }) {
  const searchParams = await props.searchParams || {}
  const supabase = createAdminClient()

  // Fetch real data from DB & persistent actions
  const [shipments, recolhasResult, clients] = await Promise.all([
    getShipmentsAction({ includeLabels: false }),
    supabase
      .from("recolhas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    getClientesAction()
  ])

  const recolhas = recolhasResult.data || []

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

  // Compare revenue with prior equivalent period for Linke software metrics
  let prevPeriodStart: Date
  let prevPeriodEnd: Date
  if (isCustomRange) {
    const rangeDuration = currentMonthEnd.getTime() - currentMonthStart.getTime()
    prevPeriodStart = new Date(currentMonthStart.getTime() - rangeDuration)
    prevPeriodEnd = new Date(currentMonthStart.getTime() - 1)
  } else {
    prevPeriodStart = new Date(targetYear, targetMonth - 1, 1)
    prevPeriodEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999)
  }

  const prevPeriodClientShipments = clientShipments.filter((s: any) => {
    const d = new Date(s.created_at)
    return d >= prevPeriodStart && d <= prevPeriodEnd
  })
  const prevClientRevenue = prevPeriodClientShipments.reduce((acc: number, s: any) => acc + (Number(s.sell_price) || 0), 0)
  const revenueGrowthPercent = prevClientRevenue > 0
    ? ((clientRevenue - prevClientRevenue) / prevClientRevenue) * 100
    : clientRevenue > 0 ? 100 : 0

  const linkeMetrics = {
    revenue: clientRevenue,
    prevRevenue: prevClientRevenue,
    growthPercent: Number(revenueGrowthPercent.toFixed(1)),
    profit: clientMargin,
  }

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

  return (
    <div className="flex flex-col gap-6">
      <OpsDashboardClientSync activeIds={activeIds} />
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <DashboardWidgets linkeMetrics={linkeMetrics} />
          <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight capitalize">
            {isCustomRange ? "Período Personalizado" : getMonthName(targetDate)}
          </h2>
          <DateRangePicker 
            defaultFrom={isCustomRange ? searchParams.from! : currentMonthStart.toISOString().split('T')[0]} 
            defaultTo={isCustomRange ? searchParams.to! : currentMonthEnd.toISOString().split('T')[0]} 
          />
        </div>
        <Badge variant="neutral" className="font-medium bg-[var(--surface-bg)] text-[var(--text-secondary)]">
          Atualizado hoje
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, idx) => (
          <div 
            key={idx} 
            className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 flex flex-col justify-between shadow-2xs hover:border-[var(--border-strong)] transition-all duration-150"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                {stat.label}
              </span>
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text-secondary)] border border-[var(--border-subtle)] shrink-0">
                <stat.icon className="w-4 h-4" strokeWidth={1.75} />
              </div>
            </div>
            
            <div className="flex items-baseline justify-between mt-auto">
              <span className="text-3xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
                {stat.value}
              </span>
              <span className="text-[11px] font-medium text-[var(--text-tertiary)]">
                {stat.subtext}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfitComparisonChart data={chartData} />
        {/* Breakdown Row */}
        <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 shadow-2xs">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Estado Atual ({getMonthName(targetDate)})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { 
            label: "Pendentes", 
            value: statusCounts.pendente, 
            dot: "bg-slate-400",
            href: "/ops/envios?status=Pendente"
          },
          { 
            label: "Em Trânsito", 
            value: statusCounts.em_transito, 
            dot: "bg-blue-500",
            href: "/ops/envios?status=Em Trânsito"
          },
          { 
            label: "Em Distrib.", 
            value: statusCounts.em_distribuicao, 
            dot: "bg-amber-500",
            href: "/ops/envios?status=Em Distribuição"
          },
          { 
            label: "Incidências", 
            value: statusCounts.incidencia, 
            dot: statusCounts.incidencia > 0 ? "bg-rose-500 animate-pulse" : "bg-neutral-300",
            href: "/ops/incidencias"
          },
          { 
            label: "Entregues", 
            value: statusCounts.entregue, 
            dot: "bg-emerald-500",
            href: "/ops/envios?status=Entregue"
          }
        ].map((s, i) => (
          <Link
            key={i}
            href={s.href}
            className="group bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-3.5 flex flex-col justify-between shadow-2xs hover:border-[var(--border-strong)] hover:shadow-xs transition-all duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[var(--text-secondary)] tracking-wide">
                {s.label}
              </span>
              <span className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
                {s.value}
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">
                Ver &rarr;
              </span>
            </div>
          </Link>
        ))}
          </div>
        </div>
      </div>


      {/* Table & Widgets Grid */}
      <div className="flex flex-col xl:flex-row gap-5">
        
        {/* Envios Recentes Table */}
        <div className="flex-[2] bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Envios Recentes</h2>
              <p className="text-[11px] text-[var(--text-tertiary)]">Últimos transportes registados no sistema</p>
            </div>
            <Link 
              href="/ops/envios" 
              className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] bg-[var(--accent-soft)] hover:bg-[rgba(18,138,71,0.15)] px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 border border-[rgba(18,138,71,0.08)]"
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
            <div className="overflow-x-auto">
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
          )}
        </div>

        {/* Right side - Rastreamento Widget */}
        <div className="flex-1 flex flex-col">
          <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 shadow-2xs flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-[var(--status-info-soft)] flex items-center justify-center text-[var(--status-info)] shrink-0 border border-[rgba(37,99,235,0.1)]">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)] text-sm">Último Rastreamento</h3>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Estado em tempo real</p>
                  </div>
                </div>
                <Link href="/ops/envios" className="text-xs font-semibold text-[var(--status-info)] hover:underline flex items-center gap-1">
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
    </div>
  )
}
