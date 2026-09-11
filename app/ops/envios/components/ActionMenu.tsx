"use client"

import * as React from "react"
import { 
  Package, 
  Printer, 
  Download, 
  RotateCcw, 
  Truck, 
  Mail, 
  ChevronDown, 
  Loader2, 
  Trash2, 
  Edit3, 
  Undo2 
} from "lucide-react"

import { 
  dispatchShipmentAction, 
  deleteShipmentAction, 
  createReturnShipmentAction,
  regenerateCttLabelAction
} from "@/app/actions/shipments"
import { convertZplToPdfAction, syncCttTrackingAction } from "@/app/actions/ctt"
import { printCttLabel, downloadCttLabel } from "@/lib/label-utils"

interface ActionMenuProps {
  shipment?: any
  shipmentId?: string
  trackingRef?: string
  isCtt?: boolean
  onOpenDetails?: () => void
  onUpdateShipment?: (updated: any) => void
  onDeleteShipment?: (id: string) => void
}

export function ActionMenu({ 
  shipment, 
  shipmentId, 
  trackingRef, 
  isCtt = true,
  onOpenDetails,
  onUpdateShipment,
  onDeleteShipment
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isEmitting, setIsEmitting] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [isCreatingReturn, setIsCreatingReturn] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const effectiveId = shipmentId || shipment?.id
  const effectiveRef = trackingRef || shipment?.tracking_number || effectiveId

  // Close when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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

  const getOrFetchLabel = async (): Promise<string | null> => {
    let rawLabel = shipment?.ctt_label_base64
    if (!rawLabel && effectiveId) {
      try {
        const res = await regenerateCttLabelAction(effectiveId)
        if (res.success && res.labelBase64) {
          rawLabel = res.labelBase64
          if (onUpdateShipment) {
            onUpdateShipment({ ...shipment, ctt_label_base64: rawLabel })
          }
        } else {
          alert("Não foi possível gerar a etiqueta CTT: " + (res.error || "Verifique credenciais CTT em /ops/configuracao/webservices"))
          return null
        }
      } catch (err: any) {
        alert("Erro ao obter etiqueta CTT: " + (err?.message || err))
        return null
      }
    }
    if (!rawLabel) {
      alert("Nenhuma etiqueta CTT disponível para este envio.")
      return null
    }
    return resolveLabel(rawLabel)
  }

  const handlePrint = async () => {
    setIsOpen(false)
    setIsProcessing(true)
    try {
      const label = await getOrFetchLabel()
      if (label) printCttLabel(label)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async () => {
    setIsOpen(false)
    setIsProcessing(true)
    try {
      const label = await getOrFetchLabel()
      if (label) {
        downloadCttLabel(label, `${effectiveRef}_Etiqueta_CTT.pdf`)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleEmitCtt = async () => {
    if (!effectiveId) return
    setIsEmitting(true)
    try {
      await dispatchShipmentAction(effectiveId)
      alert("Envio CTT emitido com sucesso!")
    } catch (err: any) {
      alert("Erro ao emitir CTT: " + err.message)
    } finally {
      setIsEmitting(false)
      setIsOpen(false)
    }
  }

  const handleSyncTracking = async () => {
    if (!effectiveRef) return
    setIsProcessing(true)
    try {
      const res = await syncCttTrackingAction(effectiveRef, effectiveId)
      if (res.success) {
        if (onUpdateShipment) {
          onUpdateShipment({ ...shipment, status: res.latestStatus || shipment?.status })
        }
      }
    } catch (e: any) {
      alert("Erro ao sincronizar tracking: " + e.message)
    } finally {
      setIsProcessing(false)
      setIsOpen(false)
    }
  }

  const handleCreateReturn = async () => {
    if (!effectiveId) return
    const confirmed = window.confirm(`Deseja criar uma guia de DEVOLUÇÃO para o envio ${effectiveRef}?\n\nO Remetente e Destinatário serão invertidos automaticamente.`)
    if (!confirmed) return

    setIsCreatingReturn(true)
    try {
      const res = await createReturnShipmentAction(effectiveId)
      if (res.success) {
        alert(`✅ Guia de devolução criada com sucesso!\n\nNovo Tracking: ${res.newTrackingNumber}`)
        if (onUpdateShipment) {
          onUpdateShipment({ ...shipment, status: "devolvido" })
        }
        window.location.reload()
      } else {
        alert("Erro ao criar devolução: " + (res.error || "Erro desconhecido"))
      }
    } catch (e: any) {
      alert("Erro ao criar devolução: " + e.message)
    } finally {
      setIsCreatingReturn(false)
      setIsOpen(false)
    }
  }

  const handleDelete = async () => {
    if (!effectiveId) return
    const confirmed = window.confirm(`⚠️ Tem a certeza que deseja ELIMINAR o envio ${effectiveRef}?\n\nEsta ação apagará permanentemente a guia e o histórico de rastreio.`)
    if (!confirmed) return

    setIsDeleting(true)
    try {
      const res = await deleteShipmentAction(effectiveId)
      if (res.success) {
        alert(`🗑️ Envio ${effectiveRef} eliminado com sucesso!`)
        if (onDeleteShipment) {
          onDeleteShipment(effectiveId)
        } else {
          window.location.reload()
        }
      } else {
        alert("Erro ao eliminar envio: " + (res.error || "Erro desconhecido"))
      }
    } catch (e: any) {
      alert("Erro ao eliminar envio: " + e.message)
    } finally {
      setIsDeleting(false)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative inline-flex items-center justify-end" ref={menuRef}>
      {/* Botão Principal: Editar */}
      <button 
        type="button"
        onClick={() => onOpenDetails?.()}
        className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1 rounded-l text-[12px] font-semibold shadow-sm transition-colors h-7 flex items-center gap-1.5 cursor-pointer"
        title="Editar / Ver Detalhes do Envio"
      >
        <Edit3 className="w-3 h-3 text-slate-500" />
        <span>Editar</span>
      </button>

      {/* Botão Dropdown */}
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-slate-100 border border-l-0 border-slate-300 hover:bg-slate-200 text-slate-700 px-1.5 py-1 rounded-r shadow-sm transition-colors h-7 flex items-center cursor-pointer"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 text-left animate-in fade-in-50 zoom-in-95 duration-150 font-sans">
          
          {/* 1. Detalhes Principais */}
          <div className="px-1.5 py-1">
            <button 
              type="button"
              onClick={() => {
                setIsOpen(false)
                onOpenDetails?.()
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-blue-50 hover:text-blue-800 rounded-lg text-xs text-slate-800 font-bold transition-colors cursor-pointer"
            >
              <Package className="w-4 h-4 text-blue-600" />
              <span>Ver Detalhes & Rastreio</span>
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          {/* 2. Impressão & Download da Guia/Etiqueta */}
          <div className="px-1.5 py-1">
            <button 
              type="button"
              onClick={handlePrint}
              disabled={isProcessing}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-50 rounded-lg text-xs text-slate-700 font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
              ) : (
                <Printer className="w-4 h-4 text-emerald-600" />
              )}
              <span>Imprimir Etiqueta CTT</span>
            </button>

            <button 
              type="button"
              onClick={handleDownload}
              disabled={isProcessing}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-50 rounded-lg text-xs text-slate-700 font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Descarregar PDF</span>
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          {/* 3. Ações Avançadas: Devolução & Eliminar */}
          <div className="px-1.5 py-1">
            <div className="px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ações de Gestão</div>

            {/* Criar Devolução */}
            <button 
              type="button"
              onClick={handleCreateReturn}
              disabled={isCreatingReturn}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-amber-50 rounded-lg text-xs text-amber-800 font-semibold transition-colors cursor-pointer disabled:opacity-50 mt-0.5"
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
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-red-50 rounded-lg text-xs text-red-700 font-semibold transition-colors cursor-pointer disabled:opacity-50 mt-0.5"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 text-red-600 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 text-red-600" />
              )}
              <span>Eliminar Envio</span>
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          {/* 4. Ações CTT Expresso */}
          <div className="px-1.5 py-1 bg-red-50/40 rounded-lg mx-1 my-0.5">
            <div className="px-2 py-0.5 text-[10px] font-black text-red-600 uppercase tracking-wider">Ações CTT Expresso</div>
            
            {shipment?.status === "pendente" && (
              <button 
                type="button"
                onClick={handleEmitCtt}
                disabled={isEmitting || !effectiveId}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-red-100/60 rounded-md text-xs text-red-700 font-bold disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Truck className={`w-3.5 h-3.5 text-red-600 ${isEmitting ? 'animate-pulse' : ''}`} />
                <span>{isEmitting ? 'A Emitir...' : 'Emitir Envio CTT'}</span>
              </button>
            )}

            <button 
              type="button"
              onClick={handleSyncTracking}
              disabled={isProcessing}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-red-100/60 rounded-md text-xs text-red-700 font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-red-600 ${isProcessing ? "animate-spin" : ""}`} />
              <span>Sincronizar Pickagens CTT</span>
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          {/* 5. Enviar por E-mail */}
          <div className="px-1.5 py-0.5">
            <button 
              type="button"
              onClick={() => {
                alert(`Enviar detalhes do envio ${effectiveRef} por e-mail`)
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-50 rounded-lg text-xs text-slate-500 font-medium transition-colors cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>Enviar por e-mail...</span>
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
