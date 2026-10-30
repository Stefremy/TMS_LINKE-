"use server"

import { loadCodPayoutInbox } from "@/lib/services/reembolsos/client-cod-payout"
import fs from "fs"
import path from "path"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/context"
import { parseCttReembolsoFile } from "@/lib/services/reembolsos/ctt-reembolso-parser"
import { reconcileReembolsoItems } from "@/lib/services/reembolsos/reembolso-reconciler"
import type { ReembolsoBatch } from "@/lib/services/reembolsos/types"

async function requireReembolsoAccess() {
  const ctx = await requirePermission("Faturação & Contas Correntes")
  if (!ctx.tenant_id) throw new Error("Acesso negado. Empresa não identificada.")
  return ctx
}

/**
 * Processes an uploaded COD settlement file (CTT or Correos),
 * reconciles with shipments in DB, and stores the batch record.
 */
export async function processReembolsoUploadAction(
  fileContent: string,
  filename: string,
  carrier: "ctt" | "correos" = "ctt"
): Promise<{ success: boolean; batch?: ReembolsoBatch; error?: string }> {
  const ctx = await requireReembolsoAccess()
  try {
    const supabase = createAdminClient()

    // 1. Parse the file
    const parsed = parseCttReembolsoFile(fileContent)

    if (parsed.items.length === 0) {
      return {
        success: false,
        error: "Nenhum objeto ou valor de cobrança encontrado no ficheiro. Verifique o formato do documento.",
      }
    }

    // 2. Reconcile with shipments database
    const batch = await reconcileReembolsoItems(parsed.items, {
      filename,
      carrier,
      carrierAccount: parsed.carrierAccount,
      carrierContract: parsed.carrierContract,
      destinationIban: parsed.destinationIban,
    }, ctx.tenant_id)

    // 3. Persist the batch in audit_log
    const { error: insErr } = await supabase.from("audit_log").insert({
      id: batch.id,
      tenant_id: ctx.tenant_id,
      action: "reembolso_batch",
      details: { ...batch, actor_user_id: ctx.user.id },
    })

    if (insErr) {
      throw insErr
    }

    revalidatePath("/ops/tesouraria/reembolsos")

    return { success: true, batch }
  } catch (err: unknown) {
    console.error("processReembolsoUploadAction error:", err)
    return { success: false, error: "Erro ao processar ou guardar ficheiro. Tente novamente." }
  }
}

/**
 * Loads and processes the sample CTT file from public folder
 * for instant 1-click verification.
 */
export async function loadSampleCttFileAction(): Promise<{
  success: boolean
  batch?: ReembolsoBatch
  error?: string
}> {
  await requireReembolsoAccess()
  try {
    const filePath = path.join(process.cwd(), "public", "CTTE99001554332026.XLS")
    if (!fs.existsSync(filePath)) {
      return { success: false, error: "Ficheiro de exemplo não encontrado em public/CTTE99001554332026.XLS" }
    }

    const content = fs.readFileSync(filePath, "utf8")
    return await processReembolsoUploadAction(content, "CTTE99001554332026.XLS", "ctt")
  } catch {
    return { success: false, error: "Erro ao carregar ficheiro de exemplo." }
  }
}

/**
 * Fetches all past reconciliation batches.
 */
export async function getReembolsoBatchesAction(): Promise<ReembolsoBatch[]> {
  const ctx = await requireReembolsoAccess()
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("audit_log")
      .select("id, details, created_at")
      .eq("tenant_id", ctx.tenant_id)
      .eq("action", "reembolso_batch")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error || !data) return []

    return data
      .map((d: { id: string; details: ReembolsoBatch | null; created_at: string }) => {
        const b = d.details as ReembolsoBatch
        if (!b) return null
        return {
          ...b,
          id: d.id,
          created_at: d.created_at,
        }
      })
      .filter(Boolean) as ReembolsoBatch[]
  } catch (err) {
    console.error("getReembolsoBatchesAction error:", err)
    return []
  }
}

/**
 * Toggles a client's payout status inside a reconciliation batch.
 */
