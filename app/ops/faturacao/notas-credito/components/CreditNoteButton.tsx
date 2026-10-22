'use client'
import {useEffect,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Undo2,X,Loader2,ExternalLink} from 'lucide-react'
import {previewCreditNoteAction,prepareCreditNoteAction,confirmCreditNoteAction,cancelCreditNoteDraftAction,refreshCreditNoteAction} from '@/app/actions/credit-notes'
import type {CreditNoteDto} from '@/lib/billing/credit-notes/service'
import {creditMoney,CREDIT_STATE_LABELS,type CreditSource,type CreditPreview} from '@/lib/billing/credit-notes/types'

export function CreditNoteButton({source,resume,className}:{source:CreditSource;resume?:CreditNoteDto;className?:string}) {
  const [open,setOpen]=useState(false)
  return <>
    <button type="button" onClick={e=>{e.stopPropagation();setOpen(true)}} className={className||'inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'}><Undo2 className="h-4 w-4" aria-hidden="true" />{resume?'Consultar / Retomar':'Emitir nota de crédito'}</button>
    {open&&<CreditNoteDialog source={source} initial={resume} onClose={()=>setOpen(false)} />}
  </>
}
export function CreditNoteDialog({source,initial,onClose}:{source:CreditSource;initial?:CreditNoteDto;onClose:()=>void}) {
  const router=useRouter(),ref=useRef<HTMLDialogElement>(null)
  const [preview,setPreview]=useState<CreditPreview|null>(null),[note,setNote]=useState<CreditNoteDto|undefined>(initial)
  const [quantities,setQuantities]=useState<Record<string,string>>({}),[reason,setReason]=useState('')
  const [pending,setPending]=useState(true),[error,setError]=useState(''),[requestId]=useState(()=>initial?.id||crypto.randomUUID())
  useEffect(()=>{const dialog=ref.current;if(!dialog)return;const focus=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';return()=>{if(dialog.open)dialog.close();document.body.style.overflow=overflow;if(focus?.isConnected)focus.focus()}},[])
  const sourceId=source.id,sourceKind=source.kind,initialId=initial?.id
  useEffect(()=>{let active=true;const load=initialId?refreshCreditNoteAction(initialId):previewCreditNoteAction({id:sourceId,kind:sourceKind})
    load.then(result=>{if(!active)return;if(!result.success){setError(result.error);return}const data=result.data;if('state'in data)setNote(data);else setPreview(data)})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível consultar o Moloni.')}).finally(()=>{if(active)setPending(false)})
    return()=>{active=false}
  },[sourceId,sourceKind,initialId])
  async function act(kind:'prepare'|'issue'|'cancel'|'refresh') {
    if(pending)return;setPending(true);setError('')
    try {
      const result=kind==='prepare'?await prepareCreditNoteAction(source,requestId,Object.entries(quantities).filter(([,q])=>Number(q)>0).map(([id,q])=>({id:Number(id),qty:Number(q)})),reason)
        :kind==='issue'?await confirmCreditNoteAction(note!.id):kind==='cancel'?await cancelCreditNoteDraftAction(note!.id):await refreshCreditNoteAction(note!.id)
      if(!result.success){setError(result.error);return}
      setNote(result.data);router.refresh()
    } catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir. Consulte Notas de Crédito antes de repetir.')}
    finally{setPending(false)}
  }
  const selected=Object.entries(quantities).some(([,q])=>Number(q)>0)
  return <dialog ref={ref} aria-label="Nota de crédito" onCancel={e=>{e.preventDefault();if(!pending)onClose()}} onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget&&!pending)onClose()}} className="tms-modal-overlay fixed inset-0 m-0 h-[100dvh] w-screen max-h-none max-w-none border-0 bg-black/55 backdrop-blur-xs hidden open:flex items-center justify-center">
    <div className="tms-modal-fit flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[var(--text-primary)] shadow-xl">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4"><div><h2 className="text-base font-semibold">Nota de crédito</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{note?.invoice_number||preview?.invoiceNumber||'A consultar fatura'} · {note?.client_name||preview?.clientName}</p></div><button type="button" disabled={pending} onClick={onClose} aria-label="Fechar" className="rounded-md p-2 disabled:opacity-40"><X className="h-5 w-5" /></button></header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {pending&&<p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />A processar no Moloni…</p>}
        {!note&&preview&&<>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">Selecione as linhas e quantidades a creditar. Os preços, impostos e limites vêm da fatura original no Moloni.</p>
          <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)]">{preview.lines.map(line=><div key={line.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"><label className="flex min-w-0 flex-1 items-start gap-3"><input type="checkbox" checked={Number(quantities[line.id]||0)>0} disabled={pending} onChange={e=>setQuantities(q=>({...q,[line.id]:e.target.checked?String(line.availableQty):'0'}))} className="mt-1 accent-[var(--accent)]" /><span><span className="block text-sm font-medium">{line.name}</span><span className="mt-1 block text-xs text-[var(--text-secondary)]">{creditMoney(line.price)} / unidade · Disponível: {line.availableQty}{line.discount>0?` · Desconto original: ${line.discount}%`:''}</span></span></label><label className="shrink-0 text-xs text-[var(--text-secondary)]">Quantidade<input aria-label={`Quantidade a creditar: ${line.name}`} type="number" min="0" max={line.availableQty} step="0.000001" value={quantities[line.id]||'0'} disabled={pending} onChange={e=>setQuantities(q=>({...q,[line.id]:e.target.value}))} className="ml-2 w-28 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-2 text-sm text-[var(--text-primary)]" /></label></div>)}</div>
          {!preview.lines.length&&<p className="text-sm">Esta fatura não tem linhas disponíveis para crédito.</p>}
          <label className="block text-sm font-medium">Motivo<textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={5} maxLength={1000} disabled={pending} rows={3} className="mt-2 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-3 text-sm" placeholder="Ex.: correção de suplemento cobrado indevidamente" /></label>
          <p className="text-xs leading-5 text-[var(--text-secondary)]">O próximo passo cria um rascunho no Moloni. Poderá rever os valores calculados antes da emissão oficial.</p>
        </>}
        {note&&<>
          <p className="text-sm font-semibold">{CREDIT_STATE_LABELS[note.state]}{note.state==='issued'?` · ${note.number||'NC'}`:''}</p>
          {note.error&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">{note.error} Use «Consultar Moloni» para verificar o resultado.</p>}
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">{[['Sem IVA',note.net],['IVA',note.tax],['Total',note.total]].map(([label,value])=><div key={String(label)}><p className="text-xs text-[var(--text-secondary)]">{label}</p><p className="mt-1 font-semibold">{creditMoney(value as number|undefined)}</p></div>)}</div>
          <ul className="space-y-2 text-sm">{note.lines.map((line,i)=><li key={i} className="flex justify-between gap-4"><span>{line.name}</span><span className="shrink-0 text-[var(--text-secondary)]">{line.qty} × {creditMoney(line.price)}</span></li>)}</ul>
          <p className="text-sm leading-6"><strong>Motivo:</strong> {note.reason}</p>
          <p className="text-xs leading-6 text-[var(--text-secondary)]">{note.state==='draft'?'Pode fechar e retomar este rascunho em Notas de Crédito. Ao confirmar, será emitida a nota de crédito oficial no Moloni. ':''}Esta operação não faz reembolsos Stripe nem carregamentos de saldo.</p>
          {note.document_id&&<a href={`/api/credit-notes/${note.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"><ExternalLink className="h-4 w-4" />{note.state==='issued'?'Abrir nota de crédito':'Ver PDF do rascunho'}</a>}
        </>}
      </div>
      <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
        <button type="button" disabled={pending} onClick={onClose} className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm disabled:opacity-50">Fechar</button>
        {!note&&preview&&<button type="button" disabled={pending||!selected||reason.trim().length<5} onClick={()=>act('prepare')} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Preparar rascunho</button>}
        {note?.state==='draft'&&<><button type="button" disabled={pending} onClick={()=>{if(confirm('Cancelar e eliminar apenas este rascunho no Moloni?'))act('cancel')}} className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm disabled:opacity-50">Cancelar rascunho</button><button type="button" disabled={pending} onClick={()=>act('issue')} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirmar emissão</button></>}
        {note&&note.state!=='cancelled'&&<button type="button" disabled={pending} onClick={()=>act('refresh')} className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm disabled:opacity-50">Consultar Moloni</button>}
      </footer>
    </div>
  </dialog>
}
