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

export async function emitCorreosShipmentAction(shipmentInput: {
  id?: string
  ref?: string
  sender: { name: string; address: string; zip: string; city: string; phone: string; email?: string }
  recipient: { name: string; address: string; zip: string; city: string; phone: string; email?: string }
  weightKg?: number
  volumes?: number
  subProduct?: string
  codValue?: number
  autoClose?: boolean
  isReturn?: boolean
  selectedSpecialServices?: string[]
}) {
  await requireEmployee()
  const creds = await getCorreosCredentials()
  const shipmentService = new CorreosShipmentService()

  try {
    const result = await shipmentService.createShipment(creds, {
      ref: shipmentInput.ref || `TRK-${Date.now().toString().slice(-8)}`,
      fecha: new Date().toLocaleDateString("pt-PT").replace(/\//g, ""),
      remitente: {
        nombre: shipmentInput.sender.name,
        direccion: shipmentInput.sender.address,
        poblacion: shipmentInput.sender.city,
        cpNacional: shipmentInput.sender.zip.replace("-", ""),
        cpInternacional: shipmentInput.sender.zip.replace("-", ""),
        paisISO: "PT",
        contacto: shipmentInput.sender.name,
        telefono: shipmentInput.sender.phone || "910000000",
        email: shipmentInput.sender.email || ""
      },
      destinatario: {
        nombre: shipmentInput.recipient.name,
        direccion: shipmentInput.recipient.address,
        poblacion: shipmentInput.recipient.city,
        cpNacional: shipmentInput.recipient.zip.replace("-", ""),
        cpInternacional: shipmentInput.recipient.zip.replace("-", ""),
        paisISO: "PT", // Simplification: assuming PT for now, should be dynamic if needed
        contacto: shipmentInput.recipient.name,
        telefono: shipmentInput.recipient.phone || "910000000",
        email: shipmentInput.recipient.email || ""
      },
      bultos: shipmentInput.volumes || 1,
      kilos: shipmentInput.weightKg || 1,
      producto: shipmentInput.subProduct || "63",
      portes: "P",
      reembolso: shipmentInput.codValue ? shipmentInput.codValue.toString() : "",
      tipoEtiqueta: "1" // 1 = PDF, 2 = ZPL (Termica)
    })

    if (result.codigoRetorno === 0 || (result.codigoRetorno === 404 && result.datosResultado)) {
      let labelBase64 = ""
      if (result.listaInformacionAdicional && result.listaInformacionAdicional.length > 0) {
        labelBase64 = result.listaInformacionAdicional[0].etiquetaPDF || ""
      }
      
      // Inject mock label in test environment so UI testing works!
      if (!labelBase64 && creds.environment === "test") {
        labelBase64 = "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgNDAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCiAgICA+PgogID4+CiAgL0NvbnRlbnRzIDUgMCBSCj4+CmVuZG9iagoKNCAwIG9iago8PAogIC9UeXBlIC9Gb250CiAgL1N1YnR5cGUgL1R5cGUxCiAgL0Jhc2VGb250IC9UaW1lcy1Sb21hbgo+PgplbmRvYmoKCjUgMCBvYmogICUgcGFnZSBjb250ZW50Cjw8CiAgL0xlbmd0aCA4MAo+PgpzdHJlYW0KQlQKNTAgMTAwIFRECi9GMSAyNCBUZgooRXRpcXVldGEgQ29ycmVvcyBUZXN0ZSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNzkgMDAwMDAgbiAKMDAwMDAwMDE3MyAwMDAwMCBuIAowMDAwMDAwMzAwIDAwMDAwIG4gCjAwMDAwMDAzODggMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNTM2CiUlRU9GCg=="
      }

      return {
        success: true,
        trackingNumber: result.datosResultado || result.envios?.[0]?.numEnvio || shipmentInput.ref,
        labelBase64: labelBase64
      }
    }

    return {
      success: false,
      error: `Correos Express: ${result.mensajeRetorno || "Erro desconhecido"} (Código ${result.codigoRetorno})`
    }
  } catch (err: any) {
    return {
      success: false,
      error: `Erro Correos Express: ${err.message}`
    }
  }
}
