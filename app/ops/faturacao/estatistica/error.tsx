"use client"

import { AlertCircle, RefreshCw } from "lucide-react"

export default function StatisticsError({ reset }: { reset: () => void }) {
  return <div role="alert" className="mx-auto max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-8 text-center">
    <AlertCircle className="mx-auto mb-3 h-7 w-7 text-[#C2413B]" />
    <h1 className="font-semibold text-[var(--text-primary)]">Não foi possível carregar a faturação</h1>
    <p className="mt-2 text-sm text-[var(--text-secondary)]">Os dados estão indisponíveis. Tente novamente para consultar os totais.</p>
    <button onClick={reset} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#155EEF] px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" />Tentar novamente</button>
  </div>
}
