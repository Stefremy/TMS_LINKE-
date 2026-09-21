"use client"

import * as React from "react"
import { Mail, X } from "lucide-react"
import { emailTemplates } from "./templates"

type TemplateId = keyof typeof emailTemplates | null

export function TemplatesClient() {
  const [previewId, setPreviewId] = React.useState<TemplateId>(null)

  return (
    <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Templates de Notificação</h2>
            <p className="text-sm text-slate-500">Gerir mensagens automáticas enviadas para os clientes.</p>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-semibold text-slate-800">Preview do Email</h3>
              <button 
                onClick={() => setPreviewId(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-0 bg-slate-100">
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
    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
      <div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500">{desc}</p>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={onPreview}
          className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
        >
          Preview
        </button>
        <button 
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            isError ? "text-red-600 hover:bg-red-50" : "text-blue-600 hover:bg-blue-50"
          }`}
          disabled
        >
          Editar
        </button>
      </div>
    </div>
  )
}
