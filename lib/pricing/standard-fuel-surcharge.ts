import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { validateFuelSurcharge } from "./fuel-surcharge"

export const STANDARD_FUEL_ACTION = "standard_fuel_surcharge"

export async function loadStandardFuelSurcharge(db: SupabaseClient, tenantId: string) {
  if (!tenantId) throw new Error("Empresa não identificada.")
  const { data, error } = await db.from("audit_log").select("id, details, created_at")
    .eq("tenant_id", tenantId).eq("action", STANDARD_FUEL_ACTION)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error("Não foi possível carregar a taxa de combustível standard. Tente novamente.")
  return { fuelSurchargePct: data ? validateFuelSurcharge(data.details?.percentage) : undefined,
    fuelUpdatedAt: data?.created_at as string | undefined }
}
