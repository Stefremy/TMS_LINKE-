"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  RefreshCw, 
  MapPin, 
  Phone, 
  Clock, 
  Calendar, 
  User, 
  Building2, 
  CheckCircle2, 
  ExternalLink, 
  RotateCcw, 
  Eye, 
  ChevronRight, 
  Truck, 
  ArrowUpRight, 
  ShieldAlert, 
  Copy, 
  Check, 
  SlidersHorizontal,
  Package,
  XCircle,
  AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { ClientShipmentDetailModal } from "@/app/app/components/ClientShipmentDetailModal"
import { TratarIncidenciaModal } from "./components/TratarIncidenciaModal"
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
  rawShipment: any
}

interface IncidenciasClientProps {
  initialIncidents: IncidentShipment[]
  clients: { id: string; name: string }[]
}

export function IncidenciasClient({ initialIncidents, clients }: IncidenciasClientProps) {
  const router = useRouter()
  const [incidents, setIncidents] = React.useState<IncidentShipment[]>(initialIncidents)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedFilter, setSelectedFilter] = React.useState<string>("todos")
  const [selectedClientId, setSelectedClientId] = React.useState<string>("all")
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  
  // Modals state
  const [modalShipment, setModalShipment] = React.useState<any | null>(null)
  const [tratarModalShipment, setTratarModalShipment] = React.useState<any | null>(null)
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  // Keep state in sync with server revalidations
  React.useEffect(() => {
    setIncidents(initialIncidents)
  }, [initialIncidents])

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
    } catch (err: any) {
      console.warn("Sync error:", err?.message)
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

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredIncidents.map(i => i.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Top Header Card */}
      <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--status-critical-soft)] text-[var(--status-critical)] border border-[rgba(220,38,38,0.2)] flex items-center justify-center font-bold">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Gestão de Incidências Operacionais
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              stats.total > 0 
                ? "bg-[var(--status-critical)] text-white" 
                : "bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[rgba(18,138,71,0.2)]"
            }`}>
              {stats.total} Ativas
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Controlo e resolução de entregas não conseguidas, moradas incompletas e devoluções na rede CTT Expresso.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="text-xs font-semibold h-9 px-3.5 border-[var(--border-strong)] bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? "animate-spin text-[var(--accent)]" : "text-[var(--text-secondary)]"}`} />
            Sincronizar CTT Tracking
          </Button>

          <Button
            size="sm"
            onClick={() => router.push('/ops/envios')}
            className="text-xs font-semibold h-9 px-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-2xs"
          >
            <Package className="w-3.5 h-3.5 mr-1.5" />
            Ver Todos os Envios
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Incidências Card */}
        <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 flex flex-col relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Incidências Ativas
            </span>
            <div className={`w-8 h-8 rounded-md flex items-center justify-center border ${
              stats.total > 0
                ? "bg-[var(--status-critical-soft)] text-[var(--status-critical)] border-[rgba(220,38,38,0.15)]"
                : "bg-[var(--status-success-soft)] text-[var(--status-success)] border-[rgba(18,138,71,0.15)]"
            }`}>
              {stats.total > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-auto">
            <span className="text-3xl font-bold text-[var(--text-primary)]">{stats.total}</span>
            <span className={`text-xs font-medium ${stats.criticalSla > 0 ? "text-[var(--status-critical)]" : "text-[var(--text-tertiary)]"}`}>
              {stats.criticalSla > 0 ? `${stats.criticalSla} em SLA Crítico (>24h)` : "Sem incumprimento de SLA"}
            </span>
          </div>
        </div>

        {/* Destinatário Ausente */}
        <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 flex flex-col relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Destinatário Ausente
            </span>
            <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-auto">
            <span className="text-3xl font-bold text-[var(--text-primary)]">{stats.ausentes}</span>
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Aguardam reagendamento de 2ª tentativa
            </span>
          </div>
        </div>

        {/* Morada Incompleta */}
        <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 flex flex-col relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Morada Incorreta / Incompleta
            </span>
            <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-auto">
            <span className="text-3xl font-bold text-[var(--text-primary)]">{stats.moradas}</span>
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Requer retificação de morada/contacto
            </span>
          </div>
        </div>

        {/* Avarias & Extravios */}
        <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 flex flex-col relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Avarias / Outros Motivos
            </span>
            <div className="w-8 h-8 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-auto">
            <span className="text-3xl font-bold text-[var(--text-primary)]">{stats.avarias}</span>
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Em averiguação técnica com o CTT
            </span>
          </div>
        </div>

      </div>

      {/* Main Content Table Section */}
      <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] shadow-sm overflow-hidden flex flex-col">
        
        {/* Toolbar & Filters */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[var(--surface-bg)]">
          
          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs font-medium">
            <button
              onClick={() => setSelectedFilter("todos")}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0 ${
                selectedFilter === "todos"
                  ? "bg-[var(--accent)] text-white font-semibold"
                  : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Todas ({stats.total})
            </button>

            <button
              onClick={() => setSelectedFilter("destinatario_ausente")}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0 ${
                selectedFilter === "destinatario_ausente"
                  ? "bg-amber-600 text-white font-semibold"
                  : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Destinatário Ausente ({stats.ausentes})
            </button>

            <button
              onClick={() => setSelectedFilter("morada_incorreta")}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0 ${
                selectedFilter === "morada_incorreta"
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Morada Incorreta ({stats.moradas})
            </button>

            <button
              onClick={() => setSelectedFilter("avaria_dano")}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0 ${
                selectedFilter === "avaria_dano"
                  ? "bg-purple-600 text-white font-semibold"
                  : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Avarias / Outros ({stats.avarias})
            </button>
          </div>

          {/* Search & Client Filter */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar envio, destinatário..."
                className="w-full h-8 pl-8.5 pr-3 rounded-md bg-[var(--canvas-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {clients.length > 0 && (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="h-8 px-2.5 rounded-md bg-[var(--canvas-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="all">Todos os Clientes</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

        </div>

        {/* Bulk Action Header (if items selected) */}
        {selectedIds.length > 0 && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs animate-in fade-in">
            <span className="font-semibold text-amber-900">
              {selectedIds.length} envio(s) com incidência selecionado(s)
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const first = incidents.find(i => selectedIds.includes(i.id))
                  if (first) setTratarModalShipment(first.rawShipment || first)
                }}
                className="h-7 text-xs bg-white text-amber-900 border-amber-300 hover:bg-amber-100 font-semibold"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Tratar em Lote
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
                className="h-7 text-xs text-amber-800 hover:bg-amber-100/50"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--canvas-bg)] text-[var(--text-secondary)] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredIncidents.length > 0 && selectedIds.length === filteredIncidents.length}
                    onChange={handleSelectAll}
                    className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Envio / Objeto CTT</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Destinatário & Localidade</th>
                <th className="py-3 px-4">Motivo da Incidência</th>
                <th className="py-3 px-4">Tempo / SLA</th>
                <th className="py-3 px-4">Estado Tratamento</th>
                <th className="py-3 px-4 text-right">Ações Operacionais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--surface-bg)]">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-secondary)]">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-full bg-[var(--status-success-soft)] text-[var(--status-success)] flex items-center justify-center mb-3">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        Sem Incidências Pendentes
                      </h3>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        Todos os envios em circulação encontram-se operacionais ou os filtros aplicados não retornaram resultados.
                      </p>
                      {(searchQuery || selectedFilter !== "todos" || selectedClientId !== "all") && (
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
                  const isSelected = selectedIds.includes(item.id)
                  const carrierTracking = item.ctt_object_id || item.tracking_number
                  const internalRef = item.reference || item.tracking_number
                  
                  // SLA alert style
                  const isSlaCritical = item.sla_hours >= 24
                  const isSlaWarning = item.sla_hours >= 12 && item.sla_hours < 24

                  return (
                    <tr 
                      key={item.id}
                      className={`hover:bg-[var(--surface-muted)] transition-colors group ${
                        isSelected ? "bg-amber-50/40" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(item.id)}
                          className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Envio / AWB */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded bg-[var(--status-critical-soft)] text-[var(--status-critical)] flex items-center justify-center shrink-0 border border-[rgba(220,38,38,0.15)] mt-0.5">
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span 
                                onClick={() => setModalShipment(item.rawShipment)}
                                className="font-mono text-xs font-bold text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline cursor-pointer"
                              >
                                {carrierTracking}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(carrierTracking, item.id)}
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
                          <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-[var(--status-critical-soft)] text-[var(--status-critical)] border border-[rgba(220,38,38,0.2)]">
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
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : isSlaWarning
                                ? "bg-amber-100 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {item.sla_hours}h decorridas
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--text-tertiary)] block mt-1">
                          {isSlaCritical ? "SLA Excedido (>24h)" : "Em janela operacional"}
                        </span>
                      </td>

                      {/* Estado Tratamento */}
                      <td className="py-3.5 px-4">
                        {item.status_tratamento === "pendente" && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 inline-block">
                            Pendente Ação
                          </span>
                        )}
                        {item.status_tratamento === "reagendado" && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 inline-block">
                            Reagendado
                          </span>
                        )}
                        {item.status_tratamento === "morada_atualizada" && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 inline-block">
                            Morada Atualizada
                          </span>
                        )}
                        {item.status_tratamento === "em_resolucao" && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                            Em Resolução
                          </span>
                        )}
                      </td>

                      {/* Ações Operacionais */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => setTratarModalShipment(item.rawShipment || item)}
                            className="h-7 text-xs font-semibold px-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-2xs"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Tratar
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setModalShipment(item.rawShipment || item)}
                            title="Ver histórico e eventos de rastreio"
                            className="h-7 w-7 p-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>Mostrando <strong>{filteredIncidents.length}</strong> de <strong>{incidents.length}</strong> ocorrências operacionais</span>
          <div className="flex items-center gap-4 text-[11px] text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--status-critical)]"></span>
              Crítico (&gt;24h)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Aviso (12h-24h)
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

      {/* Tratar Incidência Modal */}
      {tratarModalShipment && (
        <TratarIncidenciaModal
          shipment={tratarModalShipment}
          isOpen={Boolean(tratarModalShipment)}
          onClose={() => setTratarModalShipment(null)}
          onSuccess={() => {
            router.refresh()
          }}
        />
      )}

    </div>
  )
}
