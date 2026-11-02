"use server"

import { revalidatePath } from "next/cache"
import { requireEmployee } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { validateStandardSpecialFees } from "@/lib/pricing/special-fees"
import { loadStandardSpecialFees, STANDARD_SPECIAL_FEES_ACTION } from "@/lib/pricing/standard-special-fees"

export async function getStandardSpecialFeesAction() {
  const ctx = await requireEmployee()
  return loadStandardSpecialFees(createAdminClient(), ctx.tenant_id)
}

export async function saveStandardSpecialFeesAction(input: unknown) {
  const ctx = await requireEmployee([PERMISSIONS.clients, PERMISSIONS.finance])
  try {
    const fees = validateStandardSpecialFees(input)
    const now = new Date().toISOString()
    const { error } = await createAdminClient().from("audit_log").insert({
      tenant_id: ctx.tenant_id, action: STANDARD_SPECIAL_FEES_ACTION,
      details: { fees, updated_by_user_id: ctx.user.id }, created_at: now,
    })
    if (error) throw new Error("Não foi possível guardar as taxas standard.")
    revalidatePath("/ops/configuracao/taxas")
    revalidatePath("/ops/entidades/clientes")
    revalidatePath("/ops/envios/novo")
    revalidatePath("/app", "layout")
    return { success: true as const, fees, updatedAt: now }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível guardar as taxas standard." }
  }
}
