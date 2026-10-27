"use server"

import { publicUrl } from "@/lib/config/public-origins"
import { getCttPickupRequester } from "@/lib/config/ctt-pickup-requester"

import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getAuthContext, requireEmployee, requireUser, getTenantId } from "@/lib/auth/context"
import { syncShipmentTracking } from "@/lib/services/tracking"
import { CttProvider } from "@/lib/services/carriers/ctt-provider"
import { resolveCttCredentials } from "@/lib/services/carriers/credentials"
import { 
  CTTShipmentService, 
  CTTPickupService, 
  CTTTrackingService, 
  CTTReferencesService,
  CTTConnectionCredentials,
  CTTPickupRequester,
  CTTAddressData,
  CTTShipmentData,
  CTTPontoEntrega,
  CTTSpecialService
} from "@/lib/services/ctt"
import { convertZplToPdfBase64 } from "@/lib/label-utils"
import { closeCttManifest } from "@/lib/services/ctt/close-manifest"


/**
 * Obtém credenciais ativas da CTT (de carrier_connections, tenant_integrations ou .env.local)
 */
async function getCttCredentials(): Promise<CTTConnectionCredentials> {
  const supabase = createAdminClient()

  // 1. Tentar ler de carrier_connections
  try {
    const { data: conn } = await supabase
      .from("carrier_connections")
      .select("*")
      .eq("tenant_id", (await getTenantId()))
      .eq("carrier_code", "ctt_expresso")
      .single()

    if (conn) {
      return {
        contract_number: conn.contract_number,
        client_number: conn.client_id,
        auth_id: conn.auth_id,
        user_id: conn.user_id || undefined,
        pickup_requester: getCttPickupRequester(),
        distribution_channel: conn.distribution_channel || 99,
        environment: (conn.environment as "qa" | "production") || "production",
        default_subproduct: conn.default_subproduct || "EMSF056.01",
      }
    }
  } catch {
    // Ignorar se a tabela ainda não existir no schema cache
  }



  // 3. Fallback para variáveis de ambiente
  if (!process.env.CTT_CONTRACT_ID || !process.env.CTT_CLIENT_ID || !process.env.CTT_AUTHENTICATION_ID) {
    throw new Error("Missing required CTT environment variables. Please check your configuration.")
  }

  return {
    contract_number: process.env.CTT_CONTRACT_ID,
    client_number: process.env.CTT_CLIENT_ID,
    auth_id: process.env.CTT_AUTHENTICATION_ID,
    user_id: process.env.CTT_USER_ID,
    pickup_requester: getCttPickupRequester(),
    distribution_channel: 99,
    environment: "production",
    default_subproduct: "EMSF056.01",
  }
}

/**
 * Guarda credenciais CTT na base de dados
 */
export async function saveCttConnectionAction(creds: {
  contract_number: string
  client_number: string
  auth_id: string
  user_id?: string
  environment?: "qa" | "production"
  default_subproduct?: string
  description?: string
  supplier_id?: string
}) {
  await requireEmployee()
  const supabase = createAdminClient()

  const payload = {
    carrier_code: "ctt_expresso",
    description: creds.description || "Integração CTT Expresso",
    client_id: creds.client_number,
    contract_number: creds.contract_number,
    auth_id: creds.auth_id,
    user_id: creds.user_id || null,
    distribution_channel: 99,
    environment: creds.environment || "qa",
    default_subproduct: creds.default_subproduct || "EMSF056.01",
    supplier_id: creds.supplier_id || "ctt_portugal",
    is_active: true,
    updated_at: new Date().toISOString(),
  }

  // 1. Tentar tabela carrier_connections
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
    revalidatePath("/ops/configuracao/webservices")
  } catch {}
  return { success: true }
}

/**
 * Obtém a lista de conexões configuradas
 */
