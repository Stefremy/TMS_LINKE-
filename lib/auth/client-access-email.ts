import type { AuthContext } from "./context"
import { hasClientAccessEmailGrant } from "./permissions"

export const CLIENT_ACCESS_EMAIL_PERMISSION = "Enviar email de acesso ao cliente"

export function canSendClientAccessEmail(ctx: AuthContext | null | undefined): boolean {
  return hasClientAccessEmailGrant(ctx)
}
