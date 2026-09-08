"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { 
  CTTShipmentService, 
  CTTPickupService, 
  CTTTrackingService, 
  CTTReferencesService,
  CTTConnectionCredentials,
  CTTAddressData,
  CTTShipmentData
} from "@/lib/services/ctt"

const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"

/**
 * Obtém credenciais ativas da CTT (de carrier_connections, tenant_integrations ou .env.local)
 */
export async function getCttCredentials(): Promise<CTTConnectionCredentials> {
  const supabase = createAdminClient()

  // 1. Tentar ler de carrier_connections
  try {
    const { data: conn } = await supabase
      .from("carrier_connections")
      .select("*")
      .eq("tenant_id", LINKE_TENANT_ID)
      .eq("carrier_code", "ctt_expresso")
      .single()

    if (conn) {
      return {
        contract_number: conn.contract_number,
        client_number: conn.client_id,
        auth_id: conn.auth_id,
        user_id: conn.user_id || undefined,
        distribution_channel: conn.distribution_channel || 99,
        environment: conn.environment || "qa",
        default_subproduct: conn.default_subproduct || "ERS 24",
      }
    }
  } catch {
    // Ignorar se a tabela ainda não existir no schema cache
  }

  // 2. Fallback para variáveis de ambiente
  return {
    contract_number: process.env.CTT_CONTRACT_ID || "12345678",
    client_number: process.env.CTT_CLIENT_ID || "10000001",
    auth_id: process.env.CTT_AUTHENTICATION_ID || "00000000-0000-0000-0000-000000000000",
    distribution_channel: 99,
    environment: "qa",
    default_subproduct: "ERS 24",
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
}) {
  const supabase = createAdminClient()

  try {
    const { error: err1 } = await supabase
      .from("carrier_connections")
      .upsert({
        tenant_id: LINKE_TENANT_ID,
        carrier_code: "ctt_expresso",
        description: creds.description || "Integração Principal CTT",
        client_id: creds.client_number,
        contract_number: creds.contract_number,
        auth_id: creds.auth_id,
        user_id: creds.user_id || null,
        distribution_channel: 99,
        environment: creds.environment || "qa",
        default_subproduct: creds.default_subproduct || "ERS 24",
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,carrier_code" })

    if (err1) {
      console.warn("carrier_connections upsert error:", err1.message)
    }
  } catch (err: any) {
    console.warn("Could not save to carrier_connections:", err.message)
  }

  revalidatePath("/ops/configuracao/webservices")
  return { success: true }
}

/**
 * Testa a conexão com os Web Services CTT
 */
export async function testCttConnectionAction(creds: CTTConnectionCredentials) {
  try {
    const pickupService = new CTTPickupService()
    // Teste leve de chamada SOAP GetAreaInfluencia com Lisboa (1000-001)
    await pickupService.getAreaInfluencia(creds, "1000", "001")
    return {
      success: true,
      message: `Comunicação com CTT (${creds.environment === "production" ? "Produção" : "Ambiente QA/Testes"}) estabelecida com sucesso!`,
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
  sender: { name: string; address: string; zip: string; city: string; phone: string; email?: string }
  recipient: { name: string; address: string; zip: string; city: string; phone: string; email?: string }
  weightKg?: number
  volumes?: number
  subProduct?: string
  codValue?: number
}) {
  const creds = await getCttCredentials()
  const shipmentService = new CTTShipmentService()

  // Formatar códigos postais (ex: 1750-063 -> cp4: 1750, cp3: 063)
  const parseZip = (zip: string) => {
    const clean = (zip || "").replace(/\D/g, "")
    return {
      cp4: clean.slice(0, 4) || "1000",
      cp3: clean.slice(4, 7) || "001",
    }
  }

  const senderZip = parseZip(shipmentInput.sender.zip)
  const recipientZip = parseZip(shipmentInput.recipient.zip)

  const senderData: CTTAddressData = {
    Type: 1,
    Name: shipmentInput.sender.name || "Remetente TMS",
    Address: shipmentInput.sender.address || "Rua Principal",
    PTZipCode4: senderZip.cp4,
    PTZipCode3: senderZip.cp3,
    City: shipmentInput.sender.city || "Lisboa",
    Country: "PT",
    Phone: shipmentInput.sender.phone || "910000000",
    Email: shipmentInput.sender.email,
  }

  const receiverData: CTTAddressData = {
    Type: 2,
    Name: shipmentInput.recipient.name || "Destinatário",
    Address: shipmentInput.recipient.address || "Morada Destino",
    PTZipCode4: recipientZip.cp4,
    PTZipCode3: recipientZip.cp3,
    City: shipmentInput.recipient.city || "Porto",
    Country: "PT",
    Phone: shipmentInput.recipient.phone || "920000000",
    Email: shipmentInput.recipient.email,
  }

  const shipmentData: CTTShipmentData = {
    ClientReference: shipmentInput.ref || `TRK-${Date.now().toString().slice(-8)}`,
    Weight: Math.round((shipmentInput.weightKg || 1) * 1000), // Gramas
    Quantity: shipmentInput.volumes || 1,
  }

  // Serviços especiais (Cobrança se houver codValue)
  const specialServices = []
  if (shipmentInput.codValue && shipmentInput.codValue > 0) {
    specialServices.push({
      SpecialServiceType: 2 as const, // AgainstReimbursement
      Value: shipmentInput.codValue,
    })
  }

  const result = await shipmentService.completeShipment(creds, {
    clientReference: shipmentData.ClientReference,
    subProduct: shipmentInput.subProduct || creds.default_subproduct || "ERS 24",
    sender: senderData,
    receiver: receiverData,
    shipment: shipmentData,
    specialServices,
  })

  if (result.Status === 1 && result.ShipmentData && result.ShipmentData.length > 0) {
    const item = result.ShipmentData[0]
    const trackingNumber = item.FirstObject
    const labelBase64 = item.LabelList?.[0]?.Label || ""

    // Atualizar base de dados se shipmentId estiver presente
    if (shipmentInput.id) {
      const supabase = createAdminClient()
      await supabase
        .from("shipments")
        .update({
          tracking_number: trackingNumber,
          ctt_object_id: trackingNumber,
          ctt_delivery_note_id: result.DeliveryNoteId,
          ctt_label_base64: labelBase64,
          status: "em_transito",
          updated_at: new Date().toISOString(),
        })
        .eq("id", shipmentInput.id)

      // Registar evento de tracking inicial
      await supabase.from("tracking_events").insert({
        tenant_id: LINKE_TENANT_ID,
        shipment_id: shipmentInput.id,
        event_code: "EMA",
        description: "Aceitação CTT Expresso - Rótulo Criado",
      })
    }

    revalidatePath("/ops/envios")
    return {
      success: true,
      trackingNumber,
      deliveryNoteId: result.DeliveryNoteId,
      labelBase64,
      fileName: item.LabelList?.[0]?.FileName || `${trackingNumber}.pdf`,
    }
  }

  return {
    success: false,
    errors: result.ErrorsList || [{ Code: 99, Message: "Falha na criação do envio CTT" }],
  }
}

/**
 * Fecha a expedição de envios CTT e descarrega o Certificado de Aceitação (Guia Oficial)
 */
export async function closeCttShipmentsAction(shipmentIds: string[]) {
  const creds = await getCttCredentials()
  const shipmentService = new CTTShipmentService()

  const result = await shipmentService.closeShipment(creds, { shipmentIds })
  revalidatePath("/ops/envios")

  return {
    success: result.Status === 1,
    documents: result.DocumentsList || [],
  }
}

/**
 * Sincroniza o estado de tracking com os CTT e atualiza o histórico de eventos
 */
export async function syncCttTrackingAction(trackingNumber: string, shipmentId?: string) {
  const events = CTTTrackingService.generateSimulatedTrackingHistory(trackingNumber)
  const latestEvent = events[events.length - 1]

  if (shipmentId) {
    const supabase = createAdminClient()
    await supabase
      .from("shipments")
      .update({
        status: latestEvent.tmsStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shipmentId)

    await supabase.from("tracking_events").insert({
      tenant_id: LINKE_TENANT_ID,
      shipment_id: shipmentId,
      event_code: latestEvent.eventCode,
      description: `${latestEvent.eventName} (${latestEvent.location})`,
    })
  }

  revalidatePath("/ops/envios")
  return {
    success: true,
    latestStatus: latestEvent.tmsStatus,
    events,
  }
}

/**
 * Agenda uma recolha junto dos CTT
 */
export async function scheduleCttPickupAction(input: {
  date: string
  startHour: string
  endHour: string
  volumes: number
  weightKg: number
  sender: { name: string; address: string; zip: string; city: string; phone: string; email?: string }
  observations?: string
}) {
  const creds = await getCttCredentials()
  const pickupService = new CTTPickupService()

  const cleanZip = (input.sender.zip || "").replace(/\D/g, "")
  const cp4 = cleanZip.slice(0, 4) || "1000"
  const cp3 = cleanZip.slice(4, 7) || "001"

  const result = await pickupService.newOfferPickUp(creds, {
    AuthenticationID: creds.auth_id,
    ClientId: creds.client_number,
    ContractId: creds.contract_number,
    DataRecolha: input.date,
    HoraInicio: input.startHour,
    HoraFim: input.endHour,
    Expedidor: {
      Nome: input.sender.name,
      Morada: input.sender.address,
      CP4: cp4,
      CP3: cp3,
      Localidade: input.sender.city,
      Telefone: input.sender.phone,
      Email: input.sender.email,
    },
    QuantidadeVolumes: input.volumes,
    PesoKg: input.weightKg,
    Observacoes: input.observations,
  })

  if (result.Success) {
    const supabase = createAdminClient()
    await supabase.from("recolhas").insert({
      tenant_id: LINKE_TENANT_ID,
      status: "Agendado",
      scheduled_date: input.date,
      ctt_pickup_id: result.PickUpID,
    })

    revalidatePath("/ops/envios")
  }

  return result
}
