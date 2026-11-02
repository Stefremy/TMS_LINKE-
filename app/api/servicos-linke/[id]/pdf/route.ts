import { getAuthContext } from "@/lib/auth/context"
import { getServicosLinkeAction } from "@/app/actions/servicos-linke"
import { buildServicePriceSheet, servicePriceSheetFilename, ServicePriceSheetError } from "@/lib/services/pricing/service-price-sheet"
import { generateServicePriceSheetPdf } from "@/lib/services/pricing/service-price-sheet-pdf"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function response(body: BodyInit, status: number, headers?: HeadersInit) {
  const privateHeaders = new Headers(headers)
  privateHeaders.set("Cache-Control", "private, no-store, max-age=0")
  privateHeaders.set("Vary", "Cookie, Authorization")
  privateHeaders.set("X-Content-Type-Options", "nosniff")
  return new Response(body, { status, headers: privateHeaders })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx?.user || !ctx.tenant_id || (ctx.role !== "employee" && ctx.role !== "admin")) {
    return response("Acesso reservado à equipa Linke.", 403)
  }
  const { id } = await params
  if (!id || id.length > 160 || /[\u0000-\u001f\u007f]/.test(id)) return response("Tabela não encontrada.", 404)
  try {
    const services = await getServicosLinkeAction()
    const service = services.find(item => item.id === id)
    const tenantId = (service as typeof service & { tenant_id?: string })?.tenant_id
    if (!service || (tenantId && tenantId !== ctx.tenant_id)) return response("Tabela não encontrada.", 404)
    const sheet = buildServicePriceSheet(service)
    const buffer = await generateServicePriceSheetPdf(sheet)
    return response(new Uint8Array(buffer), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${servicePriceSheetFilename(sheet.serviceName)}"`,
    })
  } catch (error) {
    if (error instanceof ServicePriceSheetError) return response(error.message, 422)
    console.error("Service price sheet PDF generation failed", error)
    return response("Não foi possível gerar o PDF. Tente novamente.", 500)
  }
}
