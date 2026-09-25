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
  Undo2,
  Copy,
  MessageCircle,
  Share2,
  ExternalLink
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { 
  getShipmentTrackingTimelineAction,
  deleteShipmentAction,
  createReturnShipmentAction
} from "@/app/actions/shipments"
import { convertZplToPdfAction, syncCttTrackingAction, injectTrackingEventAction } from "@/app/actions/ctt"
import { printCttLabel, downloadCttLabel } from "@/lib/label-utils"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { getShipmentStatusConfig } from "@/lib/status-helpers"
import { CTT_TRACKING_EVENTS, CTT_NON_DELIVERY_REASONS, CTT_SITUATIONS } from "@/lib/services/ctt/ctt-types"

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
  const [isInjectingEvent, setIsInjectingEvent] = React.useState(false)
  const [selectedEvent, setSelectedEvent] = React.useState("EMH")
  const [selectedReason, setSelectedReason] = React.useState("11")
  const [selectedSituation, setSelectedSituation] = React.useState("D")

  const internalRef =
    (currentShipment?.reference?.startsWith("LTK") || currentShipment?.reference?.startsWith("LKT") ? currentShipment.reference : null) ||
    (currentShipment?.tracking_number?.startsWith("LTK") || currentShipment?.tracking_number?.startsWith("LKT") ? currentShipment.tracking_number : null) ||
    (currentShipment?.ctt_label_base64?.match(/Ref:\s*(LTK\d+)/i)?.[1]) ||
    currentShipment?.reference ||
    `LTK${(currentShipment?.id || "00000000").substring(0, 8).toUpperCase()}`

  const carrierTracking =
    currentShipment?.carrier_tracking_number ||
    currentShipment?.ctt_object_id ||
    (currentShipment?.tracking_number !== internalRef ? currentShipment?.tracking_number : null)
  const tracking = internalRef
  const currentStatus = currentShipment?.status || "pendente"

  // Load timeline events
  const loadTimeline = React.useCallback(async (shipmentId: string, trkNumber?: string) => {
    try {
      console.log("Loading timeline for:", shipmentId, trkNumber)
      setLoadingTimeline(true)
      const data = await getShipmentTrackingTimelineAction(shipmentId, trkNumber)
      console.log("Timeline data loaded:", data?.length, "events")
      setTimelineEvents(data || [])
    } catch (e) {
      console.error("Error loading tracking timeline:", e)
    } finally {
      setLoadingTimeline(false)
    }
  }, [])

  React.useEffect(() => {
    if (shipment) {
      setCurrentShipment(shipment)
      const carrierTrk = shipment.carrier_tracking_number || shipment.ctt_object_id || (!shipment.tracking_number?.startsWith("LTK") ? shipment.tracking_number : null)
      loadTimeline(shipment.id, carrierTrk || shipment.tracking_number)

      if (carrierTrk && shipment.status !== "entregue" && shipment.status !== "cancelado") {
        syncCttTrackingAction(carrierTrk, shipment.id).then((res) => {
          if (res?.success) {
            loadTimeline(shipment.id, carrierTrk)
            if (res.latestStatus) {
              setCurrentShipment((prev: any) => ({ ...prev, status: res.latestStatus }))
            }
          }
        }).catch(() => {})
      }
    }
  }, [shipment, loadTimeline])

  const [copiedLink, setCopiedLink] = React.useState(false)

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
  // Resolve a etiqueta: se for ZPL cru, converte server-side via Labelary
  const resolveLabel = async (rawLabel: string | null | undefined): Promise<string | null> => {
    if (!rawLabel) {
      alert("Este envio não tem etiqueta CTT. A etiqueta é gerada exclusivamente na criação do envio.")
      return null
    }
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

  // Sincronizar com CTT Track & Trace API
  const handleSyncTracking = async () => {
    setIsSyncing(true)
    try {
      const res = await syncCttTrackingAction(carrierTracking || tracking, currentShipment.id)
      if (res.success) {
        const updated = { ...currentShipment, status: res.latestStatus || currentShipment.status }
        setCurrentShipment(updated)
        if (onUpdateShipment) onUpdateShipment(updated)
        await loadTimeline(currentShipment.id, tracking)
      } else {
        alert("Atenção: " + (res.error || "Não foi possível obter pickagens para este envio."))
      }
    } catch (e: any) {
      alert("Erro ao sincronizar com CTT: " + e.message)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleInjectEvent = async () => {
    setIsInjectingEvent(true)
    try {
      const res = await injectTrackingEventAction(currentShipment.id, tracking, selectedEvent, selectedReason, selectedSituation)
      if (res.success) {
        alert(`🎉 Evento ${selectedEvent} injetado com sucesso!`)
        // Re-sincroniza
        await loadTimeline(currentShipment.id, tracking)
        // Obtém estado atualizado
        const newStatus = CTT_TRACKING_EVENTS[selectedEvent]?.tms_status || currentShipment.status
        const updated = { ...currentShipment, status: newStatus }
        setCurrentShipment(updated)
        if (onUpdateShipment) onUpdateShipment(updated)
      } else {
        alert("Erro ao injetar evento: " + res.error)
      }
    } catch (e: any) {
      alert("Erro ao injetar evento: " + e.message)
    } finally {
      setIsInjectingEvent(false)
    }
  }


  const handleCopyTrackingLink = () => {
    if (typeof window === "undefined") return
    const url = `${window.location.origin}/tracking?trk=${encodeURIComponent(tracking)}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  const handleShareTrackingWhatsApp = () => {
    if (typeof window === "undefined") return
    const url = `${window.location.origin}/tracking?trk=${encodeURIComponent(tracking)}`
    const text = `📦 Siga o rastreio da sua encomenda (${tracking}):\n${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[var(--surface-bg)] rounded-xl w-full max-w-4xl shadow-2xl border border-[var(--border-strong)] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 bg-[var(--surface-muted)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(18,138,71,0.1)] flex items-center justify-center font-bold shadow-2xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Detalhes do Envio</h3>
                <span className="font-mono text-xs bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(18,138,71,0.2)] px-2.5 py-0.5 rounded-md font-bold">
                  {internalRef}
                </span>
                {carrierTracking && (
                  <span className="font-mono text-xs bg-[var(--surface-dim)] text-[var(--text-secondary)] border border-[var(--border-strong)] px-2.5 py-0.5 rounded-md font-bold shadow-xs" title="Referência CTT Expresso">
                    CTT: {carrierTracking}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] mt-1 font-medium">
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
                  className="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-md text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Imprimir etiqueta CTT em nova janela"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Etiqueta</span>
                </button>

                <button
                  type="button"
                  onClick={downloadLabel}
                  className="px-3 py-1.5 bg-[var(--surface-bg)] border border-[var(--border-strong)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Descarregar etiqueta em PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descarregar PDF</span>
                </button>
              </>
            ) : null}

            {/* Criar Devolução */}
            <button
              type="button"
              onClick={handleCreateReturn}
              disabled={isCreatingReturn}
              className="px-3 py-1.5 bg-[var(--status-warning-soft)] hover:bg-[rgba(217,119,6,0.15)] border border-[rgba(217,119,6,0.2)] text-[var(--status-warning)] rounded-md text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Criar guia de devolução (inverte remetente/destinatário)"
            >
              {isCreatingReturn ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Undo2 className="w-3.5 h-3.5" />
              )}
              <span>Devolução</span>
            </button>

            {/* Eliminar Envio */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-1.5 bg-[var(--status-critical-soft)] hover:bg-[rgba(220,38,38,0.15)] border border-[rgba(220,38,38,0.2)] text-[var(--status-critical)] rounded-md text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Eliminar envio permanentemente"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Eliminar</span>
            </button>

            <button 
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-md bg-[var(--surface-bg)] border border-[var(--border-strong)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer ml-1 shadow-2xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Control Bar */}
        <div className="px-6 py-2.5 bg-[var(--surface-dim)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Estado da Encomenda:</span>
            {(() => {
              const cfg = getShipmentStatusConfig(currentStatus)
              return (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider leading-none shadow-2xs border ${
                  cfg.color.includes('green') ? 'bg-[var(--status-success-soft)] text-[var(--status-success)] border-[rgba(18,138,71,0.2)]' :
                  cfg.color.includes('yellow') || cfg.color.includes('orange') ? 'bg-[var(--status-warning-soft)] text-[var(--status-warning)] border-[rgba(217,119,6,0.2)]' :
                  cfg.color.includes('red') ? 'bg-[var(--status-critical-soft)] text-[var(--status-critical)] border-[rgba(220,38,38,0.2)]' :
                  cfg.color.includes('blue') ? 'bg-[var(--status-info-soft)] text-[var(--status-info)] border-[rgba(37,99,235,0.2)]' :
                  'bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor.replace('bg-', 'bg-')} shrink-0`} />
                  <span>{cfg.label}</span>
                </span>
              )
            })()}
            <span className="text-[10px] text-[var(--text-tertiary)] font-medium hidden sm:inline ml-1">
              (Sincronizado com API CTT)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncTracking}
              disabled={isSyncing}
              className="bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold px-3 py-1 rounded-md flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 text-[10px] uppercase tracking-wider"
              title="Consultar API dos CTT para obter novas leituras de tracking"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin text-[var(--accent)]" : ""}`} />
              <span>{isSyncing ? "A Sincronizar..." : "Sincronizar"}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--border-subtle)] px-6 bg-[var(--surface-muted)] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("tracking")}
            className={`py-2.5 px-3 text-[11px] font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "tracking"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Rastreio & Histórico ({timelineEvents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("dados")}
            className={`py-2.5 px-3 text-[11px] font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "dados"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ficha & Moradas</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-[var(--surface-bg)]">
          
          {/* TAB 1: RASTREIO E TIMELINE */}
          {activeTab === "tracking" && (
            <div className="space-y-6">
              
              {/* Stepper Visual */}
              <div className="bg-[var(--surface-bg)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-2xs">
                <h4 className="text-xs font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[var(--accent)]" />
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
                          isFailed ? "bg-[var(--status-critical-soft)] border-[rgba(220,38,38,0.2)] text-[var(--status-critical)]" :
                          isCurrent ? "bg-[var(--accent-soft)] border-[var(--accent)] ring-2 ring-[rgba(18,138,71,0.2)]" :
                          isCompleted ? "bg-[var(--status-success-soft)] border-[rgba(18,138,71,0.2)] text-[var(--status-success)]" :
                          "bg-[var(--surface-muted)] border-[var(--border-subtle)] opacity-60 text-[var(--text-tertiary)]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                            Etapa {idx + 1}
                          </span>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shadow-2xs">
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-[var(--status-success)]" />
                            ) : isCurrent ? (
                              <span className="w-3 h-3 rounded-full bg-[var(--accent)] animate-ping" />
                            ) : isFailed ? (
                              <AlertTriangle className="w-4 h-4 text-[var(--status-critical)]" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-[var(--border-strong)]" />
                            )}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">
                          {step.label}
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)] font-mono mt-0.5">
                          Pickagem CTT: {step.eventCode}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Partilhar Rastreio com o Cliente Final */}
              <div className="bg-[var(--accent-soft)] border border-[rgba(18,138,71,0.2)] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--surface-bg)] text-[var(--accent)] border border-[rgba(18,138,71,0.1)] flex items-center justify-center font-bold">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[var(--text-primary)]">Partilhar Rastreio com o Cliente</h5>
                    <p className="text-[11px] text-[var(--text-secondary)]">Link público direto para o destinatário acompanhar a entrega</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyTrackingLink}
                    className="px-3 py-1.5 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-strong)] text-xs font-bold rounded-md shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-[var(--status-success)]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? "Copiado!" : "Copiar"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareTrackingWhatsApp}
                    className="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-md shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                  <a
                    href={`/tracking?trk=${encodeURIComponent(tracking)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-[var(--surface-dim)] hover:bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)] rounded-md text-xs font-semibold flex items-center gap-1 transition-all"
                    title="Abrir portal de rastreio em novo separador"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Incidência Banner (Se aplicável) */}
              {(currentStatus === "incidencia" || timelineEvents.some((e: any) => e.eventCode === "EMH" || e.eventCode === "EMN" || e.eventCode === "EDF")) && (
                <div className="bg-[var(--status-critical-soft)] border border-[rgba(220,38,38,0.2)] rounded-xl p-4 text-xs text-[var(--status-critical)] flex items-start gap-3 shadow-2xs">
                  <AlertTriangle className="w-5 h-5 text-[var(--status-critical)] shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-sm font-bold text-[var(--status-critical)]">Alerta de Incidência CTT (Código EMH)</strong>
                      <span className="font-mono text-[10px] font-bold bg-[rgba(220,38,38,0.15)] text-[var(--status-critical)] px-2 py-0.5 rounded">
                        Entrega Não Conseguida
                      </span>
                    </div>
                    <p className="text-xs text-[var(--status-critical)] opacity-90">
                      {timelineEvents.slice().reverse().find((e: any) => e.isIncidencia || e.eventCode === "EMH")?.description ||
                       "O estafeta registou uma tentativa de entrega não conseguida na morada do destinatário."}
                    </p>
                    <div className="pt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSyncTracking}
                        disabled={isSyncing}
                        className="px-3 py-1 bg-[var(--status-critical)] hover:opacity-90 disabled:opacity-50 text-white rounded-md font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                        <span>Verificar Atualização CTT</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}


              {/* Linha Temporal Cronológica de Pickagens */}
              <div className="bg-[var(--surface-bg)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--accent)]" />
                    <span>Histórico Cronológico de Pickagens CTT</span>
                  </h4>
                  <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
                    {timelineEvents.length} evento(s)
                  </span>
                </div>

                {loadingTimeline ? (
                  <div className="p-8 text-center text-[var(--text-secondary)] text-xs font-semibold">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--accent)]" />
                    <span>A carregar histórico de tracking...</span>
                  </div>
                ) : timelineEvents.length === 0 ? (
                  <div className="p-8 text-center bg-[var(--surface-dim)] rounded-xl border border-dashed border-[var(--border-strong)] my-2">
                    <div className="w-10 h-10 rounded-full bg-[var(--surface-muted)] border border-[var(--border-strong)] text-[var(--text-tertiary)] flex items-center justify-center mx-auto mb-2.5">
                      <Clock className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Aguardar Pickagem CTT</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] max-w-sm mx-auto">
                      Ainda não existem leituras óticas registadas na rede CTT para este envio. O histórico será preenchido automaticamente.
                    </p>
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-px before:bg-[var(--border-strong)]">
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

                      const isIncidencia = ev.isIncidencia || ev.eventCode === "EMH" || ev.eventCode === "EMN" || ev.eventCode === "EDF"
                      const isEntregue = ev.eventCode === "EMI"
                      const isDistribuicao = ev.eventCode === "EMZ"
                      const isDevolvido = ev.eventCode === "EMV"

                      return (
                        <div key={ev.id || idx} className="relative group">
                          {/* Dot */}
                          <div className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--surface-bg)] shadow-2xs ${
                            isIncidencia
                              ? "bg-[var(--status-critical)] ring-4 ring-[rgba(220,38,38,0.1)]"
                              : isEntregue
                              ? "bg-[var(--status-success)] ring-4 ring-[rgba(18,138,71,0.1)]"
                              : isLatest
                              ? "bg-[var(--accent)] ring-4 ring-[rgba(18,138,71,0.1)]"
                              : "bg-[var(--text-tertiary)]"
                          }`} />

                          <div className={`transition-colors p-3.5 rounded-xl border ${
                            isIncidencia
                              ? "bg-[var(--status-critical-soft)] border-[rgba(220,38,38,0.2)] text-[var(--status-critical)] shadow-2xs"
                              : isEntregue
                              ? "bg-[var(--status-success-soft)] border-[rgba(18,138,71,0.2)] text-[var(--status-success)]"
                              : isDistribuicao
                              ? "bg-[var(--status-info-soft)] border-[rgba(37,99,235,0.2)] text-[var(--status-info)]"
                              : isDevolvido
                              ? "bg-[var(--status-warning-soft)] border-[rgba(217,119,6,0.2)] text-[var(--status-warning)]"
                              : "bg-[var(--surface-muted)] hover:bg-[var(--surface-dim)] border-[var(--border-subtle)]"
                          }`}>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                  isIncidencia
                                    ? "bg-[var(--status-critical)] text-white"
                                    : isEntregue
                                    ? "bg-[var(--status-success)] text-white"
                                    : isDistribuicao
                                    ? "bg-[var(--status-info)] text-white"
                                    : "bg-[var(--surface-dim)] border border-[var(--border-strong)] text-[var(--text-primary)]"
                                }`}>
                                  {ev.eventCode}
                                </span>
                                <span className={`text-xs font-bold ${
                                  isIncidencia ? "text-[var(--status-critical)]" : isEntregue ? "text-[var(--status-success)]" : "text-[var(--text-primary)]"
                                }`}>
                                  {ev.eventName}
                                </span>
                                {isIncidencia && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-[rgba(220,38,38,0.15)] text-[var(--status-critical)] px-2 py-0.5 rounded-full">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Incidência</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-[var(--text-tertiary)] font-semibold">
                                {dateStr}
                              </span>
                            </div>

                            <p className={`text-xs mt-1 ${
                              isIncidencia ? "font-medium" : "text-[var(--text-secondary)]"
                            }`}>
                              {ev.description}
                            </p>

                            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] mt-2 font-medium uppercase tracking-wider text-[9px]">
                              <MapPin className="w-3 h-3 text-[var(--text-tertiary)]" />
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
                <div className="bg-[var(--status-warning-soft)] border border-[rgba(217,119,6,0.2)] text-[var(--status-warning)] rounded-xl p-4 flex items-start gap-2.5 text-xs shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-[var(--status-warning)] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Este envio ainda não tem a etiqueta CTT associada no sistema.</p>
                    <p className="opacity-90">A etiqueta é gerada exclusivamente no momento da criação do envio.</p>
                  </div>
                </div>
              )}

              {/* 1. Remetente e Destinatário */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Remetente Card */}
                <div className="space-y-2 bg-[var(--surface-muted)] p-4 rounded-xl border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Remetente (Empresa)</label>
                    <span className="text-[9px] text-[var(--text-secondary)] font-bold bg-[var(--surface-dim)] border border-[var(--border-strong)] px-2 py-0.5 rounded-sm uppercase tracking-wider">Conta Cliente</span>
                  </div>
                  <div className="text-xs text-[var(--text-primary)] font-bold">{currentShipment.sender_name || "Empresa Cliente"}</div>
                  <div className="text-[11px] text-[var(--text-tertiary)] font-medium">
                    {currentShipment.sender_address || "Sede Comercial"}
                    {currentShipment.sender_zip3 ? ` (${currentShipment.sender_zip3}-${currentShipment.sender_zip4})` : ""}
                  </div>
                </div>

                {/* Destinatário Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Nome do Destinatário</label>
                  <input 
                    type="text" 
                    disabled
                    value={recipientName}
                    className="w-full px-3.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs text-[var(--text-primary)] font-bold cursor-not-allowed select-none" 
                  />
                </div>
              </div>

              {/* 2. Morada, CP, Cidade e Peso */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Morada de Entrega</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      disabled
                      value={recipientAddress}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs text-[var(--text-primary)] font-medium cursor-not-allowed select-none" 
                    />
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">CP & Cidade</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      disabled
                      value={recipientZip || "—"}
                      className="w-1/2 px-2.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs font-mono font-bold text-[var(--text-primary)] cursor-not-allowed select-none" 
                    />
                    <input 
                      type="text" 
                      disabled
                      value={recipientCity || "Portugal"}
                      className="w-1/2 px-2.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs font-medium text-[var(--text-primary)] cursor-not-allowed select-none" 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Peso Total</label>
                  <input 
                    type="text" 
                    disabled
                    value={`${weightKg} kg`}
                    className="w-full px-3 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs font-mono font-bold text-[var(--text-primary)] cursor-not-allowed select-none" 
                  />
                </div>
              </div>

              {/* 3. Telefone, Email e Volumes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Telemóvel Dest.</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      disabled
                      value={recipientPhone}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs text-[var(--text-primary)] font-medium cursor-not-allowed select-none" 
                    />
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Email Dest.</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      disabled
                      value={recipientEmail}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs text-[var(--text-primary)] font-medium cursor-not-allowed select-none" 
                    />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Nº Volumes</label>
                  <input 
                    type="text" 
                    disabled
                    value={`${volumes} volume(s)`}
                    className="w-full px-3 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs font-mono font-bold text-[var(--text-primary)] cursor-not-allowed select-none" 
                  />
                </div>
              </div>

              {/* 4. Serviço Escolhido */}
              <div className="bg-[var(--surface-muted)] p-4 rounded-xl border border-[var(--border-subtle)] space-y-2">
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Serviço de Transporte Linke</label>
                <div className="flex items-center gap-3">
                  {getCarrierLogo(serviceType || "ctt") ? (
                    <div className="w-8 h-8 rounded-md bg-[var(--surface-bg)] border border-[var(--border-strong)] p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={getCarrierLogo(serviceType || "ctt")!} 
                        alt="Logo" 
                        className="max-w-full max-h-full object-contain" 
                      />
                    </div>
                  ) : (
                    <Truck className="w-5 h-5 text-[var(--accent)]" />
                  )}
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-[var(--text-primary)] uppercase tracking-wide">{serviceType}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)] font-semibold">Expedição integrada CTT Expresso API</span>
                  </div>
                </div>
              </div>

              {/* 5. Serviços Especiais */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Serviços Especiais & Suplementares</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Cobrança */}
                  <div className={`p-3 rounded-md border ${isCOD ? "bg-[var(--accent-soft)] border-[var(--accent)] shadow-2xs" : "bg-[var(--surface-muted)] border-[var(--border-subtle)] opacity-70"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-[11px] uppercase tracking-wider ${isCOD ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}>Cobrança / COD</span>
                      {isCOD && <span className="font-mono font-bold text-[var(--status-success)] text-xs">{codAmount}</span>}
                    </div>
                  </div>

                  {/* Frágil */}
                  <div className={`p-3 rounded-md border ${isFragil ? "bg-[var(--accent-soft)] border-[var(--accent)] shadow-2xs" : "bg-[var(--surface-muted)] border-[var(--border-subtle)] opacity-70"}`}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={isFragil} disabled className="w-3.5 h-3.5 rounded text-[var(--accent)] cursor-not-allowed border-[var(--border-strong)]" />
                      <span className={`font-bold text-[11px] uppercase tracking-wider ${isFragil ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}>Mercadoria Frágil</span>
                    </div>
                  </div>

                  {/* SMS Notification */}
                  <div className={`p-3 rounded-md border ${isSMS ? "bg-[var(--accent-soft)] border-[var(--accent)] shadow-2xs" : "bg-[var(--surface-muted)] border-[var(--border-subtle)] opacity-70"}`}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={isSMS} disabled className="w-3.5 h-3.5 rounded text-[var(--accent)] cursor-not-allowed border-[var(--border-strong)]" />
                      <span className={`font-bold text-[11px] uppercase tracking-wider ${isSMS ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}>Alerta SMS Tracking</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
            Total Faturado: <strong className="text-[var(--text-primary)] font-mono text-sm ml-1">{currentShipment.sell_price ? `${Number(currentShipment.sell_price).toFixed(2)}€` : "0.00€"}</strong>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasLabel ? (
              <>
                <button
                  type="button"
                  onClick={printLabel}
                  className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Etiqueta</span>
                </button>

                <button
                  type="button"
                  onClick={downloadLabel}
                  className="px-4 py-2 bg-[var(--surface-bg)] border border-[var(--border-strong)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Descarregar PDF</span>
                </button>
              </>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-[var(--surface-dim)] hover:bg-[var(--surface-muted)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
