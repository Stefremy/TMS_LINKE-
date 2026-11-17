import { NextRequest } from "next/server"
import { handleMoloniOAuthCallback } from "@/lib/moloni/oauth-callback"

export async function GET(request: NextRequest) {
  return handleMoloniOAuthCallback(request)
}
