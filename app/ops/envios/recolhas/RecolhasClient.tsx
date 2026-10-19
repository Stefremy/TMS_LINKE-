"use client"

import * as React from "react"
import {
  Package,
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Truck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  ChevronRight,
  Hash,
  Weight,
  RefreshCw,
  Info,
  Building2,
  ChevronDown,
  Wifi,
  Copy,
  Check,
  Search,
  Filter,
  ArrowRight,
} from "lucide-react"
import { scheduleCttPickupAction } from "@/app/actions/ctt"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { DEFAULT_CTT_REQUESTER_PHONE, readPickupContact, readPickupRequester } from "@/lib/pickup-contact"
import type { CTTPickupRequester } from "@/lib/services/ctt/ctt-types"
import type { PickupSummary } from "@/lib/pickup-management"
import { PickupDetailsDialog, PickupSearchPanel } from "./PickupManagement"

interface MappedClient {
  id: string
  code: string
  name: string
  address: string
  city: string
  postal_code: string
  phone: string
  mobile_phone?: string
  email?: string
}

interface CarrierConnection {
  id: string
  label: string
  contract_number: string
  client_number: string
  environment: string
  carrier_code?: string
}

type Recolha = PickupSummary

interface RecolhasClientProps {
  initialError?: string
  requesterContact?: CTTPickupRequester
  recolhas: Recolha[]
  clients: MappedClient[]
  carrierConnections: CarrierConnection[]
}

const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  Agendado:  { label: "Agendado",  color: "bg-blue-50 text-blue-700 border-blue-200",       dot: "bg-blue-500" },
  Realizado: { label: "Realizado", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  Cancelado: { label: "Cancelado", color: "bg-red-50 text-red-600 border-red-200",           dot: "bg-red-500" },
  pendente:  { label: "Pendente",  color: "bg-amber-50 text-amber-700 border-amber-200",     dot: "bg-amber-500" },
  rascunho:  { label: "Rascunho",  color: "bg-slate-100 text-slate-600 border-slate-200",   dot: "bg-slate-400" },
}

function getStatusCfg(status: string) {
  return STATUS_CFG[status] || { label: status, color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" }
}

function tomorrowDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split("T")[0]
}

