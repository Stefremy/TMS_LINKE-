import type { AuthContext } from "@/lib/auth/context"
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions"

export const QUOTATION_PERMISSIONS = [PERMISSIONS.shipments, PERMISSIONS.clients, PERMISSIONS.support]

export function assertQuotationStaff(ctx: AuthContext) {
  if (!ctx.user?.id || !ctx.tenant_id || !["employee", "admin"].includes(ctx.role || "") ||
    !QUOTATION_PERMISSIONS.some(permission => hasPermission(ctx, permission))) throw new Error("Sem permissão para consultar os pedidos de operações.")
}