export async function getCarrierConnectionsAction() {
  await requireEmployee()
  const supabase = createAdminClient()

  // 1. Tentar carrier_connections
  try {
    const { data, error } = await supabase
      .from("carrier_connections")
      .select("*")
      .order("created_at", { ascending: false })

    if (!error && data && data.length > 0) {
      return data
    }
  } catch {}

  // 2. Fallback: Ler do audit_log
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .eq("action", "carrier_connection_config")
      .order("created_at", { ascending: false })

    if (logs && logs.length > 0) {
      const seen = new Set<string>()
      const list: any[] = []
      for (const item of logs) {
        const d = item.details
        if (d && !seen.has(d.carrier_code || d.client_id)) {
          seen.add(d.carrier_code || d.client_id)
          list.push({
            id: item.id,
            carrier_code: d.carrier_code || "ctt_expresso",
            description: d.description || "Integração CTT Expresso",
            client_id: d.client_id || d.client_number || "",
            contract_number: d.contract_number || "",
            auth_id: d.auth_id || "",
            user_id: d.user_id || null,
            environment: d.environment || "qa",
            default_subproduct: d.default_subproduct || "EMSF056.01",
            supplier_id: d.supplier_id || "ctt_portugal",
            is_active: d.is_active ?? true,
            created_at: item.created_at,
          })
        }
      }
      if (list.length > 0) {
        return list
      }
    }
  } catch (err: any) {
    console.warn("Fallback audit_log read error:", err?.message)
  }

  return []
}

/**
 * Ativa ou desativa uma conexão de transportadora
 */
export async function toggleCarrierConnectionAction(
  id: string,
  is_active: boolean,
  carrier_code: string = "ctt_expresso"
) {
  await requireEmployee()
  const supabase = createAdminClient()

  // 1. Atualizar em carrier_connections
  try {
    await supabase
      .from("carrier_connections")
      .update({ is_active, updated_at: new Date().toISOString() })
      .or(`id.eq.${id},carrier_code.eq.${carrier_code}`)
  } catch (err: any) {
    console.warn("carrier_connections toggle error:", err?.message)
  }

  // 2. Atualizar em audit_log (fallback storage)
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .eq("action", "carrier_connection_config")

    if (logs && logs.length > 0) {
      for (const item of logs) {
        if (
          item.id === id ||
          item.details?.carrier_code === carrier_code ||
          item.details?.client_id === id
        ) {
          await supabase
            .from("audit_log")
            .update({
              details: {
                ...item.details,
                is_active,
                updated_at: new Date().toISOString(),
              },
            })
            .eq("id", item.id)
        }
      }
    }
  } catch (err: any) {
    console.warn("audit_log toggle error:", err?.message)
  }

  revalidatePath("/ops/configuracao/webservices")
  return { success: true, is_active }
}

/**
 * Elimina uma ligação de transportadora
 */
export async function deleteCarrierConnectionAction(
  id: string,
  carrier_code: string = "ctt_expresso"
) {
  await requireEmployee()
  const supabase = createAdminClient()

  // 1. Eliminar em carrier_connections
  try {
    await supabase
      .from("carrier_connections")
      .delete()
      .or(`id.eq.${id},carrier_code.eq.${carrier_code}`)
  } catch (err: any) {
    console.warn("carrier_connections delete error:", err?.message)
  }

  // 2. Eliminar em audit_log
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .eq("action", "carrier_connection_config")

    if (logs && logs.length > 0) {
      for (const item of logs) {
        if (
          item.id === id ||
          item.details?.carrier_code === carrier_code ||
          item.details?.client_id === id
        ) {
          await supabase.from("audit_log").delete().eq("id", item.id)
        }
      }
    }
  } catch (err: any) {
    console.warn("audit_log delete error:", err?.message)
  }

  revalidatePath("/ops/configuracao/webservices")
  return { success: true }
}

/**
 * Testa a conexão com os Web Services CTT
 */
