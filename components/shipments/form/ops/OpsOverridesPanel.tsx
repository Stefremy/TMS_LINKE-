"use client"

import Link from "next/link"
import { useFormContext } from "react-hook-form"
import { Settings2, LockKeyhole } from "lucide-react"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import { getClientSpecialFees } from "@/lib/pricing/calculate-shipment-quote"
import { SpecialFeesEditor } from "@/components/shipments/SpecialFeesEditor"
import { FieldError, inputClass } from "../fields"
import type { ShipmentFormValues } from "../schema"
import type { ShipmentQuote } from "../useShipmentQuote"
import { shipmentOptionLabel } from "../presentation"
import { money } from "../steps/ServiceStep"

export function OpsOverridesPanel({ client, quote }: { client: Cliente; quote: ShipmentQuote }) {
  const form = useFormContext<ShipmentFormValues>()
  return <details className="group rounded-xl border border-zinc-200 bg-white shadow-xs">
    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm font-semibold text-zinc-700"><Settings2 size={16} />Apenas Ops<span className="ml-auto rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Operações</span></summary>
    <div className="space-y-5 border-t border-zinc-100 p-5">
      <label className="block space-y-2 text-sm font-medium text-zinc-700">Transportadora
        <select {...form.register("carrierOverride")} className={inputClass} aria-invalid={!!form.formState.errors.carrierOverride}><option value="">Todas as opções autorizadas</option><option value="ctt">CTT Expresso</option><option value="correos">Correos Express</option></select><FieldError name="carrierOverride" />
      </label>
      <div className="flex items-start gap-2 rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600"><LockKeyhole size={15} className="mt-0.5 shrink-0" /><p>Preço definido pela tabela deste cliente{quote.quote ? `: ${money(quote.quote.totalPrice)}` : "."} As condições comerciais mantêm-se na <Link href="/ops/entidades/clientes" className="font-medium text-emerald-700 underline">ficha do cliente</Link>.</p></div>
      <label className="block space-y-2 text-sm font-medium text-zinc-700">Notas internas<textarea {...form.register("internalNotes")} maxLength={2000} rows={3} className={inputClass} placeholder="Informação para a equipa de operações…" /><span className="block text-xs font-normal text-zinc-500">Estas notas não são enviadas à transportadora nem apresentadas ao cliente.</span><FieldError name="internalNotes" /></label>
      <details className="rounded-lg border border-zinc-200 p-3"><summary className="cursor-pointer text-sm font-medium text-zinc-700">Consultar taxas deste cliente</summary><div className="mt-4"><SpecialFeesEditor fees={getClientSpecialFees(client).map(fee => ({ ...fee, special_service_name: shipmentOptionLabel(fee.special_service_name) }))} mode="client" disabled onChange={() => {}} /></div></details>
    </div>
  </details>
}
