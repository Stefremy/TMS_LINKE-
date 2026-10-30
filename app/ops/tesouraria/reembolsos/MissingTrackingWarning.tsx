import type { ReembolsoMatchedItem } from '@/lib/services/reembolsos/types'

const money = (cents: number) => (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })

export function MissingTrackingWarning({ items, carrier }: { items: ReembolsoMatchedItem[]; carrier: string }) {
  const missing = items.filter(item => item.trackingNotFound === true)
  if (!missing.length) return null
  const cents = (item: ReembolsoMatchedItem) => Number.isFinite(item.amount) ? Math.round(item.amount * 100) : 0
  const total = missing.reduce((sum, item) => sum + cents(item), 0)
  const name = carrier.toLowerCase() === 'ctt' ? 'CTT' : carrier.toUpperCase()

  return <section role="alert" className="rounded-lg border border-[#d9c59f] bg-[#faf6ed] p-4 text-[#785a2d]">
    <p className="text-sm font-semibold">Reembolsos {name} sem guia no TMS</p>
    <p className="mt-1 text-xs">O ficheiro indica {missing.length} linha(s) de reembolso, no total de {money(total)}, cujas guias não existem neste TMS. Podem pertencer à plataforma antiga. Confira antes de atribuir o dinheiro a um cliente. Estes valores não entram em «A receber».</p>
    <p className="mt-2 text-xs">O Excel é a fonte de confirmação usada pelo sistema; não existe confirmação bancária automática.</p>
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer font-semibold">Ver guias não encontradas</summary>
      <div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-left">
        <thead><tr><th className="py-1 pr-3">Linha</th><th className="py-1 pr-3">Tracking</th><th className="py-1 text-right">Valor no ficheiro</th></tr></thead>
        <tbody>{missing.map((item, index) => <tr key={`${item.lineNumber}-${index}`}>
          <td className="py-1 pr-3">{item.lineNumber}</td><td className="py-1 pr-3 font-mono">{item.carrierTracking || 'Sem tracking'}</td><td className="py-1 text-right tabular-nums">{money(cents(item))}</td>
        </tr>)}</tbody>
      </table></div>
    </details>
  </section>
}
