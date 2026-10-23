"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle, Search, MapPin, Phone, Clock, User,
  CheckCircle2, Eye, Truck, ShieldAlert, Copy, Check, Package,
} from "lucide-react"
import { RefreshIcon } from "@/components/ui/refresh-icon"
import { Button } from "@/components/ui/button"
import { ClientShipmentDetailModal } from "@/app/app/components/ClientShipmentDetailModal"
import { syncCttTrackingAction } from "@/app/actions/ctt"

export interface IncidentShipment {
  id: string
  rawId: string
  tracking_number: string
  ctt_object_id?: string
  reference?: string
  carrier_name: string
  service_type: string
  created_at: string
  updated_at?: string
  incident_date: string
  client_name: string
  client_id?: string
  recipient_name: string
  recipient_phone?: string
  recipient_address: string
  recipient_zip?: string
  recipient_city?: string
  incident_code: string
  incident_reason: string
  incident_notes?: string
  sla_hours: number
  status_tratamento: "pendente" | "reagendado" | "morada_atualizada" | "em_resolucao"
  attempts_count: number
  rawShipment: Record<string, unknown>
}

interface IncidenciasClientProps {
  initialIncidents: IncidentShipment[]
  clients: { id: string; name: string }[]
}

export function IncidenciasClient({ initialIncidents, clients }: IncidenciasClientProps) {
  const router = useRouter()
  const incidents = initialIncidents
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedFilter, setSelectedFilter] = React.useState<string>("todos")
  const [selectedClientId, setSelectedClientId] = React.useState<string>("all")
  
  // Modals state
  const [modalShipment, setModalShipment] = React.useState<IncidentShipment["rawShipment"] | IncidentShipment | null>(null)
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSyncAll = async () => {
    setIsSyncing(true)
    try {
      for (const inc of incidents) {
        const idToSync = inc.rawId || inc.id
        await syncCttTrackingAction("", idToSync)
      }
      router.refresh()
    } catch (err) {
      console.warn("Sync error:", err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setIsSyncing(false)
    }
  }

  // Filter logic
  const filteredIncidents = React.useMemo(() => {
    return incidents.filter((item) => {
      // Client filter
      if (selectedClientId !== "all" && item.client_id !== selectedClientId) {
        return false
      }

      // Tab filter
      if (selectedFilter === "destinatario_ausente") {
        if (!item.incident_reason.toLowerCase().includes("ausente") && item.incident_code !== "11") return false
      } else if (selectedFilter === "morada_incorreta") {
        if (!item.incident_reason.toLowerCase().includes("morada") && item.incident_code !== "01") return false
      } else if (selectedFilter === "avaria_dano") {
        if (!item.incident_reason.toLowerCase().includes("dan") && !item.incident_reason.toLowerCase().includes("avaria") && item.incident_code !== "18") return false
      } else if (selectedFilter === "recusado") {
        if (!item.incident_reason.toLowerCase().includes("recus") && item.incident_code !== "13") return false
      }

      // Search query
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        item.tracking_number.toLowerCase().includes(q) ||
        (item.reference && item.reference.toLowerCase().includes(q)) ||
        (item.ctt_object_id && item.ctt_object_id.toLowerCase().includes(q)) ||
        item.recipient_name.toLowerCase().includes(q) ||
        item.recipient_address.toLowerCase().includes(q) ||
        (item.recipient_city && item.recipient_city.toLowerCase().includes(q)) ||
        item.incident_reason.toLowerCase().includes(q) ||
        item.client_name.toLowerCase().includes(q)
      )
    })
  }, [incidents, searchQuery, selectedFilter, selectedClientId])

  // Key KPI stats
  const stats = React.useMemo(() => {
    const total = incidents.length
    const ausentes = incidents.filter(i => i.incident_reason.toLowerCase().includes("ausente") || i.incident_code === "11").length
    const moradas = incidents.filter(i => i.incident_reason.toLowerCase().includes("morada") || i.incident_code === "01").length
    const avarias = incidents.filter(i => i.incident_reason.toLowerCase().includes("dan") || i.incident_reason.toLowerCase().includes("avaria") || i.incident_code === "18").length
    const criticalSla = incidents.filter(i => i.sla_hours >= 24).length

    return { total, ausentes, moradas, avarias, criticalSla }
  }, [incidents])

  const indicators = [
    { label: "Incidências ativas", value: stats.total, icon: AlertTriangle, color: "#DC2626", description: "Ocorrências por resolver" },
    { label: "Destinatário ausente", value: stats.ausentes, icon: User, color: "#B45309", description: "Ausência no local de entrega" },
    { label: "Morada incorreta", value: stats.moradas, icon: MapPin, color: "#155EEF", description: "Morada incompleta ou incorreta" },
    { label: "Avarias / Outros", value: stats.avarias, icon: ShieldAlert, color: "#FA8072", iconColor: "#B94438", description: "Danos ou avarias comunicados" },
  ]
  const hasFilters = Boolean(searchQuery || selectedFilter !== "todos" || selectedClientId !== "all")

  return (
    <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 border-b border-[var(--border-subtle)] pb-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Incidências</h1>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${stats.total > 0 ? "bg-red-700 text-white" : "bg-[var(--surface-bg)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"}`}>
              {stats.total} ativas
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Acompanhe as ocorrências e resolva os envios que precisam de atenção.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={isSyncing || incidents.length === 0} className="h-9">
            <RefreshIcon aria-hidden="true" className={`mr-1.5 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "A sincronizar…" : "Sincronizar CTT"}
          </Button>
          <Button size="sm" onClick={() => router.push('/ops/envios')} className="h-9">
            <Package aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Ver envios
          </Button>
        </div>
      </header>

      <section aria-label="Resumo das incidências" className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
        <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)] xl:grid-cols-4">
          {indicators.map(indicator => (
            <div key={indicator.label} className="min-w-0 border-t-4 bg-[var(--surface-bg)] p-4 sm:p-5" style={{ borderTopColor: indicator.color }}>
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-[var(--text-primary)]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: indicator.iconColor || indicator.color }}>
                  <indicator.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                </span>
                {indicator.label}
              </div>
              <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-[var(--text-primary)] tabular-nums">{indicator.value}</div>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">{indicator.description}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/60 px-4 py-3 text-xs sm:px-5">
          <span className="flex items-center gap-2 text-[var(--text-secondary)]"><Clock aria-hidden="true" className="h-3.5 w-3.5" />Tempo desde a última atualização</span>
          <span className={`font-medium ${stats.criticalSla > 0 ? "text-[var(--status-critical)]" : "text-[var(--text-secondary)]"}`}>
            {stats.criticalSla > 0 ? `${stats.criticalSla} com 24h ou mais` : "Sem ocorrências com 24h ou mais"}
          </span>
        </div>
      </section>

      {/* Main Content Table Section */}
      <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] flex flex-col">
        
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Envios com incidência</h2>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Consulte o motivo, o histórico e as ações disponíveis para cada envio.</p>
          </div>
          <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] tabular-nums">{filteredIncidents.length} resultado(s)</span>
        </div>
        {/* Toolbar & Filters */}
        <div className="flex min-w-0 flex-col gap-3 border-b border-[var(--border-subtle)] p-4 sm:px-5">
          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setSelectedFilter("todos")}
              aria-pressed={selectedFilter === "todos"}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0 ${
                selectedFilter === "todos"
                  ? "bg-[var(--accent)] text-white font-semibold"
                  : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Todas ({stats.total})
            </button>

            <button
              type="button"
              onClick={() => setSelectedFilter("destinatario_ausente")}
              aria-pressed={selectedFilter === "destinatario_ausente"}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0 ${
                selectedFilter === "destinatario_ausente"
                  ? "bg-amber-700 text-white font-semibold"
                  : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Destinatário Ausente ({stats.ausentes})
            </button>

            <button
              type="button"
              onClick={() => setSelectedFilter("morada_incorreta")}
              aria-pressed={selectedFilter === "morada_incorreta"}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0 ${
                selectedFilter === "morada_incorreta"
                  ? "bg-blue-700 text-white font-semibold"
                  : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Morada Incorreta ({stats.moradas})
            </button>

            <button
              type="button"
              onClick={() => setSelectedFilter("avaria_dano")}
              aria-pressed={selectedFilter === "avaria_dano"}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0 ${
                selectedFilter === "avaria_dano"
                  ? "bg-[#B94438] text-white font-semibold"
                  : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Avarias / Outros ({stats.avarias})
            </button>
          </div>

          {/* Search & Client Filter */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Pesquisar incidências"
                placeholder="Pesquisar guia, destinatário, motivo ou cliente…"
                className="w-full h-9 pl-8.5 pr-3 rounded-md bg-[var(--canvas-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {clients.length > 0 && (
              <select
                aria-label="Filtrar por cliente"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="h-9 w-full sm:w-auto sm:max-w-64 px-2.5 rounded-md bg-[var(--canvas-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="all">Todos os Clientes</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table aria-label="Lista de envios com incidência" className={`w-full text-left border-collapse text-xs ${filteredIncidents.length ? "min-w-[1100px]" : ""}`}>
            {filteredIncidents.length > 0 && <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--canvas-bg)] text-[var(--text-secondary)] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Envio / Nº Rastreio</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Destinatário & Localidade</th>
                <th className="py-3 px-4">Motivo da Incidência</th>
                <th className="py-3 px-4">Tempo / SLA</th>
                <th className="py-3 px-4">Estado Tratamento</th>
                <th className="py-3 px-4 text-right">Detalhes</th>
              </tr>
            </thead>}
            <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--surface-bg)]">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--text-secondary)]">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                        {hasFilters ? <Search aria-hidden="true" className="h-6 w-6" /> : <CheckCircle2 aria-hidden="true" className="h-6 w-6" />}
                      </div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        {hasFilters ? "Nenhuma incidência encontrada" : "Sem incidências pendentes"}
                      </h3>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        {hasFilters ? "Experimente outra pesquisa ou limpe os filtros para ver todas as ocorrências." : "As novas ocorrências aparecerão aqui para acompanhamento e resolução."}
                      </p>
                      {hasFilters && (
                        <button
                          onClick={() => {
                            setSearchQuery("")
                            setSelectedFilter("todos")
                            setSelectedClientId("all")
                          }}
                          className="mt-3 text-xs font-semibold text-[var(--accent)] hover:underline"
                        >
                          Limpar Filtros de Pesquisa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((item) => {
                  const carrierTracking = item.ctt_object_id || item.tracking_number
                  const internalRef = item.reference || item.tracking_number
                  
                  // SLA alert style
                  const isSlaCritical = item.sla_hours >= 24
                  const isSlaWarning = item.sla_hours >= 12 && item.sla_hours < 24

                  return (
                    <tr 
                      key={item.id}
                      className="hover:bg-[var(--surface-muted)] transition-colors group"
                    >
                      {/* Envio / AWB */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded bg-red-700 text-white flex items-center justify-center shrink-0 border border-red-700 mt-0.5">
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setModalShipment(item.rawShipment)}
                                className="font-mono text-xs font-bold text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline cursor-pointer"
                              >
                                {carrierTracking}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(carrierTracking, item.id)}
                                aria-label={`Copiar código ${carrierTracking}`}
                                title="Copiar código"
                                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                              >
                                {copiedId === item.id ? (
                                  <Check className="w-3 h-3 text-[var(--status-success)]" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--text-secondary)] font-mono">
                              <span>Ref: {internalRef}</span>
                              <span>•</span>
                              <span className="text-[var(--text-tertiary)]">{item.carrier_name}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-[var(--text-primary)] block">
                          {item.client_name}
                        </span>
                        <span className="text-[11px] text-[var(--text-tertiary)] block">
                          {new Date(item.created_at).toLocaleDateString("pt-PT")}
                        </span>
                      </td>

                      {/* Destinatário & Localidade */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-[var(--text-primary)] block">
                          {item.recipient_name}
                        </span>
                        <span className="text-[11px] text-[var(--text-secondary)] block truncate max-w-[200px]" title={item.recipient_address}>
                          {item.recipient_address}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                          {item.recipient_zip && <span>{item.recipient_zip}</span>}
                          {item.recipient_phone && (
                            <a 
                              href={`tel:${item.recipient_phone}`}
                              className="text-[var(--accent)] hover:underline flex items-center gap-0.5 font-medium"
                            >
                              <Phone className="w-2.5 h-2.5" />
                              {item.recipient_phone}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Motivo da Incidência */}
                      <td className="py-3.5 px-4 max-w-[240px]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-red-700 text-white border border-red-700">
                            {item.incident_code}
                          </span>
                          <span className="font-bold text-[var(--text-primary)] truncate text-xs">
                            {item.incident_reason}
                          </span>
                        </div>
                        {item.incident_notes && (
                          <p className="text-[11px] text-[var(--text-secondary)] italic line-clamp-2">
                            &quot;{item.incident_notes}&quot;
                          </p>
                        )}
                        <span className="text-[10px] text-[var(--text-tertiary)] block mt-0.5">
                          Tentativa #{item.attempts_count} • {item.incident_date}
                        </span>
                      </td>

                      {/* Tempo / SLA */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span 
                            className={`px-2 py-0.5 rounded font-semibold text-[11px] flex items-center gap-1 ${
                              isSlaCritical
                                ? "bg-red-700 text-white border border-red-700"
                                : isSlaWarning
                                ? "bg-amber-700 text-white border border-amber-700"
                                : "bg-emerald-700 text-white border border-emerald-700"
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {item.sla_hours}h decorridas
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--text-tertiary)] block mt-1">
                          {isSlaCritical ? "SLA Excedido (≥24h)" : "Em janela operacional"}
                        </span>
                      </td>

                      {/* Estado Tratamento */}
                      <td className="py-3.5 px-4">
                        {item.status_tratamento === "pendente" && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-700 text-white border border-amber-700 inline-block">
                            Pendente Ação
                          </span>
                        )}
                        {item.status_tratamento === "reagendado" && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-700 text-white border border-blue-700 inline-block">
                            Reagendado
                          </span>
                        )}
                        {item.status_tratamento === "morada_atualizada" && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-700 text-white border border-blue-700 inline-block">
                            Morada Atualizada
                          </span>
                        )}
                        {item.status_tratamento === "em_resolucao" && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-700 text-white border border-emerald-700 inline-block">
                            Em Resolução
                          </span>
                        )}
                      </td>

                      {/* Ações Operacionais */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => setModalShipment(item.rawShipment || item)}
                            aria-label={`Ver detalhes do envio ${carrierTracking}`}
                            title="Ver histórico e eventos de rastreio"
                            className="h-8 w-8 shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>

                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/60 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
          <span>Mostrando <strong>{filteredIncidents.length}</strong> de <strong>{incidents.length}</strong> ocorrências operacionais</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--status-critical)]"></span>
              Crítico (≥24h)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Aviso (12–24h)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Recente (&lt;12h)
            </span>
          </div>
        </div>

      </div>

      {/* Shipment Details / Tracking Modal */}
      {modalShipment && (
        <ClientShipmentDetailModal
          shipment={modalShipment}
          onClose={() => setModalShipment(null)}
          onUpdateShipment={() => {
            router.refresh()
          }}
        />
      )}


    </div>
  )
}
