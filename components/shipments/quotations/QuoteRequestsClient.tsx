"use client"

import { startTransition, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ClipboardList, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { getShipmentQuotationsAction, updateShipmentQuotationAction, markShipmentQuotationReadAction } from "@/app/actions/shipment-quotations"
import { QUOTATION_STATUSES, QUOTATION_UNREAD_EVENT, type QuotationPage, type ShipmentQuotation } from "@/lib/shipments/quotations/types"
import { partnerTrackingUrl } from "@/lib/shipments/quotations/tracking"
import { CORREOS_PARTNER_PORTAL_URL } from "@/lib/services/correos/shipment-policy"

type Props = { mode: "client" | "ops"; basePath: string; clientId?: string; initial: QuotationPage; initialError?: string; selectedId?: string; canRecordBooking?: boolean; onNewRequest?: () => void }
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold disabled:opacity-50"
const primary = `${button} border-transparent bg-[var(--accent)] text-white`
const input = "mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm"
const money = (amount: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(amount)
const date = (value: string) => new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon" }).format(new Date(value))

export function QuoteRequestsClient({ mode, basePath, clientId, initial, initialError = "", selectedId, canRecordBooking = false, onNewRequest }: Props) {
  const [page, setPage] = useState(initial)
  const [selected, setSelected] = useState(selectedId || initial.requests[0]?.id || "")
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState(initialError)
  const [notice, setNotice] = useState("")
  const [readError, setReadError] = useState("")
  const [readAttempt, setReadAttempt] = useState(0)
  const current = page.requests.find(request => request.id === selected) || page.requests[0]
  const currentId = current?.id, currentUnread = current?.is_unread
  useEffect(() => {
    if (mode !== "ops" || !currentId || currentUnread === false) return
    let active = true, reading = false
    const markVisible = () => {
      if (!active || reading || document.visibilityState === "hidden") return
      reading = true
      startTransition(async () => {
        try {
          const result = await markShipmentQuotationReadAction(currentId)
          if (!active) return
          setPage(previous => ({ ...previous, requests: previous.requests.map(row => row.id === currentId ? { ...row, is_unread: false } : row) }))
          setReadError("")
          window.dispatchEvent(new CustomEvent(QUOTATION_UNREAD_EVENT, { detail: { count: result.count } }))
        } catch { if (active) setReadError("Não foi possível guardar a leitura deste pedido. Atualize para tentar novamente.") }
        finally { reading = false }
      })
    }
    markVisible()
    document.addEventListener("visibilitychange", markVisible)
    return () => { active = false; document.removeEventListener("visibilitychange", markVisible) }
  }, [mode, currentId, currentUnread, readAttempt])
  const reload = async (more = false) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(""); setNotice("")
    try {
      const next = await getShipmentQuotationsAction(clientId, more ? page.next || undefined : undefined, mode === "client")
      setPage(previous => more ? { ...next, requests: [...previous.requests, ...next.requests.filter(row => !previous.requests.some(old => old.id === row.id))] } : next)
      setReadAttempt(attempt => attempt + 1)
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar as cotações.") }
    finally { setBusy(false); lock.current = false }
  }
  const update = async (request: ShipmentQuotation, action: unknown) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(""); setNotice("")
    try {
      const result = await updateShipmentQuotationAction(request.id, request.revision, action)
      if (!result.success) { setError(result.error); return }
      setPage(previous => ({ ...previous, requests: previous.requests.map(row => row.id === result.request.id ? { ...result.request, is_unread: row.is_unread } : row) }))
      setNotice(result.warning || "Cotação atualizada.")
    } catch { setError("Não foi possível confirmar a alteração. Atualize a lista antes de repetir.") }
    finally { setBusy(false); lock.current = false }
  }
  const copy = async (request: ShipmentQuotation) => {
    const s = request.shipment
    try {
      await navigator.clipboard.writeText(`${request.reference}\n${request.service_name}${request.requested_transport === "air" ? " · Pedido de envio aéreo" : ""}\nCliente: ${request.client_name}\nRemetente: ${s.senderName}\n${s.senderAddress}\n${s.senderPostal} ${s.senderCity}, PT\nTelefone: ${s.senderPhone}\nDestinatário: ${s.recipientName}\n${s.recipientAddress}\n${s.recipientPostal} ${s.recipientCity}, ${s.recipientCountry}\nTelefone: ${s.recipientPhone}\nEmail: ${s.recipientEmail}\n${s.volumesCount} volume(s); ${s.weightKg} kg\nMedidas por volume: ${s.lengthCm} × ${s.widthCm} × ${s.heightCm} cm\nPesos por volume: ${s.parcelWeightsKg.join(", ")}\nObservações: ${s.observations}`)
      setNotice("Dados copiados para preparar a guia no parceiro.")
    } catch { setError("Não foi possível copiar os dados. Pode consultá-los abaixo.") }
  }
  const Heading = mode === "client" ? "h2" : "h1"
  return <div className="space-y-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><Heading className="flex items-center gap-2 text-lg font-semibold"><ClipboardList size={20} />{mode === "client" ? "Pedidos e propostas" : "Cotações"}</Heading><p className="mt-1 text-sm text-[var(--text-secondary)]">{mode === "ops" ? "Pedidos dos clientes para Correos Internacional Standard (90), a emitir pela conta Linke no parceiro." : "Acompanhe os pedidos e as propostas da equipa Linke."}</p></div>
      <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void reload()} className={button}><RefreshCw size={15} className={busy ? "animate-spin motion-reduce:animate-none" : ""} />Atualizar</button>{mode === "client" && (onNewRequest ? <button type="button" disabled={busy} onClick={onNewRequest} className={primary}>Novo pedido</button> : <Link href={`${basePath}/cotacoes#novo-pedido`} className={primary}>Novo pedido</Link>)}</div></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {readError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{readError}</p>}
    {notice && <p role="status" className="rounded-lg bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent)]">{notice}</p>}
    {!page.requests.length ? <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-10 text-center text-sm text-[var(--text-secondary)]">{mode === "ops" ? "Ainda não existem pedidos de cotação. Os clientes enviam o pedido na página Pedido de envio internacional aéreo, no portal." : "Ainda não existem pedidos de cotação. Preencha o formulário acima para pedir uma proposta de envio internacional aéreo à equipa Linke."}</div> :
      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]"><aside className="space-y-2" aria-label="Pedidos de cotação">
        {page.requests.map(request => <button key={request.id} type="button" disabled={busy} aria-current={current?.id === request.id ? "true" : undefined} onClick={() => { setSelected(request.id); setError(""); setNotice(""); setReadError("") }} className={`w-full rounded-xl border p-3 text-left ${current?.id === request.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-bg)]"}`}>
          {mode === "ops" && request.is_unread && <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold text-red-600"><span className="size-1.5 rounded-full bg-red-600" />Por ler</span>}
          <span className="text-xs font-semibold">{request.reference}{request.requested_transport === "air" && <span className="ml-2 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--accent)]">Aéreo</span>}</span><span className="mt-1 block text-xs text-[var(--text-secondary)]">{mode === "ops" ? `${request.client_name} · ` : ""}{request.shipment.recipientCountry} · {request.shipment.volumesCount} volume(s)</span>
          <span className="mt-2 block text-[11px] font-medium">{QUOTATION_STATUSES[request.status]}</span><time className="mt-1 block text-[10px] text-[var(--text-secondary)]" dateTime={request.created_at}>{date(request.created_at)}</time>
        </button>)}
        {page.next && <button type="button" disabled={busy} className={`${button} w-full`} onClick={() => void reload(true)}>Carregar mais</button>}
      </aside>{current && <QuoteDetail key={`${current.id}:${current.revision}`} request={current} mode={mode} basePath={basePath} canRecordBooking={canRecordBooking} busy={busy} update={action => update(current, action)} copy={() => void copy(current)} />}</div>}
  </div>
}

