"use server"

import fs from "fs"
import path from "path"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { requireUser, getTenantId } from "@/lib/auth/context"
import { parseCttReembolsoFile } from "@/lib/services/reembolsos/ctt-reembolso-parser"
import { reconcileReembolsoItems } from "@/lib/services/reembolsos/reembolso-reconciler"
import type { ReembolsoBatch } from "@/lib/services/reembolsos/types"

/**
 * Processes an uploaded COD settlement file (CTT or Correos),
 * reconciles with shipments in DB, and stores the batch record.
 */
export async function processReembolsoUploadAction(
  fileContent: string,
  filename: string,
  carrier: "ctt" | "correos" = "ctt"
): Promise<{ success: boolean; batch?: ReembolsoBatch; error?: string }> {
  try {
    await requireUser()
    const supabase = createAdminClient()
    const tenantId = await getTenantId()

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
    })

    // 3. Persist the batch in audit_log
    const { error: insErr } = await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      action: "reembolso_batch",
      details: batch,
    })

    if (insErr) {
      console.warn("Could not save reembolso batch in audit_log:", insErr.message)
    }

    revalidatePath("/ops/tesouraria/reembolsos")

    return { success: true, batch }
  } catch (err: any) {
    console.error("processReembolsoUploadAction error:", err)
    return { success: false, error: err?.message || "Erro desconhecido ao processar ficheiro." }
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
  try {
    const filePath = path.join(process.cwd(), "public", "CTTE99001554332026.XLS")
    if (!fs.existsSync(filePath)) {
      return { success: false, error: "Ficheiro de exemplo não encontrado em public/CTTE99001554332026.XLS" }
    }

    const content = fs.readFileSync(filePath, "utf8")
    return await processReembolsoUploadAction(content, "CTTE99001554332026.XLS", "ctt")
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao carregar ficheiro de exemplo." }
  }
}

/**
 * Fetches all past reconciliation batches.
 */
export async function getReembolsoBatchesAction(): Promise<ReembolsoBatch[]> {
  try {
    await requireUser()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("audit_log")
      .select("id, details, created_at")
      .eq("action", "reembolso_batch")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error || !data) return []

    return data
      .map((d: any) => {
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
  try {
    await requireUser()
    const supabase = createAdminClient()

    const { data: record, error: fetchErr } = await supabase
      .from("audit_log")
      .select("details")
      .eq("id", batchId)
      .single()

    if (fetchErr || !record?.details) {
      return { success: false, error: "Lote de reconciliação não encontrado." }
    }

    const batch = record.details as ReembolsoBatch
    const summary = batch.clientSummaries?.find((c) => c.clientId === clientId)

    if (summary) {
      summary.isPaid = isPaid
      summary.paidAt = isPaid ? new Date().toISOString() : undefined
      summary.paymentRef = isPaid ? paymentRef || "Transferência Bancária" : undefined
    }

    const { error: updateErr } = await supabase
      .from("audit_log")
      .update({ details: batch })
      .eq("id", batchId)

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }

    revalidatePath("/ops/tesouraria/reembolsos")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao atualizar estado do reembolso." }
  }
}

/**
 * Deletes a reconciliation batch from history.
 */
export async function deleteReembolsoBatchAction(batchId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireUser()
    const supabase = createAdminClient()

    const { error } = await supabase.from("audit_log").delete().eq("id", batchId)

    if (error) return { success: false, error: error.message }

    revalidatePath("/ops/tesouraria/reembolsos")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao apagar lote." }
  }
}
