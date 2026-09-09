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
  Info,
  Barcode
} from "lucide-react"

import { dispatchShipmentAction, regenerateCttLabelAction } from "@/app/actions/shipments"
import { convertZplToPdfAction, syncCttTrackingAction } from "@/app/actions/ctt"
import { printCttLabel, downloadCttLabel } from "@/lib/label-utils"

interface ActionMenuProps {
  shipment?: any
  shipmentId?: string
  trackingRef?: string
  isCtt?: boolean
  onOpenDetails?: () => void
  onUpdateShipment?: (updated: any) => void
}

export function ActionMenu({ 
  shipment, 
  shipmentId, 
  trackingRef, 
  isCtt = true,
  onOpenDetails,
  onUpdateShipment
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isEmitting, setIsEmitting] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
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

  const handlePrint = async () => {
    setIsOpen(false)
    const rawLabel = shipment?.ctt_label_base64
    if (!rawLabel) {
      if (onOpenDetails) onOpenDetails()
      return
    }
    setIsProcessing(true)
    try {
      const label = await resolveLabel(rawLabel)
      if (label) printCttLabel(label)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async () => {
    setIsOpen(false)
    const rawLabel = shipment?.ctt_label_base64
    if (!rawLabel) {
      if (onOpenDetails) onOpenDetails()
      return
    }
    setIsProcessing(true)
    try {
      const label = await resolveLabel(rawLabel)
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
        alert(`Estado CTT sincronizado com sucesso: ${res.latestStatus || "Atualizado"}`)
      } else {
        alert("Não foi possível atualizar o rastreio.")
      }
    } catch (e: any) {
      alert("Erro ao sincronizar tracking: " + e.message)
    } finally {
      setIsProcessing(false)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative inline-flex items-center justify-end" ref={menuRef}>
      {/* Botão Principal: Editar / Ver Detalhes */}
      <button 
        type="button"
        onClick={() => onOpenDetails?.()}
        className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1 rounded-l text-[12px] font-semibold shadow-sm transition-colors h-7 flex items-center gap-1.5 cursor-pointer"
        title="Ver Detalhes e Editar Envio"
      >
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
        <div className="absolute top-full right-0 mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 text-left animate-in fade-in-50 zoom-in-95 duration-150">
          
          {/* 1. Detalhes Principais */}
          <div className="px-1.5 py-1">
            <button 
              type="button"
              onClick={() => {
                setIsOpen(false)
                onOpenDetails?.()
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 rounded-lg text-xs text-slate-800 font-bold transition-colors cursor-pointer"
            >
              <Package className="w-4 h-4 text-slate-500" />
              <span>Ver Detalhes</span>
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          {/* 2. Impressão & Download da Guia/Etiqueta */}
          <div className="px-1.5 py-1">
            <button 
              type="button"
              onClick={handlePrint}
              disabled={isProcessing}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 rounded-lg text-xs text-slate-700 font-semibold transition-colors cursor-pointer disabled:opacity-50"
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
              className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 rounded-lg text-xs text-slate-700 font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Descarregar PDF</span>
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          {/* 3. Ações CTT Expresso */}
          <div className="px-1.5 py-1 bg-red-50/40 rounded-lg mx-1 my-0.5">
            <div className="px-2 py-1 text-[10px] font-black text-red-600 uppercase tracking-wider">Ações CTT Expresso</div>
            
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
              <RotateCcw className="w-3.5 h-3.5 text-red-600" />
              <span>Atualizar Tracking CTT</span>
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          {/* 4. Enviar por E-mail */}
          <div className="px-1.5 py-1">
            <button 
              type="button"
              onClick={() => {
                alert(`Enviar detalhes do envio ${effectiveRef} por e-mail`)
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 rounded-lg text-xs text-slate-600 font-medium transition-colors cursor-pointer"
            >
              <Mail className="w-4 h-4 text-slate-400" />
              <span>Enviar por e-mail...</span>
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
