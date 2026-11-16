"use client"

import { useFormContext } from "react-hook-form"
import { ClipboardCheck, ArrowRight, Pencil } from "lucide-react"
import { shipmentOptionLabel } from "../presentation"
import { FormSection, inputClass } from "../fields"
import type { ShipmentFormRole, ShipmentFormValues } from "../schema"
import type { ShipmentQuote } from "../useShipmentQuote"
import { getClientServiceName } from "@/lib/services/client-service-label"
import { money } from "./ServiceStep"
import { requiresShipmentDimensions } from "@/lib/services/shipments/parcel-dimensions"

export function ReviewStep({ quote, role, onEdit }: { quote: ShipmentQuote; role: ShipmentFormRole; onEdit: (section: "parties" | "parcel" | "service") => void }) {
  const form = useFormContext<ShipmentFormValues>()
  const values = form.watch()
  const address = (title: string, name: string, street: string, postal: string, city: string, country: string, phone: string) => <div className="space-y-1 text-sm"><p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</p><p className="font-semibold text-zinc-900">{name}</p><p className="text-zinc-500">{street}</p><p className="text-zinc-500">{postal} {city} · {country}</p><p className="text-zinc-500">{phone}</p></div>
  return <FormSection title={quote.requiresQuotation ? "Rever pedido de cotação" : "Tudo pronto para enviar?"} description={quote.requiresQuotation ? "A equipa confirma o preço. Após aceitar, cria o envio no TMS e a Linke emite a guia pela sua conta Correos." : "Reveja os dados antes de emitir a guia. A emissão cria o envio na transportadora."} icon={<ClipboardCheck size={18} />}>
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-zinc-900">Percurso</h3><button type="button" onClick={() => onEdit("parties")} className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Pencil size={12} />Editar moradas</button></div>
    <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr]">{address("Remetente", values.senderName, values.senderAddress, values.senderPostal, values.senderCity, "PT", values.senderPhone)}<ArrowRight className="hidden self-center text-zinc-300 sm:block" size={19} />{address("Destinatário", values.recipientName, values.recipientAddress, values.recipientPostal, values.recipientCity, values.recipientCountry, values.recipientPhone || values.recipientEmail)}</div>
    <div className="grid gap-4 border-t border-zinc-100 pt-5">
      <label className="block space-y-2 text-sm font-medium text-zinc-700">Observações para a transportadora <span className="font-normal text-zinc-400">(opcional)</span><textarea {...form.register("observations")} rows={3} maxLength={500} className={`${inputClass} resize-y`} placeholder="Indicações úteis para a entrega…" /></label>
      <label className="block space-y-2 text-sm font-medium text-zinc-700">Referência <span className="font-normal text-zinc-400">(opcional · interna, não vai para a transportadora)</span><input {...form.register("reference")} maxLength={100} className={inputClass} placeholder="Ex.: nº da encomenda ou nota interna" /></label>
    </div>
    <div className="border-t border-zinc-100 pt-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-zinc-900">Volumes</h3><button type="button" onClick={() => onEdit("parcel")} className="text-xs font-medium text-emerald-700">Editar volumes</button></div>
      <p className="text-sm text-zinc-600">{values.volumesCount} volume(s) · {values.weightKg.toLocaleString("pt-PT")} kg{requiresShipmentDimensions(values.recipientCountry, values.recipientPostal) && <> · {values.lengthCm} × {values.widthCm} × {values.heightCm} cm por volume</>}</p>
      {!!values.parcelWeightsKg.length && <p className="mt-2 text-xs text-zinc-500">Pesos por volume: {values.parcelWeightsKg.map(weight => `${weight.toLocaleString("pt-PT")} kg`).join(" · ")}</p>}
    </div>
    <div className="border-t border-zinc-100 pt-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-zinc-900">Serviço e opções</h3><button type="button" onClick={() => onEdit("service")} className="text-xs font-medium text-emerald-700">Editar serviço</button></div>
      <p className="text-sm text-zinc-700">{quote.selected ? role === "client" ? getClientServiceName(quote.selected.service.name) : quote.selected.service.name : "Selecione um serviço"}</p>
      <p className="mt-2 text-xs text-zinc-500">{quote.specialFees.filter(fee => quote.activeSpecialServices.includes(fee.special_service_code)).map(fee => shipmentOptionLabel(fee.special_service_name)).join(" · ") || "Sem opções adicionais"}</p>
      {quote.activeSpecialServices.some(code => code === "cod" || code === "correos_cod") && <p className="mt-2 text-sm text-zinc-600">Cobrança ao destinatário: {money(values.codValue)}</p>}
      {values.saveToAgenda && <p className="mt-2 text-xs text-zinc-500">O destinatário será guardado na agenda após {quote.requiresQuotation ? "o pedido" : "a emissão"}.</p>}
    </div>
    {role === "client" && !quote.requiresQuotation && !!quote.selected && <label className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5 text-sm text-zinc-700"><input type="checkbox" {...form.register("printCertificate")} className="mt-0.5 size-4 accent-emerald-700" /><span><span className="block font-medium text-zinc-900">Imprimir certificado de aceitação</span><span className="block text-xs text-zinc-500">Opcional. Abre o documento para imprimir e entregar ao estafeta na recolha.</span></span></label>}
  </FormSection>
}
