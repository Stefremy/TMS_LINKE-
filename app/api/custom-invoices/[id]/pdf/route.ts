import { NextRequest } from "next/server"
import { loadFinancialDocument, financialPdfResponse } from "@/lib/services/billing/document-access"
import { getMoloniClientForDocument } from "@/lib/moloni/connection"
import { createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await loadFinancialDocument(id, "custom_invoice")
    if (!access) return financialPdfResponse("Documento não encontrado", { status: 404 })
    const { document: match } = access

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
          // Documento já emitido: usar sempre a empresa Moloni que o emitiu (Teste ou Produção).
          const issuer = await getMoloniClientForDocument(createAdminClient(), match.tenant_id, invoice)
          if (issuer) {
            const { moloni } = issuer
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
        return financialPdfResponse(new Uint8Array(arrayBuffer), {
          status: 200,
          headers
        })
      }
    }

    // Só o PDF certificado do Moloni é uma fatura. Nunca gerar um documento interno no seu lugar.
    if (!docId) {
      return financialPdfResponse("Esta fatura não foi emitida no Moloni, por isso não tem PDF oficial.", { status: 404 })
    }
    return financialPdfResponse("O PDF oficial do Moloni está indisponível de momento. Tente novamente dentro de instantes.", { status: 502 })
  } catch {
    console.error("Custom invoice PDF streaming error")
    return financialPdfResponse("Erro ao processar PDF", { status: 500 })
  }
}