export async function markClientReembolsoPaidAction(
  batchId: string,
  clientId: string,
  isPaid: boolean,
  paymentRef?: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireReembolsoAccess()
  if (typeof batchId !== "string" || !batchId.trim() || typeof clientId !== "string" || !clientId.trim() || typeof isPaid !== "boolean") {
    return { success: false, error: "Pedido inválido." }
  }
  try {
    const supabase = createAdminClient()

    const { data: record, error: fetchErr } = await supabase
      .from("audit_log")
      .select("details")
      .eq("tenant_id", ctx.tenant_id)
      .eq("action", "reembolso_batch")
      .eq("id", batchId)
      .single()

    if (fetchErr || !record?.details) {
      return { success: false, error: "Lote de reconciliação não encontrado." }
    }

    const batch = record.details as ReembolsoBatch
    const summary = batch.clientSummaries?.find((c) => c.clientId === clientId)

    if (!summary) {
      return { success: false, error: "Cliente não encontrado neste lote." }
    }
    if (isPaid) {
      const checked = await reconcileReembolsoItems(batch.items, {filename:batch.filename,carrier:batch.carrier},ctx.tenant_id)
      const confirmed = checked.clientSummaries.find(c=>c.clientId===clientId)
      const ids = (items: typeof summary.items) => items.filter(item=>item.reconcileStatus==='matched').map(item=>item.shipmentId).sort().join('|')
      if (!confirmed || confirmed.totalAmount<=0 || Math.round(confirmed.totalAmount*100)!==Math.round(summary.totalAmount*100) || ids(confirmed.items)!==ids(summary.items)) {
        return {success:false,error:'O lote não está confirmado com as guias e cobranças atuais do TMS. Reveja o cruzamento antes de marcar o pagamento.'}
      }
    }
    summary.isPaid = isPaid
    summary.paidAt = isPaid ? new Date().toISOString() : undefined
    summary.paymentRef = isPaid ? paymentRef || "Transferência Bancária" : undefined

    const { data: updated, error: updateErr } = await supabase
      .from("audit_log")
      .update({ details: { ...batch, updated_by_user_id: ctx.user.id } })
      .eq("tenant_id", ctx.tenant_id)
      .eq("action", "reembolso_batch")
      .eq("id", batchId)
      .select("id")
      .maybeSingle()

    if (updateErr || !updated) {
      return { success: false, error: "Erro ao atualizar estado do reembolso." }
    }

    revalidatePath("/ops/tesouraria/reembolsos")
    return { success: true }
  } catch {
    return { success: false, error: "Erro ao atualizar estado do reembolso." }
  }
}

/**
 * Deletes a reconciliation batch from history.
 */
export async function deleteReembolsoBatchAction(batchId: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireReembolsoAccess()
  if (typeof batchId !== "string" || !batchId.trim()) return { success: false, error: "Pedido inválido." }
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase.from("audit_log").delete()
      .eq("tenant_id", ctx.tenant_id).eq("action", "reembolso_batch").eq("id", batchId)
      .select("id").maybeSingle()

    if (error || !data) return { success: false, error: "Não foi possível apagar o lote." }

    revalidatePath("/ops/tesouraria/reembolsos")
    return { success: true }
  } catch {
    return { success: false, error: "Erro ao apagar lote." }
  }
}

export async function getCodPayoutInboxAction() {
  const ctx = await requireReembolsoAccess()
  return loadCodPayoutInbox(createAdminClient(),ctx.tenant_id)
}

/** Read-only: never rewrite historical payments while checking a legacy platform export. */
export async function previewReembolsoReconciliationAction(batchId:string) {
  const ctx=await requireReembolsoAccess()
  const db=createAdminClient()
  const {data,error}=await db.from('audit_log').select('details').eq('tenant_id',ctx.tenant_id).eq('action','reembolso_batch').eq('id',batchId).single()
  if(error||!data?.details)throw new Error('Lote não encontrado nesta empresa.')
  const batch=data.details as ReembolsoBatch
  const preview=await reconcileReembolsoItems(batch.items,{filename:batch.filename,carrier:batch.carrier,carrierAccount:batch.carrierAccount,carrierContract:batch.carrierContract,destinationIban:batch.destinationIban},ctx.tenant_id)
  return {...preview,id:batchId,created_at:batch.created_at,reconciliationPreview:true,legacyPaidGroups:batch.clientSummaries.filter(c=>c.isPaid).length}
}
