import { ShoppingCart } from "lucide-react"

/** Marks a shipment created from an imported web-store order; manual shipments show nothing. */
export function OnlineOrderIcon({ order }: { order?: { order_number: string; store_name: string } | null }) {
  if (!order) return null
  const label = `Encomenda online ${order.order_number.startsWith("#") ? order.order_number : `#${order.order_number}`} · ${order.store_name}`
  return (
    <span role="img" aria-label={label} title={label}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]">
      <ShoppingCart aria-hidden className="size-3" strokeWidth={2} />
    </span>
  )
}
