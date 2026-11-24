"use server"

import { revalidatePath } from "next/cache"
import { requireEmployee } from "@/lib/auth/context"
import { canHardDeleteShipments } from "@/lib/auth/hard-delete"
import { createAdminClient } from "@/lib/supabase/server"

/**
 * Limpeza de testes: elimina um extrato/fatura de TESTE e os seus envios (deixam de contar em receitas,
 * margens e estatísticas). A base de dados recusa faturas do Moloni de produção e extratos com notas de crédito.
 */
export async function deleteTestStatementAction(statementNumber: string) {
  const ctx = await requireEmployee()
  if (!canHardDeleteShipments(ctx)) return { success: false as const, error: "Sem permissão para eliminar definitivamente." }
  if (typeof statementNumber !== "string" || !statementNumber.trim() || statementNumber.length > 160) {
    return { success: false as const, error: "Extrato inválido." }
  }
  const { data, error } = await createAdminClient().rpc("delete_test_billing_statement", {
    p_tenant: ctx.tenant_id, p_statement_number: statementNumber.trim(), p_actor: ctx.user.email || ctx.user.id,
  })
  if (error) {
    if (error.code === "PGRST202") return { success: false as const, error: "Falta aplicar a migração 20261124150000_delete_test_billing_statement.sql no Supabase." }
    return { success: false as const, error: error.message || "Não foi possível eliminar o extrato." }
  }
  for (const path of ["/ops/faturacao/contas-corrente", "/ops/faturacao/estatistica", "/ops/relatorios", "/ops/envios", "/ops"]) revalidatePath(path)
  revalidatePath("/app", "layout")
  return { success: true as const, shipmentsDeleted: Number(data?.shipments_deleted ?? 0) }
}
