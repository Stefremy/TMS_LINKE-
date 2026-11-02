import type { AuthContext } from "@/lib/auth/context"
import { hasPermission, PERMISSIONS } from "./permissions"

const DIRECTOR_EMAIL = "geral@linke.pt"

export function canAccessStaffDocuments(context: AuthContext | null | undefined) {
  if (!context || (context.role !== "employee" && context.role !== "admin")) return false
  return hasPermission(context, PERMISSIONS.documents) || context.user?.email?.toLowerCase().trim() === DIRECTOR_EMAIL
}

