'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getOpsClientCodCollectionsAction } from '@/app/actions/ops-client-cod'
import type { OpsCodClient } from '@/lib/services/reembolsos/ops-cod-data'
import { currentCodMonth, summarizeClientCod } from '@/lib/services/reembolsos/client-cod'
import { lisbonDate } from '@/lib/billing/recurring-periods'
import { getShipmentStatusConfig } from '@/lib/status-helpers'

type Result=Awaited<ReturnType<typeof getOpsClientCodCollectionsAction>>
export function OpsCodCollectionsPanel({clients,initialPeriod,clientError}:{clients:OpsCodClient[];initialPeriod:{from:string;to:string};clientError?:string}) {
  const [clientId,setClientId]=useState('')
  const [period,setPeriod]=useState(initialPeriod)
  const [result,setResult]=useState<Result|null>(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [state,setState]=useState('valid')
  const [page,setPage]=useState(1)
  const sequence=useRef(0)
  useEffect(()=>()=>{sequence.current++},[])
  const selected=clients.find(c=>c.id===clientId)
  const valid=result?.clientId===clientId&&result.from===period.from&&result.to===period.to?result:null
  const rows=useMemo(()=>valid?.rows.filter(row=>state==='all'||(state==='valid'?row.state!=='excluded':row.state==='excluded'))||[],[valid,state])
  const summary=useMemo(()=>summarizeClientCod(rows),[rows])
  const pages=Math.max(1,Math.ceil(rows.length/20)),current=Math.min(page,pages)
  const visible=rows.slice((current-1)*20,current*20)
  const day=(value:string|null)=>value?value.split('-').reverse().join('/'):'—'
  const money=(value:number|null)=>value===null?'—':(value/100).toLocaleString('pt-PT',{style:'currency',currency:'EUR'})
  function invalidate(){sequence.current++;setResult(null);setError('');setLoading(false);setPage(1)}
  async function consult(){
    if(!clientId||!period.from||!period.to||period.from>period.to)return
    const token=++sequence.current
    setLoading(true);setError('');setResult(null);setPage(1)
    try{
      const fresh=await getOpsClientCodCollectionsAction(clientId,period.from,period.to)
      if(sequence.current!==token)return
      if(fresh.clientId!==clientId||fresh.from!==period.from||fresh.to!==period.to)throw new Error('A resposta não corresponde ao cliente e período selecionados.')
      setResult(fresh)
    }catch(reason){if(sequence.current===token)setError(reason instanceof Error?reason.message:'Não foi possível consultar as cobranças.')}
    finally{if(sequence.current===token)setLoading(false)}
  }
  return <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 space-y-3" aria-label="Consulta de cobranças por cliente">
    <div><h2 className="text-sm font-semibold">Pagamentos à cobrança por cliente</h2><p className="mt-1 text-[11px] text-[var(--text-secondary)]">Consulte os envios COD criados no período. O mês atual está selecionado por defeito.</p></div>
    {clientError?<p role="alert" className="text-xs text-[#936A32]">{clientError}</p>:<form onSubmit={event=>{event.preventDefault();void consult()}} className="flex flex-wrap items-end gap-2 text-xs">
      <label>Cliente<select aria-label="Cliente das cobranças" required value={clientId} onChange={e=>{invalidate();setClientId(e.target.value)}} className="mt-1 block max-w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5"><option value="">Selecione o cliente</option>{clients.map(client=><option key={client.id} value={client.id}>{client.name} · {client.code||client.id.slice(0,8)}</option>)}</select></label>
      <label>Desde<input type="date" required value={period.from} max={period.to||undefined} onChange={e=>{invalidate();setPeriod({...period,from:e.target.value})}} className="mt-1 block rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5" /></label>
      <label>Até<input type="date" required value={period.to} min={period.from||undefined} onChange={e=>{invalidate();setPeriod({...period,to:e.target.value})}} className="mt-1 block rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5" /></label>
      <button type="button" onClick={()=>{invalidate();setPeriod(currentCodMonth(lisbonDate()))}} className="px-2 py-1.5 font-semibold text-[var(--accent)]">Mês atual</button>
      <button type="submit" disabled={loading||!clientId||period.from>period.to} className="rounded-md bg-[var(--accent)] px-3 py-1.5 font-semibold text-white disabled:opacity-40">{loading?'A consultar…':'Consultar'}</button>
    </form>}
    {error&&<p role="alert" className="text-xs text-[#936A32]">{error}</p>}
    {valid&&selected?<>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3"><p className="text-xs font-semibold">{selected.name} · {selected.code||selected.id.slice(0,8)} · {day(valid.from)} a {day(valid.to)}</p><select aria-label="Estado dos envios à cobrança" value={state} onChange={e=>{setState(e.target.value);setPage(1)}} className="rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1 text-xs"><option value="valid">Envios válidos</option><option value="excluded">Cancelados / rascunhos</option><option value="all">Todos os envios COD</option></select></div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs"><p>Cobranças: <strong className="tabular-nums">{summary.count}</strong></p><p>Valor solicitado: <strong className="tabular-nums">{money(summary.requestedCents)}</strong></p></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]"><tr><th className="p-2">Guia</th><th className="p-2">Data do envio</th><th className="p-2 text-right">Valor à cobrança</th><th className="p-2">Estado do envio</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{visible.map(row=><tr key={row.id}><td className="p-2 font-mono font-semibold">{row.tracking}</td><td className="p-2">{day(row.date)}</td><td className="p-2 text-right tabular-nums">{money(row.requestedCents)}</td><td className="p-2">{getShipmentStatusConfig(row.shipmentStatus).label}</td></tr>)}{!visible.length&&<tr><td colSpan={4} className="p-4 text-center text-[var(--text-secondary)]">Sem cobranças para este cliente e período.</td></tr>}</tbody></table></div>
      <div className="flex justify-between gap-2 text-[11px] text-[var(--text-secondary)]"><span>{rows.length} registos · Página {current} de {pages}</span><div className="flex gap-3"><button type="button" disabled={current===1} onClick={()=>setPage(current-1)} className="disabled:opacity-40">Anterior</button><button type="button" disabled={current===pages} onClick={()=>setPage(current+1)} className="disabled:opacity-40">Próxima</button></div></div>
      <p className="text-[11px] text-[var(--text-secondary)]">Estes valores são cobranças solicitadas nos envios, não dinheiro recebido da transportadora. Cancelados e rascunhos não somam.</p>
      {summary.missingRequested>0&&<p className="text-[11px] text-[#936A32]">{summary.missingRequested} envio(s) sem valor solicitado registado.</p>}
    </>:!loading&&!error&&!clientError&&<p className="text-xs text-[var(--text-secondary)]">Selecione um cliente e consulte o intervalo pretendido.</p>}
  </section>
}
