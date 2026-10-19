import "server-only"
import { requireEmployee } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { getClientesAction } from "@/app/actions/clientes"
import { normalizeBillingStatistics, type BillingLog, type BillingStatsCycle } from "./statistics"

export async function loadBillingStatistics() {
  const ctx = await requireEmployee()
  if (!ctx.tenant_id) throw new Error("Conta sem empresa associada.")
  const db = createAdminClient()
  const readLogs = async () => {
    const logs: BillingLog[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("audit_log").select("id, action, created_at, details")
        .eq("tenant_id", ctx.tenant_id).in("action", ["billing_statement", "custom_invoice"])
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 999)
      if (error || !data) throw new Error("Não foi possível carregar os documentos de faturação.")
      logs.push(...data as BillingLog[])
      if (data.length < 1000) return logs
    }
  }
  const readCycles = async () => {
    const cycles: BillingStatsCycle[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("recurring_statement_cycles").select("invoice_document_id, invoice_payload")
        .eq("tenant_id", ctx.tenant_id).order("id").range(offset, offset + 999)
      if (error || !data) return { cycles: [] as BillingStatsCycle[], unavailable: true }
      cycles.push(...data as BillingStatsCycle[])
      if (data.length < 1000) return { cycles, unavailable: false }
    }
  }
  const [logs, clients, cycleData] = await Promise.all([readLogs(), getClientesAction(), readCycles()])
  return { ...normalizeBillingStatistics(logs, clients, cycleData.cycles), cyclesUnavailable: cycleData.unavailable }
}
