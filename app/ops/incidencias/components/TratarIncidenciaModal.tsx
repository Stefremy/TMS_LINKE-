"use client"

import * as React from "react"
import { 
  X, 
  AlertTriangle, 
  Calendar, 
  MapPin, 
  RotateCcw, 
  CheckCircle2, 
  Loader2, 
  Truck, 
  Clock, 
  Phone, 
  User, 
  FileText,
  Building2,
  HelpCircle
} from "lucide-react"
import { resolveShipmentIncidentAction } from "@/app/actions/shipments"
import { Button } from "@/components/ui/button"

interface TratarIncidenciaModalProps {
  shipment: any
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function TratarIncidenciaModal({
  shipment,
  isOpen,
  onClose,
  onSuccess
}: TratarIncidenciaModalProps) {
  if (!isOpen || !shipment) return null

  const [activeTab, setActiveTab] = React.useState<"reagendar" | "morada" | "devolver" | "resolvido">("reagendar")
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Form states
  // Tomorrow's date formatted as YYYY-MM-DD
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDateStr = tomorrow.toISOString().split("T")[0]

  const [scheduledDate, setScheduledDate] = React.useState(defaultDateStr)
  const [timeWindow, setTimeWindow] = React.useState("Qualquer hora (09h - 19h)")
  const [notes, setNotes] = React.useState("")
  
  // Morada fields
  const [address, setAddress] = React.useState(shipment.recipient_address || shipment.recipient?.city || "")
  const [zipCode, setZipCode] = React.useState(
    shipment.recipient_zip3 && shipment.recipient_zip4 
      ? `${shipment.recipient_zip3}-${shipment.recipient_zip4}` 
      : (shipment.recipient?.zip || "")
  )
  const [phone, setPhone] = React.useState(shipment.recipient_phone || shipment.recipient?.phone || "")
  const [returnReason, setReturnReason] = React.useState("Destinatário ausente após múltiplas tentativas")

  const trackingCode = shipment.tracking_number || shipment.trk?.id || shipment.ctt_object_id || "N/A"
  const internalRef = shipment.reference || shipment.trk?.ref || trackingCode
  const incidentDesc = shipment.incidentReason || shipment.ops_substatus || shipment.status?.subCode || "Destinatário ausente na morada indicada"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const res = await resolveShipmentIncidentAction({
        shipmentId: shipment.rawId || shipment.id,
        actionType: activeTab,
        scheduledDate: activeTab === "reagendar" ? scheduledDate : undefined,
        timeWindow: activeTab === "reagendar" ? timeWindow : undefined,
        newAddress: activeTab === "morada" ? address : undefined,
        newZipCode: activeTab === "morada" ? zipCode : undefined,
        newPhone: activeTab === "morada" ? phone : undefined,
        notes: activeTab === "devolver" ? returnReason : notes,
      })

      if (res.success) {
        if (onSuccess) onSuccess()
        onClose()
      } else {
        setErrorMsg(res.error || "Ocorreu um erro ao processar a ação.")
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro na comunicação com o servidor.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[var(--surface-bg)] rounded-xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--surface-bg)] flex items-start justify-between shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--status-critical-soft)] text-[var(--status-critical)] border border-[rgba(220,38,38,0.2)] flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  Tratamento de Incidência Operacional
                </h2>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                  {trackingCode}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
                <span className="font-medium text-[var(--text-primary)]">Ref: {internalRef}</span>
                <span>•</span>
                <span className="text-[var(--status-critical)] font-semibold">{incidentDesc}</span>
              </p>
            </div>
          </div>
          
          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-[var(--border-subtle)] bg-[var(--canvas-bg)] text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("reagendar")}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "reagendar"
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface-bg)] rounded-t-md"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Reagendar Entrega
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("morada")}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "morada"
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface-bg)] rounded-t-md"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Corrigir Morada / Contacto
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("devolver")}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "devolver"
                ? "border-[var(--status-critical)] text-[var(--status-critical)] bg-[var(--surface-bg)] rounded-t-md"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Autorizar Devolução
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("resolvido")}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "resolvido"
                ? "border-[var(--status-success)] text-[var(--status-success)] bg-[var(--surface-bg)] rounded-t-md"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Marcar Resolvido
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {errorMsg && (
            <div className="p-3 bg-[var(--status-critical-soft)] border border-[rgba(220,38,38,0.2)] rounded-lg text-xs font-semibold text-[var(--status-critical)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Context Info Box */}
          <div className="bg-[var(--surface-muted)] rounded-lg p-3.5 border border-[var(--border-subtle)] grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[var(--text-tertiary)] block text-[10px] font-bold uppercase tracking-wider">Destinatário Original</span>
              <span className="font-semibold text-[var(--text-primary)] block mt-0.5">
                {shipment.recipient_name || shipment.recipient?.name || "N/A"}
              </span>
              <span className="text-[var(--text-secondary)] block text-[11px] truncate">
                {shipment.recipient_address || shipment.recipient?.city || "Morada não registada"}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)] block text-[10px] font-bold uppercase tracking-wider">Transportadora & Serviço</span>
              <span className="font-semibold text-[var(--text-primary)] block mt-0.5">
                {shipment.carrier_name || "CTT Expresso"}
              </span>
              <span className="text-[var(--text-secondary)] block text-[11px]">
                {shipment.service_type || "Envio D+1 Standard"}
              </span>
            </div>
          </div>

          {/* Tab 1: Reagendar */}
          {activeTab === "reagendar" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">
                    Data da Nova Tentativa <span className="text-[var(--status-critical)]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="h-9 px-3 rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <span className="text-[11px] text-[var(--text-tertiary)]">Garante transmissão aos CTT para distribuição</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">
                    Janela Horária Preferencial
                  </label>
                  <select
                    value={timeWindow}
                    onChange={(e) => setTimeWindow(e.target.value)}
                    className="h-9 px-3 rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="Qualquer hora (09h - 19h)">Qualquer hora (09h - 19h)</option>
                    <option value="Período da Manhã (09h - 13h)">Período da Manhã (09h - 13h)</option>
                    <option value="Período da Tarde (14h - 19h)">Período da Tarde (14h - 19h)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Instruções Especiais para o Estafeta
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Tocar à campainha nº 3E; em caso de ausência deixar na portaria ou ligar para o destinatário antes da entrega."
                  className="p-3 rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-tertiary)]"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Morada */}
          {activeTab === "morada" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Morada Completa Retificada <span className="text-[var(--status-critical)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, Número de Porta, Andar, Fração"
                  className="h-9 px-3 rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="4000-001"
                    className="h-9 px-3 rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">
                    Contacto Telefónico Direto
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+351 912 345 678"
                    className="h-9 px-3 rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Nota Explicativa da Alteração
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Destinatário confirmou novo número de porta por telefone."
                  className="h-9 px-3 rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          )}

          {/* Tab 3: Devolver */}
          {activeTab === "devolver" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <div className="p-3 bg-[var(--status-critical-soft)] border border-[rgba(220,38,38,0.2)] rounded-lg text-xs text-[var(--text-primary)] flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[var(--status-critical)] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[var(--status-critical)] block">Atenção: Ação de Devolução Definitiva</span>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    O envio será marcado como &quot;Devolvido ao Remetente&quot; no TMS e a transportadora iniciará o fluxo de retorno ao armazém de origem.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Motivo da Devolução
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="h-9 px-3 rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--status-critical)]"
                >
                  <option value="Destinatário ausente após múltiplas tentativas">Destinatário ausente após múltiplas tentativas</option>
                  <option value="Destinatário recusou a receção da encomenda">Destinatário recusou a receção da encomenda</option>
                  <option value="Morada incorreta / Inexistente e sem resposta">Morada incorreta / Inexistente e sem resposta</option>
                  <option value="Mercadoria danificada / Extravio parcial">Mercadoria danificada / Extravio parcial</option>
                  <option value="Solicitado pelo cliente / remetente">Solicitado pelo cliente / remetente</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Observações de Devolução
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Indique referências adicionais para o armazém de receção..."
                  className="p-3 rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--status-critical)]"
                />
              </div>
            </div>
          )}

          {/* Tab 4: Resolvido */}
          {activeTab === "resolvido" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <div className="p-3 bg-[var(--status-success-soft)] border border-[rgba(18,138,71,0.2)] rounded-lg text-xs text-[var(--text-primary)] flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--status-success)] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[var(--status-success)] block">Conclusão de Ocorrência</span>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Utilize esta opção caso a situação tenha sido desbloqueada diretamente (ex: destinatário levantou no Ponto CTT ou entregador realizou a entrega com sucesso).
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Resumo da Solução Aplicada <span className="text-[var(--status-critical)]">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Destinatário recolheu o volume na estação CTT local mediante apresentação de aviso postal."
                  className="p-3 rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--status-success)]"
                />
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3 mt-auto shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="text-xs font-medium"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className={`text-xs font-semibold px-4 ${
                activeTab === "devolver"
                  ? "bg-[var(--status-critical)] hover:bg-red-700 text-white"
                  : activeTab === "resolvido"
                  ? "bg-[var(--status-success)] hover:bg-emerald-700 text-white"
                  : "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
              }`}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {activeTab === "reagendar" && "Confirmar Reagendamento"}
              {activeTab === "morada" && "Atualizar Morada & Agendar"}
              {activeTab === "devolver" && "Confirmar Devolução"}
              {activeTab === "resolvido" && "Marcar como Resolvido"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
