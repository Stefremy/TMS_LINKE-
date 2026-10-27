import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { getCttServiceIdentity } from "@/lib/services/ctt/service-identity"

const COLORS = {
  EQ: "bg-amber-50 text-amber-900 border-amber-300",
  DD: "bg-emerald-50 text-emerald-900 border-emerald-200",
  DB: "bg-blue-50 text-blue-900 border-blue-200",
  EE: "bg-sky-50 text-sky-900 border-sky-200",
  CE: "bg-violet-50 text-violet-900 border-violet-200",
}

export function CttServiceBadge({ service }: { service: Partial<ServicoLinke> }) {
  const identity = getCttServiceIdentity(service)
  if (!identity) return null
  return (
    <span title={`Serviço CTT configurado: ${service.webservice_service_code}`}
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${COLORS[identity.prefix]}`}>
      {identity.label}
    </span>
  )
}
