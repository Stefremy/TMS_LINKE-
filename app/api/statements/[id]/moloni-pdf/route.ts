import { NextRequest } from "next/server"
import { loadFinancialDocument, financialPdfResponse } from "@/lib/services/billing/document-access"
import { getMoloniClientForDocument } from "@/lib/moloni/connection"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await loadFinancialDocument(id, "billing_statement")
    if (!access) return financialPdfResponse("Documento não encontrado", { status: 404 })
    const { supabase, document: match, ctx } = access

    const stmt = match.details
    let pdfUrl = stmt.moloni_document_pdf
    const docId = stmt.moloni_document_id

    if (!pdfUrl && !docId) {
      return financialPdfResponse("Fatura oficial Moloni ainda não emitida para este extrato.", { status: 404 })
    }

    // Convert landing page to direct download link if needed
    if (pdfUrl && pdfUrl.includes("/downloads/?h=") && docId) {
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

    // Fallback: If direct fetch failed or token expired, re-fetch fresh link from Moloni API
    if ((!pdfResponse || !pdfResponse.ok) && docId) {
      try {
        // Documento já emitido: usar sempre a empresa Moloni que o emitiu (Teste ou Produção).
        const issuer = await getMoloniClientForDocument(supabase, ctx.tenant_id, stmt)
        if (issuer) {
          const { moloni } = issuer
          const freshPdfUrl = await moloni.getDocumentPDFLink(Number(docId))
          if (freshPdfUrl) {
            pdfUrl = freshPdfUrl
            pdfResponse = await fetch(pdfUrl, { cache: "no-store" })
            if (pdfResponse && pdfResponse.ok) {
              // Update audit_log with fresh URL
              await supabase
                .from("audit_log")
                .update({
                  details: {
                    ...stmt,
                    moloni_document_pdf: freshPdfUrl,
                  }
                })
                .eq("id", match.id)
                .eq("tenant_id", ctx.tenant_id)
                .eq("action", "billing_statement")
            }
          }
        }
      } catch (refreshErr) {
        console.warn("Could not refresh Moloni PDF link:", refreshErr)
      }
    }

    if (!pdfResponse || !pdfResponse.ok) {
      return financialPdfResponse("Erro ao descarregar PDF da API Moloni. Por favor tente novamente.", { status: 502 })
    }

    const pdfBuffer = await pdfResponse.arrayBuffer()
    const filename = `Fatura_Oficial_${(stmt.statement_number || "Moloni").replace(/[\/\\]/g, "_")}.pdf`

    return financialPdfResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch {
    console.error("Error serving Moloni PDF")
    return financialPdfResponse("Erro ao processar PDF", { status: 500 })
  }
}
