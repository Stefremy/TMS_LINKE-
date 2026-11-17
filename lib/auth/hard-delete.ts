import type { AuthContext } from "@/lib/auth/context"

// Eliminação definitiva de envios (limpeza de testes): reservada ao Stefano.
const HARD_DELETE_EMAILS = ["stefano.remy@gmail.com"]
const HARD_DELETE_COLABORADOR_IDS = ["col-stefano-001"]

export function canHardDeleteShipments(
  ctx: Pick<AuthContext, "role" | "user" | "colaborador_id"> | null | undefined
): boolean {
  if (!ctx || !ctx.role || ctx.role === "client") return false
  const email = String(ctx.user?.email || "").trim().toLowerCase()
  return HARD_DELETE_EMAILS.includes(email) || HARD_DELETE_COLABORADOR_IDS.includes(String(ctx.colaborador_id || ""))
}
