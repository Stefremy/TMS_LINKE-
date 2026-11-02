"use client"

import { useState } from "react"
import Link from "next/link"
import type { ClientSpecialServiceFee } from "@/app/ops/entidades/clientes/types"
import { SpecialFeesEditor } from "@/components/shipments/SpecialFeesEditor"
import { saveStandardSpecialFeesAction } from "@/app/actions/special-fees"

export function StandardSpecialFeesClient({ initialFees, initialUpdatedAt }: { initialFees: ClientSpecialServiceFee[]; initialUpdatedAt?: string }) {
  const [fees, setFees] = useState(initialFees)
  const [saved, setSaved] = useState(JSON.stringify(initialFees))
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const changed = saved !== JSON.stringify(fees)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true); setError(""); setMessage("")
    try {
      const result = await saveStandardSpecialFeesAction(fees)
      if (!result.success) { setError(result.error); return }
      setFees(result.fees); setSaved(JSON.stringify(result.fees)); setUpdatedAt(result.updatedAt)
      setMessage("Tabela standard guardada. Os ajustes personalizados dos clientes foram mantidos.")
    } catch { setError("Não foi possível guardar as taxas. Tente novamente.") }
    finally { setPending(false) }
  }
  return <form onSubmit={submit} className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-xl font-bold">Taxas Suplementares e Serviços Especiais</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Tabela standard de valores cobrados nas opções adicionais dos envios.</p></div>
      <button type="submit" disabled={pending || !changed && !!updatedAt}
        className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A guardar…" : "Guardar standard"}</button>
    </div>
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 text-sm">
      <p>Os clientes seguem estes valores nas taxas assinaladas como <strong>Standard</strong>. No modal de cada cliente pode ajustar os valores à mão ou voltar ao standard.</p>
      <Link href="/ops/entidades/clientes" className="mt-2 inline-block text-xs font-semibold text-[var(--accent)]">Abrir clientes →</Link>
      <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">{fees.length} taxas · {fees.filter(fee => fee.is_enabled).length} ativas{changed ? " · Alterações por guardar" : ""}
        {updatedAt && ` · Última atualização: ${new Date(updatedAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`}</p>
    </div>
    {error && <p role="alert" className="rounded-xl bg-[var(--status-critical-soft)] p-3 text-sm text-[var(--status-critical)]">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent)]">{message}</p>}
    <SpecialFeesEditor fees={fees} onChange={values => { setFees(values); setMessage("") }} mode="standard" disabled={pending} />
  </form>
}
