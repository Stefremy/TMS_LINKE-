import "server-only"
import { redirect } from "next/navigation"
import { requireEmployee } from "./context"
import { canAccessOpsRoute } from "./permissions"

/** Page checks run on every navigation, including when the parent layout is reused. */
export async function requireOpsPageAccess(path: string) {
  const ctx = await requireEmployee()
  if (!canAccessOpsRoute(ctx, path)) redirect("/ops/sem-acesso")
  return ctx
}
