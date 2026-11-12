"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { BookUser, Building2, ChevronDown, MapPin, Loader2 } from "lucide-react"
import { usePostalCodeLookup } from "@/lib/hooks/usePostalCodeLookup"
import { useRecipientAgenda } from "@/lib/hooks/useRecipientAgenda"
import { PostalAddressSuggestions } from "@/components/postal-address-suggestions"
import { FormField, FormSection, inputClass, secondaryButton } from "../fields"
import type { ShipmentFormValues } from "../schema"
import type { ShipmentQuote } from "../useShipmentQuote"

export function PartiesStep({ clientId, quote }: { clientId: string; quote: ShipmentQuote }) {
  const form = useFormContext<ShipmentFormValues>()
  const country = form.watch("recipientCountry")
  const [senderName, senderPostal, senderCity] = form.watch(["senderName", "senderPostal", "senderCity"])
  const [senderExpanded, setSenderExpanded] = useState(false)
  const senderHasErrors = ["senderName", "senderPostal", "senderCity", "senderAddress", "senderPhone"].some(name => !!form.formState.errors[name as keyof ShipmentFormValues])
  const [agendaOpen, setAgendaOpen] = useState(false)
  const agenda = useRecipientAgenda(clientId, agendaOpen)
  const senderLookup = usePostalCodeLookup({ country: "PT", onFound: info => {
    form.setValue("senderCity", info.city, { shouldValidate: true })
    if (!form.getValues("senderAddress") && info.street) form.setValue("senderAddress", info.street)
  } })
  const recipientLookup = usePostalCodeLookup({ country, onFound: info => {
    form.setValue("recipientCity", info.city, { shouldValidate: true })
    if (!form.getValues("recipientAddress") && info.street) form.setValue("recipientAddress", info.street)
  } })
  const chooseRecipient = (id: string) => {
    const recipient = agenda.recipients.find(row => row.id === id)
    if (!recipient) return
    const recipientCountry = recipient.country.trim().toUpperCase()
    if (!quote.countries.some(option => option.code === recipientCountry)) {
      form.setError("recipientCountry", { message: "O país deste destinatário não tem serviços autorizados para este cliente." }); return
    }
    recipientLookup.reset()
    for (const [field, value] of Object.entries({ recipientName: recipient.name, recipientAddress: recipient.address, recipientCity: recipient.city,
      recipientPostal: recipient.postal_code, recipientCountry, recipientPhone: recipient.phone || "", recipientEmail: recipient.email || "" })) {
      form.setValue(field as keyof ShipmentFormValues, value, { shouldDirty: true, shouldValidate: true })
    }
    setAgendaOpen(false)
  }
  return <div className="space-y-3">
    <details open={senderExpanded || senderHasErrors} onToggle={event => setSenderExpanded(event.currentTarget.open)} className="group rounded-xl border border-zinc-200 bg-white shadow-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 [&::-webkit-details-marker]:hidden">
        <span className="rounded-lg border border-zinc-200 bg-zinc-50 p-1.5 text-zinc-600"><Building2 size={16} /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold tracking-tight text-zinc-900">Remetente</span><span className="block truncate text-xs text-zinc-500">{[senderName, [senderPostal, senderCity].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "Preencha os dados de expedição"}</span></span>
        <ChevronDown aria-hidden size={18} className="shrink-0 text-zinc-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="space-y-3 border-t border-zinc-100 p-4">
      <p className="text-xs text-zinc-500">Local de expedição deste envio.</p>
      <FormField compact name="senderName" label="Nome / empresa" autoComplete="organization" />
      <div className="grid gap-3 sm:grid-cols-2"><FormField compact name="senderPostal" label="Código postal" placeholder="0000-000" onValueChange={senderLookup.lookup} /><FormField compact name="senderCity" label="Localidade" /></div>
      {senderLookup.loading && <p role="status" className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={13} className="animate-spin motion-reduce:animate-none" />A procurar localidade…</p>}
      <div className="grid gap-2 sm:grid-cols-3"><div className="sm:col-span-2"><FormField compact name="senderAddress" label="Morada e número da porta" autoComplete="street-address" /></div><FormField compact name="senderPhone" label="Telefone / telemóvel" type="tel" autoComplete="tel" /></div>
      {senderLookup.info && <PostalAddressSuggestions info={senderLookup.info} onCity={value => form.setValue("senderCity", value)} onStreet={value => form.setValue("senderAddress", value)} />}
      </div>
    </details>
    <FormSection dense title="Destinatário" icon={<MapPin size={16} />}>
      <div className="grid items-end gap-2 sm:grid-cols-2"><FormField compact name="recipientName" label="Nome / empresa" autoComplete="shipping name" /><button type="button" className={`${secondaryButton} min-h-10 w-full px-3 py-2 text-xs sm:w-auto`} aria-expanded={agendaOpen} onClick={() => setAgendaOpen(value => !value)}><BookUser size={15} />Agenda de destinatários</button></div>
      {agendaOpen && <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        {agenda.loading ? <p role="status" className="text-sm text-zinc-500">A carregar destinatários…</p> : agenda.error ? <p role="alert" className="text-sm text-red-700">{agenda.error}</p> : <label className="block text-xs font-medium text-zinc-700">Destinatário guardado
          <select className={`${inputClass.replace("py-2.5", "py-2")} mt-1 min-h-10`} value="" onChange={event => chooseRecipient(event.target.value)}><option value="">Selecionar destinatário…</option>{agenda.recipients.map(row => <option key={row.id} value={row.id}>{row.name} · {row.postal_code} · {row.city}</option>)}</select>
          {!agenda.recipients.length && <span className="mt-2 block text-xs text-zinc-500">Ainda não existem destinatários nesta agenda.</span>}
        </label>}
      </div>}
      <div className="grid gap-2 sm:grid-cols-3"><label className="space-y-1 text-xs font-medium text-zinc-700">País
        <select {...form.register("recipientCountry")} value={country} aria-invalid={!!form.formState.errors.recipientCountry} className={`${inputClass.replace("py-2.5", "py-2")} min-h-11 text-xs sm:min-h-10 sm:text-sm`}
          onChange={event => { form.setValue("recipientCountry", event.target.value, { shouldDirty: true }); form.setValue("recipientPostal", ""); form.setValue("recipientCity", ""); form.setValue("serviceId", ""); form.setValue("islandTransportMode", ""); form.setValue("exportFields", {}); recipientLookup.reset() }}>
          <option value="">Selecionar país…</option>{quote.countries.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}
        </select>{form.formState.errors.recipientCountry && <span role="alert" className="block text-xs text-red-700">{form.formState.errors.recipientCountry.message}</span>}
      </label><FormField compact name="recipientPostal" label="Código postal" autoComplete="shipping postal-code" onValueChange={recipientLookup.lookup} /><FormField compact name="recipientCity" label="Localidade" autoComplete="shipping address-level2" /></div>
      {recipientLookup.loading && <p role="status" className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={13} className="animate-spin motion-reduce:animate-none" />A procurar localidade…</p>}
      <div className="grid gap-2 sm:grid-cols-3"><div className="sm:col-span-2"><FormField compact name="recipientAddress" label="Morada e número da porta" autoComplete="shipping street-address" /></div><FormField compact name="recipientPhone" label="Telefone / telemóvel" type="tel" autoComplete="shipping tel" /></div>
      {recipientLookup.info && <PostalAddressSuggestions info={recipientLookup.info} onCity={value => form.setValue("recipientCity", value)} onStreet={value => form.setValue("recipientAddress", value)} />}
      <div className="grid items-end gap-2 sm:grid-cols-3"><div className="sm:col-span-2"><FormField compact name="recipientEmail" label="Email" type="email" autoComplete="shipping email" /></div>
      <div className="space-y-1"><label className="flex min-h-10 items-center gap-2 text-xs text-zinc-700"><input type="checkbox" {...form.register("saveToAgenda")} className="size-4 shrink-0 rounded border-zinc-300 accent-emerald-700" />Guardar na agenda</label><p className="text-[10px] leading-tight text-zinc-500">Indique pelo menos um contacto; alguns serviços exigem campos específicos.</p></div></div>
    </FormSection>
  </div>
}
