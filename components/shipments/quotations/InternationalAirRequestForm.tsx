"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { FormProvider, useForm, useWatch, type FieldPath } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { BookUser, CheckCircle2, ChevronDown, Loader2, Send } from "lucide-react"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { getInternationalAirQuotationReferenceAction, requestInternationalAirShipmentAction } from "@/app/actions/shipment-form"
import { saveDestinatarioAction } from "@/app/actions/destinatarios"
import { usePostalCodeLookup } from "@/lib/hooks/usePostalCodeLookup"
import { useRecipientAgenda } from "@/lib/hooks/useRecipientAgenda"
import { generalCorreosQuotationReference, generalCorreosQuotationClient } from "@/lib/services/correos/quotation-pricing"
import { shipmentDefaults, shipmentFormSchema, type ShipmentFormValues } from "../form/schema"
import { FormField, FieldError, inputClass, primaryButton, secondaryButton } from "../form/fields"
import { getShipmentQuote, useShipmentQuote } from "../form/useShipmentQuote"

const money = (amount: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(amount)
type Props = {
  client: Cliente; isEmployee?: boolean; services?: ServicoLinke[]; initialValues?: Partial<ShipmentFormValues>
  onCreated: (id: string) => Promise<void> | void; onNewRequest: () => void
}

/** A quotation-only form: no stepper, carrier dispatch or label actions. */
export function InternationalAirRequestForm({ client, isEmployee = false, services: supplied, initialValues, onCreated, onNewRequest }: Props) {
  const [resource, setResource] = useState<{ services: ServicoLinke[]; fuelSurchargePct?: number; loading: boolean; error: string }>({ services: supplied || [], loading: !supplied, error: "" })
  const services = useMemo(() => [generalCorreosQuotationReference(supplied || resource.services)], [supplied, resource.services])
  const referenceClient = useMemo(() => generalCorreosQuotationClient(client, services[0], resource.fuelSurchargePct), [client, services, resource.fuelSurchargePct])
  const form = useForm<ShipmentFormValues>({ defaultValues: shipmentDefaults(client, {
    recipientCountry: "", serviceId: services.length === 1 ? services[0].id : "", ...initialValues,
  }), resolver: zodResolver(shipmentFormSchema), mode: "onTouched" })
  const values = useWatch({ control: form.control }) as ShipmentFormValues
  const quote = useShipmentQuote({ client: referenceClient, services, values, role: "client" })
  const countries = quote.countries.filter(country => country.code !== "PT" && country.code !== "ES")
  const [agendaOpen, setAgendaOpen] = useState(false)
  const agenda = useRecipientAgenda(client.id, agendaOpen)
  const [created, setCreated] = useState<{ id: string; reference: string } | null>(null)
  const [notice, setNotice] = useState("")
  const lock = useRef(false), requestKey = useRef<string | null>(null)
  const rootError = useRef<HTMLParagraphElement>(null), success = useRef<HTMLElement>(null)
  const lookup = usePostalCodeLookup({ country: values.recipientCountry, onFound: info => {
    form.setValue("recipientCity", info.city, { shouldValidate: true })
    if (!form.getValues("recipientAddress") && info.street) form.setValue("recipientAddress", info.street)
  } })
  const busy = form.formState.isSubmitting
  const suspended = client.is_active === false || client.portal_access_status === "suspended" || client.portal_access_status === "blocked"
  const parcelReady = [values.weightKg, values.lengthCm, values.widthCm, values.heightCm, values.volumesCount].every(value => Number.isFinite(value) && value > 0)
  const estimate = parcelReady ? quote.quote : null
  const focusField = (field: string) => requestAnimationFrame(() => {
    if (field === "root") { rootError.current?.focus(); return }
    if (field.startsWith("sender")) {
      const details = document.getElementsByName(field)[0]?.closest("details")
      if (details) details.open = true
    }
    form.setFocus(field as FieldPath<ShipmentFormValues>)
  })

  useEffect(() => {
    if (supplied) return
    let active = true
    getInternationalAirQuotationReferenceAction(client.id).then(reference => { if (active) setResource({ services: [reference.service], fuelSurchargePct: reference.fuelSurchargePct, loading: false, error: "" }) })
      .catch(() => { if (active) setResource({ services: [], loading: false, error: "Não foi possível carregar a tabela de referência. Atualize a página." }) })
    return () => { active = false }
  }, [supplied, client.id])
  useEffect(() => {
    if (!resource.loading && services.length === 1 && values.serviceId !== services[0].id) form.setValue("serviceId", services[0].id)
  }, [form, resource.loading, services, values.serviceId])
  useEffect(() => { if (created) success.current?.focus() }, [created])

  const submit = (event: FormEvent<HTMLFormElement>) => form.handleSubmit(async submitted => {
    if (lock.current || created) return
    lock.current = true
    form.clearErrors("root")
    try {
      const fresh = getShipmentQuote({ client: referenceClient, services, values: submitted, role: "client" })
      if (fresh.isBlocked || !fresh.requiresQuotation) {
        form.setError("serviceId", { message: fresh.blockedReason || "Atualize a página para carregar a referência internacional." })
        focusField("serviceId"); return
      }
      requestKey.current ||= crypto.randomUUID()
      const result = await requestInternationalAirShipmentAction(submitted, client.id, requestKey.current)
      if (!result.success) {
        for (const issue of result.fieldErrors) form.setError(issue.field, { message: issue.message })
        focusField(result.fieldErrors[0]?.field || "root"); return
      }
      if (result.kind !== "quotation") throw new Error("Resultado inesperado")
      setCreated(result.quotation)
      if (submitted.saveToAgenda) {
        try {
          const saved = await saveDestinatarioAction({ client_id: client.id, name: submitted.recipientName, address: submitted.recipientAddress,
            city: submitted.recipientCity, postal_code: submitted.recipientPostal, country: submitted.recipientCountry, phone: submitted.recipientPhone, email: submitted.recipientEmail })
          if (!saved.success) throw new Error("Agenda indisponível")
        } catch { setNotice("O pedido foi guardado, mas não foi possível guardar o destinatário na agenda.") }
      }
      await onCreated(result.quotation.id)
    } catch {
      form.setError("root", { message: "Não foi possível confirmar o resultado. Atualize os pedidos abaixo antes de voltar a tentar." }); focusField("root")
    } finally { lock.current = false }
  }, errors => focusField(Object.keys(errors)[0] || "root"))(event)

  if (created) return <section ref={success} tabIndex={-1} role="status" className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
    <CheckCircle2 className="text-emerald-700" size={24} /><h2 className="text-lg font-semibold text-zinc-900">Pedido de envio internacional aéreo recebido</h2>
    <p className="text-sm text-zinc-700">Referência <strong>{created.reference}</strong>. A equipa Linke irá confirmar o preço e a disponibilidade. Pode acompanhar a resposta nos pedidos abaixo.</p>
    {notice && <p className="text-xs text-amber-800">{notice}</p>}
    <button type="button" disabled={busy} className={secondaryButton} onClick={onNewRequest}>Fazer outro pedido</button>
  </section>

  return <FormProvider {...form}><form noValidate onSubmit={submit} aria-label="Pedido de envio internacional aéreo" className="rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-xs">
    <div className="border-b border-zinc-100 px-4 py-3"><h2 className="text-sm font-semibold">Dados do pedido</h2><p className="mt-1 text-xs text-zinc-500">Preencha os dados para receber a proposta da Linke.</p></div>
    <div className="space-y-4 p-4">
      {(form.formState.errors.root?.message || resource.error) && <p ref={rootError} tabIndex={-1} role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 outline-none">{form.formState.errors.root?.message || resource.error}</p>}
      {resource.loading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 size={15} className="animate-spin motion-reduce:animate-none" />A carregar a tabela de referência…</p>}
      {isEmployee && <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">O pedido será registado em nome de {client.short_name || client.legal_name}, com a sua identificação de funcionário.</p>}
      {suspended && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Esta conta está suspensa para novos pedidos. Contacte a equipa Linke.</p>}
      <fieldset disabled={busy || resource.loading || !!resource.error || suspended} className="min-w-0 space-y-4">
        <details className="group rounded-lg border border-zinc-200 bg-zinc-50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs [&::-webkit-details-marker]:hidden"><span><strong>Remetente</strong> · {values.senderName || "Preencher origem"} · {values.senderPostal}</span><ChevronDown size={15} className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
          <div className="grid gap-3 border-t border-zinc-200 p-3 sm:grid-cols-2"><FormField compact name="senderName" label="Nome do remetente" /><FormField compact name="senderPhone" label="Telefone do remetente" type="tel" /><FormField compact name="senderAddress" label="Morada do remetente" /><FormField compact name="senderCity" label="Localidade do remetente" /><FormField compact name="senderPostal" label="Código postal do remetente" placeholder="0000-000" /></div>
        </details>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold">Destino</h3><button type="button" className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-emerald-800" aria-expanded={agendaOpen} onClick={() => setAgendaOpen(!agendaOpen)}><BookUser size={14} />Usar destinatário da agenda</button></div>
        {agendaOpen && <div className="rounded-lg bg-zinc-50 p-3">{agenda.loading ? <p role="status" className="text-xs">A carregar a agenda…</p> : agenda.error ? <p role="alert" className="text-xs text-red-700">{agenda.error}</p> : <label className="block text-xs">Destinatário guardado<select className={`${inputClass} mt-1`} value="" onChange={event => {
          const recipient = agenda.recipients.find(row => row.id === event.target.value)
          if (!recipient) return
          const country = recipient.country.trim().toUpperCase()
          if (!countries.some(option => option.code === country)) { form.setError("recipientCountry", { message: "Escolha um destinatário internacional fora de Portugal e Espanha." }); return }
          lookup.reset()
          const fields = { recipientName: recipient.name, recipientAddress: recipient.address, recipientCity: recipient.city, recipientPostal: recipient.postal_code, recipientCountry: country, recipientPhone: recipient.phone || "", recipientEmail: recipient.email || "" }
          for (const [field, value] of Object.entries(fields)) form.setValue(field as keyof ShipmentFormValues, value, { shouldDirty: true, shouldValidate: true })
          setAgendaOpen(false)
        }}><option value="">Selecionar destinatário…</option>{agenda.recipients.filter(row => countries.some(country => country.code === row.country.trim().toUpperCase())).map(row => <option key={row.id} value={row.id}>{row.name} · {row.country}</option>)}</select></label>}</div>}
        <div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1.5 text-xs font-medium text-zinc-700">País<select {...form.register("recipientCountry")} className={inputClass} aria-invalid={!!form.formState.errors.recipientCountry} onChange={event => { form.setValue("recipientCountry", event.target.value, { shouldDirty: true }); form.setValue("recipientPostal", ""); form.setValue("recipientCity", ""); lookup.reset() }}><option value="">Selecionar país…</option>{countries.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}</select><FieldError name="recipientCountry" /></label>
          <FormField compact name="recipientPostal" label="Código postal de destino" onValueChange={lookup.lookup} /><FormField compact name="recipientCity" label="Localidade de destino" /></div>
        {lookup.loading && <p role="status" className="text-xs text-zinc-500">A procurar localidade…</p>}
        <div className="grid gap-3 sm:grid-cols-2"><FormField compact name="recipientName" label="Nome / empresa do destinatário" /><FormField compact name="recipientAddress" label="Morada e número da porta" /><FormField compact name="recipientPhone" label="Telefone do destinatário" type="tel" /><FormField compact name="recipientEmail" label="Email do destinatário" type="email" /></div>
        <label className="flex min-h-9 items-center gap-2 text-xs"><input {...form.register("saveToAgenda")} type="checkbox" className="size-4 accent-emerald-700" />Guardar destinatário na agenda desta loja</label>
        <div className="border-t border-zinc-100 pt-3"><h3 className="mb-3 text-xs font-semibold">Volumes e medidas</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><FormField compact name="volumesCount" label="N.º de volumes" type="number" step="1" min={1} onValueChange={() => { form.setValue("parcelWeightsKg", []) }} /><FormField compact name="weightKg" label="Peso total (kg)" type="number" step="0.001" min={0.001} /><FormField compact name="lengthCm" label="Comprimento (cm)" type="number" step="0.1" min={0.1} /><FormField compact name="widthCm" label="Largura (cm)" type="number" step="0.1" min={0.1} /><FormField compact name="heightCm" label="Altura (cm)" type="number" step="0.1" min={0.1} /></div><p className="mt-2 text-[11px] text-zinc-500">Peso total com embalagem e dimensões por volume. Indique nas observações se os volumes tiverem medidas diferentes.</p></div>
        <input type="hidden" {...form.register("serviceId")} />
        <FieldError name="serviceId" />
        <label className="block space-y-1.5 text-xs font-medium">Conteúdo e observações (opcional)<textarea {...form.register("observations")} rows={2} maxLength={500} className={`${inputClass} resize-y`} placeholder="Descreva o conteúdo ou outras informações úteis para a cotação…" /><FieldError name="observations" /></label>
        <div className="flex flex-col gap-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold text-emerald-900">Estimativa da tabela geral Correos Internacional</p><strong aria-live="polite" className="mt-1 block text-2xl font-semibold text-emerald-950">{estimate ? `${money(estimate.totalWithVat)}*` : "Preço sob consulta"}</strong><p className="mt-2 max-w-xl text-[11px] leading-relaxed text-emerald-900">{estimate ? "* Estimativa indicativa com base na tabela. O preço final e a disponibilidade do transporte aéreo serão confirmados pela equipa Linke." : "A equipa Linke confirma o preço e a disponibilidade do transporte aéreo após analisar o pedido."}</p></div><button type="submit" className={`${primaryButton} shrink-0`}>{busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> : <Send size={15} />}{busy ? "A enviar pedido…" : "Enviar pedido de cotação"}</button></div>
      </fieldset>
    </div>
  </form></FormProvider>
}
