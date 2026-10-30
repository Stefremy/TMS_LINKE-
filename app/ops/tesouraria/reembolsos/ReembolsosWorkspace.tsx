'use client'

import { useState } from 'react'
import { ReembolsoStatusBadge } from '@/components/reembolso-status-badge'
import { useRouter } from 'next/navigation'
import { recordOpsCodPaymentAction, setOpsCodDisputeAction, getOpsCodReceiptAction } from '@/app/actions/ops-client-cod'
import type { OpsCodWorkflowData, OpsCodWorkflowRequest, OpsCodWorkflowRow } from '@/lib/services/reembolsos/ops-cod-workflow'
import type { ReembolsoBatch } from '@/lib/services/reembolsos/types'
import { isDateKey, lisbonDate } from '@/lib/billing/recurring-periods'
import { getShipmentStatusConfig } from '@/lib/status-helpers'
import { getMutedShipmentBadgeClass } from '@/lib/shipment-status-colors'
import { Badge } from '@/components/ui/badge'
import ReembolsosClient from './ReembolsosClient'

const money=(cents:number)=>(cents/100).toLocaleString('pt-PT',{style:'currency',currency:'EUR'})
const day=(value:string|null|undefined)=>value?new Date(value.length===10?`${value}T12:00:00Z`:value).toLocaleDateString('pt-PT',{timeZone:'Europe/Lisbon'}):'—'
type RowSort='name_asc'|'name_desc'|'date_asc'|'date_desc'
type Tab='all'|'receiving'|'available'|'requested'|'paid'|'disputes'|'excel'
const tabs:{id:Tab;label:string}[]=[{id:'all',label:'Todos'},{id:'receiving',label:'Por receber — CTT'},{id:'available',label:'Disponível para solicitar'},{id:'requested',label:'Solicitados'},{id:'paid',label:'Devolvidos / Pagos'},{id:'disputes',label:'Disputas / Divergências'},{id:'excel',label:'Importar / Cruzar Excel'}]
const input='rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-xs'
const button='rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold disabled:opacity-40'
function TmsShipmentStatus({status}:{status:string|undefined}) {
  const config=getShipmentStatusConfig(status||'')
  return <Badge variant={config.badgeVariant} className={`whitespace-nowrap ${getMutedShipmentBadgeClass(config.badgeVariant)}`}>
    {status?.trim()?config.label:'Sem estado no TMS'}
  </Badge>
}


