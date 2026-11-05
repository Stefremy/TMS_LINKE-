"use server"

import { requireUser } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { listQuotations, updateQuotation, QUOTATION_PERMISSIONS } from "@/lib/shipments/quotations/server"
import { revalidatePath } from "next/cache"
import { sendClientMessage } from "@/lib/client-messages/server"

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
          body: request.status === "quoted" ? `A proposta ${request.reference} está disponível. Valor do envio (sem IVA): ${request.proposed_price?.toFixed(2)} €.\n${request.response}\nConsulte a área Cotações da sua loja para aceitar e criar o envio, ou recusar.`
            : `A Linke emitiu a guia ${request.tracking_number} pela sua conta Correos. O envio associado ao pedido ${request.reference} já está disponível no histórico.\n${request.response}` })
      } catch { warning = "A alteração foi guardada, mas o aviso na caixa de entrada não foi enviado. O cliente pode consultá-la em Cotações." }
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
