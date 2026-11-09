import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth/context"
import { fetchWhatsappMediaBinary } from "@/lib/services/communications/whatsapp-cloud"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: { params: Promise<{ mediaId: string }> }
) {
  const ctx = await getAuthContext()
  if (!ctx || !["admin", "employee"].includes(ctx.role || "")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const { mediaId } = await context.params
  const { searchParams } = new URL(request.url)
  const useIncNumber = searchParams.get("inc") === "1"

  try {
    const mediaBinary = await fetchWhatsappMediaBinary({
      mediaId,
      useIncNumber,
    })

    return new NextResponse(new Uint8Array(mediaBinary.buffer), {
      status: 200,
      headers: {
        "Content-Type": mediaBinary.mimeType,
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Não foi possível carregar media do WhatsApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}