export function ReembolsosWorkspace({data,error,batches,initialPeriod}:{data:OpsCodWorkflowData|null;error:string;batches:ReembolsoBatch[];initialPeriod:{from:string;to:string}}) {
  const router=useRouter()
  const [tab,setTab]=useState<Tab>('all'),[client,setClient]=useState(''),[search,setSearch]=useState(''),[period,setPeriod]=useState(initialPeriod),[page,setPage]=useState(1)
  const [sort,setSort]=useState<RowSort>('date_desc')
  const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[failed,setFailed]=useState(false)
  const [paymentDate,setPaymentDate]=useState(()=>lisbonDate())
  const [payment,setPayment]=useState<OpsCodWorkflowRequest|null>(null),[reference,setReference]=useState('')
  const normalize=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  const matches=(id:string,...values:string[]) => (!client||id===client)&&(!search.trim()||normalize(values.join(' ')).includes(normalize(search.trim())))
  const names=new Intl.Collator('pt-PT',{sensitivity:'base',numeric:true})
  const availableIds=new Set(data?.clients.flatMap(c=>c.availableIds)||[])
  const rows=(data?.rows||[]).filter(row=>matches(row.clientId,row.clientName,row.clientCode,row.tracking))
    .filter(row=>tab==='available'?availableIds.has(row.id):tab==='paid'?row.state==='paid':tab==='disputes'?row.state==='review':tab==='receiving'?(row.delivered&&row.state==='unconfirmed'):row.delivered)
    .filter(row=>!['all','receiving'].includes(tab)||Boolean(row.date&&row.date>=period.from&&row.date<=period.to))
    .sort((a,b)=>{
      if(tab!=='all') return 0
      const tie=names.compare(a.clientName,b.clientName)||a.id.localeCompare(b.id)
      if(sort==='name_asc'||sort==='name_desc') return names.compare(a.clientName,b.clientName)*(sort==='name_asc'?1:-1)||(b.date||'').localeCompare(a.date||'')||a.id.localeCompare(b.id)
      if(!a.date||!b.date) return a.date?-1:b.date?1:tie
      return a.date.localeCompare(b.date)*(sort==='date_asc'?1:-1)||tie
    })
  const requests=(data?.requests||[]).filter(r=>r.state!=='paid'&&matches(r.clientId,r.clientName,r.clientCode,...r.tracking))
  const missing=(data?.missing||[]).filter(r=>(!client||r.clientId===client)&&(!search.trim()||normalize(`${r.tracking} ${r.filename}`).includes(normalize(search.trim()))))
  const count=(id:Tab)=>!data?'—':id==='all'?data.rows.filter(r=>r.delivered).length:id==='receiving'?data.rows.filter(r=>r.delivered&&r.state==='unconfirmed').length:id==='available'?availableIds.size:id==='requested'?data.requests.filter(r=>r.state!=='paid').length:id==='paid'?data.rows.filter(r=>r.state==='paid').length:id==='disputes'?data.rows.filter(r=>r.state==='review').length+data.missing.length:batches.length
  const pages=Math.max(1,Math.ceil(rows.length/30)),current=Math.min(page,pages),visible=rows.slice((current-1)*30,current*30)
  async function run(work:()=>Promise<unknown>,message:string,after?:()=>void) {
    if(busy)return
    setBusy(true);setFeedback('');setFailed(false)
    try{await work();setFeedback(message);after?.();router.refresh()}catch(e){setFailed(true);setFeedback(e instanceof Error?e.message:'Não foi possível guardar. Atualize antes de repetir.')}finally{setBusy(false)}
  }
  async function downloadReceipt(clientId:string,requestId:string,format:'pdf'|'xlsx'='pdf') {
    if(busy)return
    setBusy(true);setFeedback('');setFailed(false)
    try {
      const document=await getOpsCodReceiptAction(clientId,requestId,format)
      const bytes=Uint8Array.from(atob(document.base64),char=>char.charCodeAt(0))
      const url=URL.createObjectURL(new Blob([bytes],{type:format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf'}))
      const link=window.document.createElement('a');link.href=url;link.download=document.filename
      window.document.body.appendChild(link);link.click();link.remove()
      window.setTimeout(()=>URL.revokeObjectURL(url),1000)
    } catch(e) {setFailed(true);setFeedback(e instanceof Error?e.message:'Não foi possível gerar o comprovativo.')}
    finally {setBusy(false)}
  }
  const rowState=(r:OpsCodWorkflowRow)=>r.state==='paid'?'Pago ao cliente':r.state==='review'?'Em disputa / Rever':r.requested?'Solicitado':r.state==='statement'?'Disponível a devolver':'Por receber da transportadora'
  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Gestão de Reembolsos</h1><p className="mt-1 text-xs text-[var(--text-secondary)]">Cobranças entregues → cruzamento CTT → disponível por loja → pagamento ao cliente.</p></div><button type="button" className={button} disabled={busy} onClick={()=>router.refresh()}>Atualizar</button></header>
    <nav aria-label="Estados dos reembolsos" className="flex flex-wrap gap-2 rounded-xl border border-slate-300 bg-white p-2 shadow-sm">
      {tabs.map(item=><button
        key={item.id}
        type="button"
        aria-pressed={tab===item.id}
        onClick={()=>{setTab(item.id);setPage(1)}}
        className={`inline-flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#32734A] focus-visible:ring-offset-2 ${tab===item.id?'border-[#285F3C] bg-[#32734A] text-white shadow-sm':'border-slate-300 bg-slate-50 text-slate-700 hover:border-[#8BAA95] hover:bg-[#EDF3EF] hover:text-[#285F3C]'}`}
      >
        <span>{item.label}</span>
        <span className={`inline-flex min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${tab===item.id?'bg-white/20 text-white':'border border-slate-200 bg-white text-slate-600'}`}>{count(item.id)}</span>
      </button>)}
    </nav>
    {feedback&&<p role={failed?'alert':'status'} className={`text-xs ${failed?'text-[#936a32]':'text-[var(--accent)]'}`}>{feedback}</p>}
    {tab==='excel'?<ReembolsosClient initialBatches={batches} managePayments={false} onViewDisputes={()=>setTab('disputes')} />:error||!data?<p role="alert" className="rounded-lg border border-[#d9c59f] bg-[#faf6ed] p-4 text-sm text-[#785a2d]">{error||'Não foi possível carregar os reembolsos.'}</p>:<>
      <div className="flex flex-wrap items-end gap-2"><label className="text-xs">Cliente<select value={client} onChange={e=>{setClient(e.target.value);setPage(1)}} className={`${input} mt-1 block max-w-xs`}><option value="">Todos os clientes</option>{data.clients.map(c=><option key={c.id} value={c.id}>{c.name}{c.code?` · ${c.code}`:''}</option>)}</select></label><input aria-label="Pesquisar cliente ou guia" placeholder="Cliente, código ou tracking…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} className={input}/>
        {tab==='all'&&<label className="text-xs">Ordenar por<select aria-label="Ordenar cobranças" value={sort} onChange={e=>{setSort(e.target.value as RowSort);setPage(1)}} className={`${input} mt-1 block`}><option value="date_desc">Data: mais recentes primeiro</option><option value="date_asc">Data: mais antigos primeiro</option><option value="name_asc">Nome do cliente: A–Z</option><option value="name_desc">Nome do cliente: Z–A</option></select></label>}
        {['all','receiving'].includes(tab)&&<><label className="text-xs">Criação desde<input type="date" value={period.from} max={period.to} onChange={e=>{setPeriod({...period,from:e.target.value});setPage(1)}} className={`${input} mt-1 block`}/></label><label className="text-xs">Até<input type="date" value={period.to} min={period.from} onChange={e=>{setPeriod({...period,to:e.target.value});setPage(1)}} className={`${input} mt-1 block`}/></label></>}
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{tab==='all'?'Todos os envios à cobrança já entregues. O intervalo usa a data de criação do envio.':tab==='receiving'?'Cobranças entregues ainda sem confirmação no Excel CTT. As correspondências válidas ficam disponíveis automaticamente após o cruzamento.':tab==='available'?'Guias confirmadas automaticamente no cruzamento CTT, ainda não pagas nem incluídas num pedido. O cliente escolhe na sua área as guias que pretende solicitar.':tab==='requested'?'Cada linha corresponde a uma seleção solicitada pelo cliente: loja, número de guias e total. Após o pagamento, os pedidos saem desta lista e ficam em Devolvidos / Pagos. Registe o pagamento apenas após executar a transferência.':tab==='paid'?'Valores cuja devolução ao cliente foi registada. Já não estão disponíveis para solicitar.': 'Cobranças divergentes, disputas abertas e guias do Excel inexistentes no TMS. Estes valores não ficam disponíveis. Resolver uma disputa volta a validar o cruzamento; não marca o valor como pago.'}</p>
      {tab==='receiving'&&<button type="button" disabled={busy} onClick={()=>{setTab('excel');setPage(1)}} className={`${button} bg-[var(--accent)] text-white`}>Importar Excel CTT</button>}
      {tab==='requested'?<div className="overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]"><table className="w-full text-left text-xs"><thead><tr><th className="p-3">Cliente / Pedido</th><th className="p-3">Data do pedido</th><th className="p-3">Envios</th><th className="p-3 text-right">Total solicitado</th><th className="p-3">Data do reembolso</th><th className="p-3">Estado</th><th className="p-3">Ação</th></tr></thead><tbody>{requests.map(r=><tr key={r.id} className="border-t border-[var(--border-subtle)]"><td className="p-3 font-semibold">{r.clientName}<span className="block font-mono text-[10px] font-normal">{r.clientCode} · {r.id.slice(0,8)}</span></td><td className="p-3">{day(r.createdAt)}</td><td className="p-3"><details><summary className="cursor-pointer">{r.tracking.length} guias</summary>{r.shipmentIds.map((id,index)=>{const shipment=data.rows.find(row=>row.id===id);return <div key={id} className="mt-2 space-y-1"><p className="font-mono">{shipment?.tracking||r.tracking[index]||id}</p><TmsShipmentStatus status={shipment?.shipmentStatus} /></div>})}</details></td><td className="p-3 text-right font-semibold">{money(r.amountCents)}</td><td className="p-3">{day(r.paidAt)}</td><td className="p-3"><ReembolsoStatusBadge state={r.state==='paid'?'paid':r.state==='review'?'review':'pending'} /></td><td className="p-3"><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={()=>downloadReceipt(r.clientId,r.id)}>Comprovativo PDF</button><button type="button" className={button} disabled={busy} onClick={()=>downloadReceipt(r.clientId,r.id,'xlsx')}>Comprovativo Excel</button>{r.state!=='paid'&&<button type="button" className={button} disabled={busy||r.state==='review'} onClick={()=>{setPayment(r);setReference('');setPaymentDate(lisbonDate())}}>Registar pagamento</button>}</div></td></tr>)}{!requests.length&&<tr><td colSpan={7} className="p-8 text-center">Sem pedidos neste filtro.</td></tr>}</tbody></table></div>:<>
        <div className="flex gap-5 text-xs"><span>{rows.length} cobranças</span><strong>{money(rows.reduce((sum,r)=>sum+(r.requestedCents||0),0))}</strong></div>
        <div className="overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]"><table className="w-full text-left text-xs"><thead><tr><th className="p-3">Cliente</th><th className="p-3">Guia</th><th className="p-3">Data do envio</th><th className="p-3">Estado no TMS</th><th className="p-3 text-right">Cobrança</th><th className="p-3">Estado do reembolso</th><th className="p-3">Gestão</th></tr></thead><tbody>{visible.map(r=><tr key={r.id} className="border-t border-[var(--border-subtle)]"><td className="p-3 font-semibold">{r.clientName}<span className="block text-[10px] font-normal">{r.clientCode}</span></td><td className="p-3 font-mono">{r.tracking}</td><td className="p-3">{day(r.date)}</td><td className="p-3"><TmsShipmentStatus status={r.shipmentStatus} /></td><td className="p-3 text-right tabular-nums">{r.requestedCents===null?'—':money(r.requestedCents)}</td><td className="p-3"><ReembolsoStatusBadge state={r.state==='paid'?'paid':r.state==='review'?'review':'pending'} />{r.state!=='paid'&&<p className="mt-1 text-[10px] text-[var(--text-secondary)]">{rowState(r)}</p>}{r.disputeReason&&<p className="mt-1 text-[#936a32]">{r.disputeReason}</p>}{r.state==='paid'&&<p className="mt-1 text-[10px]">{day(r.paidAt)} · {r.paymentRef||'Sem referência'}</p>}</td><td className="p-3">{r.state==='paid'?<div className="space-y-1">{data.requests.filter(request=>request.state==='paid'&&request.clientId===r.clientId&&request.shipmentIds.includes(r.id)).map(request=><div key={request.id} className="flex flex-wrap gap-2"><button type="button" disabled={busy} className={button} onClick={()=>downloadReceipt(r.clientId,request.id)}>Comprovativo PDF</button><button type="button" disabled={busy} className={button} onClick={()=>downloadReceipt(r.clientId,request.id,'xlsx')}>Comprovativo Excel</button></div>)}</div>:r.disputeReason?<button disabled={busy} className={button} onClick={()=>run(()=>setOpsCodDisputeAction(r.clientId,r.id,null),'Disputa resolvida. Os valores voltam a depender do cruzamento CTT.')}>Resolver disputa</button>:null}</td></tr>)}{!visible.length&&<tr><td colSpan={7} className="p-8 text-center text-[var(--text-secondary)]">Sem cobranças neste filtro.</td></tr>}</tbody></table><div className="flex justify-between border-t border-[var(--border-subtle)] p-3 text-xs"><span>Página {current} de {pages}</span><div className="flex gap-3"><button disabled={current===1} onClick={()=>setPage(current-1)}>Anterior</button><button disabled={current===pages} onClick={()=>setPage(current+1)}>Próxima</button></div></div></div>
        {tab==='disputes'&&missing.length>0&&<section className="rounded-lg border border-[#d9c59f] bg-[#faf6ed] p-4 text-xs text-[#785a2d]"><h2 className="font-semibold">Divergências do Excel por verificar</h2><p className="mt-1">Guias não encontradas, sem cliente confirmado ou com dados divergentes. Estes valores não entram no saldo disponível. A lista mantém as linhas de cada ficheiro para revisão.</p><details className="mt-2"><summary className="cursor-pointer">Ver {missing.length} linhas</summary><ul className="mt-2 max-h-64 space-y-1 overflow-auto">{missing.map((r,i)=><li key={i}><span className="font-mono">{r.tracking}</span> · {money(r.amountCents)} · {r.filename} (linha {r.lineNumber}){r.reason&&<p className="mt-1 text-[11px]">{r.reason}</p>}</li>)}</ul></details></section>}
      </>}
    </>}
    {payment&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="cod-payment-title" className="w-full max-w-md space-y-4 rounded-xl bg-[var(--surface-bg)] p-5"><h2 id="cod-payment-title" className="font-semibold">Registar pagamento</h2><p className="text-sm">{payment.clientName} · <strong>{money(payment.amountCents)}</strong> · {payment.tracking.length} guias</p><p className="text-xs text-[var(--text-secondary)]">Confirme apenas após efetuar o pagamento. Esta ação retira o valor disponível e mostra «Reembolsado» na área do cliente. Não executa a transferência.</p><label className="block text-xs">Data do pagamento<input type="date" aria-label="Data do pagamento" required disabled={busy} max={lisbonDate()} value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} className={`${input} mt-1 w-full`}/></label><label className="block text-xs">Referência / comprovativo<input autoFocus maxLength={160} value={reference} onChange={e=>setReference(e.target.value)} className={`${input} mt-1 w-full`}/></label><div className="flex justify-end gap-2"><button disabled={busy} className={button} onClick={()=>setPayment(null)}>Cancelar</button><button disabled={busy||!reference.trim()||!isDateKey(paymentDate)||paymentDate>lisbonDate()} className={`${button} bg-[var(--accent)] text-white`} onClick={()=>run(()=>recordOpsCodPaymentAction(payment.clientId,payment.id,reference,paymentDate),'Pagamento registado. A área do cliente foi atualizada.',()=>setPayment(null))}>{busy?'A guardar…':'Confirmar pagamento efetuado'}</button></div>{failed&&feedback&&<p role="alert" className="text-xs text-[#936a32]">{feedback}</p>}</section></div>}
  </div>
}
