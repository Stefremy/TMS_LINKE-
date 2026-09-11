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
} from "lucide-react"
import { scheduleCttPickupAction } from "@/app/actions/ctt"

interface MappedClient {
  id: string
  code: string
  name: string
  address: string
  city: string
  postal_code: string
  phone: string
}

interface CttConnection {
  id: string
  label: string
  contract_number: string
  client_number: string
  environment: string
}

interface Recolha {
  id: string
  ctt_pickup_id?: string
  status: string
  scheduled_date?: string
  created_at: string
  volumes?: number
  weight_kg?: number
  sender_name?: string
  sender_address?: string
  sender_city?: string
  observations?: string
  client_id?: string
}

interface RecolhasClientProps {
  recolhas: Recolha[]
  clients: MappedClient[]
  cttConnections: CttConnection[]
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

export function RecolhasClient({ recolhas, clients, cttConnections }: RecolhasClientProps) {
  const [view, setView] = React.useState<"list" | "form">("list")
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<any>(null)

  // Client & CTT account
  const [selectedClientId, setSelectedClientId] = React.useState("")
  const [selectedCttId, setSelectedCttId] = React.useState(cttConnections[0]?.id || "")

  // Form fields
  const [date, setDate] = React.useState(tomorrowDate())
  const [startHour, setStartHour] = React.useState("09:00")
  const [endHour, setEndHour] = React.useState("18:00")
  const [volumes, setVolumes] = React.useState(1)
  const [weightKg, setWeightKg] = React.useState(5)
  const [senderName, setSenderName] = React.useState("Armazém Principal")
  const [senderAddress, setSenderAddress] = React.useState("Rua do Ouro, 100")
  const [senderZip, setSenderZip] = React.useState("4000-001")
  const [senderCity, setSenderCity] = React.useState("Porto")
  const [senderPhone, setSenderPhone] = React.useState("910000000")
  const [observations, setObservations] = React.useState("")

  // When client is selected, auto-fill address fields
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId)
    const client = clients.find(c => c.id === clientId)
    if (client) {
      setSenderName(client.name)
      setSenderAddress(client.address || senderAddress)
      setSenderZip(client.postal_code || senderZip)
      setSenderCity(client.city || senderCity)
      setSenderPhone(client.phone || senderPhone)
    }
  }

  const selectedCtt = cttConnections.find(c => c.id === selectedCttId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const res = await scheduleCttPickupAction({
        date,
        startHour,
        endHour,
        volumes,
        weightKg,
        sender: {
          name: senderName,
          address: senderAddress,
          zip: senderZip,
          city: senderCity,
          phone: senderPhone,
        },
        observations: observations || undefined,
      })
      setResult(res)
      if (res.Success) {
        setTimeout(() => {
          window.location.reload()
        }, 2800)
      }
    } catch (err: any) {
      setResult({ Success: false, message: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Pedidos de Recolha</h1>
            <p className="text-xs text-slate-500">
              Agendamento direto via CTT Expresso WebServices (RecolhasWS)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setView("list"); setResult(null) }}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
              view === "list"
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => { setView("form"); setResult(null) }}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
              view === "form"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
            }`}
          >
            <Plus className="w-4 h-4" />
            Nova Recolha
          </button>
        </div>
      </div>

      {view === "list" ? (
        /* ───── LIST VIEW ───── */
        <div className="flex-1 overflow-auto">
          {recolhas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-400">
                <Package className="w-8 h-8" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-700">Nenhuma recolha agendada</p>
                <p className="text-sm text-slate-400 mt-1 max-w-sm">
                  Agende a primeira recolha CTT Expresso diretamente a partir deste painel, sem precisar da App CTT.
                </p>
              </div>
              <button
                onClick={() => setView("form")}
                className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Agendar Primeira Recolha
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-white sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
                <tr>
                  <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">PickUp ID</th>
                  <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">Cliente</th>
                  <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">Data / Horário</th>
                  <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">Morada</th>
                  <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">Vol / Peso</th>
                  <th className="px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recolhas.map((r) => {
                  const cfg = getStatusCfg(r.status)
                  const client = clients.find(c => c.id === r.client_id)
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-blue-700 text-[13px]">
                          {r.ctt_pickup_id || "—"}
                        </span>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {r.id.slice(0, 8).toUpperCase()}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {client ? (
                          <div>
                            <div className="font-semibold text-slate-800">{client.name}</div>
                            <div className="text-[11px] text-slate-400">{client.code}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {r.scheduled_date || "—"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800">{r.sender_name || "Armazém Principal"}</div>
                        <div className="text-[11px] text-slate-400">{r.sender_address || "—"}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-slate-800 font-semibold">{r.volumes ?? "—"} vol.</div>
                        <div className="text-[11px] text-slate-400">{r.weight_kg ?? "—"} kg</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* ───── FORM VIEW ───── */
        <div className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto p-6">

            {result?.Success ? (
              /* ── Success State ── */
              <div className="space-y-4">
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-800">Recolha Agendada com Sucesso!</h3>
                    <p className="text-sm text-emerald-700 mt-1">
                      O pedido de recolha foi registado nos CTT Expresso. Um estafeta passará no endereço indicado.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Detalhes do Agendamento</p>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500 flex items-center gap-2"><Hash className="w-4 h-4" /> PickUp ID CTT</span>
                    <span className="font-mono font-black text-blue-700 text-lg tracking-wider">{result.PickUpID}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500 flex items-center gap-2"><Calendar className="w-4 h-4" /> Data</span>
                    <span className="font-semibold text-slate-800">{date}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500 flex items-center gap-2"><Clock className="w-4 h-4" /> Janela</span>
                    <span className="font-semibold text-slate-800">{startHour} – {endHour}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500 flex items-center gap-2"><MapPin className="w-4 h-4" /> Morada</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {senderAddress}<br />
                      <span className="text-slate-400 font-normal text-xs">{senderZip} {senderCity}</span>
                    </span>
                  </div>
                </div>

                <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  A atualizar lista de recolhas…
                </p>
              </div>
            ) : (
              /* ── Form ── */
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Error */}
                {result && !result.Success && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-700">Falha ao agendar recolha</p>
                      <p className="text-xs text-red-600 mt-0.5">{result.message || "Erro na comunicação com os CTT."}</p>
                    </div>
                  </div>
                )}

                {/* ── Section 0: Cliente & Conta CTT ── */}
                <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5">
                  <h2 className="text-sm font-bold text-indigo-800 mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Quem — Cliente e Conta CTT Expresso
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Client selector */}
                    <div>
                      <label className="block text-xs font-semibold text-indigo-700 mb-1">
                        Cliente Associado
                      </label>
                      <div className="relative">
                        <Building2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <select
                          value={selectedClientId}
                          onChange={e => handleClientChange(e.target.value)}
                          className="w-full pl-9 pr-8 border border-slate-300 rounded-lg py-2 text-sm text-slate-800 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                        <p className="text-[11px] text-indigo-600 mt-1.5 font-medium">
                          ✓ Dados de endereço preenchidos automaticamente
                        </p>
                      )}
                    </div>

                    {/* CTT Account selector */}
                    <div>
                      <label className="block text-xs font-semibold text-indigo-700 mb-1">
                        Conta CTT Expresso
                      </label>
                      {cttConnections.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg text-xs text-amber-700 font-medium">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          Nenhuma conta CTT configurada.
                          <a href="/ops/configuracao/webservices" className="underline ml-1">Configurar</a>
                        </div>
                      ) : (
                        <div className="relative">
                          <Wifi className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <select
                            value={selectedCttId}
                            onChange={e => setSelectedCttId(e.target.value)}
                            className="w-full pl-9 pr-8 border border-slate-300 rounded-lg py-2 text-sm text-slate-800 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {cttConnections.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      )}
                      {selectedCtt && (
                        <p className="text-[11px] text-slate-500 mt-1.5 font-mono">
                          Contrato {selectedCtt.contract_number}
                          {" · "}
                          <span className={selectedCtt.environment === "production" ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                            {selectedCtt.environment === "production" ? "● Produção" : "● QA"}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Section 1: Quando ── */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                  <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Quando — Data e Horário
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Recolha *</label>
                      <input
                        required
                        type="date"
                        value={date}
                        min={tomorrowDate()}
                        onChange={e => setDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Hora de Início *</label>
                      <input
                        required
                        type="time"
                        value={startHour}
                        onChange={e => setStartHour(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Hora de Fim *</label>
                      <input
                        required
                        type="time"
                        value={endHour}
                        onChange={e => setEndHour(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    O estafeta CTT passará dentro da janela horária indicada. Recomendado: 09:00 – 18:00.
                  </p>
                </div>

                {/* ── Section 2: Morada ── */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                  <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    Onde — Morada de Recolha
                  </h2>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Nome / Empresa *</label>
                        <div className="relative">
                          <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            required
                            type="text"
                            value={senderName}
                            onChange={e => setSenderName(e.target.value)}
                            placeholder="Armazém / Empresa"
                            className="w-full pl-9 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Telefone *</label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            required
                            type="tel"
                            value={senderPhone}
                            onChange={e => setSenderPhone(e.target.value)}
                            placeholder="9XXXXXXXX"
                            className="w-full pl-9 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Morada (Rua, Nº) *</label>
                      <input
                        required
                        type="text"
                        value={senderAddress}
                        onChange={e => setSenderAddress(e.target.value)}
                        placeholder="Rua Principal, 100"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Código Postal *</label>
                        <input
                          required
                          type="text"
                          value={senderZip}
                          onChange={e => setSenderZip(e.target.value)}
                          placeholder="0000-000"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Localidade *</label>
                        <input
                          required
                          type="text"
                          value={senderCity}
                          onChange={e => setSenderCity(e.target.value)}
                          placeholder="Porto"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Volumes ── */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                  <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Weight className="w-4 h-4 text-blue-600" />
                    O Quê — Volumes e Peso
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Nº de Volumes *</label>
                      <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                        <button
                          type="button"
                          onClick={() => setVolumes(v => Math.max(1, v - 1))}
                          className="px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-bold text-lg leading-none transition-colors"
                        >−</button>
                        <input
                          required
                          type="number"
                          min={1}
                          value={volumes}
                          onChange={e => setVolumes(parseInt(e.target.value) || 1)}
                          className="flex-1 text-center text-sm font-bold text-slate-800 py-2 focus:outline-none bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setVolumes(v => v + 1)}
                          className="px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-bold text-lg leading-none transition-colors"
                        >+</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Peso Total (kg) *</label>
                      <div className="relative">
                        <input
                          required
                          type="number"
                          min={0.1}
                          step={0.1}
                          value={weightKg}
                          onChange={e => setWeightKg(parseFloat(e.target.value) || 1)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">kg</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observations */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Observações (Opcional)</label>
                  <textarea
                    rows={3}
                    value={observations}
                    onChange={e => setObservations(e.target.value)}
                    placeholder="Ex: Chamar número xxxxxx na chegada, portão azul…"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Submit */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => { setView("list"); setResult(null) }}
                    className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || cttConnections.length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition-colors text-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        A comunicar com CTT…
                      </>
                    ) : (
                      <>
                        <Truck className="w-4 h-4" />
                        Agendar Recolha CTT
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
    </div>
  )
}
