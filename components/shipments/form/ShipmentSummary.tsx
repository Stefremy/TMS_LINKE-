"use client"

import { ReceiptText, PackageCheck } from "lucide-react"
import type { ShipmentQuote } from "./useShipmentQuote"
import type { ShipmentFormValues } from "./schema"
import { shipmentOptionLabel } from "./presentation"
import { money } from "./steps/ServiceStep"

export function ShipmentSummary({ quote, values }: { quote: ShipmentQuote; values: ShipmentFormValues }) {
  const price = quote.quote
  const kg = (weight: number | null | undefined) => weight == null ? "—" : `${weight.toLocaleString("pt-PT", { maximumFractionDigits: 3 })} kg`
  return <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
    <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3"><ReceiptText size={16} className="text-zinc-400" /><h2 className="text-sm font-semibold tracking-tight text-zinc-900">Resumo</h2><span className="ml-auto rounded-md bg-zinc-100 px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-zinc-500">Estimativa</span></div>
    <div className="space-y-3 p-4">
      <div className="flex items-start gap-3 rounded-lg bg-zinc-50 p-3"><PackageCheck size={18} className="mt-0.5 shrink-0 text-zinc-400" /><div className="min-w-0 text-sm"><p className="truncate font-medium text-zinc-800">{values.recipientName || "O seu próximo envio"}</p><p className="mt-1 text-xs text-zinc-500">{values.recipientCity ? `${values.recipientCity} · ` : ""}{values.recipientCountry || "Selecione o destino"}{values.volumesCount > 0 ? ` · ${values.volumesCount} volume(s)` : ""}</p></div></div>
      <dl className="space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-zinc-500">Transporte base</dt><dd className="font-medium tabular-nums text-zinc-800">{price ? money(price.basePrice) : "—"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-zinc-500">Combustível{quote.fuelPct !== null ? ` (${quote.fuelPct.toLocaleString("pt-PT")}%)` : ""}</dt><dd className="font-medium tabular-nums text-zinc-800">{price ? money(price.fuelSurchargeAmount) : "—"}</dd></div>
        {price?.specialItems.map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-3"><dt className="min-w-0 text-xs leading-relaxed text-zinc-500">{shipmentOptionLabel(item.name)}</dt><dd className="shrink-0 font-medium tabular-nums text-zinc-800">{money(item.amount)}</dd></div>)}
        {!price?.specialItems.length && <div className="flex justify-between gap-3"><dt className="text-zinc-500">Suplementos</dt><dd className="font-medium tabular-nums text-zinc-800">{price ? money(price.specialFeesAmount) : "—"}</dd></div>}
      </dl>
      <div className="flex items-end justify-between border-t border-zinc-200 pt-3"><div><p className="text-xs font-semibold text-zinc-900">Total estimado</p><p className="mt-0.5 text-[10px] text-zinc-500">Segundo as condições do cliente</p></div><strong aria-live="polite" className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">{price ? money(price.totalPrice) : "—"}</strong></div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-zinc-100 pt-3 text-[11px]"><dt className="text-zinc-500">Peso real</dt><dd className="text-right font-medium text-zinc-700">{Number.isFinite(values.weightKg) ? kg(values.weightKg) : "—"}</dd><dt className="text-zinc-500">Peso volumétrico</dt><dd className="text-right font-medium text-zinc-700">{kg(price?.volumetricWeightKg)}</dd><dt className="text-zinc-500">Peso faturável</dt><dd className="text-right font-semibold text-zinc-900">{kg(price?.billableWeightKg)}</dd></dl>
      {!price && <p className="rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500">O preço fica disponível após preencher os volumes e selecionar um serviço.</p>}
    </div>
  </div>
}
