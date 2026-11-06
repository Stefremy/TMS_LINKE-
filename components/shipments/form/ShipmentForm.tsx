"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { FormProvider, useForm, useWatch, type FieldPath } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, ArrowRight, Check, ChevronRight, CheckCircle2, ChevronUp, Download, Loader2, Printer, X, AlertCircle, PackagePlus, Building2 } from "lucide-react"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { getServicosLinkeAction } from "@/app/actions/servicos-linke"
import { submitShipmentFormAction, type ShipmentFormResult } from "@/app/actions/shipment-form"
import { getShipmentLabelAction } from "@/app/actions/shipments"
import { convertZplToPdfAction } from "@/app/actions/ctt"
import { saveDestinatarioAction } from "@/app/actions/destinatarios"
import { readCttExportForm } from "@/lib/services/ctt/export-details"
import { getCttRecipientContactError } from "@/lib/services/ctt/recipient-contact"
import { downloadCttLabel, printCttLabel } from "@/lib/label-utils"
import { useOptionalClientScope } from "@/app/app/components/ClientScope"
import { ClientTopUpModal } from "@/app/app/components/ClientTopUpModal"
import { isCorreosQuotationService } from "@/lib/services/correos/shipment-policy"
import { shipmentDefaults, shipmentFormSchema, SHIPMENT_STEPS, stepForField, type ShipmentFormRole, type ShipmentFormValues } from "./schema"
import { useShipmentQuote, getShipmentQuote } from "./useShipmentQuote"
import { PartiesStep } from "./steps/PartiesStep"
import { ParcelStep } from "./steps/ParcelStep"
import { ServiceStep, money } from "./steps/ServiceStep"
import { ReviewStep } from "./steps/ReviewStep"
import { OpsOverridesPanel } from "./ops/OpsOverridesPanel"
import { ShipmentSummary } from "./ShipmentSummary"
import { primaryButton, secondaryButton } from "./fields"

type Props = {
  role: ShipmentFormRole; client: Cliente; initialValues?: Partial<ShipmentFormValues>
  onCreated?: (result: ShipmentFormResult) => void; services?: ServicoLinke[]
  hideQuotationServices?: boolean
}
type Feedback = { created: ShipmentFormResult | null; quotation: { id: string; reference: string } | null; label: string | null; labelError: string; warning: string; labelBusy: boolean }
const SERVICE_STEP = stepForField("serviceId")
const REVIEW_STEP = SHIPMENT_STEPS.length - 1
const emptyFeedback: Feedback = { created: null, quotation: null, label: null, labelError: "", warning: "", labelBusy: false }

