/** Shared labels preserve existing saved grants while mapping them to actual modules. */
export const PERMISSIONS = {
  all: "Acesso Total (Super-Admin)",
  shipments: "Emissão e Controlo de Guias CTT",
  pickups: "Pedidos de Recolha & Distribuição",
  clients: "Gestão de Clientes & Contratos",
  support: "Atendimento & Suporte a Incidências",
  finance: "Faturação & Contas Correntes",
  carriers: "Gestão de Transportadoras & Frotas",
  integrations: "Configurações de Webservices & Integrações",
  salaries: "Gestão de Salários & Vencimentos",
  reports: "Relatórios Operacionais",
  documents: "Documentos Internos",
  accessEmail: "Enviar email de acesso ao cliente",
} as const

export type StaffAccessLevel = "Administrador" | "Operacional" | "Comercial / Suporte"
export type PermissionContext = { role: string | null; permissions: readonly string[]; user?: { email?: string | null } }

export const PERMISSION_GROUPS: readonly { title: string; items: readonly { id: string; title: string; description: string }[] }[] = [
  { title: "Operação", items: [
    { id: PERMISSIONS.shipments, title: "Envios, guias e tracking", description: "Criar e acompanhar envios CTT e Correos, consultar tracking e pontos pickup." },
    { id: PERMISSIONS.pickups, title: "Recolhas e distribuição", description: "Agendar recolhas e gerir a distribuição e os pontos pickup." },
    { id: PERMISSIONS.support, title: "Incidências e apoio operacional", description: "Acompanhar envios e tracking, tratar incidências e comunicar com os clientes." },
  ] },
  { title: "Clientes e gestão", items: [
    { id: PERMISSIONS.clients, title: "Clientes, destinatários e contratos", description: "Gerir contas de clientes, destinatários, serviços e tabelas de preço; enviar mensagens aos clientes." },
    { id: PERMISSIONS.accessEmail, title: "Enviar email de acesso", description: "Enviar o convite de acesso ao portal do cliente. Não permite alterar credenciais de colaboradores." },
    { id: PERMISSIONS.carriers, title: "Transportadoras e frotas", description: "Gerir fornecedores de transporte e logótipos das transportadoras." },
    { id: PERMISSIONS.reports, title: "Relatórios operacionais", description: "Consultar e exportar os relatórios de operação." },
  ] },
  { title: "Financeiro e áreas reservadas", items: [
    { id: PERMISSIONS.finance, title: "Faturação, contas correntes e tesouraria", description: "Gerir faturas, notas de crédito, extratos, reembolsos e reconciliação. Inclui a configuração de faturação." },
    { id: PERMISSIONS.salaries, title: "Salários e vencimentos", description: "Autorização separada para os serviços de salários; não é incluída pela permissão de faturação. O ecrã de salários não está disponível no menu atual." },
    { id: PERMISSIONS.documents, title: "Documentos internos", description: "Consultar e gerir o arquivo interno reservado. A direção mantém o acesso existente." },
    { id: PERMISSIONS.integrations, title: "Webservices e integrações", description: "Gerir ligações, credenciais e integrações de transportadoras." },
  ] },
] as const

export const AVAILABLE_STAFF_PERMISSIONS: string[] = Object.values(PERMISSIONS)
export const PERMISSION_PRESETS: { id: string; title: string; description: string; accessLevel: StaffAccessLevel; permissions: string[] }[] = [
  { id: "operacao", title: "Operações", description: "Envios, tracking e recolhas.", accessLevel: "Operacional", permissions: [PERMISSIONS.shipments, PERMISSIONS.pickups] },
  { id: "suporte", title: "Comercial e suporte", description: "Clientes, contratos e incidências.", accessLevel: "Comercial / Suporte", permissions: [PERMISSIONS.clients, PERMISSIONS.support, PERMISSIONS.accessEmail] },
  { id: "financeiro", title: "Financeiro", description: "Faturação e relatórios; salários separados.", accessLevel: "Operacional", permissions: [PERMISSIONS.finance, PERMISSIONS.reports] },
  { id: "logistica", title: "Gestão logística", description: "Operação, transportadoras e relatórios.", accessLevel: "Operacional", permissions: [PERMISSIONS.shipments, PERMISSIONS.pickups, PERMISSIONS.carriers, PERMISSIONS.reports] },
]

export function parsePermissions(value: unknown): string[] {
  if (typeof value === "string") {
    try { return parsePermissions(JSON.parse(value)) } catch { return [] }
  }
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((p): p is string => typeof p === "string").flatMap(p =>
    p === "Acesso Operacional" ? [PERMISSIONS.shipments, PERMISSIONS.pickups] : [p],
  ))]
}

export function hasPermission(ctx: PermissionContext | null | undefined, permission: string) {
  return !!ctx && (ctx.role === "admin" || ctx.role === "employee" && (
    ctx.permissions?.includes(PERMISSIONS.all) || parsePermissions(ctx.permissions).includes(permission)
  ))
}

export function hasClientAccessEmailGrant(ctx: PermissionContext | null | undefined) {
  return hasPermission(ctx, PERMISSIONS.accessEmail) || ctx?.role === "employee"
    && ["clientes@linke.pt", "aldara.linke@gmail.com"].includes(ctx.user?.email?.trim().toLowerCase() || "")
}

