import { NextRequest, NextResponse } from "next/server"
import { MoloniClient } from "@/lib/moloni/moloni-client"
import { createAdminClient } from "@/lib/supabase/server"
import fs from "fs"
import path from "path"

const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(`/ops/faturacao/contas-corrente?moloni_error=${encodeURIComponent(error)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/ops/faturacao/contas-corrente?moloni_error=Codigo_nao_fornecido", request.url)
    )
  }

  try {
    // Note: Moloni requires the exact redirect_uri registered in the developer portal:
    // https://linke-store-ten.vercel.app/api/moloni/callback
    const redirectUri = "https://linke-store-ten.vercel.app/api/moloni/callback"
    
    let tokenData
    try {
      tokenData = await MoloniClient.exchangeAuthCode(code, redirectUri)
    } catch (exchangeErr: any) {
      // Fallback: try origin redirectUri in case developer configured localhost
      const localUri = `${new URL(request.url).origin}/api/moloni/callback`
      tokenData = await MoloniClient.exchangeAuthCode(code, localUri)
    }

    const { refreshToken, companies } = tokenData
    const selectedCompany = companies[0] || { company_id: 393993, name: "Linke" }
    const companyId = String(selectedCompany.company_id || 393993)

    // 1. Guardar no audit_log da Supabase
    const supabase = createAdminClient()
    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
      action: "moloni_connection_config",
      details: {
        company_id: companyId,
        company_name: selectedCompany.name,
        company_vat: (selectedCompany as any).vat,
        refresh_token: refreshToken,
        connected_at: new Date().toISOString(),
      },
    })

    // 2. Atualizar .env.local
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
    console.error("Moloni OAuth Callback error:", err)
    return NextResponse.redirect(
      new URL(`/ops/faturacao/contas-corrente?moloni_error=${encodeURIComponent(err.message || "Falha ao trocar código Moloni")}`, request.url)
    )
  }
}
