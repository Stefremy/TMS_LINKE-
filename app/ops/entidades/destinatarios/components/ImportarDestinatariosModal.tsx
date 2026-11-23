"use client"

import * as React from "react"
import { FileSpreadsheet, Upload, X, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import { importDestinatariosAction, finishDestinatariosImportAction } from "@/app/actions/destinatarios"
import { planRecipientImport, recipientFileMatchesClient, RECIPIENT_IMPORT_BATCH, type RecipientImportPlan } from "@/lib/recipients/legacy-import"

type Props = {
  onClose: () => void
  onImported: () => void
  clients: Cliente[]
  /** Na Área de Cliente a loja é fixa; no OPS escolhe-se o cliente. */
  lockedClientId?: string
  defaultClientId?: string
}

type Progress = { done: number; imported: number; skipped: number }

/** Importa as "Moradas Frequentes" (Excel) da plataforma antiga para a agenda de destinatários. */
export function ImportarDestinatariosModal({ onClose, onImported, clients, lockedClientId, defaultClientId }: Props) {
  const [clientId, setClientId] = React.useState(lockedClientId || defaultClientId || "")
  const [fileName, setFileName] = React.useState("")
  const [plan, setPlan] = React.useState<RecipientImportPlan | null>(null)
  const [error, setError] = React.useState("")
  const [reading, setReading] = React.useState(false)
  const [progress, setProgress] = React.useState<Progress | null>(null)
  const [finished, setFinished] = React.useState(false)
  const running = progress !== null && !finished

  const client = clients.find(c => c.id === clientId)
  const clientCodes = [client?.code, (client as { legacy_import?: { source_code?: string } } | undefined)?.legacy_import?.source_code]
  const wrongClient = Boolean(plan && client && !recipientFileMatchesClient(plan.fileClientCodes, clientCodes))

  const readFile = async (file: File) => {
    setError(""); setPlan(null); setProgress(null); setFinished(false); setFileName(file.name); setReading(true)
    try {
      const XLSX = await import("xlsx")
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!sheet) throw new Error("O ficheiro não tem folhas.")
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
      if (!rows.length) throw new Error("O ficheiro está vazio.")
      if (!("Nome" in rows[0]) || !("Morada" in rows[0])) throw new Error("O ficheiro não tem as colunas Nome e Morada da exportação de Moradas Frequentes.")
      setPlan(planRecipientImport(rows))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ler o ficheiro.")
    } finally {
      setReading(false)
    }
  }

  const runImport = async () => {
    if (!plan || !clientId || wrongClient) return
    setError("")
    const totals: Progress = { done: 0, imported: 0, skipped: 0 }
    setProgress({ ...totals })
    try {
      for (let i = 0; i < plan.recipients.length; i += RECIPIENT_IMPORT_BATCH) {
        const batch = plan.recipients.slice(i, i + RECIPIENT_IMPORT_BATCH)
        const res = await importDestinatariosAction(clientId, batch, plan.fileClientCodes)
        if (!res.success) throw new Error(res.error || "Erro ao importar destinatários.")
        totals.done += batch.length; totals.imported += res.imported || 0; totals.skipped += res.skipped || 0
        setProgress({ ...totals })
      }
      await finishDestinatariosImportAction()
      setFinished(true)
      onImported()
    } catch (err) {
      setError(`${err instanceof Error ? err.message : "Erro ao importar."} Foram importados ${totals.imported} antes do erro; pode voltar a importar o mesmo ficheiro, os já importados são ignorados.`)
      setProgress(null)
    }
  }

  const pct = plan && progress ? Math.round((progress.done / Math.max(1, plan.recipients.length)) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--surface-bg)] rounded-xl shadow-2xl border border-[var(--border-subtle)] w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="import-dest-title">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center border border-[rgba(18,138,71,0.1)]">
              <FileSpreadsheet className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 id="import-dest-title" className="text-base font-bold text-[var(--text-primary)] leading-snug">Importar destinatários</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Ficheiro Excel de Moradas Frequentes da plataforma antiga</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={running} aria-label="Fechar"
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-md transition-colors disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto text-sm">
          {!lockedClientId && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Cliente</span>
              <select value={clientId} onChange={e => setClientId(e.target.value)} disabled={running || finished}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-xs text-[var(--text-primary)]">
                <option value="">Escolha o cliente…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.short_name || c.legal_name}</option>)}
              </select>
            </label>
          )}

          <label className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border-strong)] px-4 py-6 text-center transition-colors ${running || finished ? "opacity-50" : "cursor-pointer hover:bg-[var(--surface-muted)]"}`}>
            <Upload className="w-5 h-5 text-[var(--text-tertiary)]" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">{fileName || "Escolher ficheiro .xlsx"}</span>
            <span className="text-[11px] text-[var(--text-tertiary)]">Colunas: Nome, Morada, Código Postal, Localidade, País, Telefone, E-mail</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" disabled={running || finished}
              onChange={e => { const file = e.target.files?.[0]; if (file) void readFile(file); e.target.value = "" }} />
          </label>

          {reading && <p className="text-xs text-[var(--text-secondary)]">A ler o ficheiro…</p>}

          {plan && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 p-4 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Destinatários a importar</span><strong className="text-[var(--text-primary)]">{plan.recipients.length.toLocaleString("pt-PT")}</strong></div>
              {plan.duplicates > 0 && <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Repetidos no ficheiro (ignorados)</span><span>{plan.duplicates.toLocaleString("pt-PT")}</span></div>}
              {plan.invalid.length > 0 && (
                <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Linhas incompletas (ignoradas)</span>
                  <span title={plan.invalid.slice(0, 20).map(i => `Linha ${i.row}: ${i.reason}`).join("\n")}>{plan.invalid.length.toLocaleString("pt-PT")}</span></div>
              )}
              {plan.fileClientCodes.length > 0 && <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Código do cliente no ficheiro</span><span className="font-mono">{plan.fileClientCodes.join(", ")}</span></div>}
              <p className="pt-1 text-[11px] text-[var(--text-tertiary)]">Moradas que já estão na agenda deste cliente são ignoradas, por isso pode importar o mesmo ficheiro mais do que uma vez.</p>
            </div>
          )}

          {wrongClient && (
            <p className="flex items-start gap-2 rounded-md border border-[var(--status-critical)]/30 bg-[var(--status-critical-soft)] px-3 py-2 text-xs text-[var(--status-critical)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Este ficheiro é do cliente {plan?.fileClientCodes.join(", ")}, mas a loja escolhida tem o código {client?.code || "—"}. Confirme o ficheiro.
            </p>
          )}

          {progress && (
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {finished ? <span className="inline-flex items-center gap-1 font-semibold text-[var(--accent)]"><CheckCircle2 className="h-3.5 w-3.5" />Concluído:</span> : `A importar… ${pct}% ·`}{" "}
                {progress.imported.toLocaleString("pt-PT")} importados{progress.skipped ? `, ${progress.skipped.toLocaleString("pt-PT")} já existiam` : ""}
              </p>
            </div>
          )}

          {error && <p className="rounded-md bg-[var(--status-critical-soft)] px-3 py-2 text-xs text-[var(--status-critical)]">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={running}>{finished ? "Fechar" : "Cancelar"}</Button>
          {!finished && (
            <Button size="sm" onClick={runImport} disabled={!plan || !plan.recipients.length || !clientId || wrongClient || running}>
              {running ? "A importar…" : `Importar ${plan ? plan.recipients.length.toLocaleString("pt-PT") : ""} destinatários`}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
