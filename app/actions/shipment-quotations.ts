"use server"

import { requireEmployee, requireUser } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { listQuotations, updateQuotation, QUOTATION_PERMISSIONS } from "@/lib/shipments/quotations/server"
import { revalidatePath } from "next/cache"
import { sendClientMessage } from "@/lib/client-messages/server"
import { countUnreadQuotations, markQuotationRead } from "@/lib/shipments/quotations/reads"
import { partnerTrackingUrl } from "@/lib/shipments/quotations/tracking"
import { notifyQuotationTracking } from "@/lib/shipments/quotations/tracking-notification"

export async function getUnreadShipmentQuotationsAction() {
  const ctx = await requireEmployee(QUOTATION_PERMISSIONS)
  return countUnreadQuotations(createAdminClient(), ctx)
}

export async function markShipmentQuotationReadAction(id: string) {
  const ctx = await requireEmployee(QUOTATION_PERMISSIONS)
  return { count: await markQuotationRead(createAdminClient(), ctx, id) }
}

export async function getShipmentQuotationsAction(clientId?: string, cursor?: { at: string; id: string }, clientView = false) {
  const ctx = await requireUser(QUOTATION_PERMISSIONS)
  if (clientView && !clientId) throw new Error("Selecione a loja para consultar as cotações.")
  const viewer = clientView && ctx.role !== "client" ? { ...ctx, role: "client" as const, client_id: clientId! } : ctx
  return listQuotations(createAdminClient(), viewer, clientId, cursor)
}

export async function updateShipmentQuotationAction(id: string, revision: number, update: unknown) {
  const ctx = await requireUser(QUOTATION_PERMISSIONS)
  try {
    const request = await updateQuotation(createAdminClient(), ctx, id, revision, update)
    let warning = ""
    if (ctx.role !== "client" && ["quoted", "completed"].includes(request.status)) {
      try {
        await sendClientMessage(createAdminClient(), ctx, { clientId: request.client_id, requestId: crypto.randomUUID(),
          title: `${request.status === "quoted" ? "Proposta disponível" : "Guia emitida no parceiro"} — ${request.reference}`,
          body: request.status === "quoted" ? `A proposta ${request.reference} está disponível. Valor do envio (sem IVA): ${request.proposed_price?.toFixed(2)} €.\n${request.response}\nAbra Pedido de envio internacional aéreo no menu lateral e consulte Pedidos e propostas para aceitar e criar o envio, ou recusar.`
            : `A Linke registou o envio do pedido ${request.reference}, emitido pela sua conta Correos. Tracking ${request.tracking_carrier === "fedex" ? "FedEx" : "Correos"}: ${request.tracking_number}.\n${partnerTrackingUrl(request) || "O envio já está disponível no histórico da loja."}\n${request.response}` })
      } catch { warning = "A alteração foi guardada, mas o aviso na caixa de entrada não foi enviado. O cliente pode consultá-la em Pedido de envio internacional aéreo no menu lateral." }
    }
    if (ctx.role !== "client" && request.status === "completed") {
      try { await notifyQuotationTracking(createAdminClient(), ctx.tenant_id, request) }
      catch { warning = [warning, "O envio foi registado, mas não foi possível enviar o email de tracking ao cliente."].filter(Boolean).join(" ") }
    }
    revalidatePath("/ops/envios/cotacoes")
    revalidatePath("/app/[storeSlug]/cotacoes", "page")
    revalidatePath("/ops/envios")
    revalidatePath("/app/[storeSlug]/envios", "page")
    revalidatePath("/ops/faturacao/contas-corrente")
    return { success: true as const, request, warning }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível atualizar a cotação." }
  }
}
