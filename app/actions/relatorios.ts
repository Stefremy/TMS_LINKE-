"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { getClientesAction } from "@/app/actions/clientes"
import { requireEmployee } from "@/lib/auth/context"
import { buildOperationalReport, getReportRange, REPORT_PERIODS } from "@/lib/reports/operational-reports"
import type { OperationalReport, ReportFilters, ReportShipment } from "@/lib/reports/operational-reports"

export type RelatoriosData = OperationalReport

export async function getRelatoriosDataAction(
  periodFilter: string = "este_mes",
  selectedFilters: { clientId?: string; carrier?: string; service?: string } = {},
): Promise<RelatoriosData> {
  const ctx = await requireEmployee()
  if (!ctx.tenant_id) throw new Error("Conta sem empresa associada.")
  const period = REPORT_PERIODS.find(p => p.id === periodFilter)?.id
  if (!period) throw new Error("Período de relatório inválido.")
  if (!selectedFilters || typeof selectedFilters !== "object") throw new Error("Filtros de relatório inválidos.")
  for (const value of Object.values(selectedFilters)) {
    if (value !== undefined && (typeof value !== "string" || value.length > 500)) throw new Error("Filtros de relatório inválidos.")
  }
  const filters: ReportFilters = { period, clientId: selectedFilters.clientId || undefined, carrier: selectedFilters.carrier || undefined, service: selectedFilters.service || undefined }
  const now = new Date()
  const range = getReportRange(period, now)
  const supabase = createAdminClient()
  // Thin projection: no labels, addresses, phone numbers or recipient emails.
  // Stable ordering and pagination avoid silently truncating large reporting periods.
  const loadShipments = async () => {
    const shipments: ReportShipment[] = []
    const pageSize = 500
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabase.from("shipments")
        .select("id,client_id,created_at,status,service_type,carrier_code,buy_price,sell_price")
        .eq("tenant_id", ctx.tenant_id)
        .gte("created_at", range.previousStart).lte("created_at", range.end)
        .order("created_at", { ascending: false }).order("id", { ascending: true })
        .range(offset, offset + pageSize - 1)
      if (result.error || !result.data) throw new Error("Não foi possível carregar os relatórios. Tenta novamente.")
      shipments.push(...result.data)
      if (result.data.length < pageSize) break
    }
    return shipments
  }
  const [shipments, clients] = await Promise.all([loadShipments(), getClientesAction()])
  return buildOperationalReport(shipments, clients, filters, now)
}