export function isStaffAccessLevel(value: unknown): value is StaffAccessLevel {
  return ["Administrador", "Operacional", "Comercial / Suporte"].includes(String(value))
}

export function validateStaffAccess(level: unknown, permissions: unknown) {
  if (!isStaffAccessLevel(level)) throw new Error("Selecione um perfil de acesso válido.")
  if (!Array.isArray(permissions) || permissions.some(p => typeof p !== "string" || !AVAILABLE_STAFF_PERMISSIONS.includes(p))) {
    throw new Error("Existem permissões desconhecidas. Reveja os módulos selecionados.")
  }
  if (level !== "Administrador" && permissions.includes(PERMISSIONS.all)) {
    throw new Error("O acesso total exige o perfil Administrador.")
  }
  return level === "Administrador" ? [...AVAILABLE_STAFF_PERMISSIONS] : parsePermissions(permissions)
}

// Most specific paths first. Every OPS page must have an explicit mapping.
export const OPS_ACCESS_RULES: { path: string; permissions?: readonly string[]; adminOnly?: boolean; special?: "documents" | "messages" }[] = [
  { path: "/ops/entidades/colaboradores", adminOnly: true },
  { path: "/ops/configuracao/permissoes", adminOnly: true },
  { path: "/ops/configuracao/faturacao", permissions: [PERMISSIONS.finance] },
  { path: "/ops/configuracao/servicos", permissions: [PERMISSIONS.clients, PERMISSIONS.finance] },
  { path: "/ops/configuracao/precos", permissions: [PERMISSIONS.clients, PERMISSIONS.finance] },
  { path: "/ops/configuracao/taxas", permissions: [PERMISSIONS.clients, PERMISSIONS.finance] },
  { path: "/ops/configuracao/combustivel", permissions: [PERMISSIONS.clients, PERMISSIONS.finance] },
  { path: "/ops/configuracao/zonas", permissions: [PERMISSIONS.clients, PERMISSIONS.finance] },
  { path: "/ops/configuracao/transportadoras", permissions: [PERMISSIONS.carriers] },
  { path: "/ops/configuracao/webservices", permissions: [PERMISSIONS.integrations] },
  { path: "/ops/configuracao", adminOnly: true },
  { path: "/ops/integracoes", permissions: [PERMISSIONS.integrations] },
  { path: "/ops/tesouraria/salarios", permissions: [PERMISSIONS.salaries] },
  { path: "/ops/tesouraria", permissions: [PERMISSIONS.finance] },
  { path: "/ops/faturacao", permissions: [PERMISSIONS.finance] },
  { path: "/ops/entidades/clientes", permissions: [PERMISSIONS.clients] },
  { path: "/ops/clientes/novo", permissions: [PERMISSIONS.clients] },
  { path: "/ops/clientes", permissions: [PERMISSIONS.clients] },
  { path: "/ops/entidades/destinatarios", permissions: [PERMISSIONS.clients, PERMISSIONS.shipments, PERMISSIONS.support] },
  { path: "/ops/entidades/pontos-pickup", permissions: [PERMISSIONS.shipments, PERMISSIONS.pickups, PERMISSIONS.support] },
  { path: "/ops/entidades/fornecedores", permissions: [PERMISSIONS.carriers] },
  { path: "/ops/entidades", permissions: [PERMISSIONS.clients] },
  { path: "/ops/envios/recolhas", permissions: [PERMISSIONS.pickups] },
  { path: "/ops/envios/novo", permissions: [PERMISSIONS.shipments] },
  { path: "/ops/envios", permissions: [PERMISSIONS.shipments, PERMISSIONS.support] },
  { path: "/ops/tracking", permissions: [PERMISSIONS.shipments, PERMISSIONS.support] },
  { path: "/ops/incidencias", permissions: [PERMISSIONS.support, PERMISSIONS.shipments, PERMISSIONS.pickups] },
  { path: "/ops/relatorios", permissions: [PERMISSIONS.reports] },
  { path: "/ops/documentos", special: "documents" },
  { path: "/ops/mensagens", special: "messages" },
  ...["/ops/perfil", "/ops/chat", "/ops/mail", "/ops/calendario", "/ops/sem-acesso"].map(path => ({ path })),
]

export function canAccessOpsRoute(ctx: PermissionContext | null | undefined, path: string): boolean {
  if (!ctx || !["admin", "employee"].includes(ctx.role || "")) return false
  if (ctx.role === "admin") return true
  if (path === "/ops") return true
  const rule = OPS_ACCESS_RULES.find(rule => path === rule.path || path.startsWith(`${rule.path}/`))
  if (!rule || rule.adminOnly) return false
  if (rule.path === "/ops/entidades/clientes" || rule.path === "/ops/clientes") return hasPermission(ctx, PERMISSIONS.clients) || hasClientAccessEmailGrant(ctx)
  if (rule.special === "documents") return hasPermission(ctx, PERMISSIONS.documents) || ctx.user?.email?.trim().toLowerCase() === "geral@linke.pt"
  if (rule.special === "messages") return [PERMISSIONS.clients, PERMISSIONS.pickups, PERMISSIONS.shipments, PERMISSIONS.support].some(p => hasPermission(ctx, p))
  return !rule.permissions || rule.permissions.some(p => hasPermission(ctx, p))
}
