"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { ClipboardList, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { getShipmentQuotationsAction, updateShipmentQuotationAction } from "@/app/actions/shipment-quotations"
import { QUOTATION_STATUSES, type QuotationPage, type ShipmentQuotation } from "@/lib/shipments/quotations/types"
import { CORREOS_PARTNER_PORTAL_URL } from "@/lib/services/correos/shipment-policy"

type Props = { mode: "client" | "ops"; basePath: string; clientId?: string; initial: QuotationPage; initialError?: string; selectedId?: string; canRecordBooking?: boolean }
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold disabled:opacity-50"
const primary = `${button} border-transparent bg-[var(--accent)] text-white`
const input = "mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm"
const money = (amount: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(amount)
const date = (value: string) => new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon" }).format(new Date(value))

export function QuoteRequestsClient({ mode, basePath, clientId, initial, initialError = "", selectedId, canRecordBooking = false }: Props) {
  const [page, setPage] = useState(initial)
  const [selected, setSelected] = useState(selectedId || initial.requests[0]?.id || "")
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState(initialError)
  const [notice, setNotice] = useState("")
  const current = page.requests.find(request => request.id === selected) || page.requests[0]
  const reload = async (more = false) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(""); setNotice("")
    try {
      const next = await getShipmentQuotationsAction(clientId, more ? page.next || undefined : undefined, mode === "client")
      setPage(previous => more ? { ...next, requests: [...previous.requests, ...next.requests.filter(row => !previous.requests.some(old => old.id === row.id))] } : next)
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar as cotações.") }
    finally { setBusy(false); lock.current = false }
  }
  const update = async (request: ShipmentQuotation, action: unknown) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(""); setNotice("")
    try {
      const result = await updateShipmentQuotationAction(request.id, request.revision, action)
      if (!result.success) { setError(result.error); return }
      setPage(previous => ({ ...previous, requests: previous.requests.map(row => row.id === result.request.id ? result.request : row) }))
      setNotice(result.warning || "Cotação atualizada.")
    } catch { setError("Não foi possível confirmar a alteração. Atualize a lista antes de repetir.") }
    finally { setBusy(false); lock.current = false }
  }
  const copy = async (request: ShipmentQuotation) => {
    const s = request.shipment
    try {
      await navigator.clipboard.writeText(`${request.reference}\n${request.service_name}\nCliente: ${request.client_name}\nRemetente: ${s.senderName}\n${s.senderAddress}\n${s.senderPostal} ${s.senderCity}, PT\nTelefone: ${s.senderPhone}\nDestinatário: ${s.recipientName}\n${s.recipientAddress}\n${s.recipientPostal} ${s.recipientCity}, ${s.recipientCountry}\nTelefone: ${s.recipientPhone}\nEmail: ${s.recipientEmail}\n${s.volumesCount} volume(s); ${s.weightKg} kg\nMedidas por volume: ${s.lengthCm} × ${s.widthCm} × ${s.heightCm} cm\nPesos por volume: ${s.parcelWeightsKg.join(", ")}\nObservações: ${s.observations}`)
      setNotice("Dados copiados para preparar a guia no parceiro.")
    } catch { setError("Não foi possível copiar os dados. Pode consultá-los abaixo.") }
  }
  return <div className="space-y-5 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-semibold"><ClipboardList size={22} />Cotações</h1><p className="mt-1 text-sm text-[var(--text-secondary)]">{mode === "ops" ? "Pedidos dos clientes para Correos Internacional Standard (90), a emitir pela conta Linke no parceiro." : "Acompanhe os pedidos e as propostas da equipa Linke."}</p></div>
      <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void reload()} className={button}><RefreshCw size={15} className={busy ? "animate-spin motion-reduce:animate-none" : ""} />Atualizar</button>{mode === "client" && <Link href={`${basePath}/criar-guia`} className={primary}>Novo pedido</Link>}</div></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent)]">{notice}</p>}
    {!page.requests.length ? <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-10 text-center text-sm text-[var(--text-secondary)]">{mode === "ops" ? "Ainda não existem pedidos de cotação. Os clientes pedem cotação no portal ao escolher Correos Internacional Standard para fora de Portugal e Espanha." : "Ainda não existem pedidos de cotação. No formulário de novo envio, escolha o serviço Internacional Standard para um destino fora de Portugal e Espanha."}</div> :
      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]"><aside className="space-y-2" aria-label="Pedidos de cotação">
        {page.requests.map(request => <button key={request.id} type="button" disabled={busy} aria-current={current?.id === request.id ? "true" : undefined} onClick={() => { setSelected(request.id); setError(""); setNotice("") }} className={`w-full rounded-xl border p-3 text-left ${current?.id === request.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-bg)]"}`}>
          <span className="text-xs font-semibold">{request.reference}</span><span className="mt-1 block text-xs text-[var(--text-secondary)]">{mode === "ops" ? `${request.client_name} · ` : ""}{request.shipment.recipientCountry} · {request.shipment.volumesCount} volume(s)</span>
          <span className="mt-2 block text-[11px] font-medium">{QUOTATION_STATUSES[request.status]}</span><time className="mt-1 block text-[10px] text-[var(--text-secondary)]" dateTime={request.created_at}>{date(request.created_at)}</time>
        </button>)}
        {page.next && <button type="button" disabled={busy} className={`${button} w-full`} onClick={() => void reload(true)}>Carregar mais</button>}
      </aside>{current && <QuoteDetail key={`${current.id}:${current.revision}`} request={current} mode={mode} basePath={basePath} canRecordBooking={canRecordBooking} busy={busy} update={action => update(current, action)} copy={() => void copy(current)} />}</div>}
  </div>
}