function QuoteDetail({ request: q, mode, basePath, canRecordBooking, busy, update, copy }: { request: ShipmentQuotation; mode: "client" | "ops"; basePath: string; canRecordBooking: boolean; busy: boolean; update: (action: unknown) => Promise<void>; copy: () => void }) {
  const [amount, setAmount] = useState(q.proposed_price != null ? String(q.proposed_price) : q.estimated_price != null ? String(q.estimated_price) : "")
  const [hasIva, setHasIva] = useState(Boolean(q.has_iva))
  const [response, setResponse] = useState("")
  const [tracking, setTracking] = useState("")
  const [trackingCarrier, setTrackingCarrier] = useState<"fedex" | "correos">("fedex")
  const trackingUrl = partnerTrackingUrl(q)
  const [buyPrice, setBuyPrice] = useState("")
  const s = q.shipment
  const canReply = ["pending", "reviewing"].includes(q.status)
  return <section className="space-y-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 sm:p-6" aria-label={`Cotação ${q.reference}`}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{q.reference}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{q.client_name} · {q.service_name}</p><p className="mt-1 text-xs">{QUOTATION_STATUSES[q.status]}</p></div><time className="text-xs text-[var(--text-secondary)]" dateTime={q.created_at}>{date(q.created_at)}</time></header>
    <div className="grid gap-5 text-sm sm:grid-cols-2"><div><h3 className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Remetente</h3><p>{s.senderName}</p><p>{s.senderAddress}</p><p>{s.senderPostal} {s.senderCity} · PT</p><p>{s.senderPhone}</p></div><div><h3 className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Destinatário</h3><p>{s.recipientName}</p><p>{s.recipientAddress}</p><p>{s.recipientPostal} {s.recipientCity} · {s.recipientCountry}</p><p>{s.recipientPhone}</p><p>{s.recipientEmail}</p></div></div>
    <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm"><p>{s.volumesCount} volume(s) · {s.weightKg} kg · {s.lengthCm} × {s.widthCm} × {s.heightCm} cm por volume</p>{!!s.parcelWeightsKg.length && <p className="mt-1 text-xs">Pesos por volume: {s.parcelWeightsKg.join(" · ")} kg</p>}{s.observations && <p className="mt-2 whitespace-pre-wrap text-xs">{s.observations}</p>}</div>
    {mode === "ops" && q.requested_by_role && <p className="text-xs text-[var(--text-secondary)]">Pedido criado por {q.requested_by_email || "funcionário Linke"}, em nome do cliente.</p>}
    {q.requested_transport === "air" && <p className="text-xs font-semibold text-[var(--accent)]">Transporte solicitado: aéreo · sujeito a confirmação pela equipa Linke</p>}
    {q.estimated_price != null && <p className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-secondary)]">Estimativa da tabela no pedido: <strong>{money(q.estimated_price)} sem IVA</strong>. Valor indicativo; o preço acordado é o da proposta aceite.</p>}
    {q.proposed_price !== null && <div className="rounded-lg border border-[var(--border-subtle)] p-4">
      <p className="text-xs text-[var(--text-secondary)]">Preço acordado do envio</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <strong className="text-2xl">{money(q.proposed_price)}</strong>
        {q.has_iva ? <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">+ 23% IVA ({money(Math.round(q.proposed_price * 123) / 100)} c/ IVA)</span>
          : <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">Isento de IVA (0%)</span>}
      </div>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{q.has_iva ? "Acresce 23% de IVA na faturação." : "Isento de IVA (transporte internacional / exportação)."}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm">{q.response}</p>
    </div>}
    {q.tracking_number && <p className="text-sm">Tracking {q.tracking_carrier === "fedex" ? "FedEx" : "Correos"}: <strong className="select-text font-mono">{q.tracking_number}</strong>{trackingUrl && <> · <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--accent)] underline">Acompanhar na FedEx</a></>}</p>}
    {q.completion_notes && <p className="whitespace-pre-wrap rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-secondary)]">Nota de emissão: {q.completion_notes}</p>}
    {trackingUrl && <p className="text-xs text-[var(--text-secondary)]">O estado e os movimentos da entrega podem ser consultados diretamente no site da FedEx.</p>}
    {q.shipment_id && <div className="space-y-2"><p className="text-xs text-[var(--text-secondary)]">{q.status === "accepted" ? "O envio está criado em rascunho. A Linke irá emitir a guia pela sua conta Correos." : q.billing_type === "pay_as_you_go" ? "O envio está no histórico e segue as condições de saldo pré-pago da conta." : "O envio está no histórico, com o preço acordado, disponível para faturação."}</p><Link className={button} href={mode === "ops" ? `/ops/envios?search=${encodeURIComponent(q.reference)}` : `${basePath}/envios`}>Ver envio no histórico</Link></div>}
    {mode === "client" && q.status === "quoted" && <div className="space-y-3">
      <p className="text-xs text-[var(--text-secondary)]">Ao aceitar, cria um envio em rascunho no TMS. A Linke emite a guia pela sua conta Correos e regista-a neste envio. O pedido segue as condições de faturação da sua conta após a emissão.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={primary} onClick={() => void update({ action: "accept" })}>
          Aceitar e criar envio · {money(q.proposed_price!)} {q.has_iva ? "(+ 23% IVA)" : "(Isento de IVA)"}
        </button>
        <button type="button" disabled={busy} className={button} onClick={() => void update({ action: "decline" })}>Recusar</button>
      </div>
    </div>}
    {mode === "client" && canReply && <button type="button" disabled={busy} className={button} onClick={() => void update({ action: "cancel" })}>Cancelar pedido</button>}
    {mode === "ops" && <div className="space-y-4 border-t border-[var(--border-subtle)] pt-4">
      <div className="flex flex-wrap gap-2"><a href={CORREOS_PARTNER_PORTAL_URL} target="_blank" rel="noopener noreferrer" className={button}><ExternalLink size={14} />Emitir pela conta Correos da Linke</a><button type="button" className={button} onClick={copy}><Copy size={14} />Copiar dados do pedido</button></div>
      {q.internal_notes && <p className="whitespace-pre-wrap rounded-lg bg-[var(--surface-muted)] p-3 text-xs">Nota interna: {q.internal_notes}</p>}
      {q.status === "pending" && <button type="button" disabled={busy} className={button} onClick={() => void update({ action: "review" })}>Marcar em análise</button>}
      {canReply && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void update({ action: "reply", amount: Number(amount.replace(",", ".")), hasIva, response }) }}>
        <h3 className="text-sm font-semibold">Responder ao cliente</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block text-xs font-medium">Preço proposto do envio (€ {hasIva ? "base s/ IVA" : "sem IVA / isento"})
            <input className={input} type="number" min="0.01" max="1000000" step="0.01" required disabled={busy} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Aplicação de IVA</span>
            <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-0.5">
              <button type="button" disabled={busy} onClick={() => setHasIva(false)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${!hasIva ? "bg-[var(--surface-bg)] text-[var(--text-primary)] shadow-sm font-semibold" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>Isento de IVA (0%)</button>
              <button type="button" disabled={busy} onClick={() => setHasIva(true)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${hasIva ? "bg-[var(--accent)] text-white shadow-sm font-semibold" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>+ Adicionar IVA (23%)</button>
            </div>
          </div>
        </div>
        {Number(amount.replace(",", ".")) > 0 && <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
          <span>Base: <strong>{money(Number(amount.replace(",", ".")))}</strong></span>
          {hasIva ? <>
            <span className="text-[var(--text-secondary)]">+ IVA (23%): {money(Number(amount.replace(",", ".")) * 0.23)}</span>
            <span className="font-semibold text-[var(--accent)]">Total com IVA: {money(Number(amount.replace(",", ".")) * 1.23)}</span>
          </> : <span className="font-semibold text-emerald-600 dark:text-emerald-400">Total final: {money(Number(amount.replace(",", ".")))} (Isento de IVA)</span>}
        </div>}
        <label className="block text-xs font-medium">Condições e prazo<textarea className={input} rows={3} required maxLength={2000} disabled={busy} value={response} onChange={e => setResponse(e.target.value)} /></label>
        <button className={primary} disabled={busy}>{busy && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />}Enviar proposta</button>
      </form>}
      {q.status === "accepted" && canRecordBooking && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void update({ action: "complete", trackingNumber: tracking, trackingCarrier, buyPrice: Number(buyPrice.replace(",", ".")), response }) }}><p className="text-sm">Depois de emitir no portal Correos, registe o tracking do parceiro. O envio fica no histórico ao preço aceite, disponível para faturação. O cliente recebe um aviso na loja e um email com o tracking.</p><label className="block text-xs font-medium">Transportadora do tracking<select className={input} disabled={busy} value={trackingCarrier} onChange={e => setTrackingCarrier(e.target.value as "fedex" | "correos")}><option value="fedex">FedEx (parceiro internacional)</option><option value="correos">Correos Express</option></select></label><label className="block text-xs font-medium">Número de tracking {trackingCarrier === "fedex" ? "FedEx" : "Correos"}<input className={input} required minLength={3} maxLength={80} disabled={busy} value={tracking} onChange={e => setTracking(e.target.value)} /></label><label className="block text-xs font-medium">Custo cobrado pela Correos (€ sem IVA, apenas interno)<input className={input} type="number" required min="0" max="1000000" step="0.01" disabled={busy} value={buyPrice} onChange={e => setBuyPrice(e.target.value)} /></label><label className="block text-xs font-medium">Informação para o cliente (opcional)<textarea className={input} maxLength={2000} disabled={busy} value={response} onChange={e => setResponse(e.target.value)} /></label><button className={primary} disabled={busy}>Registar envio e notificar cliente</button></form>}
      {["pending", "reviewing", "quoted"].includes(q.status) && <button type="button" disabled={busy} className={button} onClick={() => void update({ action: "cancel" })}>Cancelar cotação</button>}
    </div>}
  </section>
}
