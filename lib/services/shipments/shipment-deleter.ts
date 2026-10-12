import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { requireEmployee, getTenantId } from "@/lib/auth/context"

export async function deleteShipment(shipmentId: string) {
  await requireEmployee()

  const supabase = createAdminClient()
  try {
    // 0. Verificar se o envio pode ser apagado
    const { data: shipment } = await supabase
      .from("shipments")
      .select("status, billing_statement_id")
      .eq("id", shipmentId)
      .single()

    if (!shipment) return { success: false, error: "Envio não encontrado" }

    // Bloquear eliminação se o envio já foi faturado
    if (shipment.billing_statement_id) {
      return { success: false, error: "Erro: Este envio já foi faturado e não pode ser eliminado." }
    }

    if (shipment.status !== "pendente" && shipment.status !== "cancelado") {
      return { success: false, error: "Apenas envios pendentes podem ser eliminados." }
    }

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
    
    // 0. Filter to only allow unbilled 'pendente' or 'cancelado' shipments
    const { data: shipments } = await supabase
      .from("shipments")
      .select("id, status, billing_statement_id")
      .in("id", shipmentIds)

    if (!shipments) return { success: false, error: "Envios não encontrados" }

    const billedShipments = shipments.filter((s: any) => Boolean(s.billing_statement_id))
    if (billedShipments.length > 0) {
      return { 
        success: false, 
        error: `Erro: ${billedShipments.length} envio(s) selecionado(s) já foram faturados e não podem ser eliminados.` 
      }
    }
    
    const validIds = shipments
      .filter((s: any) => (s.status === "pendente" || s.status === "cancelado") && !s.billing_statement_id)
      .map((s: any) => s.id)

    if (validIds.length === 0) {
      return { success: false, error: "Nenhum dos envios selecionados pode ser eliminado (apenas pendentes e não faturados)." }
    }

    // 1. Apagar volumes associados
    await supabase.from("packages").delete().in("shipment_id", validIds)

    // 2. Apagar eventos de rastreio
    await supabase.from("tracking_events").delete().in("shipment_id", validIds)

    // 3. Apagar os envios
    const { error } = await supabase.from("shipments").delete().in("id", validIds)
    if (error) {
      throw new Error(error.message)
    }

    // 4. Registar na auditoria
    await supabase.from("audit_log").insert({
      tenant_id: (await getTenantId()),
      action: "shipments_bulk_deleted",
      details: { deletedShipmentIds: validIds, count: validIds.length, deletedAt: new Date().toISOString() }
    })

    revalidatePath("/ops/envios")
    revalidatePath("/app/envios")
    revalidatePath("/ops")
    revalidatePath("/app")

    return { success: true, count: validIds.length }
  } catch (err: any) {
    console.error("Erro ao eliminar envios em massa:", err)
    return { success: false, error: err?.message || "Erro desconhecido ao eliminar envios" }
  }
}
