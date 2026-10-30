export function ReembolsoStatusBadge({ state }: { state: 'paid' | 'review' | 'pending' }) {
  const style = state === 'paid'
    ? 'border-green-200 bg-green-50 text-green-800'
    : state === 'review'
      ? 'border-stone-200 bg-stone-100 text-stone-700'
      : 'border-amber-200 bg-amber-50 text-amber-800'
  return <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold ${style}`}>
    {state === 'paid' ? 'Reembolsado' : state === 'review' ? 'Em revisão' : 'Por reembolsar'}
  </span>
}
