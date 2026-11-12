"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, RefreshCw, Truck } from "lucide-react"
import { completeClientPickupRequestAction, listClientPickupRequestsAction, reopenClientPickupRequestAction, sendClientPickupConfirmationEmailAction } from "@/app/actions/client-pickup-requests"
import { PICKUP_REQUEST_PAGE_SIZE, type ClientPickupRequest, type PickupRequestPage } from "@/lib/client-pickup-requests"
import { inputClass, primaryButton, secondaryButton } from "@/components/shipments/form/fields"
import { PICKUP_REQUESTS_CHANGED_EVENT } from "@/lib/pickup-request-notifications"

export function ClientPickupRequestsPanel({ initialPage, initialError, onSchedule }: { initialPage: PickupRequestPage; initialError?: string; onSchedule: (request: ClientPickupRequest) => void }) {
  const router = useRouter()
  const [data, setData] = React.useState(initialPage)
  const [error, setError] = React.useState(initialError || "")
  const [notice, setNotice] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [includeCompleted, setIncludeCompleted] = React.useState(false)
  const lock = React.useRef(false)
  const load = async (page = data.page, all = includeCompleted) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError("")
    try {
      const result = await listClientPickupRequestsAction({ pendingOnly: !all, page })
      if (result.success) { setData(result); window.dispatchEvent(new Event(PICKUP_REQUESTS_CHANGED_EVENT)); router.refresh() } else setError(result.error)
    } catch { setError("Não foi possível carregar os pedidos.") }
    finally { lock.current = false; setBusy(false) }
  }
  const complete = async (event: React.FormEvent<HTMLFormElement>, request: ClientPickupRequest) => {
    event.preventDefault()
    if (lock.current) return
    const form = new FormData(event.currentTarget)
    lock.current = true; setBusy(true); setError("")
    try {
      const result = await completeClientPickupRequestAction(request.id, String(form.get("reference") || ""), String(form.get("carrier") || ""))
      if (!result.success) { setError(result.error); return }
      setNotice(result.email_warning || "")
      setData(previous => ({ ...previous, requests: includeCompleted ? previous.requests.map(row => row.id === request.id ? result.request : row) : previous.requests.filter(row => row.id !== request.id), total: includeCompleted ? previous.total : Math.max(0, previous.total - 1) }))
      window.dispatchEvent(new Event(PICKUP_REQUESTS_CHANGED_EVENT))
      router.refresh()
    } catch { setError("Não foi possível guardar o estado. Atualize a lista antes de repetir.") }
    finally { lock.current = false; setBusy(false) }
  }
  const reopen = async (request: ClientPickupRequest) => {
    if (lock.current || !window.confirm("Confirma que verificou na transportadora e que não foi criada nenhuma recolha para este pedido? Só reponha pendente após esta verificação.")) return
    lock.current = true; setBusy(true); setError("")
    try {
      const result = await reopenClientPickupRequestAction(request.id, true)
      if (result.success) { setData(previous => ({ ...previous, requests: previous.requests.map(row => row.id === request.id ? { ...row, status: "pending" } : row) })); window.dispatchEvent(new Event(PICKUP_REQUESTS_CHANGED_EVENT)); router.refresh() }
      else setError(result.error)
    } catch { setError("Não foi possível repor o pedido.") }
    finally { lock.current = false; setBusy(false) }
  }
  const confirmEmail = async (request: ClientPickupRequest) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(""); setNotice("")
    try {
      const result = await sendClientPickupConfirmationEmailAction(request.id)
      if (!result.success) { setError(result.error); return }
      setNotice(result.alreadySent ? "O email de confirmação já foi enviado ao cliente." : "Email de confirmação enviado ao cliente.")
    } catch { setError("Não foi possível confirmar o envio do email. Tente novamente.") }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-label="Pedidos de recolha dos clientes">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-[var(--text-primary)]">Pedidos dos clientes ({data.total})</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">O cliente aguarda o pedido à transportadora. Abra o formulário com os dados preenchidos ou registe uma recolha já pedida no portal da transportadora.</p></div><button type="button" disabled={busy} className={secondaryButton} onClick={() => void load()}><RefreshCw size={14} />Atualizar</button></div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}
    <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]"><input type="checkbox" checked={includeCompleted} disabled={busy} onChange={event => { setIncludeCompleted(event.target.checked); void load(0, event.target.checked) }} />Incluir pedidos efetuados</label>
    {!data.requests.length && !error && <p className="rounded-lg border border-[var(--border-subtle)] p-6 text-sm text-[var(--text-secondary)]">Sem pedidos pendentes dos clientes.</p>}
    {data.requests.map(request => <article key={request.id} className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-[var(--text-primary)]">{request.client_name} <span className="ml-2 font-mono text-xs text-[var(--text-secondary)]">{request.reference}</span></h3><span className={`rounded-md px-2 py-1 text-xs font-medium ${request.status === "completed" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>{request.status === "processing" ? "Em tratamento — verificar resultado" : request.status === "completed" ? "Efetuado" : "Pendente"}</span></div>
      <p className="text-sm text-[var(--text-primary)]">{request.pickup.date.split("-").reverse().join("/")} · {request.pickup.period} · {request.pickup.carrier === "ctt_expresso" ? "CTT Expresso" : "Correos Express"} · {request.pickup.volumes} volume(s) · {request.pickup.weightKg} kg</p>
      <p className="text-xs text-[var(--text-secondary)]">{request.pickup.name} · {request.pickup.address}, {request.pickup.postal} {request.pickup.city}<br />{request.pickup.contact} · {request.pickup.phone}{request.pickup.email ? ` · ${request.pickup.email}` : ""}</p>
      {request.pickup.notes && <p className="whitespace-pre-wrap rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-secondary)]">{request.pickup.notes}</p>}
      {request.carrier_reference && <p className="text-xs font-medium text-[var(--text-primary)]">{request.carrier_name} · Referência: {request.carrier_reference}</p>}
      {request.status === "completed" && <button type="button" disabled={busy} className={secondaryButton} onClick={() => void confirmEmail(request)}>Confirmar email ao cliente</button>}
      {request.status !== "completed" && <><div className="flex flex-wrap gap-2">{request.status === "pending" ? <button type="button" disabled={busy} className={primaryButton} onClick={() => onSchedule(request)}><Truck size={15} />Preparar recolha</button> : <button type="button" disabled={busy} className={secondaryButton} onClick={() => void reopen(request)}>Repor pendente após verificação</button>}</div>
      <details className="rounded-lg border border-[var(--border-subtle)] p-3"><summary className="cursor-pointer text-xs font-medium text-[var(--text-secondary)]">Já foi pedida à transportadora? Marcar efetuado</summary><form onSubmit={event => void complete(event, request)} className="mt-3"><fieldset disabled={busy} className="flex flex-wrap items-end gap-3"><label className="space-y-1 text-xs text-[var(--text-secondary)]">Transportadora<select name="carrier" defaultValue={request.pickup.carrier === "ctt_expresso" ? "CTT Expresso" : "Correos Express"} className={inputClass}><option>CTT Expresso</option><option>Correos Express</option></select></label><label className="space-y-1 text-xs text-[var(--text-secondary)]">Referência confirmada<input name="reference" required maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9./_-]*" className={inputClass} /></label><button type="submit" className={secondaryButton}><CheckCircle2 size={14} />Marcar efetuado</button></fieldset></form></details></>}
    </article>)}
    <div className="flex items-center justify-between gap-3"><button type="button" disabled={busy || data.page === 0} className={secondaryButton} onClick={() => void load(data.page - 1)}>Anterior</button><span className="text-xs text-[var(--text-secondary)]">Página {data.page + 1}</span><button type="button" disabled={busy || (data.page + 1) * PICKUP_REQUEST_PAGE_SIZE >= data.total} className={secondaryButton} onClick={() => void load(data.page + 1)}>Seguinte</button></div>
  </section>
}
