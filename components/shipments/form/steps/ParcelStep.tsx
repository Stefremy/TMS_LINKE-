"use client"

import { useFormContext } from "react-hook-form"
import { useEffect } from "react"
import { Package } from "lucide-react"
import { ShipmentOversizeSummary } from "@/components/shipments/ShipmentOversizeSummary"
import { ShipmentVolumetricSummary } from "@/components/shipments/ShipmentVolumetricSummary"
import { requiresShipmentDimensions } from "@/lib/services/shipments/parcel-dimensions"
import { FormField, FormSection, FieldError } from "../fields"
import type { ShipmentFormValues } from "../schema"
import type { ShipmentQuote } from "../useShipmentQuote"

export function ParcelStep({ quote }: { quote: ShipmentQuote }) {
  const form = useFormContext<ShipmentFormValues>()
  const { setValue, clearErrors } = form
  const values = form.watch()
  const showDimensions = requiresShipmentDimensions(values.recipientCountry, values.recipientPostal)
  useEffect(() => {
    if (showDimensions) return
    for (const field of ["lengthCm", "widthCm", "heightCm"] as const) setValue(field, 0)
    clearErrors(["lengthCm", "widthCm", "heightCm"])
  }, [setValue, clearErrors, showDimensions])
  const count = Number.isSafeInteger(values.volumesCount) && values.volumesCount > 1 && values.volumesCount <= 1000 ? values.volumesCount : 0
  return <FormSection compact title={showDimensions ? "Volumes e medidas" : "Volumes e peso"} icon={<Package size={18} />}>
    <div className={`grid grid-cols-2 gap-3 ${showDimensions ? "sm:grid-cols-5" : ""}`}>
      <FormField compact name="weightKg" label="Peso total (kg)" type="number" min={0.001} step="0.001" />
      <FormField compact name="volumesCount" label="N.º de volumes" type="number" min={1} max={quote.requiresQuotation ? 1 : undefined} step="1"
        disabled={quote.requiresQuotation}
        hint={quote.requiresQuotation ? "Cotação internacional limitada a 1 volume." : (values.volumesCount > 1 && quote.selected?.carrier === "ctt" ? "No CTT, mais de 1 volume exige o serviço Múltiplo." : undefined)} />
      {showDimensions && <fieldset className="col-span-2 grid grid-cols-3 gap-3 sm:col-span-3"><legend className="sr-only">Dimensões por volume em centímetros</legend>
        <FormField compact name="lengthCm" label="Comprimento (cm)" type="number" min={0.1} step="0.1" />
        <FormField compact name="widthCm" label="Largura (cm)" type="number" min={0.1} step="0.1" />
        <FormField compact name="heightCm" label="Altura (cm)" type="number" min={0.1} step="0.1" />
      </fieldset>}
    </div>
    <p className="text-[11px] text-zinc-500">Peso total com embalagem.{showDimensions ? " Medidas por volume." : ""}</p>
    {count > 1 && <fieldset className="space-y-3"><legend className="mb-3 text-sm font-medium text-zinc-700">Peso de cada volume</legend><p className="text-xs text-zinc-500">A soma deve corresponder ao peso total do envio.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: count }, (_, index) => <FormField compact key={index} name={`parcelWeightsKg.${index}`} label={`Volume ${index + 1} (kg)`} type="number" min={0.001} step="0.001" />)}</div><FieldError name="parcelWeightsKg" />
    </fieldset>}
    {!quote.requiresQuotation && <>{showDimensions && <details className="text-xs text-zinc-500"><summary className="cursor-pointer py-1 font-medium hover:text-zinc-800">Detalhes do peso volumétrico</summary><div className="mt-2">
    <ShipmentVolumetricSummary service={quote.selected?.service} country={values.recipientCountry} postal={values.recipientPostal} weightKg={values.weightKg} lengthCm={values.lengthCm} widthCm={values.widthCm} heightCm={values.heightCm} volumesCount={values.volumesCount} />
    </div></details>}
    <ShipmentOversizeSummary service={quote.selected?.service} country={values.recipientCountry} postal={values.recipientPostal} weightKg={values.weightKg} lengthCm={showDimensions ? values.lengthCm : 0} widthCm={showDimensions ? values.widthCm : 0} heightCm={showDimensions ? values.heightCm : 0} volumesCount={values.volumesCount} parcelWeightsKg={values.parcelWeightsKg.length ? values.parcelWeightsKg : undefined}
      weights={values.parcelWeightsKg.map(String)} onWeightsChange={weights => form.setValue("parcelWeightsKg", weights.map(Number), { shouldValidate: true })} showWeights={false} /></>}
  </FormSection>
}
