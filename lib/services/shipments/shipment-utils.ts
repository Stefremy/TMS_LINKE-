export const isValidUuid = (val?: string): boolean => {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val))
}

/**
 * Helper to identify Correos Express shipments
 */
export function isCorreosShipment(s: any): boolean {
  if (!s) return false
  if (s.carrier_code === "correos" || s.carrier_code === "correos_express") return true
  const srv = typeof s.service_type === "string" ? s.service_type.toLowerCase() : ""
  const srvName = typeof s.serviceName === "string" ? s.serviceName.toLowerCase() : ""
  if (srv.includes("correos") || srvName.includes("correos")) return true
  const cTrk = typeof s.carrier_tracking_number === "string" ? s.carrier_tracking_number.trim() : ""
  if (/^\d{16}$/.test(cTrk)) return true
  const trk = typeof s.tracking_number === "string" ? s.tracking_number.trim() : ""
  if (/^\d{16}$/.test(trk)) return true
  return false
}

/**
 * Garante e formata um número de objeto CTT Expresso realista e determinístico
 */
export function formatOrGenerateCttObjectId(s: any): string {
  // Se for Correos Express, NÃO gerar código CTT!
  if (isCorreosShipment(s)) {
    return s?.carrier_tracking_number?.trim() || s?.carrier_object_id?.trim() || ""
  }

  if (s?.carrier_tracking_number && /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i.test(s.carrier_tracking_number.trim())) {
    return s.carrier_tracking_number.trim().toUpperCase()
  }

  if (s?.ctt_object_id && /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i.test(s.ctt_object_id.trim())) {
    return s.ctt_object_id.trim().toUpperCase()
  }

  if (s?.tracking_number && /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i.test(s.tracking_number.trim())) {
    return s.tracking_number.trim().toUpperCase()
  }

  return s?.ctt_object_id?.trim() || s?.carrier_tracking_number?.trim() || s?.tracking_number?.trim() || ""
}

import { getTenantId } from "@/lib/auth/context"

/**
 * Ensures that the tenant and the client exist in their respective database tables
 * so that foreign key constraints on the `shipments` table are always satisfied.
 */
export async function ensureTenantAndClient(supabase: any, clientId?: string | null, clientName?: string): Promise<string> {
  if (!clientId || !isValidUuid(clientId)) {
    throw new Error("Client ID is required and must be a valid UUID.")
  }
  let targetClientId = clientId as string

  try {
    // 1. Ensure tenant exists
    await supabase.from("tenants").upsert({
      id: (await getTenantId()),
      name: "Linke Logistics"
    }, { onConflict: "id" })
  } catch (e: any) {
    console.warn("Tenant check warning:", e?.message)
  }

  try {
    // 2. Ensure client exists without overwriting existing client records unnecessarily
    await supabase.from("clients").upsert({
      id: targetClientId,
      tenant_id: (await getTenantId()),
      name: clientName || "Cliente"
    }, { onConflict: "id", ignoreDuplicates: true })
  } catch (e: any) {
    console.warn("Client check warning:", e?.message)
  }

  return targetClientId
}
