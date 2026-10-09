"use client"

import * as React from "react"
import { Mail, X, Save, Edit3, Loader2 } from "lucide-react"
import { getEmailTemplates, updateEmailTemplate } from "@/app/actions/templates"

export function TemplatesClient() {
  const [templates, setTemplates] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  
  const [previewTemplate, setPreviewTemplate] = React.useState<any | null>(null)
  const [editTemplate, setEditTemplate] = React.useState<any | null>(null)
  
  const [editContent, setEditContent] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    setLoading(true)
    try {
      const data = await getEmailTemplates()
      setTemplates(data || [])
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!editTemplate) return
    setIsSaving(true)
    const res = await updateEmailTemplate(editTemplate.id, editContent)
    setIsSaving(false)
    
    if (res.success) {
      setTemplates(templates.map(t => t.id === editTemplate.id ? { ...t, html_content: editContent } : t))
      setEditTemplate(null)
    } else {
      alert("Erro ao gravar o template: " + res.error)
    }
  }

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
        {loading ? (
          <div className="flex items-center justify-center p-8 text-[var(--text-secondary)]">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center p-6 text-[12px] text-[var(--text-secondary)]">
            Nenhum template encontrado. Corre o script de seed.
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <TemplateRow 
                key={t.id}
                template={t}
                onPreview={() => setPreviewTemplate(t)}
                onEdit={() => {
                  setEditTemplate(t)
                  setEditContent(t.html_content)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE PREVIEW */}
      {previewTemplate && !editTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--text-primary)]/40 backdrop-blur-sm">
          <div className="bg-[var(--surface-bg)] rounded-xl shadow-[0_20px_50px_rgba(20,23,20,0.22)] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[var(--border-strong)]">
            <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Preview: {previewTemplate.name}</h3>
              </div>
              <button 
                onClick={() => setPreviewTemplate(null)}
                className="w-7 h-7 flex items-center justify-center hover:bg-[var(--surface-container)] rounded-md transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-[var(--surface-muted)]">
              <iframe 
                srcDoc={getMockedHtml(previewTemplate.html_content)}
                className="w-full h-[600px] border-0 bg-white"
                title="Email Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      {editTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--text-primary)]/40 backdrop-blur-sm">
          <div className="bg-[var(--surface-bg)] rounded-xl shadow-[0_20px_50px_rgba(20,23,20,0.22)] w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col border border-[var(--border-strong)]">
            <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Editar: {editTemplate.name}</h3>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[12px] font-bold rounded-md flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Gravar Alterações
                </button>
                <button 
                  onClick={() => setEditTemplate(null)}
                  className="w-7 h-7 flex items-center justify-center hover:bg-[var(--surface-container)] rounded-md transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/2 border-r border-[var(--border-subtle)] flex flex-col">
                <div className="px-4 py-2 bg-[var(--surface-container)] border-b border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Código HTML
                </div>
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 w-full p-4 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-[13px] focus:outline-none resize-none"
                  spellCheck={false}
                />
              </div>
              <div className="w-1/2 flex flex-col bg-[var(--surface-muted)]">
                <div className="px-4 py-2 bg-[var(--surface-container)] border-b border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Live Preview
                </div>
                <iframe 
                  srcDoc={getMockedHtml(editContent)}
                  className="flex-1 w-full border-0 bg-white"
                  title="Email Preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateRow({ template, onPreview, onEdit }: { template: any, onPreview: () => void, onEdit: () => void }) {
  const isError = template.id === "incident"
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md hover:border-[var(--border-strong)] transition-colors group">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isError ? "bg-[var(--status-critical)]" : "bg-[var(--accent)]"}`} />
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{template.name}</h3>
          <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5 truncate">{template.description}</p>
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
          onClick={onEdit}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
            isError ? "text-[var(--status-critical)] hover:bg-[var(--status-critical-soft)]" : "text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          Editar Template
        </button>
      </div>
    </div>
  )
}

function getMockedHtml(html: string) {
  if (!html) return ""
  return html
    .replace(/{{tracking_url}}/g, "https://tms.linke.pt/tracking")
    .replace(/{{receiver_name}}/g, "João Silva")
    .replace(/{{sender_name}}/g, "Nossa Loja")
    .replace(/{{tracking_code}}/g, "EA123456789PT")
    .replace(/{{carrier_name}}/g, "CTT Expresso")
    .replace(/{{current_balance}}/g, "14.50")
    .replace(/{{topup_url}}/g, "https://tms.linke.pt/app")
    .replace(/{{date}}/g, "24 Out 2026")
    .replace(/{{time_period}}/g, "09h - 13h")
    .replace(/{{address}}/g, "Rua da Boavista, 4000-123 Porto")
    .replace(/{{volumes}}/g, "1")
    .replace(/{{incident_reason}}/g, "Morada incompleta ou incorreta")
}
