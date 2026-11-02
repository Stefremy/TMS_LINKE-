import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_STANDARD_SPECIAL_FEES } from "./special-fee-catalogue"
import { validateStandardSpecialFees } from "./special-fees"
import { loadStandardFuelSurcharge } from "./standard-fuel-surcharge"

export const STANDARD_SPECIAL_FEES_ACTION = "standard_special_services_fees"

export async function loadStandardSpecialFees(db: SupabaseClient, tenantId: string) {
  if (!tenantId) throw new Error("Empresa não identificada.")
  const [{ data, error }, fuel] = await Promise.all([db.from("audit_log").select("id, details, created_at")
    .eq("tenant_id", tenantId).eq("action", STANDARD_SPECIAL_FEES_ACTION)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle(),
    loadStandardFuelSurcharge(db, tenantId)])
  if (error) throw new Error("Não foi possível carregar as taxas standard. Tente novamente.")
  return { ...fuel, fees: data ? validateStandardSpecialFees(data.details?.fees, true) : DEFAULT_STANDARD_SPECIAL_FEES.map(fee => ({ ...fee })),
    updatedAt: data?.created_at as string | undefined }
}
