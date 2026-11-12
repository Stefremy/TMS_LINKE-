export function PickupRequestBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null
  return <span aria-label={`${count} pedidos de recolha pendentes`} className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold tabular-nums text-white ${className}`}>{count > 99 ? "99+" : count}</span>
}
