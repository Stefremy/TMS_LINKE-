import type { AuthContext } from "@/lib/auth/context"

const DIRECTOR_EMAIL = "geral@linke.pt"

export function canAccessStaffDocuments(context: AuthContext | null | undefined) {
  if (!context || (context.role !== "employee" && context.role !== "admin")) return false
  return context.role === "admin" || context.user?.email?.toLowerCase().trim() === DIRECTOR_EMAIL
}

