"use client"

import { useRef, useState } from "react"
import { Plane } from "lucide-react"
import { useClientScope } from "@/app/app/components/ClientScope"
import { getShipmentQuotationsAction } from "@/app/actions/shipment-quotations"
import type { QuotationPage } from "@/lib/shipments/quotations/types"
import { InternationalAirRequestForm } from "./InternationalAirRequestForm"
import { QuoteRequestsClient } from "./QuoteRequestsClient"

export function InternationalAirRequestsClient({ initial, initialError = "", selectedId }: {
  initial: QuotationPage; initialError?: string; selectedId?: string
}) {
  const { client, basePath, isEmployee, isSuspended } = useClientScope()
  const [requests, setRequests] = useState({ page: initial, error: initialError, selectedId, version: 0 })
  const [formVersion, setFormVersion] = useState(0)
  const [completed, setCompleted] = useState(false)
  const formTop = useRef<HTMLDivElement>(null)
  const newRequest = () => {
    if (completed) { setFormVersion(version => version + 1); setCompleted(false) }
    requestAnimationFrame(() => formTop.current?.focus())
  }
  const onCreated = async (id: string) => {
    setCompleted(true)
    try {
      const page = await getShipmentQuotationsAction(client.id, undefined, true)
      setRequests(current => ({ page, error: "", selectedId: id, version: current.version + 1 }))
    } catch {
      setRequests(current => ({ ...current, error: "O pedido foi guardado. Atualize a lista para o consultar.", version: current.version + 1 }))
    }
  }
  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    <header className="flex items-start gap-3"><span className="rounded-xl bg-[var(--accent-soft)] p-2.5 text-[var(--accent)]"><Plane aria-hidden size={23} /></span><div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Pedido de envio internacional aéreo</h1><p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">Peça uma proposta à Linke. A equipa confirma o preço e trata da emissão da guia através da sua conta Correos.</p></div></header>
    <div id="novo-pedido" ref={formTop} tabIndex={-1} className="scroll-mt-20 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
      <InternationalAirRequestForm key={`${client.id}-${formVersion}`} client={isSuspended ? { ...client, portal_access_status: "suspended" } : client} isEmployee={isEmployee} onCreated={onCreated} onNewRequest={newRequest} />
    </div>
    <QuoteRequestsClient key={`${client.id}-${requests.version}`} mode="client" basePath={basePath} clientId={client.id} initial={requests.page} initialError={requests.error} selectedId={requests.selectedId} onNewRequest={newRequest} />
  </div>
}
