"use client"

import Image from "next/image"
import { useFormContext } from "react-hook-form"
import { Truck, Plane, Ship, Check } from "lucide-react"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { getClientServiceName } from "@/lib/services/client-service-label"
import { CttExportFields } from "@/components/shipments/CttExportFields"
import { shipmentOptionLabel } from "../presentation"
import { FormField, FormSection, FieldError } from "../fields"
import type { ShipmentFormRole, ShipmentFormValues } from "../schema"
import type { ShipmentQuote } from "../useShipmentQuote"

export const money = (amount: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(amount)

export function ServiceStep({ quote, role }: { quote: ShipmentQuote; role: ShipmentFormRole }) {
  const form = useFormContext<ShipmentFormValues>()
  const values = form.watch()
  const specialServicesField = form.register("selectedSpecialServices")
  const pinnedCodes = new Set(["cod", "correos_cod", "fragil", "correos_fragil"])
  const visibleFees = quote.specialFees.filter(fee => pinnedCodes.has(fee.special_service_code) || values.selectedSpecialServices.includes(fee.special_service_code))
  const additionalFees = quote.specialFees.filter(fee => !visibleFees.includes(fee))
  const captureExport = (element: HTMLDivElement) => {
    const owner = element.closest("form")
    if (!owner) return
    const data = new FormData(owner)
    const fields: ShipmentFormValues["exportFields"] = {}
    for (const key of new Set([...data.keys()].filter(key => key.startsWith("ctt_")))) {
      const entries = data.getAll(key).filter((item): item is string => typeof item === "string")
      fields[key] = entries.length === 1 ? entries[0] : entries
    }
    form.setValue("exportFields", fields, { shouldDirty: true })
  }
  const renderFees = (fees: typeof quote.specialFees) => <div className="grid gap-1.5 sm:grid-cols-2">
    {fees.map(fee => <label key={fee.special_service_code} className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-700 hover:border-zinc-300">
      <input {...specialServicesField} type="checkbox" value={fee.special_service_code} className="size-4 shrink-0 accent-emerald-700"
        onChange={event => {
          void specialServicesField.onChange(event)
          if (!event.target.checked && (fee.special_service_code === "cod" || fee.special_service_code === "correos_cod")) {
            form.setValue("codValue", 0)
            form.clearErrors("codValue")
          }
        }} />
      <span className="min-w-0 flex-1 leading-tight">{shipmentOptionLabel(fee.special_service_name)}</span>
      <span className="min-w-0 shrink text-right text-[10px] text-zinc-500">{fee.fee_type === "fixed" ? money(fee.fixed_value ?? 0) : `${fee.percentage_value ?? 0}%${fee.min_value ? ` · mín. ${money(fee.min_value)}` : ""}`}</span>
    </label>)}
  </div>
  return <div className="space-y-5">
    <FormSection compact title="Serviço e preço" icon={<Truck size={18} />}>
      {quote.isIsland && <fieldset className="min-w-0 space-y-3"><legend className="mb-3 text-sm font-medium text-zinc-700">Como pretende enviar para as ilhas?</legend>
        <div className="grid gap-3 sm:grid-cols-2">{quote.islandModes.map(mode => {
          const Icon = mode === "sea" ? Ship : mode === "air" ? Plane : Truck
          return <label key={mode} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${quote.selectedMode === mode ? "border-emerald-600 bg-emerald-50/50" : "border-zinc-200 bg-white hover:border-zinc-400"}`}>
            <input type="radio" {...form.register("islandTransportMode")} value={mode} checked={quote.selectedMode === mode} className="accent-emerald-700" /><Icon size={19} className="text-zinc-500" /><span className="text-sm font-medium text-zinc-800">{mode === "air" ? "Aéreo" : mode === "sea" ? "Marítimo" : "Outro transporte"}</span>
          </label>
        })}</div><FieldError name="islandTransportMode" />
      </fieldset>}
      <fieldset role="radiogroup" className="min-w-0 grid gap-2 sm:grid-cols-2" aria-describedby="shipment-service-help" aria-invalid={!!form.formState.errors.serviceId}><legend className="sr-only">Serviços disponíveis</legend>
        {quote.options.map(option => {
          const selected = values.serviceId === option.service.id
          const logo = getCarrierLogo(option.carrier)
          return <label key={option.service.id} className={`relative flex min-h-16 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition-colors motion-reduce:transition-none ${selected ? "border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600" : "border-zinc-200 bg-white hover:border-zinc-400"}`}>
            <input type="radio" {...form.register("serviceId")} value={option.service.id} className="size-4 shrink-0 accent-emerald-700" />
            {logo && <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white p-1"><Image unoptimized src={logo} width={27} height={23} alt={option.carrier === "correos" ? "Correos Express" : "CTT Expresso"} className="max-h-6 object-contain" /></span>}
            <div className="min-w-0 flex-1"><div className="flex items-center gap-1"><span className="truncate text-xs font-semibold text-zinc-900">{role === "client" ? getClientServiceName(option.service.name) : option.service.name}</span>{selected && <Check aria-hidden size={13} className="shrink-0 text-emerald-700" />}</div>
              <span className="mt-1 inline-flex rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">{option.zone}</span>
              {option.error && <p className="mt-1 text-[10px] leading-tight text-zinc-500">{option.error}</p>}
            </div><div className="shrink-0 text-right"><strong className="text-sm font-semibold tabular-nums text-zinc-900">{option.quote ? money(option.quote.totalPrice) : "—"}</strong><span className="block text-[9px] text-zinc-500">Estimado</span></div>
          </label>
        })}
        {!quote.options.length && <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500">{quote.isIsland && !quote.selectedMode ? "Escolha primeiro a modalidade de transporte." : quote.multiVolumeServiceUnavailable ? quote.blockedReason : "Preencha o destino para consultar os serviços disponíveis."}</p>}
        <div className="col-span-full flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><FieldError name="serviceId" /><p id="shipment-service-help" className="text-[11px] leading-relaxed text-zinc-500">Preço da tabela deste cliente; confirmado na emissão.</p></div>
      </fieldset>
      {!!quote.specialFees.length && <fieldset className="min-w-0 space-y-2 border-t border-zinc-100 pt-3"><legend className="mb-1 text-xs font-semibold text-zinc-900">Opções de entrega</legend>
        {renderFees(visibleFees)}
        {!!additionalFees.length && <details className="pt-1"><summary className="min-h-10 cursor-pointer py-2 text-xs font-medium text-emerald-800 hover:text-emerald-950">Outras opções de entrega ({additionalFees.length})</summary><div className="mt-1">{renderFees(additionalFees)}</div></details>}
        <FieldError name="selectedSpecialServices" />
      </fieldset>}
      {quote.activeSpecialServices.some(code => code === "cod" || code === "correos_cod") && <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <FormField compact name="codValue" label="Valor a cobrar ao destinatário (€)" type="number" min={0.01} step="0.01" hint="Valor cobrado na entrega." />
      </div>}
    </FormSection>
    {values.recipientCountry && values.recipientCountry !== "PT" && quote.selected?.carrier === "ctt" && <div id="shipment-export-fields" tabIndex={-1} onChange={event => captureExport(event.currentTarget)} className="rounded-xl bg-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
      <CttExportFields key={values.recipientCountry} country={values.recipientCountry} postalCode={values.recipientPostal} values={values.exportFields} /><div className="px-4 pb-3"><FieldError name="exportFields" /></div>
    </div>}
  </div>
}
