import { NextRequest, NextResponse } from "next/server"
import { lookupPostalCode } from "@/lib/services/geo/postal-code.service"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code") || ""
  const country = searchParams.get("country") || "PT"

  if (!code) {
    return NextResponse.json({ found: false, error: "Código postal em falta" }, { status: 400 })
  }
  const result = lookupPostalCode(code, country)
  if (!result) {
    return NextResponse.json({ found: false, error: "Código postal não encontrado" }, { status: 404 })
  }

  return NextResponse.json({
    ...result,
  }, {
    headers: {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    }
  })
}
