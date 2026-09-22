import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { MoloniClient } from "@/lib/moloni/moloni-client"
import { getMoloniConfigAction } from "@/app/actions/moloni"
import { generateCustomInvoicePdfBuffer } from "@/lib/services/billing/custom-invoice-pdf"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const decodedId = decodeURIComponent(id)

    const supabase = createAdminClient()
    const { data: logs, error } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "custom_invoice")
      .order("created_at", { ascending: false })

    if (error || !logs || logs.length === 0) {
      return new NextResponse("Fatura não encontrada", { status: 404 })
    }

    const match = logs.find(
      (l: any) => l.details?.invoice_number === decodedId || l.details?.id === decodedId || l.id === decodedId
    )

    if (!match || !match.details) {
      return new NextResponse("Documento de fatura não encontrado", { status: 404 })
    }

    const invoice = match.details
    let pdfUrl = invoice.moloni_document_pdf
    const docId = invoice.moloni_document_id

    // 1. Se existir documento no Moloni, tentar fazer stream do PDF oficial
    if (docId) {
      // Ajustar URL se necessário
      if (pdfUrl && pdfUrl.includes("/downloads/?h=")) {
        pdfUrl = pdfUrl.replace("/downloads/?h=", "/downloads/index.php?action=getDownload&h=") + `&d=${docId}&e=&i=1`
      }

      let pdfResponse: Response | null = null

      if (pdfUrl) {
        try {
          pdfResponse = await fetch(pdfUrl, { cache: "no-store" })
          if (!pdfResponse.ok) {
            pdfResponse = null
          }
        } catch {
          pdfResponse = null
        }
      }

      // Se falhou, tentar obter link fresco através da API do Moloni
      if (!pdfResponse) {
        try {
          const config = await getMoloniConfigAction()
          if (config.isConnected && config.companyId) {
            const moloni = new MoloniClient({
              companyId: config.companyId,
              refreshToken: (config as any).refreshToken
            })
            const freshUrl = await moloni.getDocumentPDFLink(docId)
            if (freshUrl) {
              pdfResponse = await fetch(freshUrl, { cache: "no-store" })
            }
          }
        } catch (moloniErr) {
          console.warn("Could not retrieve fresh Moloni PDF for custom invoice:", moloniErr)
        }
      }

      const isInline = request.nextUrl.searchParams.get("inline") === "1" || request.nextUrl.searchParams.get("inline") === "true"
      const disposition = isInline ? "inline" : "attachment"
      const safeFilename = `${(invoice.invoice_number || "Fatura").replace(/[\/\\]/g, "_")}.pdf`

      if (pdfResponse && pdfResponse.ok) {
        const arrayBuffer = await pdfResponse.arrayBuffer()
        const headers = new Headers()
        headers.set("Content-Type", "application/pdf")
        headers.set("Content-Disposition", `${disposition}; filename="${safeFilename}"`)
        return new NextResponse(new Uint8Array(arrayBuffer), {
          status: 200,
          headers
        })
      }
    }

    const isInline = request.nextUrl.searchParams.get("inline") === "1" || request.nextUrl.searchParams.get("inline") === "true"
    const disposition = isInline ? "inline" : "attachment"
    const safeFilename = `${(invoice.invoice_number || "Fatura").replace(/[\/\\]/g, "_")}.pdf`

    // 2. Fallback / Documento interno do sistema: gerar via pdf-lib
    const pdfBuffer = await generateCustomInvoicePdfBuffer({
      invoiceNumber: invoice.invoice_number || `FAT-${invoice.id.slice(0, 8)}`,
      invoiceDate: invoice.invoice_date || new Date().toISOString().split("T")[0],
      dueDate: invoice.due_date || new Date().toISOString().split("T")[0],
      paymentTerms: invoice.payment_terms || "Pronto Pagamento",
      paymentMethod: invoice.payment_method || "Transferência Bancária",
      notes: invoice.notes || "",
      client: {
        name: invoice.client_name || "Cliente Linke",
        nif: invoice.client_vat || "",
        address: invoice.client_address || "",
        postalCode: invoice.client_zip || "",
        city: invoice.client_city || "Portugal",
        email: invoice.client_email || "",
        phone: invoice.client_phone || ""
      },
      items: invoice.items || []
    })

    const headers = new Headers()
    headers.set("Content-Type", "application/pdf")
    headers.set("Content-Disposition", `${disposition}; filename="${safeFilename}"`)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers
    })
  } catch (err: any) {
    console.error("Custom invoice PDF streaming error:", err)
    return new NextResponse(`Erro ao gerar PDF da fatura: ${err?.message}`, { status: 500 })
  }
}