function QuoteDetail({ request: q, mode, basePath, canRecordBooking, busy, update, copy }: { request: ShipmentQuotation; mode: "client" | "ops"; basePath: string; canRecordBooking: boolean; busy: boolean; update: (action: unknown) => Promise<void>; copy: () => void }) {
  const [amount, setAmount] = useState("")
  const [response, setResponse] = useState("")
  const [tracking, setTracking] = useState("")
  const [buyPrice, setBuyPrice] = useState("")
  const s = q.shipment
  const canReply = ["pending", "reviewing"].includes(q.status)
  return <section className="space-y-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 sm:p-6" aria-label={`Cotação ${q.reference}`}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{q.reference}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{q.client_name} · {q.service_name}</p><p className="mt-1 text-xs">{QUOTATION_STATUSES[q.status]}</p></div><time className="text-xs text-[var(--text-secondary)]" dateTime={q.created_at}>{date(q.created_at)}</time></header>
    <div className="grid gap-5 text-sm sm:grid-cols-2"><div><h3 className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Remetente</h3><p>{s.senderName}</p><p>{s.senderAddress}</p><p>{s.senderPostal} {s.senderCity} · PT</p><p>{s.senderPhone}</p></div><div><h3 className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Destinatário</h3><p>{s.recipientName}</p><p>{s.recipientAddress}</p><p>{s.recipientPostal} {s.recipientCity} · {s.recipientCountry}</p><p>{s.recipientPhone}</p><p>{s.recipientEmail}</p></div></div>
    <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm"><p>{s.volumesCount} volume(s) · {s.weightKg} kg · {s.lengthCm} × {s.widthCm} × {s.heightCm} cm por volume</p>{!!s.parcelWeightsKg.length && <p className="mt-1 text-xs">Pesos por volume: {s.parcelWeightsKg.join(" · ")} kg</p>}{s.observations && <p className="mt-2 whitespace-pre-wrap text-xs">{s.observations}</p>}</div>
    {q.proposed_price !== null && <div className="rounded-lg border border-[var(--border-subtle)] p-4"><p className="text-xs text-[var(--text-secondary)]">Preço acordado do envio (sem IVA)</p><strong className="mt-1 block text-2xl">{money(q.proposed_price)}</strong><p className="mt-1 text-xs text-[var(--text-secondary)]">Acresce o IVA aplicável na faturação.</p><p className="mt-2 whitespace-pre-wrap text-sm">{q.response}</p></div>}
    {q.tracking_number && <p className="text-sm">Guia emitida pela Linke na conta Correos: <strong className="select-text font-mono">{q.tracking_number}</strong></p>}
    {q.shipment_id && <div className="space-y-2"><p className="text-xs text-[var(--text-secondary)]">{q.status === "accepted" ? "O envio está criado em rascunho. A Linke irá emitir a guia pela sua conta Correos." : q.billing_type === "pay_as_you_go" ? "O envio está no histórico e segue as condições de saldo pré-pago da conta." : "O envio está no histórico, com o preço acordado, disponível para faturação."}</p><Link className={button} href={mode === "ops" ? `/ops/envios?search=${encodeURIComponent(q.reference)}` : `${basePath}/envios`}>Ver envio no histórico</Link></div>}
    {mode === "client" && q.status === "quoted" && <div className="space-y-3"><p className="text-xs text-[var(--text-secondary)]">Ao aceitar, cria um envio em rascunho no TMS. A Linke emite a guia pela sua conta Correos e regista-a neste envio. O pedido segue as condições de faturação da sua conta após a emissão.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className={primary} onClick={() => void update({ action: "accept" })}>Aceitar e criar envio · {money(q.proposed_price!)}</button><button type="button" disabled={busy} className={button} onClick={() => void update({ action: "decline" })}>Recusar</button></div></div>}
    {mode === "client" && canReply && <button type="button" disabled={busy} className={button} onClick={() => void update({ action: "cancel" })}>Cancelar pedido</button>}
    {mode === "ops" && <div className="space-y-4 border-t border-[var(--border-subtle)] pt-4">
      <div className="flex flex-wrap gap-2"><a href={CORREOS_PARTNER_PORTAL_URL} target="_blank" rel="noopener noreferrer" className={button}><ExternalLink size={14} />Emitir pela conta Correos da Linke</a><button type="button" className={button} onClick={copy}><Copy size={14} />Copiar dados do pedido</button></div>
      {q.internal_notes && <p className="whitespace-pre-wrap rounded-lg bg-[var(--surface-muted)] p-3 text-xs">Nota interna: {q.internal_notes}</p>}
      {q.status === "pending" && <button type="button" disabled={busy} className={button} onClick={() => void update({ action: "review" })}>Marcar em análise</button>}
      {canReply && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void update({ action: "reply", amount: Number(amount.replace(",", ".")), response }) }}><h3 className="text-sm font-semibold">Responder ao cliente</h3><label className="block text-xs font-medium">Preço proposto do envio (€ sem IVA)<input className={input} type="number" min="0.01" max="1000000" step="0.01" required disabled={busy} value={amount} onChange={e => setAmount(e.target.value)} /></label><label className="block text-xs font-medium">Condições e prazo<textarea className={input} rows={3} required maxLength={2000} disabled={busy} value={response} onChange={e => setResponse(e.target.value)} /></label><button className={primary} disabled={busy}>{busy && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />}Enviar proposta</button></form>}
      {q.status === "accepted" && canRecordBooking && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void update({ action: "complete", trackingNumber: tracking, buyPrice: Number(buyPrice.replace(",", ".")), response }) }}><p className="text-sm">Emita a guia pela conta Correos da Linke. Ao registá-la, o envio fica no cliente ao preço acordado, para faturação segundo as condições da conta.</p><label className="block text-xs font-medium">Número da guia Correos<input className={input} required minLength={3} maxLength={80} disabled={busy} value={tracking} onChange={e => setTracking(e.target.value)} /></label><label className="block text-xs font-medium">Custo cobrado pela Correos (€ sem IVA, apenas interno)<input className={input} type="number" required min="0" max="1000000" step="0.01" disabled={busy} value={buyPrice} onChange={e => setBuyPrice(e.target.value)} /></label><label className="block text-xs font-medium">Informação para o cliente (opcional)<textarea className={input} maxLength={2000} disabled={busy} value={response} onChange={e => setResponse(e.target.value)} /></label><button className={primary} disabled={busy}>Registar guia no envio</button></form>}
      {["pending", "reviewing", "quoted"].includes(q.status) && <button type="button" disabled={busy} className={button} onClick={() => void update({ action: "cancel" })}>Cancelar cotação</button>}
    </div>}
  </section>
}