export function RecolhasClient({ recolhas: initialRecolhas, clients, carrierConnections, requesterContact, initialError }: RecolhasClientProps) {
  const [updatedPickups, setUpdatedPickups] = React.useState<Record<string, PickupSummary>>({})
  const recolhas = initialRecolhas.map(row => updatedPickups[row.id] || row)
  const [view, setView] = React.useState<"list" | "search" | "form">("list")
  const [openedPickup, setOpenedPickup] = React.useState<PickupSummary | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<any>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  // List filters
  const [searchQuery, setSearchQuery] = React.useState("")
  const [carrierFilter, setCarrierFilter] = React.useState<"all" | "ctt_expresso" | "correos_express">("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)

  // Carrier Selection
  // Find first CTT and first Correos connection
  const firstCtt = carrierConnections.find(c => c.carrier_code === "ctt_expresso")
  const firstCorreos = carrierConnections.find(c => c.carrier_code === "correos_express")
  
  const [selectedCarrierCode, setSelectedCarrierCode] = React.useState<"ctt_expresso" | "correos_express">(
    (carrierConnections[0]?.carrier_code === "correos_express" ? "correos_express" : "ctt_expresso")
  )

  const [selectedCarrierId, setSelectedCarrierId] = React.useState(
    carrierConnections[0]?.id || ""
  )

  // Switch carrier code and update connection ID to match
  const handleSelectCarrierTab = (code: "ctt_expresso" | "correos_express") => {
    setSelectedCarrierCode(code)
    setPeriod(code === "ctt_expresso" ? "09:00-19:00" : "10:00-13:00")
    const matchingConn = carrierConnections.find(c => c.carrier_code === code)
    if (matchingConn) {
      setSelectedCarrierId(matchingConn.id)
    } else {
      // If no connection in DB for this carrier, pick first or empty
      setSelectedCarrierId("")
    }
  }

  // Filter connections matching currently chosen carrier tab
  const availableConnectionsForCarrier = carrierConnections.filter(c => c.carrier_code === selectedCarrierCode)

  // Client & Form fields
  const [selectedClientId, setSelectedClientId] = React.useState("")
  const [date, setDate] = React.useState(tomorrowDate())
  const [period, setPeriod] = React.useState(carrierConnections[0]?.carrier_code === "correos_express" ? "10:00-13:00" : "09:00-19:00")
  const [volumes, setVolumes] = React.useState(1)
  const [weightKg, setWeightKg] = React.useState(1)
  const [heaviestWeightKg, setHeaviestWeightKg] = React.useState(1)
  const [dimLength, setDimLength] = React.useState("")
  const [dimWidth, setDimWidth] = React.useState("")
  const [dimHeight, setDimHeight] = React.useState("")
  const [destination, setDestination] = React.useState("PT")
  const [guideStatus, setGuideStatus] = React.useState("Disponível no local")

  const [senderName, setSenderName] = React.useState("Armazém Principal")
  const [senderContact, setSenderContact] = React.useState("")
  const [senderEmail, setSenderEmail] = React.useState("")
  const [senderCountry, setSenderCountry] = React.useState("PT")
  const [senderAddress, setSenderAddress] = React.useState("Rua do Ouro, 100")
  const [senderZip, setSenderZip] = React.useState("4000-001")
  const [senderCity, setSenderCity] = React.useState("Porto")
  const [senderPhone, setSenderPhone] = React.useState("")
  const [senderMobile, setSenderMobile] = React.useState("")
  const [observations, setObservations] = React.useState("")

  // Auto-fill address fields when a client is chosen
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId)
    const client = clients.find(c => c.id === clientId)
    if (client) {
      setSenderName(client.name)
      setSenderContact(client.name)
      setSenderEmail(client.email || "")
      setSenderAddress(client.address || senderAddress)
      setSenderZip(client.postal_code || senderZip)
      setSenderCity(client.city || senderCity)
      setSenderPhone(client.phone || "")
      setSenderMobile(client.mobile_phone || "")
    }
  }

  const selectedCarrier = carrierConnections.find(c => c.id === selectedCarrierId) || availableConnectionsForCarrier[0]

  const handleCopy = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const updateVolumeCount = (count: number) => {
    const next = Math.max(1, count)
    setVolumes(next)
    if (next === 1) setHeaviestWeightKg(weightKg)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const submittedContact = readPickupContact(formData)
    const submittedRequester = readPickupRequester(formData)
    if (isCttActive && (!submittedRequester.name || (!submittedRequester.phone && !submittedRequester.mobilePhone))) {
      setResult({ success: false, error: "Preencha o contacto e um telefone ou telemóvel nos Dados do cliente CTT." })
      return
    }
    if (isCttActive && !submittedContact.phone) {
      setResult({
        success: false,
        error: "Não foi indicado telefone. Os CTT exigem um número de contacto válido. Preencha o telefone principal ou o telemóvel alternativo; sem telefone, não é possível agendar por este serviço.",
      })
      return
    }
    if (volumes > 1 && (!Number.isFinite(heaviestWeightKg) || heaviestWeightKg <= 0 || heaviestWeightKg > weightKg)) {
      setResult({ success: false, error: "O peso do volume mais pesado deve ser maior que 0 e não pode ultrapassar o peso total." })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const baseObs = observations
      const guideObs = guideStatus === "Necessário levar" ? " | Necessário levar guia de transporte" : ""
      const finalObs = `${baseObs}${guideObs}`

      const [startHour, endHour] = period.split("-")

      const res = await scheduleCttPickupAction({
        requester: isCttActive ? submittedRequester : undefined,
        connection_id: selectedCarrier?.id || selectedCarrierId,
        carrier_code: selectedCarrierCode,
        client_id: selectedClientId || undefined,
        date,
        startHour,
        endHour,
        volumes,
        weightKg,
        heaviestWeightKg: volumes > 1 ? heaviestWeightKg : weightKg,
        pickupDestination: isCttActive ? destination as "PT" | "ES" | "RM" : undefined,
        biggestParcelDimensionsCm: isCttActive ? {
          length: Number(dimLength),
          width: Number(dimWidth),
          height: Number(dimHeight),
        } : undefined,
        sender: {
          name: senderName,
          contact: senderContact,
          country: senderCountry,
          email: senderEmail,
          address: senderAddress,
          zip: senderZip,
          city: senderCity,
          ...submittedContact,
        },
        observations: finalObs || undefined,
      })
      setResult(res)
    } catch (err: any) {
      setResult({ success: false, error: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Filter recolhas list
  const filteredRecolhas = recolhas.filter((r) => {
    const scheduledDate = r.scheduled_date.slice(0, 10)
    if (invalidDateRange || (dateFrom && scheduledDate < dateFrom) || (dateTo && scheduledDate > dateTo)) return false
    if (carrierFilter !== "all") {
      const matchesCarrier = r.carrier_code === carrierFilter || 
        (carrierFilter === "correos_express" && (r.ctt_pickup_id || "").startsWith("CEX")) ||
        (carrierFilter === "ctt_expresso" && !(r.ctt_pickup_id || "").startsWith("CEX"))
      if (!matchesCarrier) return false
    }

    if (statusFilter !== "all" && r.status !== statusFilter) {
      return false
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const client = clients.find(c => c.id === r.client_id)
      const matchesQuery = 
        (r.ctt_pickup_id || "").toLowerCase().includes(q) ||
        (r.sender_name || "").toLowerCase().includes(q) ||
        (r.sender_city || "").toLowerCase().includes(q) ||
        (client?.name || "").toLowerCase().includes(q) ||
        (client?.code || "").toLowerCase().includes(q)
      if (!matchesQuery) return false
    }

    return true
  })

  // Counts for quick filter tabs
  const cttCount = recolhas.filter(r => r.carrier_code === "ctt_expresso" || !String(r.ctt_pickup_id || "").startsWith("CEX")).length
  const correosCount = recolhas.filter(r => r.carrier_code === "correos_express" || String(r.ctt_pickup_id || "").startsWith("CEX")).length

  const isCttActive = selectedCarrierCode === "ctt_expresso"
  const isCorreosActive = selectedCarrierCode === "correos_express"

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-[var(--surface-bg)] rounded-xl shadow-sm border border-[var(--border-subtle)] overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex flex-wrap gap-3 items-center justify-between shrink-0 bg-[var(--surface-muted)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent)] shadow-xs">
            <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[var(--text-primary)]">Pedidos de Recolha</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Multi-Operadora
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Recolhas recentes · Use a pesquisa para consultar o histórico por data
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setView("list"); setResult(null) }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5 ${
              view === "list"
                ? "bg-[var(--text-primary)] text-[var(--surface-bg)] border-[var(--text-primary)] shadow-xs"
                : "bg-[var(--surface-bg)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            Lista de Recolhas
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/60 dark:bg-slate-700 font-mono">
              {recolhas.length}
            </span>
          </button>
          <button
            onClick={() => { setView("search"); setResult(null) }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5 ${view === "search" ? "bg-[var(--text-primary)] text-[var(--surface-bg)] border-[var(--text-primary)]" : "bg-[var(--surface-bg)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"}`}
          ><Search className="h-3.5 w-3.5" />Pesquisar</button>
          <button
            onClick={() => { setView("form"); setResult(null) }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5 shadow-xs ${
              view === "form"
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "bg-[var(--surface-bg)] text-[var(--accent)] border-[rgba(18,138,71,0.3)] hover:bg-[var(--accent-soft)]"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Recolha
          </button>
        </div>
      </div>

      {initialError && view === "list" && <p role="alert" className="m-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{initialError} Tente novamente no separador Pesquisar.</p>}
      {view === "search" ? (
        <PickupSearchPanel onOpen={setOpenedPickup} updatedPickups={updatedPickups} connections={carrierConnections.filter(c => c.carrier_code === "ctt_expresso")} />
      ) : view === "list" ? (
        /* ───── LIST VIEW ───── */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* Filter Bar */}
          <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-bg)] flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Search */}
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Pesquisar por PickUp ID, cliente, morada..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Carrier Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-[var(--surface-muted)] p-1 rounded-lg border border-[var(--border-subtle)]">
              <button
                onClick={() => setCarrierFilter("all")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  carrierFilter === "all"
                    ? "bg-[var(--surface-bg)] text-[var(--text-primary)] shadow-xs"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Todas ({recolhas.length})
              </button>
              <button
                onClick={() => setCarrierFilter("ctt_expresso")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  carrierFilter === "ctt_expresso"
                    ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 shadow-xs"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500" />
                CTT Expresso ({cttCount})
              </button>
              <button
                onClick={() => setCarrierFilter("correos_express")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  carrierFilter === "correos_express"
                    ? "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shadow-xs"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Correos Express ({correosCount})
              </button>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs font-semibold bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-[var(--text-secondary)] focus:outline-none"
              >
                <option value="all">Todos os Estados</option>
                <option value="Agendado">Agendado</option>
                <option value="Realizado">Realizado</option>
                <option value="Cancelado">Cancelado</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-bg)] px-6 py-3">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Data de recolha — desde
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} className="mt-1 block rounded-lg border border-[var(--border-strong)] bg-[var(--surface-bg)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]" />
            </label>
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Até
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="mt-1 block rounded-lg border border-[var(--border-strong)] bg-[var(--surface-bg)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]" />
            </label>
            {(dateFrom || dateTo) && <button type="button" onClick={() => { setDateFrom(""); setDateTo("") }} className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Limpar datas</button>}
            <p className="text-xs text-[var(--text-secondary)]">Filtra as recolhas recentes. Para pesquisar todo o histórico, use <button type="button" onClick={() => setView("search")} className="font-semibold text-[var(--accent)] underline">Pesquisar</button>.</p>
            {invalidDateRange && <p role="alert" className="w-full text-xs text-red-700">A data final deve ser igual ou posterior à data inicial.</p>}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {filteredRecolhas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-[var(--surface-muted)] border border-[var(--border-strong)] flex items-center justify-center text-[var(--text-tertiary)]">
                  <Package className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-base font-bold text-[var(--text-primary)]">Nenhuma recolha encontrada</p>
                  <p className="text-sm text-[var(--text-tertiary)] mt-1 max-w-sm">
                    {searchQuery || carrierFilter !== "all" || statusFilter !== "all" || dateFrom || dateTo
                      ? "Nenhum agendamento coincide com os filtros aplicados."
                      : "Agende recolhas CTT Expresso ou Correos Express diretamente a partir deste painel."}
                  </p>
                </div>
                <button
                  onClick={() => setView("form")}
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agendar Nova Recolha
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[var(--surface-bg)] sticky top-0 z-10 shadow-[0_1px_0_0_var(--border-subtle)]">
                  <tr>
                    <th className="px-5 py-3 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wide">Operadora</th>
                    <th className="px-5 py-3 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wide">PickUp ID</th>
                    <th className="px-5 py-3 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wide">Cliente</th>
                    <th className="px-5 py-3 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wide">Data / Janela</th>
                    <th className="px-5 py-3 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wide">Local de Recolha</th>
                    <th className="px-5 py-3 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wide">Volumes / Pesos</th>
                    <th className="px-5 py-3 font-bold text-[var(--text-secondary)] text-xs uppercase tracking-wide">Estado</th>
                    <th className="px-5 py-3"><span className="sr-only">Detalhes</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredRecolhas.map((r) => {
                    const cfg = getStatusCfg(r.status)
                    const client = clients.find(c => c.id === r.client_id)
                    const isCorreos = r.carrier_code === "correos_express" || String(r.ctt_pickup_id || "").startsWith("CEX")
                    const carrierLogo = getCarrierLogo(isCorreos ? "correos_express" : "ctt_expresso")

                    return (
                      <tr key={r.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                        {/* Carrier Badge */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {carrierLogo ? (
                              <div className="w-7 h-7 rounded-md bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                                <img
                                  src={carrierLogo}
                                  alt={isCorreos ? "Correos Express" : "CTT Expresso"}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ) : null}
                            <div>
                              <div className="font-bold text-[12px] text-[var(--text-primary)]">
                                {isCorreos ? "Correos Express" : "CTT Expresso"}
                              </div>
                              <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                                {isCorreos ? "CEX WebService" : "RecolhasWS"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* PickUp ID */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setOpenedPickup(r)} className="font-mono font-bold text-[var(--accent)] text-[13px] hover:underline underline-offset-4">
                              {r.ctt_pickup_id || "—"}
                            </button>
                            {r.ctt_pickup_id && (
                              <button
                                onClick={() => handleCopy(r.ctt_pickup_id!)}
                                title="Copiar PickUp ID"
                                className="text-slate-400 hover:text-slate-700 transition-colors p-1"
                              >
                                {copiedId === r.ctt_pickup_id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--text-tertiary)] font-mono mt-0.5">
                            REF: {r.id.slice(0, 8).toUpperCase()}
                          </div>
                        </td>

                        {/* Client */}
                        <td className="px-5 py-4">
                          {client ? (
                            <div>
                              <div className="font-semibold text-[var(--text-primary)]">{client.name}</div>
                              <div className="text-[11px] text-[var(--text-tertiary)]">{client.code}</div>
                            </div>
                          ) : (
                            <span className="text-[var(--text-tertiary)] text-[12px]">Interno / Sem Cliente</span>
                          )}
                        </td>

                        {/* Date / Time */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                            <Calendar className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                            {r.scheduled_date || "—"}
                          </div>
                          {r.period && (
                            <div className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] mt-0.5 font-mono">
                              <Clock className="w-3 h-3 shrink-0" />
                              {r.period}
                            </div>
                          )}
                        </td>

                        {/* Location */}
                        <td className="px-5 py-4 max-w-xs">
                          <div className="font-semibold text-[var(--text-primary)] truncate">{r.sender_name || "Armazém Principal"}</div>
                          <div className="text-[11px] text-[var(--text-tertiary)] truncate">{r.sender_address || "—"}</div>
                        </td>

                        {/* Volumes / Weight */}
                        <td className="px-5 py-4">
                          <div className="text-[var(--text-primary)] font-semibold">{r.volumes ?? 1} vol.</div>
                          <div className="text-[11px] text-[var(--text-tertiary)]">Total: {r.weight_kg ?? 1} kg</div>
                          {r.heaviest_weight_kg != null && (r.volumes ?? 1) > 1 && (
                            <div className="text-[11px] text-[var(--text-tertiary)]">Mais pesado: {r.heaviest_weight_kg} kg</div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-4"><button onClick={() => setOpenedPickup(r)} className="whitespace-nowrap rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]">Ver detalhes</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* ───── FORM VIEW ───── */
        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto w-full p-4 sm:p-6">

            {result && (result.success || result.Success) ? (
              /* ── Success State ── */
              <div className="space-y-4">
                <div className="p-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                      Recolha Agendada com Sucesso!
                    </h3>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                      O pedido de recolha foi confirmado nos WebServices da {result.carrier_name || (selectedCarrierCode === "correos_express" ? "Correos Express" : "CTT Expresso")}.
                      O estafeta passará na morada indicada na janela horária estabelecida.
                    </p>
                  </div>
                </div>

                <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Detalhes da Confirmação</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-[var(--text-secondary)] border border-slate-200 dark:border-slate-700">
                      {result.carrier_name || (selectedCarrierCode === "correos_express" ? "Correos Express" : "CTT Expresso")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                    <span className="text-sm text-slate-500 flex items-center gap-2">
                      <Hash className="w-4 h-4 text-indigo-500" />
                      PickUp ID ({result.carrier_name || (selectedCarrierCode === "correos_express" ? "Correos" : "CTT")})
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-indigo-700 dark:text-indigo-400 text-lg tracking-wider">
                        {result.pickupNumber || result.PickUpID}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(result.pickupNumber || result.PickUpID)}
                        className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                        title="Copiar PickUp ID"
                      >
                        {copiedId === (result.pickupNumber || result.PickUpID) ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                    <span className="text-sm text-slate-500 flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> Data de Recolha</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{date}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                    <span className="text-sm text-slate-500 flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /> Período Previsto</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{period}</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500 flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> Morada de Recolha</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                      {senderAddress}<br />
                      <span className="text-slate-400 font-normal text-xs">{senderZip} {senderCity}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => { setView("list"); setResult(null); window.location.reload() }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-[var(--border-subtle)]"
                  >
                    Ver Lista de Recolhas
                  </button>
                  <button
                    type="button"
                    onClick={() => { setResult(null); setVolumes(1); setWeightKg(1); setHeaviestWeightKg(1) }}
                    className="flex items-center gap-2 px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-bold rounded-xl shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Agendar Outra Recolha
                  </button>
                </div>
              </div>
            ) : (
              /* ── Form ── */
              <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-sm sm:p-6">

                {/* Error */}
                {result && !result.success && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-700 dark:text-red-300">Falha ao agendar recolha</p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{result.error || "Erro na comunicação com o webservice da operadora."}</p>
                    </div>
                  </div>
                )}

                {isCttActive && (
                  <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                      <Building2 className="h-4 w-4" /> Dados do cliente CTT — Linke
                    </h2>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">Empresa que solicita a recolha. Pode editar estes contactos para esta marcação; são independentes do local de recolha.</p>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">Contacto *
                        <input name="requesterName" required maxLength={50} defaultValue={requesterContact?.name || ""} autoComplete="section-ctt-requester organization" className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" />
                      </label>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">Email
                        <input name="requesterEmail" type="email" maxLength={50} defaultValue={requesterContact?.email || ""} autoComplete="section-ctt-requester email" className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" />
                      </label>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">Telefone
                        <input name="requesterPhone" type="tel" defaultValue={requesterContact?.phone || DEFAULT_CTT_REQUESTER_PHONE} autoComplete="section-ctt-requester-phone tel" className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" />
                      </label>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">Telemóvel
                        <input name="requesterMobile" type="tel" defaultValue={requesterContact?.mobilePhone || ""} autoComplete="section-ctt-requester-mobile tel" className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" />
                      </label>
                    </div>
                    <p className="mt-3 text-xs text-[var(--text-secondary)]">Se deixar o telefone vazio, será usado {DEFAULT_CTT_REQUESTER_PHONE} como contacto do solicitante. O telemóvel e os contactos do local de recolha mantêm os seus próprios valores.</p>
                  </section>
                )}

                {/* ── Section 0: Transportadora & Conta ── */}
                <div className="bg-[var(--surface-muted)] rounded-xl border border-[var(--border-subtle)] p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      1. Selecionar Operadora de Transporte
                    </h2>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      Escolha com que transportadora pretende agendar
                    </span>
                  </div>

                  {/* Carrier Segmented Switcher */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* CTT Expresso Card */}
                    <button
                      type="button"
                      onClick={() => handleSelectCarrierTab("ctt_expresso")}
                      className={`relative flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                        isCttActive
                          ? "border-red-700 bg-red-700 text-white shadow-sm"
                          : "border-[var(--border-strong)] bg-[var(--surface-bg)] text-[var(--text-primary)] hover:border-red-700"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                        <img
                          src={getCarrierLogo("ctt_expresso") || ""}
                          alt="CTT Expresso"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${isCttActive ? "text-white" : "text-[var(--text-primary)]"}`}>CTT Expresso</span>
                          {isCttActive && (
                            <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                          )}
                        </div>
                        <p className={`text-[11px] truncate ${isCttActive ? "text-white/80" : "text-[var(--text-tertiary)]"}`}>RecolhasWS • Directo CTT</p>
                      </div>
                    </button>

                    {/* Correos Express Card */}
                    <button
                      type="button"
                      onClick={() => handleSelectCarrierTab("correos_express")}
                      className={`relative flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                        isCorreosActive
                          ? "border-amber-700 bg-amber-700 text-white shadow-sm"
                          : "border-[var(--border-strong)] bg-[var(--surface-bg)] text-[var(--text-primary)] hover:border-amber-700"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                        <img
                          src={getCarrierLogo("correos_express") || ""}
                          alt="Correos Express"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${isCorreosActive ? "text-white" : "text-[var(--text-primary)]"}`}>Correos Express</span>
                          {isCorreosActive && (
                            <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                          )}
                        </div>
                        <p className={`text-[11px] truncate ${isCorreosActive ? "text-white/80" : "text-[var(--text-tertiary)]"}`}>WebServices • CEX API</p>
                      </div>
                    </button>
                  </div>

                  {/* Account / Connection Selection & Client Association */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                    {/* Carrier Account */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Conta / Contrato {isCorreosActive ? "Correos Express" : "CTT Expresso"}
                      </label>
                      {availableConnectionsForCarrier.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-2 border border-slate-300 bg-white dark:bg-slate-800 rounded-lg text-xs text-[var(--text-secondary)]">
                          <Wifi className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Conta padrão configurada no sistema</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <Wifi className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <select
                            value={selectedCarrierId}
                            onChange={e => setSelectedCarrierId(e.target.value)}
                            className="w-full pl-9 pr-8 border border-slate-300 dark:border-slate-700 rounded-lg py-2 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {availableConnectionsForCarrier.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      )}
                      {selectedCarrier && (
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500 font-mono">
                          <span>Contrato: {selectedCarrier.contract_number}</span>
                          <span>•</span>
                          <span className={selectedCarrier.environment === "production" ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                            {selectedCarrier.environment === "production" ? "Produção" : "Sandbox/QA"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Client Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Cliente Associado (Preenche Morada)
                      </label>
                      <div className="relative">
                        <Building2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <select
                          value={selectedClientId}
                          onChange={e => handleClientChange(e.target.value)}
                          className="w-full pl-9 pr-8 border border-slate-300 dark:border-slate-700 rounded-lg py-2 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">— Recolha Interna / Sem Cliente —</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.code ? `[${c.code}] ` : ""}{c.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      {selectedClientId && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Dados de morada preenchidos automaticamente
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Section 1: Quando ── */}
                <div className="bg-[var(--surface-muted)] rounded-xl border border-[var(--border-subtle)] p-5 shadow-xs">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[var(--accent)]" />
                    2. Quando — Data e Janela Horária
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Data da Recolha *</label>
                      <input
                        required
                        type="date"
                        value={date}
                        min={tomorrowDate()}
                        onChange={e => setDate(e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Período de Recolha *</label>
                      <select
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                      >
                        {isCttActive ? (
                          <option value="09:00-19:00">09h00 - 19h00 — Dia inteiro</option>
                        ) : (
                          <>
                            <option value="08:00-10:00">08h00 - 10h00</option>
                            <option value="10:00-13:00">10h00 - 13h00</option>
                            <option value="13:00-16:00">13h00 - 16h00</option>
                            <option value="16:00-19:00">16h00 - 19h00</option>
                            <option value="19:00-22:00">19h00 - 22h00</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    {isCorreosActive
                      ? "O estafeta da Correos Express passará na morada do remetente na data indicada."
                      : "Os CTT efetuam a recolha entre as 09h00 e as 19h00, sem hora específica garantida."}
                  </p>
                </div>

                {/* ── Section 2: Morada ── */}
                <div className="bg-[var(--surface-muted)] rounded-xl border border-[var(--border-subtle)] p-5 shadow-xs">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--accent)]" />
                    3. Onde — Morada de Recolha
                  </h2>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Nome / Empresa *</label>
                        <div className="relative">
                          <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            required
                            type="text"
                            value={senderName}
                            onChange={e => setSenderName(e.target.value)}
                            placeholder="Armazém / Empresa"
                            className="w-full pl-9 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Pessoa de Contacto</label>
                        <input
                          type="text"
                          value={senderContact}
                          onChange={e => setSenderContact(e.target.value)}
                          placeholder="Nome de quem entrega"
                          className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">País</label>
                      <select
                        value={senderCountry}
                        onChange={e => setSenderCountry(e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                      >
                        <option value="PT">Portugal</option>
                        <option value="ES">Espanha</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Morada (Rua, Nº, Andar) *</label>
                      <input
                        required
                        type="text"
                        value={senderAddress}
                        onChange={e => setSenderAddress(e.target.value)}
                        placeholder="Rua Principal, 100"
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Código Postal *</label>
                        <input
                          required
                          type="text"
                          value={senderZip}
                          onChange={e => setSenderZip(e.target.value)}
                          placeholder="0000-000"
                          className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Localidade *</label>
                        <input
                          required
                          type="text"
                          value={senderCity}
                          onChange={e => setSenderCity(e.target.value)}
                          placeholder="Porto"
                          className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Email</label>
                        <input
                          type="email"
                          value={senderEmail}
                          onChange={e => setSenderEmail(e.target.value)}
                          placeholder="contacto@empresa.pt"
                          className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Telefone Principal</label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="tel"
                            name="pickupPhone"
                            autoComplete="section-pickup-phone tel"
                            value={senderPhone}
                            onChange={e => setSenderPhone(e.target.value)}
                            className="w-full pl-9 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Telemóvel</label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="tel"
                            name="pickupMobilePhone"
                            autoComplete="section-pickup-mobile tel"
                            value={senderMobile}
                            onChange={e => setSenderMobile(e.target.value)}
                            className="w-full pl-9 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="col-span-3 -mt-2 text-[11px] text-[var(--text-tertiary)]">
                      O telefone principal é opcional se preencher o telemóvel alternativo. Os CTT exigem pelo menos um número válido; sem telefone, não é possível agendar por este serviço.
                    </p>
                  </div>
                </div>

                {/* ── Section 3: Volumes e Dimensões ── */}
                <div className="bg-[var(--surface-muted)] rounded-xl border border-[var(--border-subtle)] p-5 shadow-xs">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <Weight className="w-4 h-4 text-[var(--accent)]" />
                    4. O Quê — Dados dos Volumes
                  </h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Nº de Volumes *</label>
                      <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                        <button
                          type="button"
                          onClick={() => updateVolumeCount(volumes - 1)}
                          className="px-3 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-lg leading-none transition-colors"
                        >−</button>
                        <input
                          required
                          type="number"
                          min={1}
                          value={volumes}
                          onChange={e => updateVolumeCount(parseInt(e.target.value) || 1)}
                          className="flex-1 text-center text-sm font-bold text-slate-800 dark:text-slate-200 py-2 focus:outline-none bg-white dark:bg-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => updateVolumeCount(volumes + 1)}
                          className="px-3 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-lg leading-none transition-colors"
                        >+</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Peso Total (kg) *</label>
                      <div className="relative">
                        <input
                          required
                          type="number"
                          min={0.1}
                          step={0.1}
                          value={weightKg}
                          onChange={e => {
                            const next = parseFloat(e.target.value) || 1
                            setWeightKg(next)
                            if (volumes === 1 || heaviestWeightKg > next) setHeaviestWeightKg(next)
                          }}
                          className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">kg</span>
                      </div>
                    </div>
                    {volumes > 1 && (
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Peso do Volume Mais Pesado (kg) *</label>
                        <div className="relative">
                          <input
                            required
                            type="number"
                            min={0.1}
                            max={weightKg}
                            step={0.1}
                            value={heaviestWeightKg}
                            onChange={e => setHeaviestWeightKg(parseFloat(e.target.value) || 0)}
                            className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">kg</span>
                        </div>
                        <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Indique o peso de um único volume; tem de ser igual ou inferior ao total. Os CTT exigem que o peso enviado à API corresponda ao total; o TMS guarda este valor separado.</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Guia de Transporte:</label>
                      <select
                        value={guideStatus}
                        onChange={e => setGuideStatus(e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                      >
                        <option value="Disponível no local">Guia disponível no local de Recolha</option>
                        <option value="Necessário levar">Necessário levar guia de transporte</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Dimensões do Maior Volume (cm) {isCttActive && "*"}</label>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 w-1/3">
                          <span className="text-xs font-semibold text-[var(--text-secondary)]">C:</span>
                          <input type="number" aria-label="Comprimento do maior volume em centímetros" placeholder="Comp" min={1} max={299} step={1} required={isCttActive} value={dimLength} onChange={e => setDimLength(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-xs text-center text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800" />
                        </div>
                        <div className="flex items-center gap-1 w-1/3">
                          <span className="text-xs font-semibold text-[var(--text-secondary)]">L:</span>
                          <input type="number" aria-label="Largura do maior volume em centímetros" placeholder="Larg" min={1} max={299} step={1} required={isCttActive} value={dimWidth} onChange={e => setDimWidth(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-xs text-center text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800" />
                        </div>
                        <div className="flex items-center gap-1 w-1/3">
                          <span className="text-xs font-semibold text-[var(--text-secondary)]">A:</span>
                          <input type="number" aria-label="Altura do maior volume em centímetros" placeholder="Alt" min={1} max={299} step={1} required={isCttActive} value={dimHeight} onChange={e => setDimHeight(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-xs text-center text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800" />
                        </div>
                      </div>
                    </div>
                  </div>
                  {isCttActive && <p className="-mt-2 mb-4 text-[10px] text-[var(--text-tertiary)]">Indique as medidas inteiras do maior volume em centímetros (1–299 cm).</p>}

                  <div className="w-1/2 pr-2">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Destino Previsto</label>
                    <select
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                    >
                      <option value="PT">Portugal Continental e Ilhas</option>
                      <option value="ES">Espanha Peninsular</option>
                      <option value="RM">Resto do Mundo / Internacional</option>
                    </select>
                  </div>
                </div>

                {/* Observations */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Instruções ou Observações para o Motorista
                  </label>
                  <textarea
                    rows={2}
                    value={observations}
                    onChange={e => setObservations(e.target.value)}
                    placeholder="Ex: Tocar ao portão azul, recolher na secção de expedição 2…"
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                  />
                </div>

                {/* Submit Bar */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => { setView("list"); setResult(null) }}
                    className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex items-center gap-2 px-6 py-2.5 text-white font-bold rounded-xl shadow-xs transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed ${
                      isCorreosActive
                        ? "bg-amber-600 hover:bg-amber-700 focus:ring-2 focus:ring-amber-500"
                        : "bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500"
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        A comunicar com {isCorreosActive ? "Correos Express" : "CTT Expresso"}…
                      </>
                    ) : (
                      <>
                        <Truck className="w-4 h-4" />
                        Agendar Recolha {isCorreosActive ? "Correos Express" : "CTT Expresso"}
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {openedPickup && <PickupDetailsDialog key={`${openedPickup.source}:${openedPickup.id}`} selected={openedPickup} onClose={() => setOpenedPickup(null)} onUpdated={pickup => setUpdatedPickups(previous => ({ ...previous, [pickup.id]: pickup }))} />}
    </div>
  )
}
