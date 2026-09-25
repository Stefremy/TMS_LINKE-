"use client"

import * as React from "react"
import { Mail, X } from "lucide-react"
import { emailTemplates } from "./templates"

type TemplateId = keyof typeof emailTemplates | null

export function TemplatesClient() {
  const [previewId, setPreviewId] = React.useState<TemplateId>(null)

  return (
    <div className="mt-6 bg-[var(--surface-bg)] rounded-lg shadow-sm border border-[var(--border-subtle)] overflow-hidden">
      <div className="p-5 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[rgba(18,138,71,0.1)]">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-[var(--text-primary)] leading-tight">Templates de Notificação</h2>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5">Gerir mensagens automáticas enviadas para os clientes.</p>
          </div>
        </div>
      </div>
      
      <div className="p-5">
        <div className="space-y-2">
          <TemplateRow 
            id="pickup_scheduled"
            title="Aviso de Recolha Agendada"
            desc="Enviado quando uma recolha CTT/Correos é confirmada."
            onPreview={() => setPreviewId("pickup_scheduled")}
          />
          <TemplateRow 
            id="low_balance"
            title="Alerta de Saldo Baixo"
            desc="Enviado quando o saldo pré-pago do cliente atinge o limite."
            onPreview={() => setPreviewId("low_balance")}
          />
          <TemplateRow 
            id="in_transit"
            title="Em Transporte"
            desc="Enviado quando a encomenda é recolhida e entra em distribuição."
            onPreview={() => setPreviewId("in_transit")}
          />
          <TemplateRow 
            id="tracking"
            title="Guia de Transporte (Tracking)"
            desc="Enviado para o destinatário final com o link de tracking."
            onPreview={() => setPreviewId("tracking")}
          />
          <TemplateRow 
            id="incident"
            title="Incidências / Problemas na Entrega"
            desc="Enviado quando há uma falha na entrega (ausência, morada incorreta, etc)."
            isError
            onPreview={() => setPreviewId("incident")}
          />
        </div>
      </div>

      {previewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--text-primary)]/40 backdrop-blur-sm">
          <div className="bg-[var(--surface-bg)] rounded-xl shadow-[0_20px_50px_rgba(20,23,20,0.22)] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[var(--border-strong)]">
            <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Preview do Email</h3>
              <button 
                onClick={() => setPreviewId(null)}
                className="w-7 h-7 flex items-center justify-center hover:bg-[var(--surface-container)] rounded-md transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-[var(--surface-muted)]">
              <iframe 
                srcDoc={emailTemplates[previewId]
                  ?.replace(/{{tracking_url}}/g, "http://localhost:3000/tracking")
                  ?.replace(/{{receiver_name}}/g, "João Silva")
                  ?.replace(/{{sender_name}}/g, "Nossa Loja")
                  ?.replace(/{{tracking_code}}/g, "EA123456789PT")
                  ?.replace(/{{carrier_name}}/g, "CTT Expresso")
                  ?.replace(/{{current_balance}}/g, "14.50")
                  ?.replace(/{{topup_url}}/g, "http://localhost:3000/app")
                  ?.replace(/{{date}}/g, "24 Out 2026")
                  ?.replace(/{{time_period}}/g, "09h - 13h")
                  ?.replace(/{{address}}/g, "Rua da Boavista, 4000-123 Porto")
                  ?.replace(/{{volumes}}/g, "1")
                  ?.replace(/{{incident_reason}}/g, "Morada incompleta ou incorreta")
                }
                className="w-full h-[600px] border-0"
                title="Email Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateRow({ id, title, desc, onPreview, isError }: { id: string, title: string, desc: string, onPreview: () => void, isError?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md hover:border-[var(--border-strong)] transition-colors group">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isError ? "bg-[var(--status-critical)]" : "bg-[var(--accent)]"}`} />
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{title}</h3>
          <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5 truncate">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-4">
        <button 
          onClick={onPreview}
          className="px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)] rounded-md transition-colors border border-transparent hover:border-[var(--border-strong)]"
        >
          Preview
        </button>
        <button 
          className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors cursor-not-allowed opacity-50 ${
            isError ? "text-[var(--status-critical)]" : "text-[var(--accent)]"
          }`}
          disabled
        >
          Editar
        </button>
      </div>
    </div>
  )
}