export function ShipmentForm({ role: requestedRole, client, initialValues, onCreated, services: providedServices, hideQuotationServices = false }: Props) {
  const scope = useOptionalClientScope()
  // Staff previewing /app use the same customer view, without operational controls.
  const role: ShipmentFormRole = scope ? "client" : requestedRole
  const effectiveClient = React.useMemo(() => role === "client" && scope?.isSuspended ? { ...client, portal_access_status: "suspended" as const } : client, [client, role, scope?.isSuspended])
  const defaults = React.useMemo(() => shipmentDefaults(client, initialValues), [client, initialValues])
  const form = useForm<ShipmentFormValues>({ defaultValues: defaults, resolver: zodResolver(shipmentFormSchema), mode: "onTouched", shouldFocusError: true })
  const values = useWatch({ control: form.control }) as ShipmentFormValues
  const [resource, setResource] = React.useState<{ services: ServicoLinke[]; loading: boolean; error: string }>({ services: providedServices || [], loading: !providedServices, error: "" })
  const [step, setStep] = React.useState(0)
  const [feedback, setFeedback] = React.useState<Feedback>(emptyFeedback)
  const [topUpOpen, setTopUpOpen] = React.useState(false)
  const submissionLock = React.useRef(false)
  const quotationKey = React.useRef<string | null>(null)
  const top = React.useRef<HTMLDivElement>(null)
  const summaryDialog = React.useRef<HTMLDialogElement>(null)
  const errorSummary = React.useRef<HTMLDivElement>(null)
  const formServices = React.useMemo(() => (providedServices || resource.services).filter(service => !hideQuotationServices || !isCorreosQuotationService(service)), [providedServices, resource.services, hideQuotationServices])
  const quote = useShipmentQuote({ client: effectiveClient, services: formServices, values, role })
  const busy = form.formState.isSubmitting || feedback.labelBusy
  const basePath = role === "ops" ? "/ops" : scope?.basePath || (client.portal_slug ? `/app/${client.portal_slug}` : "/app")
  const historyPath = `${basePath}/envios`
  const validation = shipmentFormSchema.safeParse(values)
  const invalidSteps = new Set(validation.success ? [] : validation.error.issues.map(issue => stepForField(String(issue.path[0] || "root"))))

  React.useEffect(() => {
    if (providedServices) return
    let active = true
    getServicosLinkeAction().then(services => { if (active) setResource({ services, loading: false, error: "" }) })
      .catch(() => { if (active) setResource({ services: [], loading: false, error: "Não foi possível carregar os serviços. Atualize a página para tentar novamente." }) })
    return () => { active = false }
  }, [providedServices])
  React.useEffect(() => {
    if (resource.loading) return
    if (values.serviceId && quote.options.some(option => option.service.id === values.serviceId)) return
    const nextServiceId = quote.options.length === 1 ? quote.options[0].service.id : ""
    if (values.serviceId !== nextServiceId) form.setValue("serviceId", nextServiceId)
  }, [form, quote.options, values.serviceId, resource.loading])
  React.useEffect(() => {
    if (!quote.selected) return
    if (quote.activeSpecialServices.length !== values.selectedSpecialServices.length) form.setValue("selectedSpecialServices", quote.activeSpecialServices)
    if (!quote.activeSpecialServices.some(code => code === "cod" || code === "correos_cod") && values.codValue !== 0) form.setValue("codValue", 0)
  }, [form, quote.selected, quote.activeSpecialServices, values.selectedSpecialServices, values.codValue])
  React.useEffect(() => {
    const count = values.volumesCount
    if (count === 1 && values.parcelWeightsKg.length) form.setValue("parcelWeightsKg", [])
    else if (Number.isSafeInteger(count) && count > 1 && values.parcelWeightsKg.length > count) form.setValue("parcelWeightsKg", values.parcelWeightsKg.slice(0, count))
  }, [form, values.volumesCount, values.parcelWeightsKg])
  React.useEffect(() => {
    if (!feedback.created && !feedback.quotation) return
    top.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })
  }, [feedback.created, feedback.quotation])

  const focusField = (field: string) => {
    requestAnimationFrame(() => {
      if (field === "root") { errorSummary.current?.focus(); return }
      if (field === "exportFields") {
        const section = document.getElementById("shipment-export-fields")
        const invalid = section?.querySelector<HTMLElement>("input:invalid, select:invalid, textarea:invalid")
        ;(invalid || section)?.focus(); return
      }
      if (field.startsWith("sender")) {
        const section = document.getElementsByName(field)[0]?.closest("details")
        if (section) section.open = true
      }
      form.setFocus((field === "parcelWeightsKg" ? "parcelWeightsKg.0" : field) as FieldPath<ShipmentFormValues>)
    })
  }
  const validateExport = () => {
    if (!quote.selected) return true
    const current = form.getValues()
    if (quote.requiresQuotation) return true
    if (quote.selected.carrier === "correos") {
      if (!current.recipientPhone) { form.setError("recipientPhone", { message: "Indique o telefone do destinatário para este envio Correos Express." }); setStep(0); focusField("recipientPhone"); return false }
      return true
    }
    if (current.recipientCountry === "PT") return true
    const contactError = getCttRecipientContactError({ country: current.recipientCountry, phone: current.recipientPhone, email: current.recipientEmail })
    if (contactError) { form.setError("recipientEmail", { message: contactError }); setStep(0); focusField("recipientEmail"); return false }
    try {
      const data = new FormData()
      for (const [key, value] of Object.entries(current.exportFields)) for (const item of Array.isArray(value) ? value : [value]) data.append(key, item)
      readCttExportForm(data, { country: current.recipientCountry, postalCode: current.recipientPostal, weightKg: current.weightKg })
      form.clearErrors("exportFields"); return true
    } catch (error) { form.setError("exportFields", { message: error instanceof Error ? error.message : "Preencha os dados do conteúdo internacional." }); setStep(SERVICE_STEP); focusField("exportFields"); return false }
  }
  const goToStep = async (target: number) => {
    if (busy) return
    if (target <= step) { setStep(target); return }
    form.clearErrors()
    const parsed = shipmentFormSchema.safeParse(form.getValues())
    const issues = parsed.success ? [] : parsed.error.issues.filter(issue => stepForField(String(issue.path[0])) < target)
    if (issues.length) {
      for (const issue of issues) form.setError(issue.path.join(".") as FieldPath<ShipmentFormValues>, { type: "validation", message: issue.message })
      const first = issues[0].path.join("."); setStep(stepForField(first)); focusField(first); return
    }
    if (target === REVIEW_STEP) {
      if (quote.isBlocked) { form.setError("serviceId", { message: quote.blockedReason || "Selecione um serviço disponível." }); setStep(SERVICE_STEP); focusField("serviceId"); return }
      if (!validateExport()) return
    }
    setStep(target)
    requestAnimationFrame(() => document.getElementById(`shipment-step-${target}-title`)?.focus())
  }
  const editShipmentSection = (section: "parties" | "parcel" | "service") => {
    setStep(0)
    requestAnimationFrame(() => document.getElementById(`shipment-section-${section}`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start",
    }))
  }
  const prepareLabel = async (created: ShipmentFormResult, print = false) => {
    setFeedback(previous => ({ ...previous, labelBusy: true, labelError: "" }))
    try {
      let label = feedback.label || created.labelBase64 || (created.id ? await getShipmentLabelAction(created.id) : null)
      if (!label) throw new Error("A etiqueta oficial ainda não está disponível. Pode tentar obtê-la novamente ou consultar o histórico. Não volte a emitir o envio.")
      if (label.trimStart().startsWith("^XA")) {
        const converted = await convertZplToPdfAction(label)
        if (!converted.success || !converted.base64) throw new Error("Não foi possível preparar o PDF da etiqueta. O envio já foi emitido.")
        label = converted.base64
      }
      setFeedback(previous => ({ ...previous, label }))
      const completed = print ? await printCttLabel(label) : await downloadCttLabel(label, `${created.guia}_Etiqueta.pdf`)
      if (completed === false) throw new Error("Não foi possível abrir a etiqueta. Tente descarregar novamente.")
    } catch (error) { setFeedback(previous => ({ ...previous, labelError: error instanceof Error ? error.message : "Não foi possível abrir a etiqueta." })) }
    finally { setFeedback(previous => ({ ...previous, labelBusy: false })) }
  }
  const submit = form.handleSubmit(async submitted => {
    if (submissionLock.current || feedback.created || feedback.quotation) return
    submissionLock.current = true
    form.clearErrors("root")
    try {
      const fresh = getShipmentQuote({ client: effectiveClient, services: formServices, values: submitted, role })
      if (fresh.isBlocked) { form.setError("serviceId", { message: fresh.blockedReason || "Não foi possível calcular o preço." }); setStep(SERVICE_STEP); focusField("serviceId"); return }
      if (!validateExport()) return
      const payload = { ...submitted, selectedSpecialServices: fresh.activeSpecialServices,
        codValue: fresh.activeSpecialServices.some(code => code === "cod" || code === "correos_cod") ? submitted.codValue : 0 }
      if (role === "client") { delete payload.carrierOverride; delete payload.internalNotes; delete payload.manualPrice }
      if (fresh.requiresQuotation && !quotationKey.current) quotationKey.current = crypto.randomUUID()
      const result = await submitShipmentFormAction(payload, client.id, quotationKey.current || undefined)
      if (!result.success) {
        const issues = result.fieldErrors
        for (const issue of issues) form.setError(issue.field as FieldPath<ShipmentFormValues> | "root", { type: "server", message: issue.message })
        const first = issues[0]
        if (first?.field !== "root") setStep(stepForField(first.field))
        focusField(first?.field || "root"); return
      }
      const isQuotation = result.kind === "quotation"
      setFeedback({ ...emptyFeedback, created: isQuotation ? null : result, quotation: isQuotation ? result.quotation : null, warning: result.dbWarning || "" })
      if (submitted.saveToAgenda) {
        try { const saved = await saveDestinatarioAction({ client_id: client.id, name: submitted.recipientName, address: submitted.recipientAddress, postal_code: submitted.recipientPostal,
          city: submitted.recipientCity, country: submitted.recipientCountry, phone: submitted.recipientPhone, email: submitted.recipientEmail }); if (!saved.success) throw new Error("Agenda indisponível") }
        catch { setFeedback(previous => ({ ...previous, warning: [previous.warning, `${isQuotation ? "O pedido foi guardado" : "O envio foi emitido"}, mas não foi possível guardar o destinatário na agenda.`].filter(Boolean).join(" ") })) }
      }
      if (isQuotation) return
      onCreated?.(result)
      if (result.labelBase64) await prepareLabel(result)
    } catch { form.setError("root", { message: "Não foi possível confirmar o resultado do pedido. Consulte o histórico antes de repetir a emissão." }); focusField("root") }
    finally { submissionLock.current = false }
  }, errors => {
    const field = Object.keys(errors)[0] || "root"
    setStep(stepForField(field)); focusField(field)
  })
  const next = () => step === REVIEW_STEP ? void submit() : void goToStep(step + 1)
  const nextLabel = step === REVIEW_STEP ? quote.requiresQuotation ? "Pedir cotação" : "Emitir guia" : "Continuar"
  const rootError = form.formState.errors.root?.message || resource.error
  const progress = (step + 1) / SHIPMENT_STEPS.length * 100

  return <div ref={top} className="[font-family:var(--font-geist-sans),sans-serif] mx-auto max-w-[1440px] space-y-4 bg-zinc-50 p-4 pb-36 text-zinc-900 sm:p-5 sm:pb-36 lg:p-6 lg:pb-8 [--surface-bg:#fff] [--surface-muted:#fafafa] [--text-primary:#18181b] [--text-secondary:#71717a] [--border-subtle:#e4e4e7] [--border-strong:#d4d4d8] [--accent:#047857] [--accent-soft:#ecfdf5]">
    <header className="space-y-3"><nav aria-label="Navegação" className="flex items-center gap-2 text-[11px] text-zinc-500"><Link href={basePath} className="hover:text-zinc-900">Painel</Link><ChevronRight size={11} /><span aria-current="page">Novo Envio</span></nav>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Novo envio</h1></div>
        <div className="flex max-w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-xs">{client.logo_url ? <Image unoptimized src={client.logo_url} alt="" width={30} height={26} className="size-8 rounded-md object-contain" /> : <span className="flex size-8 items-center justify-center rounded-md bg-zinc-100"><Building2 size={16} className="text-zinc-500" /></span>}<div className="min-w-0"><p className="truncate text-xs font-semibold">{client.short_name || client.legal_name}</p><p className="mt-0.5 text-[10px] font-medium text-zinc-400">{client.code}</p></div></div>
      </div>
    </header>
    {feedback.quotation ? <section role="status" className="mx-auto max-w-3xl space-y-5 rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
      <CheckCircle2 size={28} className="text-emerald-700" /><h2 className="text-2xl font-semibold text-zinc-900">Pedido de cotação enviado</h2>
      <p className="text-sm text-zinc-600">Referência <strong className="select-text font-mono text-zinc-900">{feedback.quotation.reference}</strong>. A equipa irá confirmar o preço com o parceiro. Acompanhe a resposta em Pedido de envio internacional aéreo, no menu lateral.</p>
      <p className="text-sm text-zinc-500">O pedido ficou registado, sem emissão de guia ou débito de saldo.</p>
      {feedback.warning && <p role="alert" className="text-sm text-amber-800">{feedback.warning}</p>}
      <div className="flex flex-wrap gap-3"><a href={role === "ops" ? "/ops/envios/cotacoes" : `${basePath}/cotacoes?pedido=${encodeURIComponent(feedback.quotation.id)}`} className={primaryButton}>Acompanhar pedido<ArrowRight size={15} /></a>
        <button type="button" className={secondaryButton} onClick={() => { form.reset(shipmentDefaults(client)); quotationKey.current = null; setFeedback(emptyFeedback); setStep(0) }}>Criar outro pedido</button></div>
    </section> : feedback.created ? <section role="status" aria-live="polite" className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
      <div className="space-y-4 border-b border-zinc-100 bg-emerald-50/60 p-6 sm:p-8"><span className="inline-flex rounded-xl border border-emerald-100 bg-white p-3 text-emerald-700"><CheckCircle2 size={26} /></span><div><h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Pronto. O seu envio foi emitido.</h2><p className="mt-2 text-sm text-zinc-500">Guia <strong className="select-text font-mono text-zinc-900">{feedback.created.guia}</strong></p></div></div>
      <div className="space-y-5 p-6 sm:p-8"><div className="flex flex-wrap justify-between gap-3 text-sm"><p className="text-zinc-600">{values.recipientName} · {values.recipientCity}</p><p className="font-semibold text-zinc-900">{typeof feedback.created.sellPrice === "number" ? money(feedback.created.sellPrice) : "Preço final por consultar"}</p></div>
        {feedback.warning && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{feedback.warning}</p>}
        {feedback.labelError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{feedback.labelError}</p>}
        {!feedback.created.labelBase64 && !feedback.label && <p className="text-sm text-zinc-500">A etiqueta oficial ainda não foi devolvida. Pode tentar obtê-la sem criar outro envio.</p>}
        <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void prepareLabel(feedback.created!)} className={primaryButton}>{feedback.labelBusy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> : <Download size={16} />}{feedback.labelBusy ? "A preparar etiqueta…" : "Descarregar etiqueta"}</button><button type="button" disabled={busy} onClick={() => void prepareLabel(feedback.created!, true)} className={secondaryButton}><Printer size={16} />Imprimir</button></div>
        <div className="flex flex-wrap gap-3 border-t border-zinc-100 pt-5"><Link href={historyPath} className={secondaryButton}>Ver no histórico<ArrowRight size={15} /></Link><button type="button" disabled={busy} className={secondaryButton} onClick={() => { form.reset(shipmentDefaults(client)); setFeedback(emptyFeedback); setStep(0) }}><PackagePlus size={16} />Criar outro envio</button></div>
      </div>
    </section> : <FormProvider {...form}>
      <nav aria-label="Passos do novo envio" className="rounded-xl border border-zinc-200 bg-white px-4 py-1.5 shadow-xs sm:px-5">
        <ol className="hidden gap-3 md:flex">{SHIPMENT_STEPS.map((label, index) => <li key={label} className="flex min-w-0 flex-1 items-center gap-2"><button type="button" aria-current={index === step ? "step" : undefined} disabled={busy || index > step && ([...invalidSteps].some(invalid => invalid < index) || index === REVIEW_STEP && quote.isBlocked)} onClick={() => void goToStep(index)} className={`flex min-w-0 items-center gap-2.5 text-left text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed ${index === step ? "text-zinc-900" : "text-zinc-500"}`}><span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index === step ? "bg-emerald-700 text-white" : index < step && !invalidSteps.has(index) ? "bg-emerald-50 text-emerald-700" : "border border-zinc-200 bg-white text-zinc-400"}`}>{index < step && !invalidSteps.has(index) ? <Check size={15} /> : index + 1}</span><span className="leading-relaxed">{label}</span></button>{index < REVIEW_STEP && <span aria-hidden className="ml-auto h-px min-w-3 flex-1 bg-zinc-200" />}</li>)}</ol>
        <div className="space-y-3 md:hidden"><div className="flex justify-between text-sm"><span className="font-medium">{SHIPMENT_STEPS[step]}</span><span className="text-zinc-400">Passo {step + 1} de {SHIPMENT_STEPS.length}</span></div><div role="progressbar" aria-label="Progresso do formulário" aria-valuemin={1} aria-valuemax={SHIPMENT_STEPS.length} aria-valuenow={step + 1} className="h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-emerald-700 transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div></div>
      </nav>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <form noValidate onSubmit={event => { event.preventDefault(); if (step < REVIEW_STEP) void goToStep(step + 1); else void submit(event) }} className="min-w-0 space-y-2.5">
          {rootError && <div ref={errorSummary} tabIndex={-1} role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 outline-none"><AlertCircle size={18} className="mt-0.5 shrink-0" />{rootError}</div>}
          {!resource.loading && !quote.countries.length && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{quote.blockedReason}</p>}
          {resource.loading && <p role="status" className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500"><Loader2 size={16} className="animate-spin motion-reduce:animate-none" />A carregar os serviços do cliente…</p>}
          <fieldset disabled={busy || resource.loading} className="min-w-0 space-y-3">
            {[<div key="shipment-data" className="space-y-2.5"><div id="shipment-section-parties" className="scroll-mt-6"><PartiesStep clientId={client.id} quote={quote} /></div><div id="shipment-section-parcel" className="scroll-mt-6"><ParcelStep quote={quote} /></div><div id="shipment-section-service" className="scroll-mt-6"><ServiceStep quote={quote} role={role} /></div></div>, <ReviewStep key="review" quote={quote} role={role} onEdit={editShipmentSection} />].map((component, index) => <div key={index} hidden={step !== index}><h2 id={`shipment-step-${index}-title`} tabIndex={-1} className="sr-only outline-none">{SHIPMENT_STEPS[index]}</h2>{component}</div>)}
            {quote.isBlocked && values.recipientPostal.trim() && (values.serviceId || (!quote.options.length && !quote.multiVolumeServiceUnavailable && (!quote.isIsland || !!quote.selectedMode))) && <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><AlertCircle size={15} className="mt-0.5 shrink-0" />{quote.blockedReason}</p>}
            {role === "ops" && <OpsOverridesPanel client={client} quote={quote} />}
            <div className="hidden items-center justify-between gap-3 pt-1 lg:flex"><button type="button" disabled={step === 0 || busy} onClick={() => setStep(step - 1)} className={secondaryButton}><ArrowLeft size={15} />Anterior</button><button type="button" onClick={next} disabled={busy || resource.loading || step === REVIEW_STEP && quote.isBlocked} className={primaryButton}>{form.formState.isSubmitting ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> : null}{form.formState.isSubmitting ? quote.requiresQuotation ? "A enviar pedido…" : "A emitir…" : nextLabel}{!form.formState.isSubmitting && <ArrowRight size={15} />}</button></div>
          </fieldset>
        </form>
        <aside className="sticky top-6 hidden space-y-4 lg:block"><ShipmentSummary quote={quote} values={values} />{role === "client" && client.billing_type === "pay_as_you_go" && <button type="button" className={`${secondaryButton} w-full`} onClick={() => setTopUpOpen(true)}>Carregar saldo</button>}<p className="px-2 text-xs leading-relaxed text-zinc-400">{quote.requiresQuotation ? "A proposta fica disponível em Pedido de envio internacional aéreo, no menu lateral, e recebe um aviso na caixa de entrada." : "A guia e a etiqueta ficam disponíveis no histórico após a emissão."}</p></aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-zinc-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.04)] lg:hidden"><button type="button" aria-haspopup="dialog" onClick={() => summaryDialog.current?.showModal()} className="flex min-w-0 items-center gap-2 text-left"><div><span className="block text-[10px] uppercase tracking-wider text-zinc-400">{quote.requiresQuotation ? "Estimativa*" : "Resumo"}{!quote.requiresQuotation && quote.quote ? (quote.quote.vatPct > 0 ? ` (c/ IVA ${quote.quote.vatPct}%)` : " (Isento IVA)") : ""}</span><strong className="text-xl font-semibold tabular-nums">{quote.quote ? `${money(quote.quote.totalWithVat)}${quote.requiresQuotation ? "*" : ""}` : quote.requiresQuotation ? "Sob consulta" : "—"}</strong></div><ChevronUp size={17} className="text-zinc-400" /></button><div className="flex gap-2">{step > 0 && <button type="button" aria-label="Passo anterior" disabled={busy} onClick={() => setStep(step - 1)} className={`${secondaryButton} !px-3`}><ArrowLeft size={16} /></button>}<button type="button" onClick={next} disabled={busy || resource.loading || step === REVIEW_STEP && quote.isBlocked} className={primaryButton}>{busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> : <>{nextLabel}<ArrowRight size={15} /></>}</button></div></div>
      <dialog ref={summaryDialog} aria-labelledby="shipment-mobile-summary-title" className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-0 bg-zinc-50 p-4 backdrop:bg-zinc-950/40 lg:hidden"><div className="mb-4 flex items-center justify-between"><h2 id="shipment-mobile-summary-title" className="text-base font-semibold">Resumo do envio</h2><button type="button" aria-label="Fechar resumo" onClick={() => summaryDialog.current?.close()} className="rounded-lg p-2 text-zinc-500"><X size={20} /></button></div><ShipmentSummary quote={quote} values={values} /><button type="button" disabled={busy || resource.loading || step === REVIEW_STEP && quote.isBlocked} onClick={() => { summaryDialog.current?.close(); next() }} className={`${primaryButton} mt-4 w-full`}>{nextLabel}<ArrowRight size={15} /></button>{role === "client" && client.billing_type === "pay_as_you_go" && <button type="button" onClick={() => { summaryDialog.current?.close(); setTopUpOpen(true) }} className={`${secondaryButton} mt-3 w-full`}>Carregar saldo</button>}</dialog>
    </FormProvider>}
    {role === "client" && <ClientTopUpModal isOpen={topUpOpen} onClose={() => setTopUpOpen(false)} clientId={client.id} />}
  </div>
}
