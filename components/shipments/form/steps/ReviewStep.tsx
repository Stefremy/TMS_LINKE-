"use client"

import { useFormContext } from "react-hook-form"
import { ClipboardCheck, ArrowRight, Pencil } from "lucide-react"
import { shipmentOptionLabel } from "../presentation"
import { FormSection, inputClass } from "../fields"
import type { ShipmentFormRole, ShipmentFormValues } from "../schema"
import type { ShipmentQuote } from "../useShipmentQuote"
import { getClientServiceName } from "@/lib/services/client-service-label"
import { money } from "./ServiceStep"

export function ReviewStep({ quote, role, onEdit }: { quote: ShipmentQuote; role: ShipmentFormRole; onEdit: (section: "parties" | "parcel" | "service") => void }) {
  const form = useFormContext<ShipmentFormValues>()
  const values = form.watch()
  const address = (title: string, name: string, street: string, postal: string, city: string, country: string, phone: string) => <div className="space-y-1 text-sm"><p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</p><p className="font-semibold text-zinc-900">{name}</p><p className="text-zinc-500">{street}</p><p className="text-zinc-500">{postal} {city} · {country}</p><p className="text-zinc-500">{phone}</p></div>
  return <FormSection title={quote.requiresQuotation ? "Rever pedido de cotação" : "Tudo pronto para enviar?"} description={quote.requiresQuotation ? "A equipa confirma o preço. Após aceitar, cria o envio no TMS e a Linke emite a guia pela sua conta Correos." : "Reveja os dados antes de emitir a guia. A emissão cria o envio na transportadora."} icon={<ClipboardCheck size={18} />}>
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-zinc-900">Percurso</h3><button type="button" onClick={() => onEdit("parties")} className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Pencil size={12} />Editar moradas</button></div>
    <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr]">{address("Remetente", values.senderName, values.senderAddress, values.senderPostal, values.senderCity, "PT", values.senderPhone)}<ArrowRight className="hidden self-center text-zinc-300 sm:block" size={19} />{address("Destinatário", values.recipientName, values.recipientAddress, values.recipientPostal, values.recipientCity, values.recipientCountry, values.recipientPhone || values.recipientEmail)}</div>
    <div className="border-t border-zinc-100 pt-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-zinc-900">Volumes</h3><button type="button" onClick={() => onEdit("parcel")} className="text-xs font-medium text-emerald-700">Editar volumes</button></div>
      <p className="text-sm text-zinc-600">{values.volumesCount} volume(s) · {values.weightKg.toLocaleString("pt-PT")} kg · {values.lengthCm} × {values.widthCm} × {values.heightCm} cm por volume</p>
      {!!values.parcelWeightsKg.length && <p className="mt-2 text-xs text-zinc-500">Pesos por volume: {values.parcelWeightsKg.map(weight => `${weight.toLocaleString("pt-PT")} kg`).join(" · ")}</p>}
    </div>
    <div className="border-t border-zinc-100 pt-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-zinc-900">Serviço e opções</h3><button type="button" onClick={() => onEdit("service")} className="text-xs font-medium text-emerald-700">Editar serviço</button></div>
      <p className="text-sm text-zinc-700">{quote.selected ? role === "client" ? getClientServiceName(quote.selected.service.name) : quote.selected.service.name : "Selecione um serviço"}</p>
      <p className="mt-2 text-xs text-zinc-500">{quote.specialFees.filter(fee => quote.activeSpecialServices.includes(fee.special_service_code)).map(fee => shipmentOptionLabel(fee.special_service_name)).join(" · ") || "Sem opções adicionais"}</p>
      {quote.activeSpecialServices.some(code => code === "cod" || code === "correos_cod") && <p className="mt-2 text-sm text-zinc-600">Cobrança ao destinatário: {money(values.codValue)}</p>}
      {values.saveToAgenda && <p className="mt-2 text-xs text-zinc-500">O destinatário será guardado na agenda após {quote.requiresQuotation ? "o pedido" : "a emissão"}.</p>}
    </div>
    {quote.quote && <div className="border-t border-zinc-100 pt-5">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-zinc-900">{quote.requiresQuotation ? "Estimativa da tabela — preço a confirmar" : "Discriminação do preço e IVA"}</h3><span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">{quote.requiresQuotation ? "Estimativa" : quote.quote.vatPct > 0 ? `IVA ${quote.quote.vatPct}% (PT-CONT)` : "Isento de IVA (0%)"}</span></div>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/70">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-2 p-3 text-xs">
          <span className="font-medium text-zinc-400">Parcela</span><span className="text-right font-medium text-zinc-400">Sem IVA</span><span className="text-right font-medium text-zinc-400">IVA ({quote.quote.vatPct}%)</span><span className="text-right font-medium text-zinc-400">Com IVA</span>
          <span className="text-zinc-700">Transporte base (tabela)</span><span className="text-right tabular-nums text-zinc-700">{money(quote.quote.basePrice)}</span><span className="text-right tabular-nums text-zinc-500">{money(quote.quote.baseVatAmount)}</span><span className="text-right font-medium tabular-nums text-zinc-900">{money(quote.quote.basePriceWithVat)}</span>
          <span className="text-zinc-700">Taxa de combustível{quote.fuelPct !== null ? ` (${quote.fuelPct.toLocaleString("pt-PT")}%)` : ""}</span><span className="text-right tabular-nums text-zinc-700">{money(quote.quote.fuelSurchargeAmount)}</span><span className="text-right tabular-nums text-zinc-500">{money(quote.quote.fuelVatAmount)}</span><span className="text-right font-medium tabular-nums text-zinc-900">{money(quote.quote.fuelSurchargeWithVat)}</span>
          {quote.quote.specialItems.map((item, idx) => <span key={`${item.name}-${idx}`} className="contents"><span className="text-zinc-700">{shipmentOptionLabel(item.name)}</span><span className="text-right tabular-nums text-zinc-700">{money(item.amount)}</span><span className="text-right tabular-nums text-zinc-500">{money(item.vatAmount)}</span><span className="text-right font-medium tabular-nums text-zinc-900">{money(item.totalWithVat)}</span></span>)}
        </div>
        <div className="flex items-center justify-between border-t border-zinc-200 bg-white px-3 py-2.5 text-xs">
          <span className="text-zinc-600">Subtotal s/ IVA: <strong>{money(quote.quote.totalPrice)}</strong> · IVA: <strong>{money(quote.quote.vatAmount)}</strong></span>
          <span className="text-sm font-semibold tabular-nums text-zinc-900">Total{quote.requiresQuotation ? " estimado" : ""}: {money(quote.quote.totalWithVat)}{quote.requiresQuotation ? "*" : ""}</span>
        </div>
      </div>
      {quote.requiresQuotation && <p className="px-3 pt-2 text-[11px] leading-relaxed text-zinc-500">* Estimativa indicativa da tabela. A equipa Linke confirma o preço final e a disponibilidade após analisar o pedido.</p>}
    </div>}
    <label className="block space-y-2 text-sm font-medium text-zinc-700">Observações para a transportadora <span className="font-normal text-zinc-400">(opcional)</span><textarea {...form.register("observations")} rows={3} maxLength={500} className={`${inputClass} resize-y`} placeholder="Indicações úteis para a entrega…" /></label>
  </FormSection>
}
