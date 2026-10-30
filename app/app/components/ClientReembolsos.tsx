'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Banknote, RefreshCw } from 'lucide-react'
import { useClientScope } from './ClientScope'
import { filterClientCodRows, deliveredClientCodRows, summarizeClientCod, currentCodMonth } from '@/lib/services/reembolsos/client-cod'
import type { ClientCodPageData } from '@/lib/services/reembolsos/client-cod-payout'
import { solicitarReembolsoAction } from '@/app/actions/client-reembolsos'
import { lisbonDate } from '@/lib/billing/recurring-periods'
import { getShipmentStatusConfig } from '@/lib/status-helpers'

const money = (cents: number | null) => cents === null ? '—' : (cents / 100).toLocaleString('pt-PT', { style:'currency',currency:'EUR' })
const day = (date: string | null) => date ? date.slice(0,10).split('-').reverse().join('/') : '—'
export function ClientReembolsos({ overview, error }: { overview: ClientCodPageData | null; error?: string }) {
  const { client, basePath } = useClientScope()
  const router = useRouter()
  // A stale navigation response must never render a different account's financial data.
  const data = overview?.clientId === client.id ? overview : null
  const [tab,setTab] = useState<'collections'|'receivable'>('collections')
  const [period,setPeriod] = useState(() => currentCodMonth(lisbonDate()))
  const [search,setSearch] = useState('')
  const [page,setPage] = useState(1)
  const [requesting,setRequesting] = useState(false)
  const [feedback,setFeedback] = useState('')
  const [requestError,setRequestError] = useState(false)
  const inFlight = useRef(false)
  const filtered = useMemo(() => filterClientCodRows(deliveredClientCodRows(data?.rows || []),{state:'all',search,from:period.from,to:period.to}), [data,search,period])
  const summary = useMemo(() => summarizeClientCod(filtered),[filtered])
  const pages = Math.max(1,Math.ceil(filtered.length/20)), current = Math.min(page,pages)
  const visible = filtered.slice((current-1)*20,current*20)
  async function requestPayout() {
    if(inFlight.current || !data || data.payout.pending || data.payout.availableCents<=0) return
    inFlight.current=true;setRequesting(true);setFeedback('');setRequestError(false)
    try {
      const result=await solicitarReembolsoAction(client.id)
      setFeedback(result.alreadyRequested ? 'Já existe um pedido em acompanhamento pela Linke.' : 'Pedido enviado à Linke. Pode acompanhar o estado nesta secção.')
      router.refresh()
    } catch(reason) {setRequestError(true);setFeedback(reason instanceof Error ? reason.message : 'Não foi possível confirmar o pedido. Atualize antes de repetir.')}
    finally {inFlight.current=false;setRequesting(false)}
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5"><Banknote aria-hidden="true" className="h-5 w-5 text-[var(--accent)]" /><div><h1 className="text-xl font-bold text-[var(--text-primary)]">Reembolsos</h1><p className="mt-1 text-xs text-[var(--text-secondary)]">Cobranças e valores a receber da Linke.</p></div></div>
      <button type="button" onClick={()=>router.refresh()} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold"><RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />Atualizar</button>
    </div>
    {error || !data ? <p role="alert" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 text-sm text-[var(--text-secondary)]">{error || 'Não foi possível confirmar os dados desta conta. Atualize a página.'}</p> : <>
      <div role="tablist" aria-label="Reembolsos" className="flex gap-2 border-b border-[var(--border-subtle)]">
        <button id="cod-collections-tab" role="tab" aria-selected={tab==='collections'} aria-controls="cod-collections" onClick={()=>setTab('collections')} className={`px-3 py-2 text-xs font-semibold ${tab==='collections'?'border-b-2 border-[var(--accent)] text-[var(--accent)]':'text-[var(--text-secondary)]'}`}>Pagamentos à cobrança</button>
        <button id="cod-receivable-tab" role="tab" aria-selected={tab==='receivable'} aria-controls="cod-receivable" onClick={()=>setTab('receivable')} className={`px-3 py-2 text-xs font-semibold ${tab==='receivable'?'border-b-2 border-[var(--accent)] text-[var(--accent)]':'text-[var(--text-secondary)]'}`}>A receber</button>
      </div>
      {tab==='collections' ? <section role="tabpanel" id="cod-collections" aria-labelledby="cod-collections-tab" className="space-y-3">
        <div className="flex flex-wrap items-end gap-2 text-xs">
          <label>Desde<input type="date" value={period.from} max={period.to || undefined} onChange={e=>{setPeriod({...period,from:e.target.value});setPage(1)}} className="mt-1 block rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5" /></label>
          <label>Até<input type="date" value={period.to} min={period.from || undefined} onChange={e=>{setPeriod({...period,to:e.target.value});setPage(1)}} className="mt-1 block rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5" /></label>
          <button type="button" onClick={()=>{setPeriod(currentCodMonth(lisbonDate()));setPage(1)}} className="px-2 py-1.5 font-semibold text-[var(--accent)]">Mês atual</button>
          <input aria-label="Pesquisar guia de cobrança" placeholder="Pesquisar guia…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} className="rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5" />
        </div>
        <div className="grid grid-cols-2 divide-x divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
          <div className="p-3"><p className="text-[11px] text-[var(--text-secondary)]">Cobranças de envios entregues</p><p className="mt-1 text-xl font-semibold tabular-nums">{summary.count}</p></div>
          <div className="p-3"><p className="text-[11px] text-[var(--text-secondary)]">Valor à cobrança dos entregues</p><p className="mt-1 text-xl font-semibold tabular-nums">{money(summary.requestedCents)}</p></div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]"><table className="w-full text-left text-xs"><thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]"><tr><th className="p-3">Guia</th><th className="p-3">Data do envio</th><th className="p-3 text-right">Valor à cobrança</th><th className="p-3">Estado do envio</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">
          {visible.map(row=><tr key={row.id}><td className="p-3"><Link href={`${basePath}/tracking?search=${encodeURIComponent(row.tracking)}`} className="font-mono font-semibold text-[var(--accent)]">{row.tracking}</Link></td><td className="p-3">{day(row.date)}</td><td className="p-3 text-right tabular-nums">{money(row.requestedCents)}</td><td className="p-3">{getShipmentStatusConfig(row.shipmentStatus).label}</td></tr>)}
          {!visible.length&&<tr><td colSpan={4} className="p-8 text-center text-[var(--text-secondary)]">Sem envios à cobrança entregues neste período.</td></tr>}
        </tbody></table><div className="flex justify-between border-t border-[var(--border-subtle)] p-3 text-[11px] text-[var(--text-secondary)]"><span>{filtered.length} envios · Página {current} de {pages}</span><div className="flex gap-3"><button disabled={current===1} onClick={()=>setPage(current-1)} className="disabled:opacity-40">Anterior</button><button disabled={current===pages} onClick={()=>setPage(current+1)} className="disabled:opacity-40">Próxima</button></div></div></div>
        <p className="text-[11px] text-[var(--text-secondary)]">Os envios aparecem aqui apenas após ficarem entregues. As datas filtram a data de criação do envio. O valor só fica disponível em «A receber» após o cruzamento do extrato CTT.</p>
        {summary.missingRequested>0&&<p className="text-[11px] text-[#936A32]">{summary.missingRequested} envio(s) sem valor solicitado registado.</p>}
      </section> : <section role="tabpanel" id="cod-receivable" aria-labelledby="cod-receivable-tab" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4">
          <div><p className="text-xs text-[var(--text-secondary)]">Disponível para solicitar à Linke</p><p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--accent)]">{money(data.payout.availableCents)}</p><p className="mt-1 text-[11px] text-[var(--text-secondary)]">Saldo acumulado de todos os períodos · Apenas CTT conciliado, não pago e ainda não solicitado.</p></div>
          <button type="button" onClick={requestPayout} disabled={requesting||data.payout.pending||data.payout.availableCents<=0} className="rounded-md bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-white disabled:opacity-40">{requesting?'A solicitar…':data.payout.pending?'Pedido em acompanhamento':'Solicitar'}</button>
        </div>
        {data.rows.some(row=>row.state==='review')&&<div className="rounded-lg border border-[#d9c59f] bg-[#faf6ed] p-3 text-xs text-[#785a2d]"><p className="font-semibold">Cobranças em revisão — sem saldo disponível</p><ul className="mt-2 space-y-1">{data.rows.filter(row=>row.state==='review').map(row=><li key={row.id}><span className="font-mono">{row.tracking}</span> · {money(row.requestedCents)}{row.disputeReason?` · ${row.disputeReason}`:' · A Linke está a verificar o cruzamento.'}</li>)}</ul></div>}
        {data.payout.pending&&<p className="text-xs text-[var(--text-secondary)]">{money(data.payout.pendingCents)} em pedidos por concluir. Aguarde a conclusão antes de fazer outro pedido.</p>}
        {feedback&&<p role={requestError?'alert':'status'} className={`text-xs ${requestError?'text-[#936A32]':'text-[var(--accent)]'}`}>{feedback}</p>}
        <p className="text-[11px] text-[var(--text-secondary)]">Os valores ficam disponíveis após a importação e conciliação do extrato CTT. «Solicitar» envia um pedido à Linke; não executa uma transferência bancária.</p>
        <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]"><table className="w-full text-left text-xs"><thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]"><tr><th className="p-3">Pedido</th><th className="p-3">Data</th><th className="p-3 text-right">Valor</th><th className="p-3">Estado</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{data.payout.history.map(request=><tr key={request.id}><td className="p-3 font-mono">{request.id.slice(0,8).toUpperCase()}</td><td className="p-3">{day(lisbonDate(request.createdAt))}</td><td className="p-3 text-right tabular-nums">{money(request.amountCents)}</td><td className="p-3">{request.state==='paid'?'Pago':request.state==='review'?'Em revisão pela Linke':'Solicitado à Linke'}</td></tr>)}{!data.payout.history.length&&<tr><td colSpan={4} className="p-6 text-center text-[var(--text-secondary)]">Ainda não tem pedidos de reembolso.</td></tr>}</tbody></table></div>
      </section>}
    </>}
  </div>
}
