"use client"

import * as React from "react"
import { Search, Loader2, X, Copy, ExternalLink, Calendar, MapPin, Clock, Ban, RefreshCw, FileText } from "lucide-react"
import { searchPickupsAction, searchCttPickupsAction, getPickupDetailsAction, getCttPickupDetailsAction } from "@/app/actions/pickups"
import { CTT_PICKUP_PORTAL_URL, PICKUP_PAGE_SIZE, type PickupSummary } from "@/lib/pickup-management"

const inputClass = "w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-bg)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"

function displayDate(date?: string) {
  if (!date) return "Não registada"
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}

export function PickupSearchPanel({ onOpen, connections }: {
  onOpen: (pickup: PickupSummary) => void
  connections: { id: string; label: string }[]
}) {
  const [source, setSource] = React.useState<"tms" | "ctt">("tms")
  const [from, setFrom] = React.useState(() => `${today().slice(0, 7)}-01`)
  const [to, setTo] = React.useState(today)
  const [reference, setReference] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [connection, setConnection] = React.useState(connections[0]?.id || "")
  const [rows, setRows] = React.useState<PickupSummary[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [searched, setSearched] = React.useState(false)
  const [error, setError] = React.useState("")

  const run = async (nextPage = 0) => {
    setLoading(true); setError(""); setRows([])
    try {
      const input = { dateFrom: from || undefined, dateTo: to || undefined, reference, status: source === "tms" ? status : "", page: nextPage, connectionId: connection.startsWith("default-") ? undefined : connection || undefined }
      const result = source === "tms" ? await searchPickupsAction(input) : await searchCttPickupsAction(input)
      if (!result.success) { setError(result.error); setTotal(0); return }
      setRows(result.pickups.map(row => ({ ...row, connection_id: source === "ctt" ? input.connectionId : row.connection_id })))
      setTotal(result.total); setPage(nextPage)
    } catch {
      setError("Não foi possível concluir a pesquisa. Tente novamente.")
    } finally { setLoading(false); setSearched(true) }
  }
  const changePage = (next: number) => source === "ctt" ? setPage(next) : void run(next)
  const visibleRows = source === "ctt" ? rows.slice(page * PICKUP_PAGE_SIZE, (page + 1) * PICKUP_PAGE_SIZE) : rows

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 sm:p-6">
      <form onSubmit={event => { event.preventDefault(); void run() }} onChange={() => { setSearched(false); setRows([]); setTotal(0); setPage(0); setError("") }} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:p-5">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Pesquisar recolhas</h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">Pesquise pela data prevista de recolha ou pela referência. O histórico do TMS inclui as recolhas guardadas nesta empresa.</p>
        <fieldset disabled={loading} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">Onde pesquisar
            <select value={source} onChange={e => { setSource(e.target.value as "tms" | "ctt"); setRows([]); setSearched(false); setTotal(0); setError(""); setPage(0) }} className={`${inputClass} mt-1`}>
              <option value="tms">Registos do TMS</option><option value="ctt">Consultar diretamente os CTT</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--text-secondary)]">Desde
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-semibold text-[var(--text-secondary)]">Até
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-semibold text-[var(--text-secondary)]">Referência da recolha
            <input value={reference} maxLength={64} onChange={e => setReference(e.target.value)} placeholder={source === "ctt" ? "Referência completa, ex.: 1519176/26" : "Referência completa ou parcial"} className={`${inputClass} mt-1`} />
          </label>
          {source === "tms" ? (
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Estado guardado
              <select value={status} onChange={e => setStatus(e.target.value)} className={`${inputClass} mt-1`}>
                <option value="">Todos</option><option>Agendado</option><option>Realizado</option><option>Cancelado</option><option value="pendente">Pendente</option>
              </select>
            </label>
          ) : (
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Conta CTT
              <select value={connection} onChange={e => setConnection(e.target.value)} className={`${inputClass} mt-1`}>
                {connections.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                {!connections.length && <option value="">Conta CTT configurada</option>}
              </select>
            </label>
          )}
          <button disabled={loading} className="flex items-center justify-center gap-2 self-end rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{loading ? "A pesquisar…" : "Pesquisar"}
          </button>
        </fieldset>
        {source === "ctt" && <p className="mt-3 text-xs text-[var(--text-secondary)]">Os CTT permitem consultas por intervalo até 60 dias. Com uma referência completa, as datas são ignoradas. O acesso depende das permissões da conta CTT.</p>}
      </form>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!loading && !error && searched && (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--text-secondary)]">
            <span>{total} recolha(s) encontrada(s) · {source === "tms" ? "Registos TMS" : "Resposta CTT"}</span>
            <div className="flex gap-2">
              <button type="button" className={buttonClass} disabled={page === 0} onClick={() => changePage(page - 1)}>Anterior</button>
              <button type="button" className={buttonClass} disabled={(page + 1) * PICKUP_PAGE_SIZE >= total} onClick={() => changePage(page + 1)}>Seguinte</button>
            </div>
          </div>
          {!visibleRows.length ? <p className="py-10 text-center text-sm text-[var(--text-secondary)]">Nenhuma recolha encontrada para estes filtros.</p> : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-muted)] text-xs text-[var(--text-secondary)]"><tr><th className="p-3">Referência</th><th className="p-3">Data de recolha</th><th className="p-3">Local / Operadora</th><th className="p-3">Estado</th><th className="p-3"><span className="sr-only">Ação</span></th></tr></thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">{visibleRows.map(row => (
                  <tr key={`${row.source}:${row.id}`} className="hover:bg-[var(--surface-muted)]">
                    <td className="p-3"><button className="font-mono font-semibold text-[var(--accent)] underline-offset-4 hover:underline" onClick={() => onOpen(row)}>{row.ctt_pickup_id || "Sem referência"}</button></td>
                    <td className="whitespace-nowrap p-3 text-[var(--text-primary)]">{displayDate(row.scheduled_date)}</td>
                    <td className="p-3 text-[var(--text-primary)]">{row.sender_name || row.carrier_name}<span className="block text-xs text-[var(--text-secondary)]">{row.sender_city || row.carrier_name}</span></td>
                    <td className="p-3 text-[var(--text-secondary)]">{row.status}</td>
                    <td className="p-3"><button className={buttonClass} onClick={() => onOpen(row)}>Ver detalhes</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PickupDetailsDialog({ selected, onClose }: { selected: PickupSummary; onClose: () => void }) {
  const dialog = React.useRef<HTMLDialogElement>(null)
  const [pickup, setPickup] = React.useState(selected)
  const [tab, setTab] = React.useState<"details" | "manage">("details")
  const [loading, setLoading] = React.useState(true)
  const [remoteLoading, setRemoteLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [remote, setRemote] = React.useState<PickupSummary | null>(null)
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => { dialog.current?.showModal() }, [])
  React.useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const result = selected.source === "ctt"
          ? await getCttPickupDetailsAction(selected.ctt_pickup_id, selected.connection_id)
          : await getPickupDetailsAction(selected.id)
        if (!active) return
        if (result.success) setPickup(result.pickup)
        else setError(result.error)
      } catch { if (active) setError("Não foi possível carregar os detalhes.") }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [selected])
  const copyReference = async () => {
    try { await navigator.clipboard.writeText(pickup.ctt_pickup_id); setCopied(true) }
    catch { setError("Não foi possível copiar. Selecione a referência apresentada no cabeçalho.") }
  }
  const consultCtt = async () => {
    setRemoteLoading(true); setError("")
    try {
      const result = await getCttPickupDetailsAction(pickup.ctt_pickup_id, pickup.connection_id?.startsWith("default-") ? undefined : pickup.connection_id)
      if (result.success) setRemote(result.pickup)
      else setError(result.error)
    } catch { setError("Não foi possível consultar os CTT.") }
    finally { setRemoteLoading(false) }
  }
  const field = (label: string, value?: string | number | null) => <div><dt className="text-xs text-[var(--text-secondary)]">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-[var(--text-primary)]">{value === undefined || value === null || value === "" ? "Não registado" : value}</dd></div>

  return (
    <dialog ref={dialog} aria-labelledby="pickup-detail-title" onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === e.currentTarget) onClose() }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-0 text-[var(--text-primary)] shadow-xl backdrop:bg-black/40">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5">
        <div><p className="text-xs text-[var(--text-secondary)]">{pickup.carrier_name} · {pickup.source === "tms" ? "Registo TMS" : "Consulta CTT"}</p><h2 id="pickup-detail-title" className="mt-1 text-lg font-bold">Recolha <span className="font-mono">{pickup.ctt_pickup_id || "sem referência"}</span></h2></div>
        <button onClick={onClose} aria-label="Fechar detalhes" className={buttonClass}><X className="h-4 w-4" /></button>
      </header>
      <nav aria-label="Detalhes da recolha" className="flex gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
        <button aria-pressed={tab === "details"} onClick={() => setTab("details")} className={`${buttonClass} ${tab === "details" ? "!border-[var(--accent)] !text-[var(--accent)]" : ""}`}><FileText className="h-4 w-4" />Detalhes</button>
        {pickup.carrier_code === "ctt_expresso" && <button aria-pressed={tab === "manage"} onClick={() => setTab("manage")} className={`${buttonClass} ${tab === "manage" ? "!border-[var(--accent)] !text-[var(--accent)]" : ""}`}>Alterar / Anular</button>}
      </nav>
      <div className="space-y-5 p-5">
        {loading && <p role="status" className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" />A carregar detalhes…</p>}
        {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {tab === "details" ? <>
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:grid-cols-3">
            {field(pickup.source === "tms" ? "Estado guardado" : "Estado devolvido pelos CTT", pickup.status)}{field("Data prevista", displayDate(pickup.scheduled_date))}{field("Período", pickup.period)}
            {field("Volumes", pickup.volumes)}{field("Peso total (kg)", pickup.weight_kg)}{field("Mais pesado (kg)", pickup.heaviest_weight_kg)}
          </dl>
          <section><h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4" />Local de recolha</h3>
            <dl className="grid gap-4 sm:grid-cols-2">{field("Nome", pickup.sender_name)}{field("Pessoa de contacto", pickup.sender_contact)}{field("Morada", pickup.sender_address)}{field("Código postal / Localidade", [pickup.sender_zip, pickup.sender_city].filter(Boolean).join(" "))}{field("Telefone", pickup.sender_phone)}{field("Telemóvel", pickup.sender_mobile)}{field("Email", pickup.sender_email)}{field("País", pickup.sender_country)}</dl>
          </section>
          <section className="border-t border-[var(--border-subtle)] pt-4"><h3 className="mb-3 text-sm font-bold">Contacto do solicitante</h3><dl className="grid gap-4 sm:grid-cols-2">{field("Contacto", pickup.requester?.name)}{field("Telefone", pickup.requester?.phone)}{field("Telemóvel", pickup.requester?.mobilePhone)}{field("Email", pickup.requester?.email)}</dl></section>
          <dl className="grid gap-4 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-2">{field("Destino", pickup.destination)}{field("Dimensões (C × L × A, cm)", pickup.dimensions ? `${pickup.dimensions.length} × ${pickup.dimensions.width} × ${pickup.dimensions.height}` : undefined)}{field("Observações", pickup.observations)}</dl>
          {!!pickup.objects?.length && <section><h3 className="text-sm font-bold">Objetos associados</h3><ul className="mt-2 space-y-1 font-mono text-sm">{pickup.objects.map(id => <li key={id}>{id}</li>)}</ul></section>}
          {pickup.source === "tms" && <p className="text-xs text-[var(--text-secondary)]">Os pedidos antigos podem não ter todos os contactos e dimensões registados. O estado guardado não confirma alterações posteriores feitas no portal.</p>}
          {pickup.carrier_code === "ctt_expresso" && <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-4">
            <button onClick={() => void consultCtt()} disabled={loading || remoteLoading || !pickup.ctt_pickup_id} className={buttonClass}><RefreshCw className={`h-4 w-4 ${remoteLoading ? "animate-spin" : ""}`} />{remoteLoading ? "A consultar os CTT…" : "Consultar detalhes atuais nos CTT"}</button>
            {remote && <dl className="grid gap-3 sm:grid-cols-2">{field("Origem", "Resposta CTT")} {field("Data indicada pelos CTT", displayDate(remote.scheduled_date))}{field("Estado devolvido", remote.status)}{field("Data de recolha efetuada", remote.collected_at ? displayDate(remote.collected_at) : undefined)}{field("Local", remote.sender_name)}{field("Morada", remote.sender_address)}</dl>}
          </div>}
        </> : <>
          <p className="text-sm text-[var(--text-secondary)]">As alterações de data, morada, período e a anulação são concluídas no Portal Expresso. Copie a referência e abra a recolha no menu Pesquisa do portal.</p>
          <div className="grid gap-3 sm:grid-cols-2">{[
            { icon: Calendar, title: "Alterar data de recolha" }, { icon: MapPin, title: "Alterar morada de recolha" },
            { icon: Clock, title: "Alterar período de recolha" }, { icon: Ban, title: "Anular recolha" },
          ].map(({ icon: Icon, title }) => <a key={title} href={CTT_PICKUP_PORTAL_URL} target="_blank" rel="noopener noreferrer" className={`${buttonClass} !justify-start p-4`}><Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{title}<span className="block text-xs font-normal text-[var(--text-secondary)]">No Portal Expresso</span></span><ExternalLink className="h-3.5 w-3.5" /></a>)}</div>
          <p className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-secondary)]">Abrir o portal não altera nem anula a recolha. Confirme a operação no portal e consulte depois os detalhes nos CTT. A disponibilidade depende do estado da recolha.</p>
        </>}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] p-4"><button onClick={() => void copyReference()} disabled={!pickup.ctt_pickup_id} className={buttonClass}><Copy className="h-4 w-4" />{copied ? "Referência copiada" : "Copiar referência"}</button><button onClick={onClose} className={buttonClass}>Fechar</button></footer>
    </dialog>
  )
}
