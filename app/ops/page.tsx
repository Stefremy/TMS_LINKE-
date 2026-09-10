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
import { getCarrierConnectionsAction } from "@/app/actions/ctt"
import { getCarrierLogo } from "@/lib/carrier-logos"

export default async function OpsDashboardPage() {
  const supabase = createAdminClient()

  // Fetch real data from DB & persistent actions
  const [shipments, recolhasResult, clients, carrierConnections] = await Promise.all([
    getShipmentsAction(),
    supabase
      .from("recolhas")
      .select("*")
      .order("created_at", { ascending: false }),
    getClientesAction(),
    getCarrierConnectionsAction()
  ])

  const recolhas = recolhasResult.data || []

  // Create client map
  const clientMap = new Map<string, string>()
  clients.forEach((c: any) => {
    clientMap.set(c.id, c.short_name || c.legal_name || c.name)
    if (c.code) clientMap.set(c.code, c.short_name || c.legal_name)
  })

  // Real KPI calculations
  const totalShipments = shipments.length
  const pendingRecolhas = recolhas.filter((r: any) => r.status === "pendente" || r.status === "rascunho").length
  const totalRevenue = shipments.reduce((acc: number, s: any) => acc + (Number(s.sell_price) || 0), 0)
  const deliveredCount = shipments.filter((s: any) => s.status === "entregue").length
  const deliveryRate = totalShipments > 0 ? Math.round((deliveredCount / totalShipments) * 100) : 0

  const stats = [
    { 
      label: "Envios Registados", 
      value: totalShipments.toLocaleString("pt-PT"), 
      icon: Package, 
      subtext: `${deliveredCount} entregues` 
    },
    { 
      label: "Recolhas Pendentes", 
      value: pendingRecolhas.toString(), 
      icon: ClipboardList, 
      subtext: `${recolhas.length} total agendadas` 
    },
    { 
      label: "Faturação Total", 
      value: `€${totalRevenue.toFixed(2)}`, 
      icon: ReceiptEuro, 
      subtext: "Valor acumulado de envios" 
    },
    { 
      label: "Taxa de Entrega", 
      value: `${deliveryRate}%`, 
      icon: PieChart, 
      subtext: totalShipments > 0 ? `${deliveredCount} de ${totalShipments} envios` : "Sem envios finalizados" 
    },
  ]

  const recentShipments = shipments.slice(0, 5)
  const latestActiveShipment = shipments[0] || null

  return (
    <div className="flex flex-col gap-8 font-sans">
      
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col relative overflow-hidden">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                <stat.icon className="w-6 h-6" strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold text-slate-800">{stat.label}</span>
            </div>
            
            <div className="flex items-end justify-between mt-auto">
              <span className="text-3xl font-black text-slate-900 font-mono">{stat.value}</span>
              
              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px] font-medium text-slate-400">{stat.subtext}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table & Widgets Grid */}
      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* Envios Recentes Table */}
        <div className="flex-[2] bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Envios Recentes</h2>
              <p className="text-xs text-slate-500">Últimos transportes registados no sistema</p>
            </div>
            <Link 
              href="/ops/envios" 
              className="text-xs font-bold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              Ver todos ({totalShipments}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentShipments.length === 0 ? (
            <div className="py-12 px-4 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">Nenhum envio registado ainda</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Crie novos envios através do módulo de operações ou através da Área de Cliente.
              </p>
              <Link 
                href="/ops/envios" 
                className="mt-4 inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Criar Envio
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500 font-semibold">
                    <th className="pb-3">Guia / Ref</th>
                    <th className="pb-3">Cliente / Destinatário</th>
                    <th className="pb-3">Transportadora</th>
                    <th className="pb-3">Estado</th>
                    <th className="pb-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {recentShipments.map((envio: any) => {
                    const clientName = envio.sender_name || (envio.client_id && clientMap.get(envio.client_id)) || "Cliente Direto"
                    const ref = envio.tracking_number || envio.ctt_object_id || envio.id.substring(0, 8).toUpperCase()
                    const isCtt = envio.service_type?.includes("ctt") || !envio.service_type

                    return (
                      <tr key={envio.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 font-bold font-mono text-slate-800">
                          {ref}
                        </td>
                        <td className="py-3.5">
                          <div className="font-semibold text-slate-800">{clientName}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                            Para: {envio.recipient_name || "Destinatário"}
                          </div>
                        </td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-2">
                            {getCarrierLogo(envio.service_type || "ctt") ? (
                              <div className="w-5 h-5 rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                  src={getCarrierLogo(envio.service_type || "ctt")!} 
                                  alt={envio.service_type || "Transportadora"} 
                                  className="max-w-full max-h-full object-contain" 
                                />
                              </div>
                            ) : (
                              <span className={`w-2 h-2 rounded-full ${isCtt ? 'bg-red-600' : 'bg-blue-600'}`} />
                            )}
                            <span className="font-bold text-slate-700">{envio.service_type || "CTT Expresso"}</span>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <Badge variant={
                            envio.status === "entregue" ? "success" :
                            envio.status === "pendente" ? "warning" : "info"
                          }>
                            {envio.status === "em transito" ? "Em Trânsito" : 
                             envio.status.charAt(0).toUpperCase() + envio.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="py-3.5 text-right font-mono font-bold text-slate-800">
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Último Rastreamento</h3>
                    <p className="text-[11px] text-slate-400">Estado em tempo real</p>
                  </div>
                </div>
                <Link href="/ops/envios" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                  Ver envios <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {latestActiveShipment ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-bold text-slate-700">Guia:</span>
                      <div className="flex items-center gap-1.5">
                        {getCarrierLogo(latestActiveShipment.service_type || "ctt") ? (
                          <div className="w-5 h-5 rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={getCarrierLogo(latestActiveShipment.service_type || "ctt")!} 
                              alt="Logo" 
                              className="max-w-full max-h-full object-contain" 
                            />
                          </div>
                        ) : null}
                        <span className="font-mono font-bold text-indigo-600">
                          {latestActiveShipment.tracking_number || latestActiveShipment.ctt_object_id || latestActiveShipment.id.substring(0, 8).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Destino: <strong>{latestActiveShipment.recipient_name || "Destinatário"}</strong>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Serviço: <span className="font-semibold text-slate-600">{latestActiveShipment.service_type || "CTT Expresso 24H"}</span>
                    </div>
                  </div>

                  {/* Dynamic Status Progression */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                      <span>Progresso do Envio</span>
                      <Badge variant={
                        latestActiveShipment.status === "entregue" ? "success" :
                        latestActiveShipment.status === "pendente" ? "warning" : "info"
                      }>
                        {latestActiveShipment.status}
                      </Badge>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: latestActiveShipment.status === "entregue" ? "100%" :
                                 latestActiveShipment.status === "em transito" ? "65%" :
                                 latestActiveShipment.status === "pendente" ? "35%" : "15%"
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 my-auto">
                  <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">Sem envios ativos</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    O acompanhamento do último envio ativo aparecerá aqui.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-slate-100 mt-6">
              <Link 
                href="/ops/envios" 
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <span>Aceder à Gestão de Envios</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
        
      </div>

      {/* PARCEIROS & TRANSPORTADORAS LINKE WIDGET */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Transportadoras & Parceiros Integrados</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Estado em tempo real das ligações WebServices e preçários ativos no sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/ops/configuracao/webservices"
              className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <span>Webservices Globais</span>
            </Link>
            <Link
              href="/ops/configuracao/servicos"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <span>Gerir Serviços Linke</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              name: "CTT Expresso",
              code: "ctt",
              type: "Nacional & Ilhas",
              leadTime: "24h / 48h",
              matcher: (c: any) => c.carrier_code?.toLowerCase().includes("ctt") || c.supplier_id?.toLowerCase().includes("ctt")
            },
            {
              name: "Correos Express",
              code: "correos",
              type: "Ibérico & Espanha",
              leadTime: "24h / 48h",
              matcher: (c: any) => c.carrier_code?.toLowerCase().includes("correos") || c.supplier_id?.toLowerCase().includes("correos")
            },
            {
              name: "DPD Portugal",
              code: "dpd",
              type: "Europa & B2C",
              leadTime: "24h / 72h",
              matcher: (c: any) => c.carrier_code?.toLowerCase().includes("dpd") || c.supplier_id?.toLowerCase().includes("dpd")
            },
            {
              name: "MRW",
              code: "mrw",
              type: "Urgente Ibéria",
              leadTime: "10h / 24h",
              matcher: (c: any) => c.carrier_code?.toLowerCase().includes("mrw") || c.supplier_id?.toLowerCase().includes("mrw")
            }
          ].map((partner, idx) => {
            const logo = getCarrierLogo(partner.code)
            const activeConn = (carrierConnections || []).find((c: any) => partner.matcher(c) && c.is_active !== false)
            const isConnected = Boolean(activeConn)
            const envLabel = activeConn?.environment === "production" ? "Produção" : activeConn ? "QA / Testes" : null

            return (
              <div 
                key={idx} 
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  isConnected 
                    ? "border-emerald-200/80 bg-emerald-50/20 hover:border-emerald-300 hover:shadow-xs" 
                    : "border-slate-200 bg-slate-50/60 opacity-80 hover:opacity-100 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-10 rounded-lg bg-white border border-slate-200 p-1.5 flex items-center justify-center shadow-2xs">
                    {logo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={logo} 
                        alt={partner.name} 
                        className="max-w-full max-h-full object-contain" 
                      />
                    ) : (
                      <Truck className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  
                  {isConnected ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Ativo & Conectado
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                      Não Conectado
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-slate-800 text-xs">{partner.name}</h3>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                    <span>{partner.type}</span>
                    <span className="font-mono font-bold text-slate-700">{partner.leadTime}</span>
                  </div>

                  {isConnected ? (
                    <div className="text-[10px] text-emerald-700 font-medium mt-2 pt-1.5 border-t border-emerald-100/60 flex items-center justify-between">
                      <span>Ambiente: <strong>{envLabel}</strong></span>
                      <span className="font-mono font-bold">{activeConn.contract_number ? `#${activeConn.contract_number}` : ""}</span>
                    </div>
                  ) : (
                    <div className="mt-2 pt-1.5 border-t border-slate-200/60">
                      <Link 
                        href="/ops/configuracao/webservices" 
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                      >
                        <span>Configurar Ligação</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
