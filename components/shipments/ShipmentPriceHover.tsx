"use client"

import * as React from "react"
import * as Tooltip from "@radix-ui/react-tooltip"
import { getShipmentChargeBreakdownAction, type ShipmentChargeView } from "@/app/actions/shipment-charges"
import { shipmentOptionLabel } from "@/components/shipments/form/presentation"

const money = (amount: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(amount)
// One request per shipment and price while the page is open.
const cache = new Map<string, Promise<ShipmentChargeView | null>>()

/**
 * Wraps a "valor s/ IVA" figure: on hover (or tap on mobile) shows what made it up,
 * Preço de tabela + Taxa de combustível (+ suplementos) = total s/ IVA. Loaded on first open.
 */
export function ShipmentPriceHover({ shipmentId, sellPrice, children, className }: {
  shipmentId: string
  sellPrice?: number | string | null
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState<ShipmentChargeView | null | undefined>(undefined)
  const key = `${shipmentId}:${sellPrice ?? ""}`

  React.useEffect(() => {
    if (!open) return
    let active = true
    if (!cache.has(key)) cache.set(key, getShipmentChargeBreakdownAction(shipmentId).catch(() => null))
    cache.get(key)!.then(result => { if (active) setView(result) })
    return () => { active = false }
  }, [open, key, shipmentId])

  const row = (label: string, amount: number, strong = false) => (
    <div className={`flex items-center justify-between gap-4 ${strong ? "font-bold" : ""}`}>
      <span className={strong ? "" : "text-zinc-300"}>{label}</span>
      <span className="font-mono tabular-nums">{money(amount)}</span>
    </div>
  )

  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            onClick={event => { event.stopPropagation(); event.preventDefault(); setOpen(value => !value) }}
            className={`cursor-help underline decoration-dotted decoration-[var(--text-tertiary)] underline-offset-4 ${className ?? ""}`}
            aria-label="Ver composição do preço"
          >
            {children}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={6} collisionPadding={12} className="z-[120] w-64 rounded-md bg-zinc-900 px-3 py-2.5 text-xs text-white shadow-lg">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Composição do preço (s/ IVA)</p>
            {view === undefined ? (
              <p className="text-zinc-300">A carregar…</p>
            ) : view === null ? (
              <p className="text-zinc-300">Discriminação não disponível para este envio.</p>
            ) : (
              <div className="space-y-1">
                {row("Preço de tabela", view.basePrice)}
                {row(`+ Taxa de combustível${view.fuelRatePct !== null ? ` (${view.fuelRatePct.toLocaleString("pt-PT")}%)` : ""}`, view.fuelSurchargeAmount)}
                {view.specialItems.map((item, index) => <React.Fragment key={`${item.name}-${index}`}>{row(`+ ${shipmentOptionLabel(item.name)}`, item.amount)}</React.Fragment>)}
                <div className="border-t border-zinc-700 pt-1">{row("= Total s/ IVA", view.totalPrice, true)}</div>
                {view.vatPct > 0 && <p className="pt-0.5 text-[10px] text-zinc-400">Com IVA {view.vatPct}%: {money(view.totalWithVat)}</p>}
              </div>
            )}
            <Tooltip.Arrow className="fill-zinc-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
