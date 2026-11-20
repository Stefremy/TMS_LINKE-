import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/errors"
import { MoloniClient } from "@/lib/moloni/moloni-client"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEmployee } from "@/lib/auth/context"
import { moloniAppRedirectUri } from "@/lib/moloni/app-credentials"
import { MOLONI_ENVIRONMENT_LABEL, parseMoloniEnvironment, pickMoloniCompany, saveMoloniConnection } from "@/lib/moloni/connection"

const RETURN_PATH = "/ops/configuracao/faturacao"

/** Shared Moloni OAuth callback. `state` carries the environment chosen before the redirect. */
export async function handleMoloniOAuthCallback(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const back = (query: string) => NextResponse.redirect(new URL(`${RETURN_PATH}?${query}`, request.url))
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  if (error) return back(`moloni_error=${encodeURIComponent(error)}`)
  if (!code) return back("moloni_error=Codigo_nao_fornecido")

  const environment = parseMoloniEnvironment(searchParams.get("state")) || "test"
  try {
    const ctx = await requireEmployee("Faturação & Contas Correntes")
    // The code must be exchanged by the same Moloni application, with the same callback, that issued it.
    const redirectUri = moloniAppRedirectUri(environment, new URL(request.url).origin)!
    const { refreshToken, companies } = await MoloniClient.exchangeAuthCode(code, redirectUri, environment)
    const db = createAdminClient()
    const company = await pickMoloniCompany(db, ctx.tenant_id, companies || [], environment)
    if (!company) {
      throw new Error(environment === "live"
        ? "Esta conta Moloni não tem uma empresa oficial diferente da de Teste."
        : "Nenhuma empresa encontrada nesta conta Moloni.")
    }
    await saveMoloniConnection(db, ctx.tenant_id, environment, company, refreshToken)
    return back(`moloni_connected=true&environment=${environment}&company=${encodeURIComponent(company.name)}`)
  } catch (err) {
    console.error(`Moloni OAuth callback error (${MOLONI_ENVIRONMENT_LABEL[environment]}):`, err)
    return back(`moloni_error=${encodeURIComponent(errorMessage(err) || "Falha ao trocar código Moloni")}`)
  }
}
