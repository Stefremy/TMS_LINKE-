import { getClientBillingAddress } from "@/lib/client-addresses"
import { NextRequest } from "next/server"
import { loadFinancialDocument, financialPdfResponse } from "@/lib/services/billing/document-access"
import { getClientesAction } from "@/app/actions/clientes"
import { generateStatementPdfBuffer } from "@/lib/services/billing/statement-pdf"
import type { BillingStatementPdfShipment } from "@/lib/services/billing/statement-pdf"

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

    // Obter dados adicionais da DB para enriquecer o extrato
    let enrichedShipments: BillingStatementPdfShipment[] = details.shipments || []
    const shipmentIds = (details.shipment_ids || enrichedShipments.map(s => s.id)).filter(Boolean)
    if (shipmentIds.length > 0) {
      const { data: dbShipments } = await supabase
        .from("shipments")
        .select("id, tracking_number, service_type, recipient_name, recipient_city, recipient_address, sell_price, created_at")
        .eq("tenant_id", ctx.tenant_id)
        .eq("client_id", details.client_id)
        .in("id", shipmentIds)
        
      if (dbShipments && dbShipments.length > 0) {
        enrichedShipments = enrichedShipments.map(s => {
          const dbS = dbShipments.find((d: BillingStatementPdfShipment) => d.id === s.id)
          return {
            ...s,
            tracking_number: s.tracking_number || dbS?.tracking_number,
            service_type: s.service_type || dbS?.service_type,
            recipient_name: s.recipient_name || dbS?.recipient_name,
            recipient_city: s.recipient_city || dbS?.recipient_city,
            recipient_address: s.recipient_address || dbS?.recipient_address,
            sell_price: s.sell_price != null ? Number(s.sell_price) : (dbS?.sell_price != null ? Number(dbS.sell_price) : 0),
            base_price: s.base_price,
            fuel_tax_amount: s.fuel_tax_amount,
            special_fees_amount: s.special_fees_amount,
            special_fees_description: s.special_fees_description,
            weight_kg: s.weight_kg,
            created_at: s.created_at || dbS?.created_at
          }
        })
      }
    }

    const pdfBuffer = await generateStatementPdfBuffer({
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
    console.error("Erro ao gerar PDF do extrato")
    return financialPdfResponse("Erro ao processar PDF", { status: 500 })
  }
}
