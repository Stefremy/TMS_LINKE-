"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { 
  TrendingUp, 
  Package, 
  Receipt, 
  Truck, 
  CheckCircle2, 
  Clock, 
  PlusCircle, 
  Building2, 
  BarChart3, 
  PieChart as PieChartIcon, 
  ShieldCheck, 
  MapPin, 
  FileText, 
  ArrowRight,
  Percent,
  Euro
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getClientesAction } from "@/app/actions/clientes"
import { getClientPortalStatsAction } from "@/app/actions/shipments"
import { Cliente, DEFAULT_CTT_SERVICES_PRICING } from "@/app/ops/entidades/clientes/types"

export function ClientDashboard() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("clientId")
  const clientNameParam = searchParams.get("clientName")

  const [currentClient, setCurrentClient] = React.useState<Cliente | null>(null)
  const [stats, setStats] = React.useState<{
    totalCount: number
    totalRevenue: number
    deliveredCount: number
    deliveryRate: number
    weeklyVolume: Array<{ day: string; count: number; height: string }>
    serviceBreakdown: Array<{ name: string; count: string; rawCount: number; share: number; color: string }>
    destinationRegions: Array<{ region: string; count: string; pct: number }>
    recentShipments: any[]
  }>({
    totalCount: 0,
    totalRevenue: 0,
    deliveredCount: 0,
    deliveryRate: 0,
    weeklyVolume: [
      { day: "Seg", count: 0, height: "0%" },
      { day: "Ter", count: 0, height: "0%" },
      { day: "Qua", count: 0, height: "0%" },
      { day: "Qui", count: 0, height: "0%" },
      { day: "Sex", count: 0, height: "0%" },
      { day: "Sáb", count: 0, height: "0%" },
      { day: "Dom", count: 0, height: "0%" },
    ],
    serviceBreakdown: [],
    destinationRegions: [],
    recentShipments: [],
  })

  // Load client data & real DB stats
  React.useEffect(() => {
    getClientesAction().then((clients) => {
      let target: Cliente | undefined
      if (clientId) {
        target = clients.find((c) => c.id === clientId)
      }
      if (!target && clientNameParam) {
        const decoded = decodeURIComponent(clientNameParam).toLowerCase()
        target = clients.find((c) => c.short_name.toLowerCase() === decoded || c.legal_name.toLowerCase() === decoded)
      }
      if (!target && clients.length > 0) {
        target = clients[0]
      }
      if (target) {
        setCurrentClient(target)
      }

      // Fetch 100% real stats for this client
      getClientPortalStatsAction(target?.id, target?.short_name).then((res) => {
        if (res) {
          setStats(res)
        }
      })
    })
  }, [clientId, clientNameParam])

  const querySuffix = React.useMemo(() => {
    if (!currentClient) return ""
    return `?clientId=${encodeURIComponent(currentClient.id || "")}&clientName=${encodeURIComponent(currentClient.short_name || "")}`
  }, [currentClient])

  // Contractual and pricing details from real client record
  const discountPct = currentClient?.pricing?.discount_pct ?? 0
  const fuelPct = currentClient?.pricing?.fuel_surcharge_pct ?? 12.5
  const creditLimit = currentClient?.credit_limit ?? 0
  const paymentTerms = currentClient?.payment_terms || "Pronto Pagamento"
  const activeServices = (currentClient?.pricing?.services_pricing || DEFAULT_CTT_SERVICES_PRICING).filter(s => s.is_enabled)

  // Real credit calculation
  const usedPlafondPct = creditLimit > 0 ? Math.min((stats.totalRevenue / creditLimit) * 100, 100).toFixed(1) : "0"

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto font-sans">
      
      {/* Top Welcome & Client Header Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {currentClient?.code || "CLIENTE"}
            </span>
            <span className="text-emerald-100 text-xs font-semibold">
              {currentClient?.city ? `Sede: ${currentClient.city}` : "Conta Ativa"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {currentClient?.legal_name || currentClient?.short_name || "Portal de Envios do Cliente"}
          </h1>
          <p className="text-emerald-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Painel operacional e analítico com métricas em tempo real, tabelas de preçário acordadas e serviços CTT contratados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href={`/app/criar-guia${querySuffix}`}
            className="px-6 py-3.5 bg-white text-emerald-900 hover:bg-emerald-50 active:scale-[0.99] rounded-2xl text-xs sm:text-sm font-extrabold shadow-md transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>Novo Envio</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1: Envios Totais Reais */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Volume de Envios</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono">{stats.totalCount}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{stats.deliveredCount} entregues no destino</p>
          </div>
        </div>

        {/* KPI 2: Faturação Real */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Faturação Acumulada</span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono">
                {stats.totalRevenue.toFixed(2)}€
              </span>
              <span className="text-[11px] text-slate-400 font-medium">+ IVA</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Condições: <strong>{paymentTerms}</strong></p>
          </div>
        </div>

        {/* KPI 3: Desconto Real */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Desconto Contratual</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-indigo-600 font-mono">{discountPct}%</span>
              <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">
                Taxa Comb: {fuelPct}%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {activeServices.length} serviços CTT contratados
            </p>
          </div>
        </div>

        {/* KPI 4: Plafond de Crédito Real */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plafond de Crédito</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            {creditLimit > 0 ? (
              <>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xl font-black text-slate-900 font-mono">
                    {creditLimit.toLocaleString("pt-PT")}€
                  </span>
                  <span className="text-xs font-bold text-emerald-600">{usedPlafondPct}% Utilizado</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${usedPlafondPct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Disponível: {Math.max(creditLimit - stats.totalRevenue, 0).toLocaleString("pt-PT")}€
                </p>
              </>
            ) : (
              <>
                <span className="text-2xl font-black text-slate-800 font-mono">Sem Limite</span>
                <p className="text-[11px] text-slate-400 mt-1">Conta sem teto fixado</p>
              </>
            )}
          </div>
        </div>

      </div>

      {/* GRAPHS & ANALYTICS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Graph 1: Volume Diário Real de Envios */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Volume de Envios por Dia</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Distribuição diária de emissão de guias de transporte CTT</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl">
                {stats.totalCount} {stats.totalCount === 1 ? "Envio Registado" : "Envios Registados"}
              </span>
            </div>
          </div>

          {/* Visual Bar Graph with REAL data */}
          {stats.totalCount === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Package className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">Sem envios registados</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Os gráficos de barras serão preenchidos em tempo real à medida que emitir novas guias CTT.
              </p>
            </div>
          ) : (
            <div className="h-64 flex items-end justify-between gap-3 sm:gap-6 pt-8 pb-2 px-2 border-b border-slate-100">
              {stats.weeklyVolume.map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[11px] font-mono font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.count}
                  </div>
                  <div className="w-full max-w-[48px] bg-slate-100 rounded-t-xl overflow-hidden flex items-end h-full">
                    <div 
                      className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-xl transition-all duration-500"
                      style={{ height: item.height }}
                    />
                  </div>
                  <div className="text-center mt-1">
                    <span className="block text-xs font-bold text-slate-800">{item.day}</span>
                    <span className="block text-[10px] text-slate-400 font-mono font-bold">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-emerald-500" />
              <span>Envios CTT Registados</span>
            </div>
            <span className="font-semibold text-slate-700">
              Total Acumulado: <strong>{stats.totalCount} guias</strong>
            </span>
          </div>
        </div>

        {/* Graph 2: Repartição Real por Serviço CTT */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PieChartIcon className="w-5 h-5 text-teal-600" />
              <h3 className="text-base font-bold text-slate-900">Mix de Serviços CTT</h3>
            </div>
            <p className="text-xs text-slate-500 mb-6">Utilização real por modalidade de entrega</p>

            {stats.serviceBreakdown.length === 0 ? (
              <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Truck className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">Sem serviços utilizados</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Emita uma guia para registar o primeiro serviço.</p>
              </div>
            ) : (
              <>
                {/* Progress Segment Bar */}
                <div className="w-full h-3.5 rounded-full overflow-hidden flex gap-1 mb-6 bg-slate-100 p-0.5">
                  {stats.serviceBreakdown.map((s, idx) => (
                    <div 
                      key={idx} 
                      className={`h-full rounded-full ${s.color}`} 
                      style={{ width: `${s.share}%` }} 
                      title={`${s.name}: ${s.share}%`}
                    />
                  ))}
                </div>

                {/* Breakdown Items List */}
                <div className="space-y-3.5">
                  {stats.serviceBreakdown.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-3 h-3 rounded-full ${s.color} shrink-0`} />
                        <span className="font-semibold text-slate-800">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-500 text-[11px]">{s.count}</span>
                        <span className="font-bold text-slate-900">{s.share}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              href={`/app/criar-guia${querySuffix}`}
              className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Novo Envio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

      </div>

      {/* LOWER SECTION: REAL DESTINATIONS & QUICK SHORTCUTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Real Regional Destinations Distribution */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Destinos dos Envios</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Destinos mais frequentes da mercadoria desta conta</p>
            </div>
          </div>

          {stats.destinationRegions.length === 0 ? (
            <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <MapPin className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-600">Sem destinos registados</p>
              <p className="text-[11px] text-slate-400 mt-0.5">As localidades de destino aparecerão aqui após emissão.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {stats.destinationRegions.map((dest, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{dest.region}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-400 text-[11px]">{dest.count}</span>
                      <span className="font-bold text-slate-900">{dest.pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${dest.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Operations Portal Card */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="bg-emerald-500 text-slate-950 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wide">
              Acesso Rápido
            </span>
            <h3 className="text-lg font-bold text-white mt-3">Operações Rápidas</h3>
            <p className="text-xs text-slate-400 mt-1">
              Atalhos diretos para emissão rápida de novos envios.
            </p>

            <div className="space-y-2.5 mt-5">
              <Link
                href={`/app/criar-guia${querySuffix}`}
                className="w-full p-3.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-white flex items-center justify-between transition-colors border border-slate-700"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Novo Envio</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                href={`/app/envios${querySuffix}`}
                className="w-full p-3.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-white flex items-center justify-between transition-colors border border-slate-700"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Histórico de Envios & Tracking</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Integração Webservices CTT</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Ativo
            </span>
          </div>
        </div>

      </div>

    </div>
  )
}
