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
  
  const deliveredShipments = shipments.filter((s: any) => s.status === "entregue")
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
    const { data: incidentEvents } = await supabase
      .from("tracking_events")
      .select("shipment_id")
      .in("shipment_id", deliveredIds)
      .in("event_code", ["EMH", "EMN", "EDF"])
    
    if (incidentEvents) {
      const incidentShipmentIds = new Set(incidentEvents.map((e: any) => e.shipment_id))
      deliveredWithIncidents = incidentShipmentIds.size
    }
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
  shipments.forEach((s: any) => {
    if (s.status === "pendente" || s.status === "rascunho") statusCounts.pendente++
    else if (s.status === "em transito" || s.status === "em_transito") statusCounts.em_transito++
    else if (s.status === "em_distribuicao") statusCounts.em_distribuicao++
    else if (s.status === "incidencia") statusCounts.incidencia++
    else if (s.status === "devolvido") statusCounts.devolvido++
  })

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
  ]

  const recentShipments = shipments.slice(0, 5)
  const latestActiveShipment = shipments.find((s: any) => s.status !== "entregue" && s.status !== "devolvido") || shipments[0] || null

  return (
    <div className="flex flex-col gap-6">
      
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 flex flex-col relative overflow-hidden shadow-2xs">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-md bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[rgba(18,138,71,0.1)]">
                <stat.icon className="w-4.5 h-4.5" strokeWidth={2} />
              </div>
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{stat.label}</span>
            </div>
            
            <div className="flex items-end justify-between mt-auto">
              <span className="text-3xl font-bold text-[var(--text-primary)]">{stat.value}</span>
              
              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px] font-medium text-[var(--text-tertiary)]">{stat.subtext}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Breakdown Row */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Pendentes", value: statusCounts.pendente, color: "bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]" },
          { label: "Em Trânsito", value: statusCounts.em_transito, color: "bg-[var(--status-info-soft)] text-[var(--status-info)] border border-[rgba(37,99,235,0.15)]" },
          { label: "Em Distrib.", value: statusCounts.em_distribuicao, color: "bg-purple-50 text-purple-700 border border-purple-200/60" },
          { label: "Incidências", value: statusCounts.incidencia, color: "bg-[var(--status-critical-soft)] text-[var(--status-critical)] border border-[rgba(220,38,38,0.15)]" },
          { label: "Entregues", value: statusCounts.entregue, color: "bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[rgba(18,138,71,0.15)]" }
        ].map((s, i) => (
          <div key={i} className={`rounded-lg p-3 flex flex-col items-center justify-center text-center ${s.color}`}>
            <span className="text-lg font-bold">{s.value}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider mt-0.5 opacity-90">{s.label}</span>
          </div>
        ))}
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

      {/* PARCEIROS & TRANSPORTADORAS LINKE WIDGET */}
      <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-4.5 h-4.5 text-[var(--accent)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Transportadoras & Parceiros Integrados</h2>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              Estado em tempo real das ligações WebServices e preçários ativos no sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/ops/configuracao/webservices"
              className="text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-muted)] hover:bg-[var(--surface-dim)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
            >
              <span>Webservices Globais</span>
            </Link>
            <Link
              href="/ops/configuracao/servicos"
              className="text-[11px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] bg-[var(--accent-soft)] hover:bg-[rgba(18,138,71,0.15)] border border-[rgba(18,138,71,0.08)] px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
            >
              <span>Gerir Serviços Linke</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                className={`p-3 rounded-lg border transition-all flex flex-col justify-between gap-3 ${
                  isConnected 
                    ? "border-[rgba(18,138,71,0.2)] bg-[var(--accent-soft)] hover:border-[rgba(18,138,71,0.3)]" 
                    : "border-[var(--border-subtle)] bg-[var(--surface-muted)] opacity-90 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-8 rounded-md bg-white border border-[var(--border-subtle)] p-1 flex items-center justify-center shadow-2xs">
                    {logo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={logo} 
                        alt={partner.name} 
                        className="max-w-full max-h-full object-contain" 
                      />
                    ) : (
                      <Truck className="w-4 h-4 text-[var(--text-tertiary)]" />
                    )}
                  </div>
                  
                  {isConnected ? (
                    <span className="text-[9px] font-bold text-[var(--status-success)] bg-[var(--status-success-soft)] border border-[rgba(18,138,71,0.15)] px-1.5 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider">
                      <span className="w-1 h-1 rounded-full bg-[var(--status-success)] animate-pulse" />
                      Conectado
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-[var(--text-tertiary)] bg-[var(--surface-bg)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Desligado
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-xs">{partner.name}</h3>
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] mt-0.5 font-medium">
                    <span>{partner.type}</span>
                    <span className="text-[var(--text-secondary)]">{partner.leadTime}</span>
                  </div>

                  {isConnected ? (
                    <div className="text-[9px] text-[var(--accent)] font-semibold mt-2 pt-1.5 border-t border-[rgba(18,138,71,0.1)] flex items-center justify-between uppercase tracking-wide">
                      <span>{envLabel}</span>
                      <span>{activeConn.contract_number ? `#${activeConn.contract_number}` : ""}</span>
                    </div>
                  ) : (
                    <div className="mt-2 pt-1.5 border-t border-[var(--border-subtle)]">
                      <Link 
                        href="/ops/configuracao/webservices" 
                        className="text-[10px] font-semibold text-[var(--status-info)] hover:text-blue-800 flex items-center gap-0.5"
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
