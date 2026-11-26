"use client"

import * as React from "react"
import { CalendarDays, CheckCircle2, Clock, Loader2, RefreshCw, Truck, XCircle } from "lucide-react"
import { useClientScope } from "./ClientScope"
import { requestClientPickupAction, listClientPickupRequestsAction } from "@/app/actions/client-pickup-requests"
import { CTT_PICKUP_PERIODS, CORREOS_PICKUP_PERIODS, PICKUP_REQUEST_PAGE_SIZE, formatPickupTimestamp, pickupWhen, pickupRequestToday, readPickupAddress, type PickupLocation, type PickupRequestPage } from "@/lib/client-pickup-requests"
import { inputClass, primaryButton, secondaryButton } from "@/components/shipments/form/fields"
import { ClientPickupLocationAgenda, PickupAddressFields } from "./ClientPickupLocationAgenda"

const emptyPage: PickupRequestPage = { requests: [], total: 0, page: 0 }
export function ClientRequestPickup({ initialPage = emptyPage, initialError = "", initialLocations = [], initialDefaultLocationId = null, agendaError = "" }: {
  initialPage?: PickupRequestPage
  initialError?: string
  initialLocations?: PickupLocation[]
  initialDefaultLocationId?: string | null
  agendaError?: string
}) {
  const { client, isSuspended } = useClientScope()
  const [history, setHistory] = React.useState(initialPage)
  const [error, setError] = React.useState(initialError)
  const [busy, setBusy] = React.useState(false)
  const [sent, setSent] = React.useState("")
  const [volumes, setVolumes] = React.useState(1)
  const [carrier, setCarrier] = React.useState("ctt_expresso")
  const [period, setPeriod] = React.useState("09:00-19:00")
  const [locations, setLocations] = React.useState(initialLocations)
  const [preferredLocationId, setPreferredLocationId] = React.useState(initialDefaultLocationId)
  const [locationOverride, setLocationOverride] = React.useState<string | null>(null)
  const defaultLocationId = locations.some(location => location.id === preferredLocationId) ? preferredLocationId : null
  const selectedLocationId = locationOverride ?? defaultLocationId ?? "primary"
  const lock = React.useRef(false)
  const requestId = React.useRef<string | null>(null)
  const today = pickupRequestToday()
  const suspended = isSuspended || client.portal_access_status === "suspended" || client.portal_access_status === "blocked" || client.is_active === false
  const sortedLocations = React.useMemo(() => [...locations].sort((a, b) => a.label.localeCompare(b.label, "pt-PT")), [locations])
  const primaryAddress = {
    name: client.short_name || client.legal_name,
    contact: client.pickup_contact_name || client.short_name || client.legal_name,
    address: client.address, postal: client.postal_code, city: client.city,
    phone: client.pickup_mobile_phone || client.mobile_phone || client.phone, email: client.email,
  }
  const pickupAddress = selectedLocationId === "manual" ? undefined : locations.find(location => location.id === selectedLocationId) ?? primaryAddress
  const load = async (page = 0) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError("")
    try {
      const result = await listClientPickupRequestsAction({ clientId: client.id, page })
      if (!result.success) { setError(result.error); return }
      setHistory(previous => ({ ...result, requests: page ? [...previous.requests, ...result.requests] : result.requests }))
    } catch { setError("Não foi possível atualizar os pedidos. Tente novamente.") }
    finally { lock.current = false; setBusy(false) }
  }
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (lock.current || suspended || sent) return
    const data = new FormData(event.currentTarget)
    const value = (name: string) => String(data.get(name) || "")
    lock.current = true; setBusy(true); setError("")
    requestId.current ||= crypto.randomUUID()
    try {
      const weightKg = Number(value("weightKg"))
      const result = await requestClientPickupAction({ date: value("date"), period: value("period"), carrier: value("carrier"),
        volumes, weightKg, heaviestWeightKg: volumes === 1 ? weightKg : Number(value("heaviestWeightKg")),
        ...readPickupAddress(data), notes: value("notes"),
      }, requestId.current, client.id)
      if (!result.success) { setError(result.error); return }
      setSent(result.request.reference)
      setHistory(previous => ({ ...previous, requests: [result.request, ...previous.requests.filter(row => row.id !== result.request.id)], total: previous.total + (previous.requests.some(row => row.id === result.request.id) ? 0 : 1) }))
      requestId.current = null
    } catch { setError("Não foi possível confirmar o pedido. Atualize o histórico antes de tentar novamente.") }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
    <header><h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--text-primary)]"><Truck size={22} />Pedidos de recolha</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">Envie o pedido à equipa Linke. O agendamento com a transportadora será tratado pela nossa equipa.</p></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {suspended && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Esta conta não pode criar novos pedidos. Contacte a equipa Linke.</p>}
    <ClientPickupLocationAgenda clientId={client.id} locations={sortedLocations} defaultLocationId={defaultLocationId}
      initialError={agendaError} disabled={Boolean(suspended)} onDefaultChanged={setPreferredLocationId}
      onSaved={location => setLocations(previous => [...previous.filter(row => row.id !== location.id), location])}
      onRemoved={id => {
        setLocations(previous => previous.filter(location => location.id !== id))
        setPreferredLocationId(previous => previous === id ? null : previous)
        setLocationOverride(previous => previous === id ? null : previous)
      }} />
    {sent ? <section role="status" className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="flex items-center gap-2 font-semibold text-emerald-900"><CheckCircle2 size={18} />Pedido enviado à equipa Linke · {sent}</h2><p className="text-sm text-emerald-900">Estado: Pendente. A equipa irá tratar do agendamento com a transportadora.</p><button type="button" className={secondaryButton} onClick={() => { setLocationOverride(null); setSent("") }}>Novo pedido</button></section> : <form onSubmit={submit} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 sm:p-5">
      <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Solicitar recolha</h2>
      <fieldset disabled={busy || suspended} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3"><label className="block space-y-1 text-xs font-medium text-[var(--text-secondary)]">Data pretendida<input type="date" name="date" min={today} defaultValue={today} required className={inputClass} /></label>
          <label className="block space-y-1 text-xs font-medium text-[var(--text-secondary)]">Período pretendido<select name="period" value={period} onChange={event => setPeriod(event.target.value)} className={inputClass}>{(carrier === "ctt_expresso" ? CTT_PICKUP_PERIODS : CORREOS_PICKUP_PERIODS).map(option => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="block space-y-1 text-xs font-medium text-[var(--text-secondary)]">Transportadora<select name="carrier" value={carrier} onChange={event => { setCarrier(event.target.value); setPeriod(event.target.value === "ctt_expresso" ? "09:00-19:00" : "10:00-13:00") }} className={inputClass}><option value="ctt_expresso">CTT Expresso</option><option value="correos_express">Correos Express</option></select></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3"><label className="block space-y-1 text-xs font-medium text-[var(--text-secondary)]">N.º de volumes<input type="number" name="volumes" min={1} max={1000} step={1} required value={volumes} onChange={event => setVolumes(Number(event.target.value))} className={inputClass} /></label>
          <label className="block space-y-1 text-xs font-medium text-[var(--text-secondary)]">Peso total (kg)<input type="number" name="weightKg" min={0.001} max={20000} step={0.001} required className={inputClass} /></label>
          {volumes > 1 && <label className="block space-y-1 text-xs font-medium text-[var(--text-secondary)]">Volume mais pesado (kg)<input type="number" name="heaviestWeightKg" min={0.001} max={20000} step={0.001} required className={inputClass} /></label>}
        </div>
        <label className="block space-y-1 text-xs font-medium text-[var(--text-secondary)]">
          Local de recolha
          <select name="pickupLocation" value={selectedLocationId} onChange={event => {
            const id = event.target.value
            setLocationOverride(id === (defaultLocationId ?? "primary") ? null : id)
          }} className={inputClass}>
            <option value="primary">Morada principal de recolha{!defaultLocationId && " (padrão)"}</option>
            {sortedLocations.map(location => <option key={location.id} value={location.id}>{location.label} · {location.postal} {location.city}{location.id === defaultLocationId && " (padrão)"}</option>)}
            <option value="manual">Outra morada para este pedido</option>
          </select>
        </label>
        <PickupAddressFields key={JSON.stringify([selectedLocationId, pickupAddress])} values={pickupAddress} />
        <label className="block space-y-1 text-xs font-medium text-[var(--text-secondary)]">Observações (opcional)<textarea name="notes" rows={2} maxLength={500} className={inputClass} placeholder="Acesso ao armazém, campainha, instruções úteis…" /></label>
        <p className="text-xs text-[var(--text-secondary)]">A data e o período são preferências, sujeitos a confirmação pela equipa e pela transportadora.</p>
        <button type="submit" className={primaryButton}>{busy ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}Enviar pedido à Linke</button>
      </fieldset>
    </form>}
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-[var(--text-primary)]">Os meus pedidos ({history.total})</h2><button type="button" disabled={busy} className={secondaryButton} onClick={() => void load()}><RefreshCw size={14} />Atualizar</button></div>
      <p className="mb-4 text-xs text-[var(--text-secondary)]">Pendente: aguarda tratamento pela Linke. Pedido aceite: a Linke já fez o pedido à transportadora; não confirma o levantamento da mercadoria. Cancelado: o pedido não foi feito à transportadora.</p>
      {!history.requests.length ? <p className="py-5 text-sm text-[var(--text-secondary)]">Ainda não existem pedidos de recolha.</p> : <ul className="divide-y divide-[var(--border-subtle)]">{history.requests.map(request => <li key={request.id} className="space-y-2 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="font-mono text-xs text-[var(--text-primary)]">{request.reference}</strong><span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${request.status === "completed" ? "bg-emerald-50 text-emerald-800" : request.status === "cancelled" ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-800"}`}>{request.status === "completed" ? <CheckCircle2 size={13} /> : request.status === "cancelled" ? <XCircle size={13} /> : <Clock size={13} />}{request.status === "completed" ? "Pedido aceite" : request.status === "cancelled" ? "Cancelado" : "Pendente"}</span></div><p className="text-sm text-[var(--text-primary)]">{pickupWhen(request).label} · {request.pickup.volumes} volume(s) · {request.pickup.weightKg} kg</p><p className="text-xs text-[var(--text-secondary)]">{request.pickup.address} · {request.pickup.postal} {request.pickup.city}</p>{request.carrier_reference && <p className="text-xs text-[var(--text-secondary)]">{request.carrier_name} · Referência: {request.carrier_reference}{request.completed_at ? ` · Pedido à transportadora em ${formatPickupTimestamp(request.completed_at)}` : ""}</p>}{request.status === "cancelled" && <p className="text-xs text-[var(--text-secondary)]">Cancelado em {formatPickupTimestamp(request.cancelled_at)}{request.cancel_reason ? ` · Motivo: ${request.cancel_reason}` : ""}</p>}</li>)}</ul>}
      {history.total > (history.page + 1) * PICKUP_REQUEST_PAGE_SIZE && <button type="button" disabled={busy} className={`${secondaryButton} mt-4`} onClick={() => void load(history.page + 1)}>Ver mais pedidos</button>}
    </section>
  </div>
}
