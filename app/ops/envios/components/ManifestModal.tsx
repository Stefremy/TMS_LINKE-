"use client"

import * as React from "react"
import { 
  FileText, 
  Download, 
  Printer, 
  CheckCircle2, 
  X, 
  Truck, 
  Package, 
  Barcode 
} from "lucide-react"

interface ManifestModalProps {
  isOpen: boolean
  onClose: () => void
  deliveryNoteId: string
  shipmentsCount: number
  manifestPdfBase64?: string
  dateStr?: string
}

export function ManifestModal({
  isOpen,
  onClose,
  deliveryNoteId,
  shipmentsCount,
  manifestPdfBase64,
  dateStr
}: ManifestModalProps) {
  if (!isOpen) return null

  const handleDownload = () => {
    if (!manifestPdfBase64) return
    const link = document.createElement("a")
    link.href = `data:application/pdf;base64,${manifestPdfBase64}`
    link.download = `Guia_Transporte_CTT_${deliveryNoteId}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    if (!manifestPdfBase64) return
    const blob = new Blob([Uint8Array.from(atob(manifestPdfBase64), c => c.charCodeAt(0))], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const printWindow = window.open(url)
    if (printWindow) {
      printWindow.onload = () => printWindow.print()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Fecho de Expedição Concluído</h2>
              <p className="text-xs text-slate-400">Guia de Transporte & Manifesto de Carga</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Summary Box */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Nº Manifesto CTT:</span>
              <span className="font-mono font-bold text-sm text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {deliveryNoteId}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Envios Expedidos:</span>
              <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-green-600" />
                {shipmentsCount} envio(s)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Transportadora:</span>
              <span className="font-bold text-xs text-red-600 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                CTT Expresso
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Data de Fecho:</span>
              <span className="text-xs text-slate-600">
                {dateStr || new Date().toLocaleString("pt-PT")}
              </span>
            </div>
          </div>

          {/* Info notice */}
          <div className="p-3 bg-amber-50 border border-amber-200/70 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <FileText className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p>
              Imprima este documento ou descarregue em PDF para assinatura conjunta no ato de recolha pelo motorista da <strong>CTT Expresso</strong>. Os envios passaram automaticamente ao estado <strong>Em Trânsito</strong>.
            </p>
          </div>

          {/* PDF Preview Frame (if base64 available) */}
          {manifestPdfBase64 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs h-48 bg-slate-100 flex items-center justify-center relative group">
              <iframe 
                src={`data:application/pdf;base64,${manifestPdfBase64}#toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full pointer-events-none"
                title="Pré-visualização do Manifesto"
              />
              <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center">
                <button 
                  onClick={handleDownload}
                  className="bg-white hover:bg-slate-50 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md border border-slate-200 flex items-center gap-1.5 transition-all transform hover:scale-105"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descarregar PDF Completo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Fechar
          </button>
          
          {manifestPdfBase64 && (
            <>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Descarregar Guia (PDF)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
