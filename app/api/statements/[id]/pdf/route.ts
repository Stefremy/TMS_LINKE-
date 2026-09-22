import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getClientesAction } from "@/app/actions/clientes"
import { generateStatementPdfBuffer } from "@/lib/services/billing/statement-pdf"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const rawId = decodeURIComponent(resolvedParams.id || "").trim()

    if (!rawId) {
      return new Response("ID de extrato não fornecido", { status: 400 })
    }

    const supabase = createAdminClient()

    // Procurar em audit_log
    const { data: logs, error } = await supabase
      .from("audit_log")
      .select("*")
      .eq("action", "billing_statement")
      .order("created_at", { ascending: false })

    if (error || !logs || logs.length === 0) {
      return new Response("Nenhum extrato encontrado no sistema", { status: 404 })
    }

    // Encontrar por audit_log.id, details.id ou details.statement_number
    const match = logs.find((l: any) => {
      const d = l.details || {}
      return (
        l.id === rawId ||
        d.id === rawId ||
        d.statement_number === rawId ||
        d.statement_number?.toLowerCase() === rawId.toLowerCase()
      )
    })

    if (!match) {
      return new Response(`Extrato "${rawId}" não encontrado`, { status: 404 })
    }

    const details = match.details || {}
    const clients = await getClientesAction()
    const client = clients.find((c: any) => c.id === details.client_id)

    // Tentar obter o service_type da DB se estiver em falta no log
    let enrichedShipments = details.shipments || []
    const shipmentIds = enrichedShipments.map((s: any) => s.id).filter(Boolean)
    if (shipmentIds.length > 0) {
      const { data: dbShipments } = await supabase
        .from("shipments")
        .select("id, service_type")
        .in("id", shipmentIds)
        
      if (dbShipments && dbShipments.length > 0) {
        enrichedShipments = enrichedShipments.map((s: any) => {
          const dbS = dbShipments.find((d: any) => d.id === s.id)
          return {
            ...s,
            service_type: s.service_type || dbS?.service_type
          }
        })
      }
    }

    const pdfBuffer = await generateStatementPdfBuffer({
      statementNumber: details.statement_number || "EXT-0000/00-0000",
      clientName: client?.legal_name || client?.short_name || details.client_name || "Cliente TMS",
      clientNif: client?.nif || "",
      clientAddress: client?.address || "",
      clientCity: client?.city || "",
      clientEmail: client?.billing_email || client?.email || "",
      dateStr: details.created_at ? new Date(details.created_at).toLocaleDateString("pt-PT") : new Date().toLocaleDateString("pt-PT"),
      totalValue: Number(details.total_value || 0),
      shipments: enrichedShipments
    })

    const safeFilename = (details.statement_number || "extrato").replace(/[\/\\]/g, "_")
    const isInline = request.nextUrl.searchParams.get("inline") === "1" || request.nextUrl.searchParams.get("inline") === "true"
    const disposition = isInline ? "inline" : "attachment"

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="Extrato_${safeFilename}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (err: any) {
    console.error("Erro ao gerar PDF do extrato:", err)
    return new Response(`Erro ao processar PDF: ${err?.message || "Erro interno"}`, { status: 500 })
  }
}
