import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"

type ServiceIdentityInput = Pick<Partial<ServicoLinke>, "name" | "preferred_carrier_name" | "webservice_service_code">

interface CttServiceIdentity {
  prefix: "EQ" | "DD" | "DB"
  productName: string
  label: string
}

const CTT_SERVICE_IDENTITIES: Record<string, CttServiceIdentity> = {
  "ENCF008.01": { prefix: "EQ", productName: "Económico 48", label: "Guia EQ · Económico 48" },
  "EMSF056.01": { prefix: "DD", productName: "Para Amanhã", label: "Guia DD · Para Amanhã" },
  "EMSF057.01": { prefix: "DB", productName: "Em 2 Dias", label: "Guia DB · Em 2 Dias" },
}

/** Display identity follows the configured carrier product, never an editable table name. */
export function getCttServiceIdentity(service: ServiceIdentityInput): CttServiceIdentity | null {
  if (!service.preferred_carrier_name?.toLowerCase().includes("ctt")) return null
  return CTT_SERVICE_IDENTITIES[service.webservice_service_code?.trim().toUpperCase() || ""] ?? null
}

export function getServiceDisplayLabel(service: ServiceIdentityInput): string {
  const identity = getCttServiceIdentity(service)
  return identity ? `${identity.label} — ${service.name || ""}` : service.name || ""
}
