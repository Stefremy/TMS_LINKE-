"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Copy, Loader2, X } from "lucide-react"
import { notify } from "@/lib/notify"
import { errorMessage } from "@/lib/errors"
import { dispatchShipmentAction, duplicateShipmentAction, previewShipmentDuplicateAction } from "@/app/actions/shipments"
import type { ShipmentDuplicatePreview } from "@/lib/services/shipments/shipment-duplicator"

interface DuplicateShipmentModalProps {
  shipmentId: string
  trackingRef?: string
  onClose: () => void
  onDuplicated?: () => void
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 shrink-0">{label}</span>
      <span className="text-xs text-slate-800 font-medium text-right min-w-0 break-words">{value || "—"}</span>
    </div>
  )
}

export function DuplicateShipmentModal({ shipmentId, trackingRef, onClose, onDuplicated }: DuplicateShipmentModalProps) {
  const [preview, setPreview] = React.useState<ShipmentDuplicatePreview | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [reference, setReference] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    let active = true
    previewShipmentDuplicateAction(shipmentId)
      .then(res => {
        if (!active) return
        if (res.success) setPreview(res.preview)
        else setLoadError(res.error || "Erro ao carregar o envio.")
      })
      .catch(err => { if (active) setLoadError(errorMessage(err) || "Erro ao carregar o envio.") })
    return () => { active = false }
  }, [shipmentId])

  const handleConfirm = async (emit = false) => {
    setIsSaving(true)
    try {
      const res = await duplicateShipmentAction(shipmentId, { clientReference: reference })
      if (!res.success) {
        notify.error("Erro ao duplicar envio: " + res.error)
        return
      }
      if (res.warning) notify.warning(res.warning)
      notify.success(`Envio duplicado. Novo tracking: ${res.trackingNumber}`)
      if (emit) {
        try {
          const sent = await dispatchShipmentAction(res.id)
          if (!sent.success) {
            notify.error(`Duplicado criado como rascunho (${res.trackingNumber}), mas a transportadora não aceitou: ${sent.error || "erro desconhecido"}`)
            onDuplicated?.()
            return
          }
          if (sent.dbWarning) {
            notify.warning(sent.dbWarning)
            onDuplicated?.()
            return
          }
          notify.success(`Guia emitida. Tracking: ${sent.trackingNumber}`)
        } catch (err) {
          notify.error(`Duplicado criado como rascunho (${res.trackingNumber}), mas a emissão falhou: ${errorMessage(err)}`)
          onDuplicated?.()
          return
        }
      }
      onDuplicated?.()
      onClose()
      window.location.reload()
    } catch (err) {
      notify.error("Erro ao duplicar envio: " + errorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="duplicate-shipment-title">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-200 font-sans whitespace-normal text-left normal-case">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 id="duplicate-shipment-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Copy className="w-4 h-4 text-[#007F8B]" /> Duplicar Envio
          </h2>
          <button type="button" onClick={onClose} disabled={isSaving} aria-label="Fechar" className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {loadError ? (
            <p className="text-xs text-red-700">{loadError}</p>
          ) : !preview ? (
            <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> A carregar detalhes…</div>
          ) : (
            <>
              <p className="text-xs text-slate-600 mb-3">
                Vai ser criado um novo envio, com novo tracking, para o mesmo cliente e com os mesmos dados de <span className="font-mono font-semibold">{trackingRef || preview.originalTracking}</span>.
              </p>
              <div className="rounded-lg border border-slate-200 px-3 py-1">
                <Row label="Serviço" value={preview.service} />
                <Row label="Remetente" value={<>{preview.senderName}<br /><span className="text-slate-500 font-normal">{preview.senderAddress}</span></>} />
                <Row label="Destinatário" value={<>{preview.recipientName}<br /><span className="text-slate-500 font-normal">{preview.recipientAddress}</span></>} />
                <Row label="Volumes / Peso" value={`${preview.volumes} vol.${preview.weightKg ? ` · ${preview.weightKg.toFixed(2)} kg` : ""}`} />
                {preview.codValue > 0 && <Row label="Reembolso" value={`${preview.codValue.toFixed(2)}€`} />}
                <Row label="Valor s/ IVA" value={`${preview.sellPrice.toFixed(2)}€`} />
              </div>

              <label className="block mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500" htmlFor="duplicate-client-reference">
                Referência do cliente (opcional)
              </label>
              <input
                id="duplicate-client-reference"
                value={reference}
                onChange={e => setReference(e.target.value)}
                maxLength={60}
                placeholder="Manter a do envio original"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#007F8B]/30"
              />
              <p className="mt-3 text-[11px] text-slate-500">
                &ldquo;Só Duplicar&rdquo; cria um rascunho, sem contactar a transportadora. &ldquo;Duplicar e Emitir&rdquo; regista também a guia na transportadora (CTT ou Correos) e gera o tracking oficial.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-xl">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleConfirm(false)}
            disabled={!preview || isSaving}
            className="px-3 py-1.5 text-xs font-semibold text-[#007F8B] border border-[#007F8B] hover:bg-teal-50 rounded-md disabled:opacity-50 cursor-pointer"
          >
            Só Duplicar
          </button>
          <button
            type="button"
            onClick={() => handleConfirm(true)}
            disabled={!preview || isSaving}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#007F8B] hover:bg-[#006974] rounded-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Duplicar e Emitir
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
