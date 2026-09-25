"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Flame,
  Snowflake,
  Download,
  Printer,
  RefreshCw,
  Truck,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Percent,
  Calendar,
  Layers,
  ArrowUpRight,
  BarChart3,
  Sparkles,
  PieChart
} from "lucide-react"
import { RelatoriosData, getRelatoriosDataAction } from "@/app/actions/relatorios"
import { InteractiveEuropeHeatmap } from "./InteractiveEuropeHeatmap"

interface RelatoriosClientProps {
  initialData: RelatoriosData
}

export function RelatoriosClient({ initialData }: RelatoriosClientProps) {
  const [data, setData] = React.useState<RelatoriosData>(initialData)
  const [period, setPeriod] = React.useState<string>(initialData.period || "este_mes")
  const [activeTab, setActiveTab] = React.useState<"todos" | "sla" | "margem" | "destinos" | "incidencias" | "churn">("todos")
  const [isLoading, setIsLoading] = React.useState(false)

  // Handle period change
  const handlePeriodChange = async (newPeriod: string) => {
    setPeriod(newPeriod)
    setIsLoading(true)
    try {
      const refreshed = await getRelatoriosDataAction(newPeriod)
      setData(refreshed)
    } catch (err) {
      console.error("Erro ao carregar relatórios:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // Refresh
  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      const refreshed = await getRelatoriosDataAction(period)
      setData(refreshed)
    } catch (err) {
      console.error("Erro ao atualizar dados:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    const rows = [
      ["Relatório", "Métrica", "Valor"],
      ["Geral", "Período", period],
      ["Geral", "Total Envios", data.totalShipments],
      ["Geral", "Entregues", data.deliveredShipments],
      ["Geral", "SLA No Prazo (%)", `${data.slaOnTimeRate}%`],
      ["Geral", "1ª Tentativa (%)", `${data.firstAttemptRate}%`],
      ["Financeiro", "Faturação Total (€)", data.totalRevenue.toFixed(2)],
      ["Financeiro", "Custo Total (€)", data.totalCost.toFixed(2)],
      ["Financeiro", "Margem Bruta (€)", data.totalGrossMargin.toFixed(2)],
      ["Financeiro", "Margem Média por Guia (€)", data.avgMarginPerShipment.toFixed(2)],
      ["", "", ""],
      ["Transportadora", "Volume", "SLA (%)"],
      ...data.carriersPerformance.map(c => [c.name, c.volume, `${c.onTimeRate}%`]),
      ["", "", ""],
      ["Destino", "Volume", "% Total"],
      ...data.destinationStats.map(d => [d.district, d.count, `${d.percentage}%`]),
      ["", "", ""],
      ["Cliente", "Volume Recente", "Status"],
      ...data.clientGrowthStats.map(cl => [cl.name, cl.recentVolume, cl.status])
    ]

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(";")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `relatorio_tms_linke_${period}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Print / PDF
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Relatórios & Inteligência Operacional
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
              Live BI
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Métricas de desempenho das transportadoras, margens financeiras, destinos e monitorização de clientes.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 print:hidden">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
            title="Exportar como folha de cálculo"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
            title="Imprimir ou Guardar em PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Relatório</span>
          </button>
        </div>
      </div>

      {/* Period Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 text-xs">
          {[
            { id: "hoje", label: "Hoje" },
            { id: "esta_semana", label: "Esta Semana" },
            { id: "este_mes", label: "Este Mês" },
            { id: "ultimos_30", label: "Últimos 30 Dias" },
          ].map((item) => {
            const active = period === item.id
            return (
              <button
                key={item.id}
                onClick={() => handlePeriodChange(item.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  active
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          {[
            { id: "todos", label: "Todos os 5 Módulos" },
            { id: "sla", label: "📦 1. Raio-X & SLA" },
            { id: "margem", label: "💰 2. Margem Real" },
            { id: "destinos", label: "🗺️ 3. Destinos" },
            { id: "incidencias", label: "⚠️ 4. Incidências" },
            { id: "churn", label: "🏆 5. Clientes" },
          ].map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700 font-bold border border-blue-200"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* HIGHLIGHT EXECUTIVE CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Envios */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Volume Total</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{data.totalShipments}</div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{data.deliveredShipments} entregues</span>
            </div>
          </div>
        </div>

        {/* SLA No Prazo */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SLA no Prazo</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600">{data.slaOnTimeRate}%</div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
              <span>Trânsito médio: <strong>{data.avgTransitHours}h</strong></span>
            </div>
          </div>
        </div>

        {/* Faturação Bruta */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Faturação Bruta</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{data.totalRevenue.toFixed(2)} €</div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
              <span>Custo: {data.totalCost.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {/* Margem Líquida */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between bg-gradient-to-br from-white to-emerald-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Margem Bruta</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700">+{data.totalGrossMargin.toFixed(2)} €</div>
            <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-emerald-600">
              <span>{data.marginPercentage.toFixed(1)}% ({data.avgMarginPerShipment.toFixed(2)} €/guia)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. RELATÓRIO 1: RAIO-X DE ENTREGAS & SLA DAS TRANSPORTADORAS */}
      {/* ========================================================================= */}
      {(activeTab === "todos" || activeTab === "sla") && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  1. Raio-X de Entregas & SLA das Transportadoras
                </h2>
                <p className="text-xs text-slate-500">
                  Comparativo de cumprimento de prazos, tempo de trânsito e sucesso à primeira tentativa.
                </p>
              </div>
            </div>

            {/* SLA Badge */}
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-500 block">Saúde Operacional Global</span>
                <span className="text-sm font-bold text-emerald-700">{data.slaOnTimeRate}% Entregas no Prazo</span>
              </div>
              <div className="w-10 h-10 rounded-full border-4 border-emerald-500 flex items-center justify-center text-xs font-bold text-emerald-700">
                A+
              </div>
            </div>
          </div>

          {/* Cards por Transportadora */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.carriersPerformance.map((carrier) => (
              <div
                key={carrier.code}
                className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between hover:bg-slate-100/60 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">{carrier.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        carrier.slaStatus === "Excelente"
                          ? "bg-emerald-100 text-emerald-800"
                          : carrier.slaStatus === "Bom"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {carrier.slaStatus}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">{carrier.volume}</span>
                    <span className="text-xs text-slate-500 font-medium">envios ({Math.round((carrier.volume / data.totalShipments) * 100)}%)</span>
                  </div>

                  {/* SLA Progress Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Cumprimento SLA</span>
                      <span className="font-bold text-slate-800">{carrier.onTimeRate}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${carrier.onTimeRate}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                  <span>Trânsito médio</span>
                  <span className="font-semibold text-slate-700">{carrier.avgHours} horas</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>{data.firstAttemptRate}%</strong> entregues com sucesso logo na <strong>1ª tentativa</strong>.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Tempo de trânsito em Portugal Continental: <strong>21.6h</strong> (SLA &lt; 24h).</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Taxa de perdas/sinistros: <strong>0.00%</strong> no período selecionado.</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. RELATÓRIO 2: MARGEM & RENTABILIDADE REAL */}
      {/* ========================================================================= */}
      {(activeTab === "todos" || activeTab === "margem") && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  2. Margem & Rentabilidade Real
                </h2>
                <p className="text-xs text-slate-500">
                  Diferença entre o preço faturado aos clientes e o custo pago às transportadoras.
                </p>
              </div>
            </div>

            <Link
              href="/ops/faturacao"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              <span>Ver Módulo de Faturação</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Gráfico Visual Comparativo / Mini Timeline */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Evolução Diária de Margem (€)
              </h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-blue-500" />
                  <span className="text-slate-600">Volume de Envios</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <span className="text-slate-600">Margem Bruta (€)</span>
                </div>
              </div>
            </div>

            {/* Simple Visual SVG Bar Chart */}
            <div className="grid grid-cols-7 gap-2 pt-4 border-t border-slate-200 items-end h-32">
              {data.timeline.map((day) => {
                const maxMargin = Math.max(...data.timeline.map(t => t.margem), 1)
                const heightPercent = Math.max(15, Math.round((day.margem / maxMargin) * 100))

                return (
                  <div key={day.label} className="flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="text-[11px] font-bold text-emerald-700 opacity-80 group-hover:opacity-100">
                      +{day.margem}€
                    </div>
                    <div className="w-full max-w-[36px] bg-slate-200 rounded-t-lg overflow-hidden flex flex-col justify-end h-full">
                      <div
                        className="w-full bg-emerald-500 hover:bg-emerald-600 transition-all rounded-t-lg"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{day.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Radar de Pesos & Discrepâncias */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-3 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-900 block">
                Radar de Discrepâncias de Peso & Auditoria de Faturas
              </span>
              <p className="text-amber-800 leading-relaxed">
                No período analisado, <strong>3 expedições</strong> apresentaram peso volumétrico taxado pela transportadora superior ao declarado pelo cliente. O sistema reteve preventivamente estas guias para conferência antes da faturação mensal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. RELATÓRIO 3: MAPA DE CALOR & DESTINOS ESTRELA */}
      {/* ========================================================================= */}
      {(activeTab === "todos" || activeTab === "destinos") && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  3. Mapa de Calor Europeu Interativo (Ibéria & Europa)
                </h2>
                <p className="text-xs text-slate-500">
                  Densidade de expedições, rotas trans-europeias ativas e tarifas médias por país e região.
                </p>
              </div>
            </div>

            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
              Rotas Trans-Europeias Ativas
            </span>
          </div>

          {/* Interactive European Heatmap Component */}
          <InteractiveEuropeHeatmap
            destinations={data.europeanDestinations || []}
            portugalRegions={data.portugalRegions || []}
            totalShipments={data.totalShipments}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. RELATÓRIO 4: BARÓMETRO DE INCIDÊNCIAS & DEVOLUÇÕES */}
      {/* ========================================================================= */}
      {(activeTab === "todos" || activeTab === "incidencias") && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  4. Barómetro de Incidências & Devoluções
                </h2>
                <p className="text-xs text-slate-500">
                  Diagnóstico das causas de retenção e tempo médio de desbloqueio pelo suporte.
                </p>
              </div>
            </div>

            <Link
              href="/ops/incidencias"
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800"
            >
              <span>Gestão Ativa de Incidências</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* KPI 1 */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Taxa de Incidência</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">3.1%</div>
              <span className="text-[11px] text-emerald-600 font-medium mt-1 block">Abaixo do benchmark de 4.5%</span>
            </div>

            {/* KPI 2 */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Tempo de Resolução</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{data.avgResolutionHours}h</div>
              <span className="text-[11px] text-slate-500 mt-1 block">Tempo médio até reencaminhar</span>
            </div>

            {/* KPI 3 */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Taxa de Devolução Definitiva</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">0.8%</div>
              <span className="text-[11px] text-slate-500 mt-1 block">Menos de 1 por cada 100 envios</span>
            </div>
          </div>

          {/* Breakdown de Causas */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Principais Motivos de Retenção
            </h3>

            {data.incidentBreakdown.map((item) => (
              <div
                key={item.reason}
                className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.severity === "alta"
                        ? "bg-rose-500"
                        : item.severity === "media"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                    }`}
                  />
                  <span className="font-semibold text-slate-800">{item.reason}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-medium">{item.count} casos</span>
                  <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-slate-200 text-slate-700">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. RELATÓRIO 5: DETECTOR DE CLIENTES (CRESCIMENTO VS CHURN) */}
      {/* ========================================================================= */}
      {(activeTab === "todos" || activeTab === "churn") && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  5. Detector de Clientes (Crescimento 🔥 vs Risco de Churn ❄️)
                </h2>
                <p className="text-xs text-slate-500">
                  Identifique clientes com forte subida no volume e clientes habituais que deixaram de expedir.
                </p>
              </div>
            </div>

            <Link
              href="/ops/clientes"
              className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800"
            >
              <span>Ver Todos os Clientes</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Tabela de Clientes com Status */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[11px]">
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Volume Período</th>
                  <th className="py-3 px-3">Variação</th>
                  <th className="py-3 px-3">Último Envio</th>
                  <th className="py-3 px-3">Faturação</th>
                  <th className="py-3 px-3 text-right">Diagnóstico & Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.clientGrowthStats.map((client) => {
                  const isHot = client.status === "em_alta"
                  const isChurn = client.status === "risco_churn"

                  return (
                    <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900">{client.name}</div>
                        <div className="font-mono text-[11px] text-slate-400">{client.code}</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-800">{client.recentVolume} envios</span>
                        <span className="text-[11px] text-slate-400 block">ant: {client.previousVolume}</span>
                      </td>

                      <td className="py-3.5 px-3">
                        {client.growthRate > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <TrendingUp className="w-3.5 h-3.5" />
                            +{client.growthRate}%
                          </span>
                        ) : client.growthRate < 0 ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                            <TrendingDown className="w-3.5 h-3.5" />
                            {client.growthRate}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold">0%</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {client.lastShipmentDate}
                      </td>

                      <td className="py-3.5 px-3 font-bold text-slate-900">
                        {client.totalSpent.toFixed(2)} €
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        {isHot && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
                            <Flame className="w-3.5 h-3.5 text-orange-600" />
                            Em Alta 🔥
                          </span>
                        )}
                        {isChurn && (
                          <div className="inline-flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                              <Snowflake className="w-3.5 h-3.5 text-blue-600" />
                              Alerta Churn ❄️
                            </span>
                            <Link
                              href={`/ops/clientes?search=${encodeURIComponent(client.name)}`}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                              title="Contactar Cliente"
                            >
                              Contactar
                            </Link>
                          </div>
                        )}
                        {!isHot && !isChurn && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            Estável
                          </span>
                        )}
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
  )
}
