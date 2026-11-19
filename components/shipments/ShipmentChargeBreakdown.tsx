"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { getShipmentChargeBreakdownAction, type ShipmentChargeView } from "@/app/actions/shipment-charges"
import { shipmentOptionLabel } from "@/components/shipments/form/presentation"

const money = (amount: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(amount)

/**
 * Price split recorded when the shipment was priced, with the same lines and wording as the checkout
 * summary (transport, fuel, supplements, subtotal, VAT, total). Used by the Ops/client side panel and
 * the full shipment detail. Never invents a split: falls back to the stored total (s/ IVA).
 */
export function ShipmentChargeBreakdown({ shipmentId, sellPrice }: { shipmentId: string; sellPrice?: number | string | null }) {
  const key = `${shipmentId}:${sellPrice ?? ""}`
  const [state, setState] = React.useState<{ key: string; view: ShipmentChargeView | null } | null>(null)
  React.useEffect(() => {
    let active = true
    getShipmentChargeBreakdownAction(shipmentId)
      .then(view => { if (active) setState({ key, view }) })
      .catch(() => { if (active) setState({ key, view: null }) })
    return () => { active = false }
  }, [key, shipmentId])
  const view = state?.key === key ? state.view : undefined

  if (view === undefined) return (
    <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
      <Loader2 className="w-3 h-3 animate-spin motion-reduce:animate-none" />A carregar discriminação…
    </div>
  )

  if (!view) {
    const stored = Number(String(sellPrice ?? "").replace(",", "."))
    return (
      <div className="space-y-2 text-[11px]">
        <p className="text-[var(--text-tertiary)]">Discriminação não disponível para este envio.</p>
        <div className="border-t border-[var(--border-subtle)] pt-2.5 flex items-center justify-between">
          <span className="font-bold text-xs text-[var(--text-primary)]">Total (s/ IVA)</span>
          <span className="font-bold text-sm text-[var(--accent)] font-mono tabular-nums">{Number.isFinite(stored) && stored > 0 ? money(stored) : "—"}</span>
        </div>
      </div>
    )
  }

  const hasVat = view.vatPct > 0
  const line = (label: string, amount: number, vat?: { label: string; amount: number }) => (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[var(--text-tertiary)]">{label}</span>
        <span className="font-mono tabular-nums text-[var(--text-secondary)]">{money(amount)}</span>
      </div>
      {hasVat && vat && (
        <div className="flex items-center justify-between gap-3 text-[10px] text-[var(--text-tertiary)] opacity-80">
          <span className="pl-2">↳ IVA {view.vatPct}% sobre {vat.label}</span>
          <span className="font-mono tabular-nums">+{money(vat.amount)} ({money(amount + vat.amount)})</span>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-2 text-[11px]">
      <div className="space-y-1.5">
        {line("Transporte base", view.basePrice, { label: "tabela", amount: view.baseVatAmount })}
        {line(`Combustível${view.fuelRatePct !== null ? ` (${view.fuelRatePct.toLocaleString("pt-PT")}%)` : ""}`, view.fuelSurchargeAmount, { label: "combustível", amount: view.fuelVatAmount })}
        {view.specialItems.length
          ? view.specialItems.map((item, index) => <React.Fragment key={`${item.name}-${index}`}>{line(shipmentOptionLabel(item.name), item.amount, { label: "suplemento", amount: item.vatAmount })}</React.Fragment>)
          : line("Suplementos", 0)}
      </div>
      <div className="border-t border-[var(--border-subtle)] pt-2 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[var(--text-tertiary)]">Subtotal (s/ IVA)</span>
          <span className="font-mono tabular-nums text-[var(--text-secondary)]">{money(view.totalPrice)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[var(--text-tertiary)]">{hasVat ? `IVA (${view.vatPct}% · PT-CONT)` : "IVA (0% · Ilhas / Internacional)"}</span>
          <span className="font-mono tabular-nums text-[var(--text-secondary)]">{money(view.vatAmount)}</span>
        </div>
      </div>
      <div className="border-t border-[var(--border-subtle)] pt-2.5 flex items-center justify-between">
        <span className="font-bold text-xs text-[var(--text-primary)]">{hasVat ? "Total (c/ IVA)" : "Total"}</span>
        <span className="font-bold text-sm text-[var(--accent)] font-mono tabular-nums">{money(view.totalWithVat)}</span>
      </div>
    </div>
  )
}
