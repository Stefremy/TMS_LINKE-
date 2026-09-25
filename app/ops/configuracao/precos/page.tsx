import * as React from "react"
import { DollarSign, Construction } from "lucide-react"

export default function PrecosPage() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="w-full max-w-lg bg-[var(--surface-bg)] rounded-lg border border-[var(--border-subtle)] shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[rgba(18,138,71,0.1)]">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-[14px] font-bold text-[var(--text-primary)] leading-tight">Gestão de Preços</h1>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5">Tabelas de preços e tarifas</p>
          </div>
        </div>
        <div className="p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--status-warning-soft)] border border-[rgba(217,119,6,0.2)] flex items-center justify-center text-[var(--status-warning)]">
            <Construction className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-[var(--text-primary)]">Módulo em Desenvolvimento</p>
            <p className="text-[12px] font-medium text-[var(--text-secondary)] mt-1">Este módulo estará disponível em breve.</p>
          </div>
          <span className="inline-block mt-1 px-3 py-1 bg-[var(--surface-muted)] border border-[var(--border-strong)] rounded text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
            Em Breve
          </span>
        </div>
      </div>
    </div>
  )
}
