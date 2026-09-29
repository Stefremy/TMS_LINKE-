import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { requireEmployee, getTenantId } from "@/lib/auth/context"

export async function deleteShipment(shipmentId: string) {
  await requireEmployee()

  const supabase = createAdminClient()
  try {
    // 1. Apagar volumes associados
    await supabase.from("packages").delete().eq("shipment_id", shipmentId)

    // 2. Apagar eventos de rastreio
    await supabase.from("tracking_events").delete().eq("shipment_id", shipmentId)

    // 3. Apagar o envio
    const { error } = await supabase.from("shipments").delete().eq("id", shipmentId)
    if (error) {
      console.warn("Aviso ao apagar da tabela shipments:", error.message)
    }

    // 4. Registar na auditoria
    await supabase.from("audit_log").insert({
      tenant_id: (await getTenantId()),
      action: "shipment_deleted",
      details: { deletedShipmentId: shipmentId, deletedAt: new Date().toISOString() }
    })

    revalidatePath("/ops/envios")
    revalidatePath("/app/envios")
    revalidatePath("/ops")
    revalidatePath("/app")

    return { success: true }
  } catch (err: any) {
    console.error("Erro ao eliminar envio:", err)
    return { success: false, error: err?.message || "Erro desconhecido ao eliminar envio" }
  }
}

export async function deleteShipmentsBulk(shipmentIds: string[]) {
  await requireEmployee()

  const supabase = createAdminClient()
  try {
    if (!shipmentIds || shipmentIds.length === 0) return { success: true }
    
    // 1. Apagar volumes associados
    await supabase.from("packages").delete().in("shipment_id", shipmentIds)

    // 2. Apagar eventos de rastreio
    await supabase.from("tracking_events").delete().in("shipment_id", shipmentIds)

    // 3. Apagar os envios
    const { error } = await supabase.from("shipments").delete().in("id", shipmentIds)
    if (error) {
      throw new Error(error.message)
    }

    // 4. Registar na auditoria
    await supabase.from("audit_log").insert({
      tenant_id: (await getTenantId()),
      action: "shipments_bulk_deleted",
      details: { deletedShipmentIds: shipmentIds, count: shipmentIds.length, deletedAt: new Date().toISOString() }
    })

    revalidatePath("/ops/envios")
    revalidatePath("/app/envios")
    revalidatePath("/ops")
    revalidatePath("/app")

    return { success: true, count: shipmentIds.length }
  } catch (err: any) {
    console.error("Erro ao eliminar envios em massa:", err)
    return { success: false, error: err?.message || "Erro desconhecido ao eliminar envios" }
  }
}
