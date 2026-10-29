import { getClientBillingAddress } from "@/lib/client-addresses"
import { NextRequest } from "next/server"
import { loadFinancialDocument, financialPdfResponse } from "@/lib/services/billing/document-access"
import { getClientesAction } from "@/app/actions/clientes"
import { generateProFormaPdfBuffer } from "@/lib/services/billing/proforma-pdf"
import type { BillingStatementPdfShipment } from "@/lib/services/billing/proforma-pdf"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const access = await loadFinancialDocument(resolvedParams.id || "", "billing_statement")
    if (!access) return financialPdfResponse("Documento não encontrado", { status: 404 })
    const { supabase, document: match, ctx } = access

    const details = match.details || {}
    const clients = await getClientesAction(details.client_id)
    const client = clients.find(c => c.id === details.client_id)

    // Tentar obter o service_type da DB se estiver em falta no log
    let enrichedShipments: BillingStatementPdfShipment[] = details.shipments || []
    const shipmentIds = (details.shipment_ids || enrichedShipments.map(s => s.id)).filter(Boolean)
    if (shipmentIds.length > 0) {
      const { data: dbShipments } = await supabase
        .from("shipments")
        .select("id, service_type, sell_price, recipient_name, created_at")
        .eq("tenant_id", ctx.tenant_id)
        .eq("client_id", details.client_id)
        .in("id", shipmentIds)
        
      if (dbShipments && dbShipments.length > 0) {
        enrichedShipments = enrichedShipments.map(s => {
          const dbS = dbShipments.find((d: BillingStatementPdfShipment) => d.id === s.id)
          let base = s.base_price ?? dbS?.base_price ?? null
          let fuel = s.fuel_tax_amount ?? dbS?.fuel_tax_amount ?? null
          const special = s.special_fees_amount ?? dbS?.special_fees_amount ?? 0
          const sellPrice = Number(s.sell_price || dbS?.sell_price || 0)

          // Fallback: if base_price/fuel_tax_amount are missing (old records),
          // reverse-engineer them from sell_price using standard 12.5% fuel rate
          if ((base === null || base === 0) && sellPrice > 0) {
            const fuelPct = 0.125 // 12.5%
            // sell = base * (1 + fuelPct) + special
            // base = (sell - special) / (1 + fuelPct)
            const netPrice = sellPrice - Number(special)
            base = Number((netPrice / (1 + fuelPct)).toFixed(2))
            fuel = Number((base * fuelPct).toFixed(2))
          }

          return {
            ...s,
            service_type: s.service_type || dbS?.service_type,
            sell_price: sellPrice,
            base_price: base,
            fuel_tax_amount: fuel,
            special_fees_amount: special,
            special_fees_description: s.special_fees_description ?? dbS?.special_fees_description
          }
        })
      }
    }

    const pdfBuffer = await generateProFormaPdfBuffer({
      statementNumber: details.statement_number || "EXT-0000/00-0000",
      clientName: client?.legal_name || client?.short_name || details.client_name || "Cliente TMS",
      clientNif: client?.nif || "",
      clientAddress: client ? getClientBillingAddress(client).address : "",
      clientCity: client ? getClientBillingAddress(client).city : "",
      clientEmail: client?.billing_email || client?.email || "",
      dateStr: details.created_at ? new Date(details.created_at).toLocaleDateString("pt-PT") : new Date().toLocaleDateString("pt-PT"),
      totalValue: Number(details.total_value || 0),
      shipments: enrichedShipments
    })

    const safeFilename = (details.statement_number || "extrato").replace(/[\/\\]/g, "_")
    const isInline = request.nextUrl.searchParams.get("inline") === "1" || request.nextUrl.searchParams.get("inline") === "true"
    const disposition = isInline ? "inline" : "attachment"

    return financialPdfResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="Extrato_${safeFilename}.pdf"`,
      },
    })
  } catch {
    console.error("Erro ao gerar PDF da pró-forma")
    return financialPdfResponse("Erro ao processar PDF", { status: 500 })
  }
}
