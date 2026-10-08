"use client"

import React from "react"
import { TrackingShipment } from "../types"
import { 
  X, 
  FileText, 
  Download, 
  Printer, 
  ShieldCheck, 
  QrCode, 
  Building2, 
  MapPin, 
  Calendar,
  CheckCircle2
} from "lucide-react"

interface DocumentationModalProps {
  shipment: TrackingShipment
  isOpen: boolean
  onClose: () => void
}

export function DocumentationModal({ shipment, isOpen, onClose }: DocumentationModalProps) {
  if (!isOpen) return null

  const { documentation, origin, destination, cargo } = shipment

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="w-full max-w-2xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Guia de Transporte Digital (CMR)
                </h3>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  {documentation.guiaNumber}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Certificado pela Autoridade Tributária (AT)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4 text-xs">
          {/* AT Tax Code Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold uppercase">
                  Código de Comunicação AT
                </span>
                <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                  {documentation.atDocCode}
                </span>
              </div>
            </div>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
              Emitida a {documentation.issueDate}
            </span>
          </div>

          {/* Sender & Recipient Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Sender */}
            <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                1. Remetente / Expedidor
              </span>
              <span className="font-bold text-[var(--text-primary)] text-xs">
                {documentation.senderName}
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
                NIF: {documentation.senderVat}
              </span>
              <span className="text-[11px] text-[var(--text-secondary)] leading-snug">
                {documentation.senderAddress}
              </span>
            </div>

            {/* Recipient */}
            <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                2. Destinatário / Consignatário
              </span>
              <span className="font-bold text-[var(--text-primary)] text-xs">
                {documentation.recipientName}
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
                NIF: {documentation.recipientVat}
              </span>
              <span className="text-[11px] text-[var(--text-secondary)] leading-snug">
                {documentation.recipientAddress}
              </span>
            </div>
          </div>

          {/* Cargo Details */}
          <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] flex flex-col gap-2">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              3. Especificação da Mercadoria
            </span>
            <p className="font-medium text-[var(--text-primary)] text-xs">
              {documentation.goodsDescription}
            </p>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)] text-[11px]">
              <div>
                <span className="text-[10px] text-[var(--text-tertiary)]">Volumes</span>
                <p className="font-bold text-[var(--text-primary)]">{documentation.cargoPackages} caixas</p>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-tertiary)]">Peso Bruto</span>
                <p className="font-bold text-[var(--text-primary)]">{documentation.cargoWeightKg} kg</p>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-tertiary)]">Valor Declarado</span>
                <p className="font-bold text-[var(--text-primary)]">{documentation.insuredValueEur.toLocaleString()} €</p>
              </div>
            </div>
          </div>

          {/* Carrier & Tracking Info */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-dashed border-[var(--border-strong)] text-[11px] text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--text-primary)]">Transportadora:</span>
              <span className="font-mono bg-[var(--surface-muted)] px-1.5 py-0.5 rounded font-bold">{shipment.carrier}</span>
              <span>({shipment.serviceType})</span>
            </div>
            <div>
              <span className="font-bold text-[var(--text-primary)]">Nº de Rastreio:</span> {shipment.trackingNumber || shipment.displayId}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2.5 bg-[var(--surface-bg)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>

          <button
            type="button"
            onClick={() => alert(`A descarregar guia digital ${documentation.guiaNumber}.pdf`)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descarregar PDF</span>
          </button>
        </div>
      </div>
    </div>
  )
}
