'use client'

import { useRouter } from 'next/navigation'
import type { CodPayoutInboxRow } from '@/lib/services/reembolsos/client-cod-payout'

export function CodPayoutRequestsPanel({rows,error}:{rows:CodPayoutInboxRow[]|null;error?:string}) {
  const router=useRouter()
  return <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Pedidos de reembolso dos clientes</h2><button type="button" onClick={()=>router.refresh()} className="text-xs font-semibold text-[var(--accent)]">Atualizar</button></div>
    {error || !rows ? <p role="alert" className="text-xs text-[#936A32]">{error || 'Pedidos indisponíveis.'}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-[var(--text-secondary)]"><tr><th className="p-2">Cliente / Pedido</th><th className="p-2">Data</th><th className="p-2">Guias</th><th className="p-2 text-right">Valor solicitado</th><th className="p-2">Estado</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{rows.map(row=><tr key={row.id}><td className="p-2"><span className="block font-semibold">{row.clientName}</span><span className="mt-1 block font-mono text-[10px] text-[var(--text-tertiary)]">{row.id.slice(0,8).toUpperCase()}</span></td><td className="p-2">{new Date(row.createdAt).toLocaleDateString('pt-PT',{timeZone:'Europe/Lisbon'})}</td><td className="p-2"><details><summary className="cursor-pointer">{row.tracking.length} guias</summary><ul className="mt-2 space-y-1 font-mono text-[10px]">{row.tracking.map(id=><li key={id}>{id}</li>)}</ul></details></td><td className="p-2 text-right tabular-nums">{(row.amountCents/100).toLocaleString('pt-PT',{style:'currency',currency:'EUR'})}</td><td className="p-2">{row.state==='paid'?'Pagamento registado':row.state==='review'?'Rever conciliação':'Aguarda pagamento'}</td></tr>)}{!rows.length&&<tr><td colSpan={5} className="p-4 text-center text-[var(--text-secondary)]">Sem pedidos.</td></tr>}</tbody></table></div>}
    <p className="text-[11px] text-[var(--text-secondary)]">O pedido não executa transferências. Após pagar ao cliente pelo processo habitual, registe o pagamento no lote CTT correspondente abaixo; o estado do pedido acompanha essa conciliação.</p>
  </section>
}
