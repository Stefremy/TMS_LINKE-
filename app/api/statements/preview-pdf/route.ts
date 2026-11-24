import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { getClientesAction } from "@/app/actions/clientes"
import { getClientBillingAddress, invoiceRecipient } from "@/lib/client-addresses"
import { financialPdfResponse } from "@/lib/services/billing/document-access"
import { generateStatementPdfBuffer, type BillingStatementPdfShipment } from "@/lib/services/billing/statement-pdf"
import { hydrateShipmentCharges } from "@/lib/services/billing/shipment-charge-snapshots"
import { SHIPMENT_LIST_COLUMNS } from "@/lib/services/shipments/shipment-fetcher"
import { canInvoiceShipment } from "@/lib/billing/shipment-eligibility"
import { isPrepaidShipment } from "@/lib/billing/client-balance"
import { lisbonDate } from "@/lib/billing/recurring-periods"

export const dynamic = "force-dynamic"

const FINANCE_PERMISSION = "Faturação & Contas Correntes"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Internal detailed statement for shipments not yet invoiced. Read-only: nothing is saved,
 * no statement number is reserved and nothing is sent to Moloni.
 * Same scope and eligibility rules as invoice emission.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx?.user || !ctx.tenant_id) return financialPdfResponse("Sem acesso", { status: 403 })
    const staff = ctx.role === "admin" || (ctx.role === "employee" &&
      (ctx.permissions.includes(FINANCE_PERMISSION) || ctx.permissions.includes("Acesso Total (Super-Admin)")))
    if (!staff) return financialPdfResponse("Sem acesso", { status: 403 })

    const clientId = request.nextUrl.searchParams.get("client") || ""
    const ids = [...new Set((request.nextUrl.searchParams.get("ids") || "").split(",").filter(Boolean))]
    if (!UUID.test(clientId) || !ids.length || ids.length > 1000 || ids.some(id => !UUID.test(id))) {
      return financialPdfResponse("Seleção inválida", { status: 400 })
    }

    const supabase = createAdminClient()
    const client = (await getClientesAction(clientId)).find(c => c.id === clientId)
    if (!client) return financialPdfResponse("Cliente não encontrado", { status: 404 })
    const { data: rows, error } = await supabase.from("shipments").select(SHIPMENT_LIST_COLUMNS)
      .eq("tenant_id", ctx.tenant_id).eq("client_id", clientId).in("id", ids)
    if (error || rows?.length !== ids.length) return financialPdfResponse("Envios não encontrados neste cliente", { status: 404 })
    if (rows.some(s => !canInvoiceShipment(s) || isPrepaidShipment(client, s))) {
      return financialPdfResponse("A seleção inclui envios que não podem ser faturados", { status: 422 })
    }
    const shipments = await hydrateShipmentCharges(supabase, ctx.tenant_id, clientId, rows)
    shipments.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")))

    const recipient = invoiceRecipient(client)
    const address = getClientBillingAddress(client)
    const pdf = await generateStatementPdfBuffer({
      statementNumber: `PREVIA-${lisbonDate()}`,
      clientName: recipient.name || client.legal_name || client.short_name || "Cliente TMS",
      clientNif: recipient.nif,
      clientAddress: address.address,
      clientCity: address.city,
      clientEmail: client.billing_email || client.email || "",
      dateStr: new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" }),
      totalValue: Number(shipments.reduce((sum, s) => sum + Number(s.sell_price || 0), 0).toFixed(2)),
      shipments: shipments as unknown as BillingStatementPdfShipment[],
      draft: true,
    })
    const name = (client.short_name || client.legal_name || "cliente").replace(/[^\w-]+/g, "_")
    return financialPdfResponse(new Uint8Array(pdf), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Extrato_Previo_${name}.pdf"` },
    })
  } catch {
    console.error("Erro ao gerar pré-visualização do extrato")
    return financialPdfResponse("Erro ao processar PDF", { status: 500 })
  }
}
