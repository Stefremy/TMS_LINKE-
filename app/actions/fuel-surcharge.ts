"use server"

import { revalidatePath } from "next/cache"
import { requireEmployee } from "@/lib/auth/context"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { createAdminClient } from "@/lib/supabase/server"
import { validateFuelSurcharge } from "@/lib/pricing/fuel-surcharge"
import { loadStandardFuelSurcharge, STANDARD_FUEL_ACTION } from "@/lib/pricing/standard-fuel-surcharge"

export async function getStandardFuelSurchargeAction() {
  const ctx = await requireEmployee()
  return loadStandardFuelSurcharge(createAdminClient(), ctx.tenant_id)
}

export async function saveStandardFuelSurchargeAction(input: unknown) {
  const ctx = await requireEmployee([PERMISSIONS.clients, PERMISSIONS.finance])
  try {
    const fuelSurchargePct = validateFuelSurcharge(input)
    const fuelUpdatedAt = new Date().toISOString()
    const { error } = await createAdminClient().from("audit_log").insert({
      tenant_id: ctx.tenant_id, action: STANDARD_FUEL_ACTION, created_at: fuelUpdatedAt,
      details: { percentage: fuelSurchargePct, updated_by_user_id: ctx.user.id },
    })
    if (error) throw new Error("Não foi possível guardar a taxa de combustível.")
    revalidatePath("/ops/configuracao/combustivel")
    revalidatePath("/ops/entidades/clientes")
    revalidatePath("/ops/envios/novo")
    revalidatePath("/app", "layout")
    return { success: true as const, fuelSurchargePct, fuelUpdatedAt }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível guardar a taxa de combustível." }
  }
}
