import { NextRequest, NextResponse } from "next/server"
import { MoloniClient } from "@/lib/moloni/moloni-client"
import { createAdminClient } from "@/lib/supabase/server"
import fs from "fs"
import path from "path"

import { getTenantId } from "@/lib/auth/context"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL(`/ops/faturacao/contas-corrente?moloni_error=${encodeURIComponent(error)}`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL("/ops/faturacao/contas-corrente?moloni_error=Codigo_nao_fornecido", request.url))
  }

  try {
    const redirectUri = `${new URL(request.url).origin}/api/auth/moloni/callback`
    const { refreshToken, companies } = await MoloniClient.exchangeAuthCode(code, redirectUri)

    const selectedCompany = companies[0] || { company_id: 0, name: "Empresa Moloni" }
    const companyId = String(selectedCompany.company_id)

    // 1. Guardar em audit_log
    const supabase = createAdminClient()
    await supabase.from("audit_log").insert({
      tenant_id: (await getTenantId()),
      action: "moloni_connection_config",
      details: {
        company_id: companyId,
        company_name: selectedCompany.name,
        company_vat: (selectedCompany as any).vat,
        refresh_token: refreshToken,
        connected_at: new Date().toISOString(),
      },
    })

    // 2. Tentar atualizar .env.local
    try {
      const envPath = path.join(process.cwd(), ".env.local")
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, "utf8")
        
        if (envContent.includes("MOLONI_REFRESH_TOKEN=")) {
          envContent = envContent.replace(/MOLONI_REFRESH_TOKEN=.*(\r?\n|$)/, `MOLONI_REFRESH_TOKEN=${refreshToken}\n`)
        } else {
          envContent += `\nMOLONI_REFRESH_TOKEN=${refreshToken}\n`
        }

        if (envContent.includes("MOLONI_COMPANY_ID=")) {
          envContent = envContent.replace(/MOLONI_COMPANY_ID=.*(\r?\n|$)/, `MOLONI_COMPANY_ID=${companyId}\n`)
        } else {
          envContent += `MOLONI_COMPANY_ID=${companyId}\n`
        }

        fs.writeFileSync(envPath, envContent, "utf8")
      }
    } catch (e: any) {
      console.warn("Could not write to .env.local:", e?.message)
    }

    return NextResponse.redirect(
      new URL(`/ops/faturacao/contas-corrente?moloni_connected=true&company=${encodeURIComponent(selectedCompany.name)}`, request.url)
    )
  } catch (err: any) {
    console.error("Moloni callback error:", err)
    return NextResponse.redirect(
      new URL(`/ops/faturacao/contas-corrente?moloni_error=${encodeURIComponent(err.message || "Erro de autorizacao")}`, request.url)
    )
  }
}
