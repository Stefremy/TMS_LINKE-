"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getAuthContext, requireEmployee, requireUser, getTenantId } from "@/lib/auth/context"
import { CorreosShipmentService, CorreosCredentials } from "@/lib/services/correos"

/**
 * Obtém credenciais ativas da Correos Express (de carrier_connections, tenant_integrations ou .env.local)
 */
export async function getCorreosCredentials(): Promise<CorreosCredentials> {
  const supabase = createAdminClient()

  // 1. Tentar ler de carrier_connections
  try {
    const { data: conn } = await supabase
      .from("carrier_connections")
      .select("*")
      .eq("tenant_id", (await getTenantId()))
      .eq("carrier_code", "correos_express")
      .single()

    if (conn) {
      return {
        solicitante: conn.client_id, // solicitante
        codRte: conn.contract_number, // codRte
        user: conn.auth_id, // user
        pass: conn.user_id || "", // password
        environment: (conn.environment as "test" | "production") || "production",
      }
    }
  } catch {
    // Ignorar se a tabela ainda não existir no schema cache
  }

  // 2. Tentar ler de audit_log
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .eq("action", "carrier_connection_config")
      .order("created_at", { ascending: false })

    const connLog = logs?.find((l: any) => l.details?.carrier_code === "correos_express")
    if (connLog && connLog.details) {
      const d = connLog.details
      return {
        solicitante: d.client_id,
        codRte: d.contract_number,
        user: d.auth_id,
        pass: d.user_id || "",
        environment: (d.environment as "test" | "production") || "production",
      }
    }
  } catch {}

  // 3. Fallback
  return {
    solicitante: "IP49240001",
    codRte: "P49240001",
    user: "WS_GoLinke",
    pass: "l3CtF",
    environment: "production",
  }
}

/**
 * Guarda credenciais Correos Express na base de dados
 */
export async function saveCorreosConnectionAction(creds: {
  solicitante: string
  codRte: string
  user: string
  pass: string
  environment?: "test" | "production"
  description?: string
  supplier_id?: string
}) {
  const supabase = createAdminClient()

  const payload = {
    carrier_code: "correos_express",
    description: creds.description || "Integração Correos Express",
    client_id: creds.solicitante,
    contract_number: creds.codRte,
    auth_id: creds.user,
    user_id: creds.pass,
    environment: creds.environment || "test",
    supplier_id: creds.supplier_id || "ws_correos",
    is_active: true,
    updated_at: new Date().toISOString(),
  }

  try {
    const { error: err1 } = await supabase
      .from("carrier_connections")
      .upsert({
        tenant_id: (await getTenantId()),
        ...payload,
      }, { onConflict: "tenant_id,carrier_code" })

    if (err1) {
      console.warn("carrier_connections upsert error:", err1.message)
    }
  } catch (err: any) {
    console.warn("Could not save to carrier_connections:", err.message)
  }

  try {
    await supabase.from("audit_log").insert({
      tenant_id: (await getTenantId()),
      action: "carrier_connection_config",
      details: payload,
    })
  } catch (err: any) {
    console.warn("audit_log insert error:", err?.message)
  }

  try {
    revalidatePath("/ops/configuracao/webservices")
  } catch {}
  return { success: true }
}

/**
 * Testa a conexão com os Web Services Correos Express
 */
export async function testCorreosConnectionAction(creds: CorreosCredentials) {
  await requireEmployee()
  try {
    const shipmentService = new CorreosShipmentService()
    
    // Executar teste com pedido mínimo à Correos Express
    const result = await shipmentService.createShipment(creds, {
      ref: "TEST-CONN-" + Date.now().toString().slice(-6),
      fecha: new Date().toLocaleDateString("pt-PT").replace(/\//g, ""),
      remitente: {
        nombre: "TMS LINKE",
        direccion: "Avenida Teste 100",
        poblacion: "Madrid",
        cpInternacional: "4000",
        paisISO: "PT",
        contacto: "Remitente Teste",
        telefono: "910000000"
      },
      destinatario: {
        nombre: "Destinatario Teste",
        direccion: "Calle Mayor 1",
        poblacion: "Madrid",
        cpInternacional: "1000",
        paisISO: "PT",
        contacto: "Destinatario Teste",
        telefono: "910000000"
      },
      bultos: 1,
      kilos: 1,
      producto: "63",
      portes: "P"
    })

    if (result.codigoRetorno === 0) {
      return {
        success: true,
        message: `Comunicação e Autenticação Correos Express (${creds.environment === "production" ? "Produção" : "Ambiente Teste"}) validadas com SUCESSO!`,
      }
    }

    return {
      success: false,
      message: `Resposta Correos Express: ${result.mensajeRetorno || "Erro desconhecido"} (Código ${result.codigoRetorno})`,
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Erro na comunicação Correos Express: ${err.message}`,
    }
  }
}
