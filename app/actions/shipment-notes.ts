"use server"

import { requireUser } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"

export type ShipmentNotes = { observations: string; reference: string; internalNotes: string[] }

const empty: ShipmentNotes = { observations: "", reference: "", internalNotes: [] }

/** Observações (sent to the carrier), the client's internal Referência and, for staff only, Ops internal notes. */
export async function getShipmentNotesAction(shipmentId: string): Promise<ShipmentNotes> {
  const ctx = await requireUser()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shipmentId || "")) return empty
  const db = createAdminClient()
  let owner = db.from("shipments").select("id").eq("tenant_id", ctx.tenant_id).eq("id", shipmentId)
  if (ctx.role === "client") owner = owner.eq("client_id", ctx.client_id!)
  const { data: shipment } = await owner.maybeSingle()
  if (!shipment) return empty

  const isStaff = ctx.role === "employee" || ctx.role === "admin"
  const [data, reference, ops] = await Promise.all([
    db.from("audit_log").select("details").eq("tenant_id", ctx.tenant_id).eq("action", "shipment_data").eq("details->>id", shipmentId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    // Shipments created before the reference was stored with the shipment data.
    db.from("audit_log").select("details").eq("tenant_id", ctx.tenant_id).eq("action", "shipment_client_reference").eq("details->>shipment_id", shipmentId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    isStaff
      ? db.from("audit_log").select("details").eq("tenant_id", ctx.tenant_id).eq("action", "shipment_ops_notes").eq("details->>shipment_id", shipmentId).order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { details: { notes?: string } }[] }),
  ])
  const details = data.data?.details ?? {}
  return {
    observations: typeof details.observations === "string" ? details.observations : "",
    reference: (typeof details.client_reference === "string" && details.client_reference) || reference.data?.details?.reference || "",
    internalNotes: (ops.data ?? []).map(row => row.details?.notes).filter((note): note is string => typeof note === "string" && !!note.trim()),
  }
}
