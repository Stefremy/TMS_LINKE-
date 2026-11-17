
import { errorMessage } from "@/lib/errors"
import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { requireEmployee } from "@/lib/auth/context"
import { canHardDeleteShipments } from "@/lib/auth/hard-delete"

// Never sent to a carrier or already voided — safe to remove.
const DELETABLE_STATUSES = ["pendente", "cancelado", "rascunho", "anulado"]
// Envios anulados ficam com status "cancelado" (o enum shipment_status não tem "anulado"); a UI mostra "Anulado".

export async function deleteShipment(shipmentId: string) {
  const ctx = await requireEmployee("Emissão e Controlo de Guias CTT")

  const supabase = createAdminClient()
  try {
    // 0. Verificar se o envio pode ser apagado
    const { data: shipment } = await supabase
      .from("shipments")
      .select("status, billing_statement_id")
      .eq("id", shipmentId)
      .eq("tenant_id", ctx.tenant_id)
      .maybeSingle()

    if (!shipment) return { success: false, error: "Envio não encontrado" }

    // Bloquear eliminação se o envio já foi faturado
    if (shipment.billing_statement_id) {
      return { success: false, error: "Erro: Este envio já foi faturado e não pode ser anulado." }
    }

    if (!DELETABLE_STATUSES.includes(shipment.status)) {
      return { success: false, error: "Apenas envios pendentes, cancelados ou em rascunho podem ser anulados." }
    }

    // Já anulado: nada a fazer
    if (shipment.status === "cancelado" || shipment.status === "anulado") return { success: true }

    // Anular (soft delete): o envio mantém-se em Envios com estado "Anulado",
    // com volumes e histórico preservados. O cliente deixa de poder imprimir etiquetas.
    const { error } = await supabase
      .from("shipments")
      .update({ status: "cancelado", updated_at: new Date().toISOString() })
      .eq("id", shipmentId)
      .eq("tenant_id", ctx.tenant_id)
    if (error) throw new Error(error.message)

    await supabase.from("audit_log").insert({
      tenant_id: ctx.tenant_id,
      action: "shipment_voided",
      details: { shipmentId, previousStatus: shipment.status, voidedAt: new Date().toISOString() }
    })

    revalidatePath("/ops/envios")
    revalidatePath("/app/[storeSlug]/envios", "page")
    revalidatePath("/ops")
    revalidatePath("/app", "layout")

    return { success: true }
  } catch (err) {
    console.error("Erro ao eliminar envio:", err)
    return { success: false, error: errorMessage(err) || "Erro desconhecido ao eliminar envio" }
  }
}

export async function deleteShipmentsBulk(shipmentIds: string[]) {
  const ctx = await requireEmployee("Emissão e Controlo de Guias CTT")

  const supabase = createAdminClient()
  try {
    if (!shipmentIds || shipmentIds.length === 0) return { success: true }
    
    // 0. Filter to only allow unbilled 'pendente' or 'cancelado' shipments
    const { data: shipments } = await supabase
      .from("shipments")
      .select("id, status, billing_statement_id")
      .eq("tenant_id", ctx.tenant_id)
      .in("id", shipmentIds)

    if (!shipments) return { success: false, error: "Envios não encontrados" }

    const billedShipments = shipments.filter((s) => Boolean(s.billing_statement_id))
    if (billedShipments.length > 0) {
      return { 
        success: false, 
        error: `Erro: ${billedShipments.length} envio(s) selecionado(s) já foram faturados e não podem ser anulados.` 
      }
    }
    
    const validIds = shipments
      .filter((s) => DELETABLE_STATUSES.includes(s.status) && !["cancelado", "anulado"].includes(s.status) && !s.billing_statement_id)
      .map((s) => s.id)

    if (validIds.length === 0) {
      return { success: false, error: "Nenhum dos envios selecionados pode ser anulado (apenas pendentes, cancelados ou rascunhos não faturados)." }
    }

    // Anular (soft delete): mantêm-se em Envios com estado "Anulado"
    const { error } = await supabase
      .from("shipments")
      .update({ status: "cancelado", updated_at: new Date().toISOString() })
      .in("id", validIds)
      .eq("tenant_id", ctx.tenant_id)
    if (error) {
      throw new Error(error.message)
    }

    await supabase.from("audit_log").insert({
      tenant_id: ctx.tenant_id,
      action: "shipments_bulk_voided",
      details: { shipmentIds: validIds, count: validIds.length, voidedAt: new Date().toISOString() }
    })

    revalidatePath("/ops/envios")
    revalidatePath("/app/[storeSlug]/envios", "page")
    revalidatePath("/ops")
    revalidatePath("/app", "layout")

    return { success: true, count: validIds.length }
  } catch (err) {
    console.error("Erro ao eliminar envios em massa:", err)
    return { success: false, error: errorMessage(err) || "Erro desconhecido ao eliminar envios" }
  }
}

/** Eliminação definitiva (apaga envio, volumes e rastreio). Apenas para limpeza de testes por contas autorizadas. */
export async function hardDeleteShipment(shipmentId: string) {
  const ctx = await requireEmployee()
  if (!canHardDeleteShipments(ctx)) return { success: false, error: "Sem permissão para eliminar definitivamente." }

  const supabase = createAdminClient()
  try {
    const { data: shipment } = await supabase
      .from("shipments")
      .select("id, status, billing_statement_id, tracking_number")
      .eq("id", shipmentId)
      .eq("tenant_id", ctx.tenant_id)
      .maybeSingle()

    if (!shipment) return { success: false, error: "Envio não encontrado" }
    if (shipment.billing_statement_id) {
      return { success: false, error: "Este envio já foi faturado e não pode ser eliminado." }
    }

    await supabase.from("packages").delete().eq("shipment_id", shipmentId)
    await supabase.from("tracking_events").delete().eq("shipment_id", shipmentId)
    const { error } = await supabase.from("shipments").delete().eq("id", shipmentId).eq("tenant_id", ctx.tenant_id)
    if (error) throw new Error(error.message)

    await supabase.from("audit_log").insert({
      tenant_id: ctx.tenant_id,
      action: "shipment_hard_deleted",
      details: { deletedShipmentId: shipmentId, trackingNumber: shipment.tracking_number, previousStatus: shipment.status, deletedBy: ctx.user.email, deletedAt: new Date().toISOString() }
    })

    revalidatePath("/ops/envios")
    revalidatePath("/app/[storeSlug]/envios", "page")
    revalidatePath("/ops")
    revalidatePath("/app", "layout")
    return { success: true }
  } catch (err) {
    console.error("Erro ao eliminar envio definitivamente:", err)
    return { success: false, error: errorMessage(err) || "Erro desconhecido ao eliminar envio" }
  }
}
