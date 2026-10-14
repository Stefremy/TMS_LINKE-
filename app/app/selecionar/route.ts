import { NextRequest, NextResponse } from "next/server"
import { requireEmployee } from "@/lib/auth/context"
import { getPortalDestination } from "@/lib/client-portal/access"
import { PORTAL_SECTIONS } from "@/lib/client-portal/paths"

export async function GET(request: NextRequest) {
  await requireEmployee()
  const clientId = request.nextUrl.searchParams.get("clientId")
  if (!clientId) return NextResponse.redirect(new URL("/ops/entidades/clientes", request.url))
  const basePath = await getPortalDestination(clientId)
  const section = request.nextUrl.searchParams.get("section")
  const suffix = PORTAL_SECTIONS.find(s => s === section)
  const destination = new URL(`${basePath}${suffix ? `/${suffix}` : ""}`, request.url)
  const topup = request.nextUrl.searchParams.get("topup")
  if (topup === "success" || topup === "cancelled") destination.searchParams.set("topup", topup)

  const response = NextResponse.redirect(destination)
  response.cookies.set("impersonated_client_id", clientId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })
  return response
}
