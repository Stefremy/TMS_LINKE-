import { NextRequest, NextResponse } from "next/server"
import { requireEmployee } from "@/lib/auth/context"
import { getClientesAction } from "@/app/actions/clientes"

export async function GET(request: NextRequest) {
  await requireEmployee()
  const clientId = request.nextUrl.searchParams.get("clientId")
  const client = clientId && (await getClientesAction(clientId)).find(c => c.id === clientId)
  if (!client) return NextResponse.redirect(new URL("/ops/entidades/clientes", request.url))

  const response = NextResponse.redirect(new URL("/app", request.url))
  response.cookies.set("impersonated_client_id", client.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })
  return response
}
