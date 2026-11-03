"use client"

import { useMemo, useState } from "react"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { ShipmentForm } from "@/components/shipments/form/ShipmentForm"
import { inputClass } from "@/components/shipments/form/fields"

/** The previous operational form remains in LegacyNovoEnvioPageClient until approval. */
export function NovoEnvioPageClient({ clients, servicosLinke = [] }: { clients: Cliente[]; servicosLinke?: ServicoLinke[] }) {
  const availableClients = useMemo(() => {
    const operational = clients.filter(client => (client.short_name || client.legal_name || "").toLowerCase().includes("go linke"))
    return operational.length ? operational : clients
  }, [clients])
  const [clientId, setClientId] = useState(availableClients[0]?.id || "")
  const client = availableClients.find(client => client.id === clientId)
  if (!client) return <p role="alert" className="m-6 rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Não existem clientes disponíveis para emitir envios.</p>
  return <>
    {availableClients.length > 1 && <div className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-6 lg:px-8"><label className="block max-w-md space-y-2 text-sm font-medium text-zinc-700">Cliente do envio<select value={clientId} onChange={event => setClientId(event.target.value)} className={inputClass}>{availableClients.map(client => <option key={client.id} value={client.id}>{client.code} · {client.short_name || client.legal_name}</option>)}</select></label></div>}
    <ShipmentForm key={client.id} role="ops" client={client} services={servicosLinke} />
  </>
}
