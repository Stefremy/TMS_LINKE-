export const SUPPORT_CATEGORIES = [
  { id: "envio", label: "Problema com um envio" },
  { id: "recolha", label: "Recolha não efetuada / atrasada" },
  { id: "etiqueta", label: "Etiquetas ou certificado" },
  { id: "faturacao", label: "Faturação e pagamentos" },
  { id: "conta", label: "Conta e acessos" },
  { id: "outro", label: "Outro assunto" },
] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["id"]
export type SupportStatus = "aberto" | "em_curso" | "resolvido"

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = { aberto: "Aberto", em_curso: "Em curso", resolvido: "Resolvido" }

export type SupportRequestInput = {
  clientId: string
  category: SupportCategory
  subject: string
  issueDate: string
  shipmentRef: string
  description: string
  contact: string
}

export type SupportRequest = Omit<SupportRequestInput, "clientId"> & {
  id: string
  clientId: string
  createdAt: string
  createdByEmail: string | null
  status: SupportStatus
  statusUpdatedAt: string | null
}

export const supportCategoryLabel = (id: string) => SUPPORT_CATEGORIES.find(category => category.id === id)?.label ?? "Outro assunto"

/** Dispatched in the browser after a status change so the sidebar badge and bell refresh at once. */
export const SUPPORT_REQUESTS_CHANGED_EVENT = "linke:support-requests-changed"
