import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { MoloniClient } from "@/lib/moloni/moloni-client"

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
      .eq("action", "billing_statement")
      .order("created_at", { ascending: false })

    if (error || !logs || logs.length === 0) {
      return new NextResponse("Extrato / Fatura não encontrado", { status: 404 })
    }

    const match = logs.find(
      (l: any) => l.details?.statement_number === decodedId || l.details?.id === decodedId
    )

    if (!match || !match.details) {
      return new NextResponse("Documento não encontrado", { status: 404 })
    }

    const stmt = match.details
    let pdfUrl = stmt.moloni_document_pdf
    const docId = stmt.moloni_document_id

    if (!pdfUrl && !docId) {
      return new NextResponse("Fatura oficial Moloni ainda não emitida para este extrato.", { status: 404 })
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
        let moloniConfig: any = null
        if (process.env.MOLONI_REFRESH_TOKEN && process.env.MOLONI_COMPANY_ID) {
          moloniConfig = {
            refreshToken: process.env.MOLONI_REFRESH_TOKEN,
            companyId: process.env.MOLONI_COMPANY_ID,
          }
        }
        if (moloniConfig) {
          const moloni = new MoloniClient(moloniConfig)
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
            }
          }
        }
      } catch (refreshErr) {
        console.warn("Could not refresh Moloni PDF link:", refreshErr)
      }
    }

    if (!pdfResponse || !pdfResponse.ok) {
      return new NextResponse("Erro ao descarregar PDF da API Moloni. Por favor tente novamente.", { status: 502 })
    }

    const pdfBuffer = await pdfResponse.arrayBuffer()
    const filename = `Fatura_Oficial_${(stmt.statement_number || "Moloni").replace(/[\/\\]/g, "_")}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (err: any) {
    console.error("Error serving Moloni PDF:", err)
    return new NextResponse(err.message || "Erro interno", { status: 500 })
  }
}
