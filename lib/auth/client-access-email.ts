import type { AuthContext } from "./context"

export const CLIENT_ACCESS_EMAIL_PERMISSION = "Enviar email de acesso ao cliente"

export function canSendClientAccessEmail(ctx: AuthContext | null | undefined): boolean {
  if (!ctx) return false
  if (ctx.role === "admin") return true
  return ctx.role === "employee" && (
    ctx.permissions?.includes(CLIENT_ACCESS_EMAIL_PERMISSION) ||
    ["clientes@linke.pt", "aldara.linke@gmail.com"].includes(ctx.user?.email?.trim().toLowerCase() || "")
  )
}
