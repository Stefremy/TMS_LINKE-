"use client"

import * as React from "react"
import { 
  Building2, 
  MapPin, 
  Truck, 
  Zap, 
  Printer, 
  Download,
  RotateCcw, 
  Loader2, 
  X, 
  Package, 
  Calendar, 
  ShieldCheck, 
  Phone, 
  Mail, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  History,
  Check,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Undo2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { 
  regenerateCttLabelAction, 
  getShipmentTrackingTimelineAction,
  deleteShipmentAction,
  createReturnShipmentAction
} from "@/app/actions/shipments"
import { convertZplToPdfAction, syncCttTrackingAction } from "@/app/actions/ctt"
import { printCttLabel, downloadCttLabel } from "@/lib/label-utils"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { getShipmentStatusConfig } from "@/lib/status-helpers"

interface ClientShipmentDetailModalProps {
  shipment: any
  onClose: () => void
  onUpdateShipment?: (updated: any) => void
}

export function ClientShipmentDetailModal({ 
  shipment, 
  onClose, 
  onUpdateShipment 
}: ClientShipmentDetailModalProps) {
  // ALL hooks must be called unconditionally before any early return (Rules of Hooks)
  const [currentShipment, setCurrentShipment] = React.useState(shipment)
  const [activeTab, setActiveTab] = React.useState<"dados" | "tracking">("tracking")
  const [isRegenerating, setIsRegenerating] = React.useState(false)
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [isCreatingReturn, setIsCreatingReturn] = React.useState(false)
  const [timelineEvents, setTimelineEvents] = React.useState<any[]>([])
  const [loadingTimeline, setLoadingTimeline] = React.useState(true)

  const tracking = currentShipment?.tracking_number || currentShipment?.id || "N/A"
  const currentStatus = currentShipment?.status || "pendente"

  // Load timeline events
  const loadTimeline = React.useCallback(async (shipmentId: string, trkNumber?: string) => {
    setLoadingTimeline(true)
    try {
      const events = await getShipmentTrackingTimelineAction(shipmentId, trkNumber)
      setTimelineEvents(events)
    } catch (e) {
      console.error("Error loading tracking timeline:", e)
    } finally {
      setLoadingTimeline(false)
    }
  }, [])

  React.useEffect(() => {
    if (shipment) {
      setCurrentShipment(shipment)
      loadTimeline(shipment.id, shipment.tracking_number)
    }
  }, [shipment, loadTimeline])

  // Null guard AFTER all hooks
  if (!shipment || !currentShipment) return null

  const dateFormatted = currentShipment.created_at
    ? new Date(currentShipment.created_at).toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Recentemente"

  // Resolve a etiqueta: se for ZPL cru, converte server-side via Labelary
  const resolveLabel = async (rawLabel: string | null | undefined): Promise<string | null> => {
    if (!rawLabel) return null
    if (rawLabel.trimStart().startsWith("^XA")) {
      const res = await convertZplToPdfAction(rawLabel)
      if (res.success && res.base64) return res.base64
      alert(`Falha ao converter etiqueta ZPL para PDF: ${res.error || "Erro desconhecido"}`)
      return null
    }
    return rawLabel
  }

  // 1. Imprimir Etiqueta CTT
  const printLabel = async () => {
    const label = await resolveLabel(currentShipment.ctt_label_base64)
    if (!label) return
    printCttLabel(label)
  }

  // 2. Descarregar Etiqueta PDF
  const downloadLabel = async () => {
    const label = await resolveLabel(currentShipment.ctt_label_base64)
    if (!label) return
    downloadCttLabel(label, `${tracking}_Etiqueta_CTT.pdf`)
  }

  // 3. Solicitar / Reemitir Etiqueta aos CTT
  const handleReRequestLabel = async () => {
    setIsRegenerating(true)
    try {
      const res = await regenerateCttLabelAction(currentShipment.id || currentShipment.tracking_number)
      if (res.success && res.labelBase64) {
        const updated = {
          ...currentShipment,
          ctt_label_base64: res.labelBase64,
          tracking_number: res.trackingNumber || currentShipment.tracking_number
        }
        setCurrentShipment(updated)
        if (onUpdateShipment) {
          onUpdateShipment(updated)
        }
      } else {
        alert("Resposta dos CTT: " + (res.error || "Não foi possível obter etiqueta. Verifique as credenciais CTT em /ops/configuracao/webservices."))
      }
    } catch (e: any) {
      alert("Erro de comunicação CTT: " + (e?.message || e))
    } finally {
      setIsRegenerating(false)
    }
  }

  // Sincronizar com CTT Track & Trace API
  const handleSyncTracking = async () => {
    setIsSyncing(true)
    try {
      const res = await syncCttTrackingAction(tracking, currentShipment.id)
      if (res.success) {
        const updated = { ...currentShipment, status: res.latestStatus || currentShipment.status }
        setCurrentShipment(updated)
        if (onUpdateShipment) onUpdateShipment(updated)
        await loadTimeline(currentShipment.id, tracking)
      }
    } catch (e: any) {
      alert("Erro ao sincronizar com CTT: " + e.message)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleCreateReturn = async () => {
    if (!currentShipment?.id) return
    const confirmed = window.confirm(`Deseja criar uma guia de DEVOLUÇÃO para o envio ${tracking}?\n\nO Remetente e Destinatário serão invertidos automaticamente.`)
    if (!confirmed) return

    setIsCreatingReturn(true)
    try {
      const res = await createReturnShipmentAction(currentShipment.id)
      if (res.success) {
        alert(`✅ Guia de devolução criada com sucesso!\n\nNovo Tracking: ${res.newTrackingNumber}`)
        const updated = { ...currentShipment, status: "devolvido" }
        setCurrentShipment(updated)
        if (onUpdateShipment) onUpdateShipment(updated)
        onClose()
      } else {
        alert("Erro ao criar devolução: " + (res.error || "Erro desconhecido"))
      }
    } catch (e: any) {
      alert("Erro ao criar devolução: " + e.message)
    } finally {
      setIsCreatingReturn(false)
    }
  }

  const handleDelete = async () => {
    if (!currentShipment?.id) return
    const confirmed = window.confirm(`⚠️ Tem a certeza que deseja ELIMINAR permanentemente o envio ${tracking}?\n\nEsta ação apagará a guia e todo o histórico de rastreio associado.`)
    if (!confirmed) return

    setIsDeleting(true)
    try {
      const res = await deleteShipmentAction(currentShipment.id)
      if (res.success) {
        alert(`🗑️ Envio ${tracking} eliminado com sucesso!`)
        onClose()
        window.location.reload()
      } else {
        alert("Erro ao eliminar envio: " + (res.error || "Erro desconhecido"))
      }
    } catch (e: any) {
      alert("Erro ao eliminar envio: " + e.message)
    } finally {
      setIsDeleting(false)
    }
  }

  // Extract fields with fallbacks
  const recipientName = currentShipment.recipient_name || ""
  const recipientAddress = currentShipment.recipient_address || ""
  const recipientZip = currentShipment.recipient_zip3 
    ? `${currentShipment.recipient_zip3}-${currentShipment.recipient_zip4 || "000"}`
    : ""
  const recipientCity = currentShipment.recipient_city || ""
  const recipientPhone = currentShipment.recipient_phone || "Não especificado"
  const recipientEmail = currentShipment.recipient_email || "Não especificado"
  const weightKg = currentShipment.weight_kg || currentShipment.weight || "1.00"
  const volumes = currentShipment.volumes_count || currentShipment.volumes || 1
  const serviceType = currentShipment.service_type || "CTT Expresso 24H"

  // Special services status
  const isCOD = Boolean(currentShipment.is_cod || currentShipment.cod_amount)
  const codAmount = currentShipment.cod_amount ? `${Number(currentShipment.cod_amount).toFixed(2)}€` : "—"
  const isInsurance = Boolean(currentShipment.is_insurance || currentShipment.insured_value)
  const insuredValue = currentShipment.insured_value ? `${Number(currentShipment.insured_value).toFixed(2)}€` : "—"
  const isFragil = Boolean(currentShipment.is_fragil)
  const isSMS = currentShipment.is_sms_notification !== false // default true

  const hasLabel = Boolean(currentShipment.ctt_label_base64)

  // Stepper calculations
  const steps = [
    { key: "pendente", label: "Aceitação / Registo", eventCode: "EMA" },
    { key: "em_transito", label: "Em Trânsito CTT", eventCode: "EMF" },
    { key: "em_distribuicao", label: "Em Distribuição", eventCode: "EMZ" },
    { key: "entregue", label: "Entregue", eventCode: "EMI" },
  ]

  const getStepStatus = (stepKey: string) => {
    if (currentStatus === "incidencia" && stepKey === "entregue") return "failed"
    if (currentStatus === "devolvido" && stepKey === "entregue") return "returned"
    
    const order = ["pendente", "em_transito", "em_distribuicao", "entregue"]
    const currentIndex = order.indexOf(currentStatus === "incidencia" ? "em_distribuicao" : currentStatus)
    const stepIndex = order.indexOf(stepKey)

    if (stepIndex < currentIndex) return "completed"
    if (stepIndex === currentIndex) return "current"
    return "upcoming"
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Detalhes do Envio</h3>
                <span className="font-mono text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-lg font-bold">
                  {tracking}
                </span>
                {currentShipment.ctt_object_id && (
                  <span className="font-mono text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-lg font-bold" title="Referência CTT Expresso">
                    CTT: {currentShipment.ctt_object_id}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {dateFormatted}
                </span>
                <span>•</span>
                {(() => {
                  const cfg = getShipmentStatusConfig(currentStatus)
                  return (
                    <Badge variant={cfg.badgeVariant}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.dotColor} shrink-0`} />
                      <span>{cfg.label}</span>
                    </Badge>
                  )
                })()}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasLabel ? (
              <>
                <button
                  type="button"
                  onClick={printLabel}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Imprimir etiqueta CTT em nova janela"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Etiqueta</span>
                </button>

                <button
                  type="button"
                  onClick={downloadLabel}
                  className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Descarregar etiqueta em PDF"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Descarregar PDF</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleReRequestLabel}
                disabled={isRegenerating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>A Obter Etiqueta CTT...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Solicitar Etiqueta CTT</span>
                  </>
                )}
              </button>
            )}

            {/* Criar Devolução */}
            <button
              type="button"
              onClick={handleCreateReturn}
              disabled={isCreatingReturn}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Criar guia de devolução (inverte remetente/destinatário)"
            >
              {isCreatingReturn ? (
                <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
              ) : (
                <Undo2 className="w-4 h-4 text-amber-600" />
              )}
              <span>Criar Devolução</span>
            </button>

            {/* Eliminar Envio */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Eliminar envio permanentemente"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 text-rose-600 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 text-rose-600" />
              )}
              <span>Eliminar</span>
            </button>

            <button 
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Control Bar */}
        <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-slate-700">Estado da Encomenda:</span>
            {(() => {
              const cfg = getShipmentStatusConfig(currentStatus)
              return (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold leading-none shadow-2xs ${cfg.color}`}>
                  <span className={`w-2 h-2 rounded-full ${cfg.dotColor} shrink-0`} />
                  <span>{cfg.label}</span>
                </span>
              )
            })()}
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              (Alimentado pela API CTT Expresso)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncTracking}
              disabled={isSyncing}
              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Consultar API dos CTT para obter novas leituras de tracking"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "A Sincronizar..." : "Sincronizar com CTT"}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("tracking")}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "tracking"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Rastreio & Pickagens CTT ({timelineEvents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("dados")}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "dados"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Ficha do Envio & Moradas</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 bg-slate-50/40">
          
          {/* TAB 1: RASTREIO E TIMELINE */}
          {activeTab === "tracking" && (
            <div className="space-y-6">
              
              {/* Stepper Visual */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <h4 className="text-xs font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>Progresso do Envio na Rede CTT</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative">
                  {steps.map((step, idx) => {
                    const status = getStepStatus(step.key)
                    const isCompleted = status === "completed"
                    const isCurrent = status === "current"
                    const isFailed = status === "failed"

                    return (
                      <div 
                        key={step.key}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                          isFailed ? "bg-rose-50 border-rose-200 text-rose-900" :
                          isCurrent ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20" :
                          isCompleted ? "bg-emerald-50/30 border-emerald-200 text-emerald-900" :
                          "bg-slate-50 border-slate-200 opacity-60 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                            Etapa {idx + 1}
                          </span>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shadow-2xs">
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : isCurrent ? (
                              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                            ) : isFailed ? (
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-slate-300" />
                            )}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-800">
                          {step.label}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Pickagem CTT: {step.eventCode}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Incidência Banner (Se aplicável) */}
              {currentStatus === "incidencia" && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 flex items-start gap-3 shadow-2xs">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="text-sm font-black text-rose-800">Alerta de Incidência CTT (Código EMH)</strong>
                    <p className="text-xs text-rose-700">
                      O estafeta registou uma tentativa de entrega não conseguida. Razão CTT: <strong>Destinatário ausente / empresa encerrada (Código 11)</strong>.
                    </p>
                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSyncTracking}
                        disabled={isSyncing}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                        <span>Verificar Atualização CTT</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Linha Temporal Cronológica de Pickagens */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>Histórico Cronológico de Pickagens CTT (Track & Trace)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {timelineEvents.length} evento(s) registados
                  </span>
                </div>

                {loadingTimeline ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>A carregar histórico de tracking...</span>
                  </div>
                ) : timelineEvents.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 my-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                      <Clock className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 mb-1">Aguardar Primeira Leitura / Pickagem CTT</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Ainda não existem leituras óticas registadas na rede CTT para este envio. O histórico será preenchido automaticamente pelas pickagens reais da transportadora.
                    </p>
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                    {timelineEvents.map((ev, idx) => {
                      const isLatest = idx === timelineEvents.length - 1
                      const dateStr = ev.timestamp
                        ? new Date(ev.timestamp).toLocaleDateString("pt-PT", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"

                      return (
                        <div key={ev.id || idx} className="relative group">
                          {/* Dot */}
                          <div className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${
                            isLatest ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-slate-400"
                          }`} />

                          <div className="bg-slate-50 hover:bg-slate-100/80 transition-colors p-3.5 rounded-xl border border-slate-200/80">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-black bg-slate-800 text-white px-1.5 py-0.5 rounded">
                                  {ev.eventCode}
                                </span>
                                <span className="text-xs font-bold text-slate-900">
                                  {ev.eventName}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 font-medium">
                                {dateStr}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 mt-0.5">
                              {ev.description}
                            </p>

                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2 font-medium">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{ev.location || "Rede CTT Expresso"}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: FICHA DO ENVIO & MORADAS */}
          {activeTab === "dados" && (
            <div className="space-y-6">
              
              {/* Missing label warning if not available */}
              {!hasLabel && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Este envio não tem etiqueta associada em cache. Pode obtê-la diretamente dos Web Services CTT.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReRequestLabel}
                    disabled={isRegenerating}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>Obter Etiqueta Agora</span>
                  </button>
                </div>
              )}

              {/* 1. Remetente e Destinatário */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Remetente Card */}
                <div className="space-y-2 bg-slate-100/80 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-600">Remetente (Empresa)</label>
                    <span className="text-[10px] text-slate-500 font-bold bg-slate-200/80 px-2 py-0.5 rounded-full">Conta Cliente</span>
                  </div>
                  <div className="text-xs text-slate-800 font-bold">{currentShipment.sender_name || "Empresa Cliente"}</div>
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    {currentShipment.sender_address || "Sede Comercial"}
                    {currentShipment.sender_zip3 ? ` (${currentShipment.sender_zip3}-${currentShipment.sender_zip4})` : ""}
                  </div>
                </div>

                {/* Destinatário Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Nome do Destinatário</label>
                  <input 
                    type="text" 
                    disabled
                    value={recipientName}
                    className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-700 font-bold cursor-not-allowed select-none" 
                  />
                </div>
              </div>

              {/* 2. Morada, CP, Cidade e Peso */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Morada de Entrega</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      disabled
                      value={recipientAddress}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-not-allowed select-none" 
                    />
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Código Postal & Cidade</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      disabled
                      value={recipientZip || "—"}
                      className="w-1/2 px-2.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none" 
                    />
                    <input 
                      type="text" 
                      disabled
                      value={recipientCity || "Portugal"}
                      className="w-1/2 px-2.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 cursor-not-allowed select-none" 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Peso Total (kg)</label>
                  <input 
                    type="text" 
                    disabled
                    value={`${weightKg} kg`}
                    className="w-full px-3 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none" 
                  />
                </div>
              </div>

              {/* 3. Telefone, Email e Volumes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Telefone do Destinatário</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      disabled
                      value={recipientPhone}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-not-allowed select-none" 
                    />
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Email do Destinatário</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      disabled
                      value={recipientEmail}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-not-allowed select-none" 
                    />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Nº de Volumes</label>
                  <input 
                    type="text" 
                    disabled
                    value={`${volumes} volume(s)`}
                    className="w-full px-3 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none" 
                  />
                </div>
              </div>

              {/* 4. Serviço Escolhido */}
              <div className="bg-slate-100/80 p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-600">Serviço de Transporte Linke</label>
                <div className="flex items-center gap-3">
                  {getCarrierLogo(serviceType || "ctt") ? (
                    <div className="w-6 h-6 rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={getCarrierLogo(serviceType || "ctt")!} 
                        alt="Logo" 
                        className="max-w-full max-h-full object-contain" 
                      />
                    </div>
                  ) : (
                    <Truck className="w-5 h-5 text-emerald-600" />
                  )}
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-slate-800">{serviceType}</span>
                    <span className="text-[10px] text-slate-500">Expedição integrada CTT Expresso API</span>
                  </div>
                </div>
              </div>

              {/* 5. Serviços Especiais */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600">Serviços Especiais & Suplementares</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Cobrança */}
                  <div className={`p-3 rounded-xl border ${isCOD ? "bg-emerald-50 border-emerald-300" : "bg-slate-100/70 border-slate-200 opacity-60"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">Cobrança / COD</span>
                      {isCOD && <span className="font-mono font-bold text-emerald-700 text-xs">{codAmount}</span>}
                    </div>
                  </div>

                  {/* Frágil */}
                  <div className={`p-3 rounded-xl border ${isFragil ? "bg-emerald-50 border-emerald-300" : "bg-slate-100/70 border-slate-200 opacity-60"}`}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={isFragil} disabled className="w-3.5 h-3.5 rounded text-emerald-600 cursor-not-allowed" />
                      <span className="font-bold text-slate-800 text-[11px]">Mercadoria Frágil</span>
                    </div>
                  </div>

                  {/* SMS Notification */}
                  <div className={`p-3 rounded-xl border ${isSMS ? "bg-emerald-50 border-emerald-300" : "bg-slate-100/70 border-slate-200 opacity-60"}`}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={isSMS} disabled className="w-3.5 h-3.5 rounded text-emerald-600 cursor-not-allowed" />
                      <span className="font-bold text-slate-800 text-[11px]">Alerta SMS Tracking</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Total Faturado: <strong className="text-slate-900 font-mono text-sm">{currentShipment.sell_price ? `${Number(currentShipment.sell_price).toFixed(2)}€` : "0.00€"}</strong>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasLabel ? (
              <>
                <button
                  type="button"
                  onClick={printLabel}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Etiqueta</span>
                </button>

                <button
                  type="button"
                  onClick={downloadLabel}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Descarregar PDF</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleReRequestLabel}
                disabled={isRegenerating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Solicitar Etiqueta CTT</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