export async function testCttConnectionAction(creds: CTTConnectionCredentials) {
  await requireEmployee()
  try {
    const { CTTReferencesService } = await import("@/lib/services/ctt/ctt-references.service")
    const refService = new CTTReferencesService()
    
    // Test connection by fetching points in a specific zip code (lightweight)
    const result = await refService.getDeliveryPoints(creds, { codigoPostal: "4100" })
    
    if (result && Array.isArray(result)) {
      return { 
        success: true, 
        message: `Comunicação e Autenticação CTT (${creds.environment === "production" ? "Produção" : "Ambiente QA"}) validadas com SUCESSO! A conta está pronta a ser utilizada.` 
      }
    } else {
      return { 
        success: false, 
        message: "Resposta inesperada da API (Autenticação falhou ou conta inativa)." 
      }
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Erro na comunicação CTT: ${err.message}`,
    }
  }
}

/**
 * Emite uma encomenda nos CTT (Gera Código de Barras / Tracking e Etiqueta Oficial)
 */
export async function emitCttShipmentAction(shipmentInput: {
  id?: string
  ref?: string
  sender: { name: string; address: string; zip: string; city: string; phone: string; email?: string; country?: string }
  recipient: { name: string; address: string; zip: string; city: string; phone: string; email?: string; country?: string }
  weightKg?: number
  volumes?: number
  dimensionsCm?: { length: number; width: number; height: number }
  subProduct?: string
  codValue?: number
  autoClose?: boolean
  isReturn?: boolean
  selectedSpecialServices?: string[]
  cttExportDetails?: import("@/lib/services/ctt/export-details").CttExportDetails
}) {
  await requireEmployee()
  const creds = await getCttCredentials()
  const provider = new CttProvider()
  await provider.initialize(creds)

  // Preparar observações baseadas nos serviços especiais para imprimir na etiqueta CTT
  const obsLines: string[] = []
  if (shipmentInput.selectedSpecialServices?.includes('fragil')) {
    obsLines.push("CUIDADO: FRÁGIL")
  }
  if (shipmentInput.selectedSpecialServices?.includes('cod') && shipmentInput.codValue) {
    obsLines.push(`COBRANÇA: ${shipmentInput.codValue.toFixed(2)}€`)
  }
  if (shipmentInput.selectedSpecialServices?.includes('auth_return')) {
    obsLines.push("LOGÍSTICA INVERSA")
  }
  
  const observationsString = obsLines.length > 0 ? obsLines.join(" | ").substring(0, 70) : undefined

  const result = await provider.createShipment({
    reference: shipmentInput.ref || `TRK-${Date.now().toString().slice(-8)}`,
    sender: { ...shipmentInput.sender, country: shipmentInput.sender.country || "PT" },
    recipient: { ...shipmentInput.recipient, country: shipmentInput.recipient.country || "PT" },
    weightKg: shipmentInput.weightKg || 1,
    volumes: shipmentInput.volumes || 1,
    dimensionsCm: shipmentInput.dimensionsCm,
    subProduct: shipmentInput.subProduct,
    codValue: shipmentInput.codValue,
    isReturn: shipmentInput.isReturn,
    specialServices: [], // CTT rejects SpecialServiceType for EMSF056.01, so we map them as observations
    observations: observationsString,
    autoClose: shipmentInput.autoClose,
    cttExportDetails: shipmentInput.cttExportDetails,
  })

  if (result.success && result.trackingNumber) {
    const trackingNumber = result.trackingNumber
    const rawLabel = result.labelBase64 || ""
    const labelBase64 = await convertZplToPdfBase64(rawLabel)

    // Atualizar base de dados se shipmentId estiver presente
    if (shipmentInput.id) {
      const supabase = createAdminClient()
      try {
        await supabase
          .from("shipments")
          .update({
            tracking_number: trackingNumber,
            carrier_tracking_number: trackingNumber,
            carrier_code: "ctt_expresso",
            status: "pendente",
            updated_at: new Date().toISOString(),
          })
          .eq("id", shipmentInput.id)
      } catch (e: any) {
        console.warn("Could not update shipments table:", e?.message)
      }

      // Atualizar audit_log com metadados ricos CTT
      try {
        const { data: existingLogs } = await supabase
          .from("audit_log")
          .select("id, details")
          .eq("action", "shipment_data")
        
        const targetLog = existingLogs?.find((l: any) => l.details?.id === shipmentInput.id)
        if (targetLog) {
          await supabase.from("audit_log").update({
            details: {
              ...targetLog.details,
              tracking_number: trackingNumber,
              ctt_object_id: trackingNumber,
              ctt_delivery_note_id: result.carrierShipmentId,
              ctt_label_base64: labelBase64,
              status: "pendente",
              updated_at: new Date().toISOString(),
            }
          }).eq("id", targetLog.id)
        }
      } catch (e: any) {
        console.warn("Could not update audit_log with CTT details:", e?.message)
      }

      // Registar evento de tracking inicial
      try {
        await supabase.from("tracking_events").insert({
          tenant_id: (await getTenantId()),
          shipment_id: shipmentInput.id,
          event_code: "EMA",
          description: "Aceitação CTT Expresso - Rótulo Criado",
        })
      } catch {}
    }

    revalidatePath("/ops/envios")
    return {
      success: true,
      trackingNumber,
      deliveryNoteId: result.carrierShipmentId,
      labelBase64,
      fileName: `${trackingNumber}.pdf`,
    }
  }

  return {
    success: false,
    error: result.error || "Falha na criação do envio pelo provedor",
    errors: [{ Code: 99, Message: result.error || "Erro desconhecido" }],
  }
}

/** Fecha o manifesto confirmado pelos CTT, sem alterar o estado de transporte. */
export async function closeCttShipmentsAction(shipmentIds?: string[]) {
  const ctx = await requireUser()
  let result
  try {
    result = await closeCttManifest(ctx.tenant_id, shipmentIds, ctx.role === 'client' ? ctx.client_id! : undefined)
  } catch {
    return { success: false, count: 0, error: "Não foi possível concluir o pedido de manifesto. Confirme o resultado com os CTT antes de repetir." }
  }
  if (result.success) {
    try {
      revalidatePath("/ops/envios")
      revalidatePath("/ops")
      revalidatePath("/app/[storeSlug]/envios", "page")
    } catch {
      // The carrier confirmation must not turn into an apparent failed close.
    }
  }
  return result
}

/**
 * Sincroniza o estado de tracking com a transportadora (CTT Expresso ou Correos Express)
 * Mantém retrocompatibilidade total com todos os componentes da interface (UI).
 */
export async function syncCttTrackingAction(trackingNumber: string, shipmentId?: string) {
  const ctx = await requireUser()
  const res = await syncShipmentTracking(
    { trackingNumber, shipmentId },
    {
      skipAuth: ctx.role !== "client",
      userRole: ctx.role,
      clientId: ctx.client_id,
      tenantId: ctx.tenant_id,
    }
  )

  revalidatePath("/ops/envios")
  revalidatePath("/ops")
  revalidatePath("/app/[storeSlug]/envios", "page")

  return res
}


/**
 * Agenda uma recolha junto da transportadora (CTT Expresso ou Correos Express)
 */
export async function scheduleCttPickupAction(input: {
  requester?: CTTPickupRequester
  connection_id?: string
  carrier_code?: string
  client_id?: string
  date: string
  startHour: string
  endHour: string
  volumes: number
  weightKg: number
  heaviestWeightKg?: number
  pickupDestination?: "PT" | "ES" | "RM"
  biggestParcelDimensionsCm?: { length: number; width: number; height: number }
  sender: { name: string; contact?: string; address: string; country?: string; zip: string; city: string; phone: string; mobilePhone?: string; email?: string }
  observations?: string
}) {
  await requireEmployee()
  const heaviestWeightKg = input.heaviestWeightKg ?? input.weightKg
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0 ||
      !Number.isFinite(heaviestWeightKg) || heaviestWeightKg <= 0 || heaviestWeightKg > input.weightKg ||
      !Number.isInteger(input.volumes) || input.volumes < 1) {
    return { success: false, error: "Confirme os pesos e o número de volumes. O volume mais pesado não pode exceder o peso total." }
  }
  const supabase = createAdminClient()
  const tenantId = await getTenantId()

  // 1. Detetar operadora através da ligação selecionada
  let carrierCode = input.carrier_code || "ctt_expresso"
  if (input.connection_id) {
    try {
      const { data: conn } = await supabase
        .from("carrier_connections")
        .select("carrier_code")
        .eq("tenant_id", tenantId)
        .eq("id", input.connection_id)
        .single()
      if (conn?.carrier_code) {
        carrierCode = conn.carrier_code
      }
    } catch {}
  }

  let result: { success: boolean; pickupNumber?: string; error?: string } = { success: false }
  let metadataSaved = true
  let carrierName = carrierCode === "correos_express" ? "Correos Express" : "CTT Expresso"

  // 2. Chamar o webservice da transportadora correta
  if (carrierCode === "correos_express") {
    try {
      const { resolveCorreosCredentials } = await import("@/lib/services/carriers/credentials")
      const { CorreosPickupService } = await import("@/lib/services/correos")

      const correosCreds = await resolveCorreosCredentials(input.connection_id)
      const pickupService = new CorreosPickupService()
      result = await pickupService.createPickup(correosCreds, {
        date: input.date,
        startHour: input.startHour,
        endHour: input.endHour,
        volumes: input.volumes,
        weightKg: input.weightKg,
        heaviestWeightKg,
        sender: input.sender,
        observations: input.observations,
      })
    } catch (cexErr: any) {
      return { success: false, error: cexErr.message || "Erro na comunicação com a Correos Express" }
    }
  } else {
    try {
      const creds = await resolveCttCredentials(input.connection_id?.startsWith("default-") ? undefined : input.connection_id)
      if (!creds.auth_id?.trim() || !creds.client_number?.trim() || !creds.contract_number?.trim()) {
        throw new Error("A ligação CTT não tem as credenciais completas. Confirme o número de cliente, contrato e chave de autenticação em Configuração → Webservices.")
      }
      const provider = new CttProvider()
      await provider.initialize(creds)

      result = await provider.createPickup({
        requester: input.requester,
        date: input.date,
        startHour: input.startHour,
        endHour: input.endHour,
        volumes: input.volumes,
        weightKg: input.weightKg,
        heaviestWeightKg,
        pickupDestination: input.pickupDestination,
        biggestParcelDimensionsCm: input.biggestParcelDimensionsCm,
        sender: {
          name: input.sender.name,
          contact: input.sender.contact,
          country: input.sender.country,
          address: input.sender.address,
          zip: input.sender.zip,
          city: input.sender.city,
          phone: input.sender.phone,
          mobilePhone: input.sender.mobilePhone,
          email: input.sender.email,
        },
        observations: input.observations,
      })
    } catch (cttErr: any) {
      return { success: false, error: cttErr.message || "Erro na comunicação com os CTT Expresso" }
    }
  }

  if (result.success && result.pickupNumber) {
    let recolhaId = ""
    try {
      const { data: ins } = await supabase.from("recolhas").insert({
        tenant_id: tenantId,
        status: "Agendado",
        scheduled_date: input.date,
        ctt_pickup_id: result.pickupNumber,
      }).select("id").single()
      recolhaId = ins?.id || ""
    } catch (dbErr: any) {
      console.warn("Could not insert into recolhas table:", dbErr?.message)
    }

    // Guardar metadados enriquecidos no audit_log para permitir histórico detalhado unificado
    try {
      const { error: metadataError } = await supabase.from("audit_log").insert({
        tenant_id: tenantId,
        action: "recolha_data",
        details: {
          recolha_id: recolhaId,
          pickup_id: result.pickupNumber,
          carrier_code: carrierCode,
          carrier_name: carrierName,
          client_id: input.client_id || null,
          sender_name: input.sender.name,
          sender_address: input.sender.address,
          sender_city: input.sender.city,
          sender_zip: input.sender.zip,
          sender_contact: input.sender.contact,
          sender_phone: input.sender.phone,
          sender_mobile: input.sender.mobilePhone,
          sender_email: input.sender.email,
          sender_country: input.sender.country,
          requester: input.requester || (carrierCode === "ctt_expresso" ? getCttPickupRequester() : undefined),
          dimensions: input.biggestParcelDimensionsCm,
          destination: input.pickupDestination,
          connection_id: input.connection_id,
          volumes: input.volumes,
          weight_kg: input.weightKg,
          heaviest_weight_kg: heaviestWeightKg,
          period: `${input.startHour}-${input.endHour}`,
          observations: input.observations,
          created_at: new Date().toISOString(),
        }
      })
      if (metadataError) {
        metadataSaved = false
        console.error("CTT pickup was accepted, but its detailed metadata was not saved:", metadataError.message)
      }
    } catch (auditErr: any) {
      metadataSaved = false
      console.warn("Could not save recolha metadata to audit_log:", auditErr?.message)
    }

    // Disparar email de confirmação se fornecido
    if (input.sender.email) {
      try {
      const { sendEmail, compileTemplate } = await import("@/lib/email/resend")
      const { emailTemplates } = await import("@/app/ops/configuracao/notificacoes/templates")
      
      const html = compileTemplate(emailTemplates.pickup_scheduled, {
        date: input.date,
        time_period: `${input.startHour}h - ${input.endHour}h`,
        address: `${input.sender.address}, ${input.sender.zip} ${input.sender.city}`,
        volumes: input.volumes,
        tracking_url: publicUrl("/app/recolhas", "portal")
      })

      sendEmail({
        to: input.sender.email,
        subject: `Linke | Recolha ${carrierName} Agendada com Sucesso (${result.pickupNumber})`,
        html,
      }).catch(err => console.error("Error sending pickup email:", err))
      } catch {
        // A missing public email URL must not turn an accepted pickup into a failed booking.
        console.warn("A recolha foi aceite, mas não foi possível preparar o email de confirmação.")
      }
    }

    revalidatePath("/ops/envios/recolhas")
    revalidatePath("/ops/envios")
  }

  return {
    ...result,
    carrier_code: carrierCode,
    carrier_name: carrierName,
    // A carrier may accept the booking even if the separate local detail archive fails.
    // Keep those outcomes distinct so operators know when the details need attention.
    ...(result.success && result.pickupNumber ? { metadata_saved: metadataSaved } : {}),
  }
}

export const scheduleCarrierPickupAction = scheduleCttPickupAction

/**
 * Consulta a lista oficial de produtos/subprodutos ativados nos CTT via RecolhasWS (GetProdutosRecolha)
 */
export async function fetchCttAvailableProductsAction() {
  await requireEmployee()
  try {
    const creds = await getCttCredentials()
    const pickupService = new CTTPickupService()
    const products = await pickupService.getProdutosRecolha(creds)
    return { success: true, products }
  } catch (err: any) {
    return { success: false, error: err?.message, products: [] }
  }
}

/**
 * Valida a cobertura de rota e subproduto entre 2 códigos postais via RecolhasWS (GetAreaInfluencia)
 */
export async function validateCttRouteAction(options: {
  cp4Origem: string
  cp4Destino: string
  subproduto: string
  cdPaisDestino?: string
  seps?: string[]
}) {
  await requireEmployee()
  try {
    const creds = await getCttCredentials()
    const pickupService = new CTTPickupService()
    const result = await pickupService.getAreaInfluencia(creds, options)
    return { success: true, ...result }
  } catch (err: any) {
    return { success: false, error: err?.message, valido: false }
  }
}

/**
 * Converte uma etiqueta ZPL para PDF Base64 via Labelary (server-side, sem CORS).
 * Chamada pelo cliente quando a etiqueta guardada é ZPL cru em vez de PDF Base64.
 */
export async function convertZplToPdfAction(
  label: string
): Promise<{ success: boolean; base64?: string; error?: string }> {
  await requireUser()
  if (!label) {
    return { success: false, error: "Etiqueta vazia" }
  }

  // Decodificar entidades XML se ainda existirem
  let zpl = label.trim()
    .replace(/&#xD;/gi, "\r")
    .replace(/&#xA;/gi, "\n")
    .replace(/&#x9;/gi, "\t")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")

  if (!zpl.startsWith("^XA")) {
    // Já é Base64 PDF — devolver tal como está
    return { success: true, base64: label }
  }

  // Tentar Labelary com timeout de 15s
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    console.log(`[Labelary] Iniciando conversão ZPL→PDF (${zpl.length} chars)`)

    const res = await fetch("https://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/", {
      method: "POST",
      headers: {
        "Accept": "application/pdf",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: zpl,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error(`[Labelary] Erro HTTP ${res.status}: ${body.slice(0, 200)}`)
      return { success: false, error: `Labelary respondeu com erro ${res.status}: ${res.statusText}` }
    }

    const arrayBuf = await res.arrayBuffer()
    const base64 = Buffer.from(arrayBuf).toString("base64")
    console.log(`[Labelary] Conversão OK — PDF Base64 com ${base64.length} chars`)
    return { success: true, base64 }

  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === "AbortError") {
      console.error("[Labelary] Timeout (15s) — Labelary não respondeu")
      return { success: false, error: "Timeout ao contactar Labelary (15s). Verifique a ligação à internet do servidor." }
    }
    console.error("[Labelary] Erro:", err.message)
    return { success: false, error: `Erro ao converter ZPL: ${err.message}` }
  }
}

let cachedDeliveryPoints: { timestamp: number; data: CTTPontoEntrega[] } | null = null
const CACHE_TTL_MS = 1000 * 60 * 30 // 30 minutos

/**
 * Obtém todos os pontos de pickup / entrega da CTT Expresso e parceiros
 */
export async function getPontosPickupCttAction(forceRefresh = false): Promise<{
  success: boolean
  points: CTTPontoEntrega[]
  cachedAt?: string
  total: number
  error?: string
}> {
  await requireEmployee()
  try {
    const now = Date.now()
    if (!forceRefresh && cachedDeliveryPoints && (now - cachedDeliveryPoints.timestamp < CACHE_TTL_MS)) {
      return {
        success: true,
        points: cachedDeliveryPoints.data,
        cachedAt: new Date(cachedDeliveryPoints.timestamp).toISOString(),
        total: cachedDeliveryPoints.data.length,
      }
    }

    const creds = await getCttCredentials()
    const referencesService = new CTTReferencesService()
    const points = await referencesService.getAllDeliveryPoints(creds)

    cachedDeliveryPoints = {
      timestamp: now,
      data: points,
    }

    return {
      success: true,
      points,
      cachedAt: new Date(now).toISOString(),
      total: points.length,
    }
  } catch (error: any) {
    console.error("[getPontosPickupCttAction] Erro ao carregar pontos CTT:", error)
    if (cachedDeliveryPoints) {
      return {
        success: true,
        points: cachedDeliveryPoints.data,
        cachedAt: new Date(cachedDeliveryPoints.timestamp).toISOString(),
        total: cachedDeliveryPoints.data.length,
        error: `Aviso: Atualização em tempo real falhou (${error.message}). A apresentar dados em cache.`,
      }
    }
    return {
      success: false,
      points: [],
      total: 0,
      error: error?.message || "Erro ao contactar o webservice da CTT Expresso",
    }
  }
}


import { CTT_TRACKING_EVENTS, CTT_NON_DELIVERY_REASONS, CTT_SITUATIONS } from "@/lib/services/ctt/ctt-types"

/**
 * Injeta um evento de Tracking manual no envio para testes / simulação
 */
export async function injectTrackingEventAction(
  shipmentId: string,
  trackingNumber: string,
  eventCode: string,
  reasonCode?: string,
  situationCode?: string
) {
  const ctx = await requireUser()
  const supabase = createAdminClient()
  if (ctx.role === 'client') {
    const { data: shipment } = await supabase.from('shipments').select('client_id').eq('id', shipmentId).single()
    if (shipment?.client_id !== ctx.client_id) return { success: false, error: 'Unauthorized' }
  }

  const cttEvent = CTT_TRACKING_EVENTS[eventCode]
  if (!cttEvent) {
    return { success: false, error: `Código de evento desconhecido: ${eventCode}` }
  }

  const description = CTTTrackingService.parseEvent(eventCode)
  const reasonDesc = reasonCode ? CTT_NON_DELIVERY_REASONS[reasonCode] : undefined
  const situationDesc = situationCode ? CTT_SITUATIONS[situationCode] : undefined

  const details = {
    tracking_number: trackingNumber,
    eventCode,
    description,
    reasonCode,
    reasonDesc,
    situationCode,
    situationDesc,
    location: "Centro de Testes CTT",
    timestamp: new Date().toISOString()
  }

  // 1. Inserir no tracking_events
  const { error: logError } = await supabase
    .from("tracking_events")
    .insert({
      tenant_id: "11111111-1111-1111-1111-111111111111", // (await getTenantId())
      shipment_id: shipmentId,
      event_code: eventCode,
      description: `${description}${reasonDesc ? ` | Razão: ${reasonDesc}` : ''}${situationDesc ? ` | Situação: ${situationDesc}` : ''}`,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    })

  if (logError) {
    console.error("Error inserting manual event:", logError)
    return { success: false, error: "Erro ao gravar evento na cronologia." }
  }

  // 2. Atualizar o estado principal do envio
  const { error: updateError } = await supabase
    .from("shipments")
    .update({
      status: cttEvent.tms_status,
      updated_at: new Date().toISOString()
    })
    .eq("id", shipmentId)

  if (updateError) {
    console.error("Error updating shipment status:", updateError)
    return { success: false, error: "Erro ao atualizar estado principal." }
  }

  revalidatePath(`/ops/envios`)
  
  return { success: true }
}
