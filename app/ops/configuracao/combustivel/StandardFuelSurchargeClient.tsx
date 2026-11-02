"use client"

import { useState } from "react"
import { saveStandardFuelSurchargeAction } from "@/app/actions/fuel-surcharge"
import { DEFAULT_FUEL_SURCHARGE_PCT } from "@/lib/pricing/fuel-surcharge"

export function StandardFuelSurchargeClient({ initialPercentage, initialUpdatedAt }: { initialPercentage?: number; initialUpdatedAt?: string }) {
  const [percentage, setPercentage] = useState(String(initialPercentage ?? DEFAULT_FUEL_SURCHARGE_PCT))
  const [saved, setSaved] = useState(initialPercentage)
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const numericPercentage = percentage.trim() === "" ? NaN : Number(percentage)
  const valid = Number.isFinite(numericPercentage) && numericPercentage >= 0
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    setPending(true); setError(""); setMessage("")
    try {
      const result = await saveStandardFuelSurchargeAction(numericPercentage)
      if (!result.success) { setError(result.error); return }
      setPercentage(String(result.fuelSurchargePct)); setSaved(result.fuelSurchargePct); setUpdatedAt(result.fuelUpdatedAt)
      setMessage("Taxa standard guardada. Será aplicada aos novos envios de todos os clientes.")
    } catch { setError("Não foi possível guardar a taxa de combustível. Tente novamente.") }
    finally { setPending(false) }
  }
  return <form onSubmit={submit} className="max-w-3xl space-y-5">
    <div><h1 className="text-xl font-bold">Taxa de Combustível</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">Uma percentagem standard para todos os clientes.</p></div>
    <div className="space-y-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5">
      <p className="text-sm text-[var(--text-secondary)]">O valor guardado aqui aplica-se ao frete base dos novos envios de todos os clientes e transportadoras. Prevalece sobre as taxas de combustível definidas no cliente e nas tabelas de preços.</p>
      <div><label htmlFor="standard-fuel-percentage" className="mb-2 block text-sm font-semibold">Taxa de combustível standard (%)</label>
        <input id="standard-fuel-percentage" type="number" min="0" step="0.01" required disabled={pending} value={percentage}
          onChange={event => { setPercentage(event.target.value); setMessage("") }}
          className="w-40 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm tabular-nums" />
        {valid && <p className="mt-2 text-xs text-[var(--text-secondary)]">Exemplo: num frete de 10,00 €, o combustível será {(numericPercentage / 10).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}.</p>}
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{updatedAt
        ? `Última atualização: ${new Date(updatedAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`
        : "Guarde a taxa para uniformizar o combustível em todos os clientes. Até lá, mantêm-se as taxas atuais."} Os envios já registados mantêm os valores originais.</p>
      <button type="submit" disabled={pending || !valid || numericPercentage === saved}
        className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "A guardar…" : "Guardar standard para todos"}</button>
    </div>
    {error && <p role="alert" className="rounded-xl bg-[var(--status-critical-soft)] p-3 text-sm text-[var(--status-critical)]">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent)]">{message}</p>}
  </form>
}
