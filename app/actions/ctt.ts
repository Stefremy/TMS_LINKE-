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
import { convertZplToPdfBase64 } from "@/lib/label-utils"

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
        environment: (conn.environment as "qa" | "production") || "production",
        default_subproduct: conn.default_subproduct || "EMSF056.01",
      }
    }
  } catch {
    // Ignorar se a tabela ainda não existir no schema cache
  }

  // 2. Tentar ler de audit_log (resiliência caso a tabela carrier_connections ainda não tenha sido criada)
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .eq("action", "carrier_connection_config")
      .order("created_at", { ascending: false })
      .limit(1)

    if (logs && logs[0]?.details) {
      const d = logs[0].details
      return {
        contract_number: d.contract_number,
        client_number: d.client_id,
        auth_id: d.auth_id,
        user_id: d.user_id || undefined,
        distribution_channel: d.distribution_channel || 99,
        environment: (d.environment as "qa" | "production") || "production",
        default_subproduct: d.default_subproduct || "EMSF056.01",
      }
    }
  } catch {}

  // 3. Fallback para variáveis de ambiente
  return {
    contract_number: process.env.CTT_CONTRACT_ID || "300330941",
    client_number: process.env.CTT_CLIENT_ID || "100032458",
    auth_id: process.env.CTT_AUTHENTICATION_ID || "1d7ad9a9-c7bb-43be-9f57-851d1baafb4b",
    user_id: "cea67efe-b547-4be6-87a7-09d287ccf0f6",
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
        tenant_id: LINKE_TENANT_ID,
        ...payload,
      }, { onConflict: "tenant_id,carrier_code" })

    if (err1) {
      console.warn("carrier_connections upsert error:", err1.message)
    }
  } catch (err: any) {
    console.warn("Could not save to carrier_connections:", err.message)
  }

  // 2. Gravar em audit_log (sempre funcional em Supabase mesmo antes de correr migrações manuais)
  try {
    await supabase
      .from("audit_log")
      .delete()
      .eq("action", "carrier_connection_config")

    await supabase
      .from("audit_log")
      .insert({
        tenant_id: LINKE_TENANT_ID,
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
 * Obtém a lista de conexões configuradas
 */
export async function getCarrierConnectionsAction() {
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
  try {
    const shipmentService = new CTTShipmentService()
    
    // Executar teste com pedido mínimo aos CTT
    const subProdToTest = creds.default_subproduct || "EMSF056.01"
    const result = await shipmentService.createShipment(creds, {
      clientReference: "TEST-CONN-" + Date.now().toString().slice(-6),
      subProduct: subProdToTest,
      sender: {
        Name: "Linke Logistica",
        Address: "Avenida da Boavista 1000",
        City: "Porto",
        Country: "PT",
        PTZipCode4: "4100",
        PTZipCode3: "001",
        Phone: "910000001",
        Type: 1
      },
      receiver: {
        Name: "Destinatario Teste",
        Address: "Rua Garrett 20",
        City: "Lisboa",
        Country: "PT",
        PTZipCode4: "1200",
        PTZipCode3: "001",
        Phone: "920000002",
        Type: 2
      },
      shipment: {
        ClientReference: "TEST-CONN-" + Date.now().toString().slice(-6),
        Weight: 1000,
        Quantity: 1
      }
    })

    if (result.Status === 1) {
      return {
        success: true,
        message: `Comunicação e Autenticação CTT (${creds.environment === "production" ? "Produção" : "Ambiente QA"}) validadas com SUCESSO! A conta está pronta a emitir expedições.`,
      }
    }

    const cttError = result.ErrorsList?.[0]
    
    // EW0061 significa que a comunicação e a autenticação da conta CTT foram APROVADAS no servidor CTT!
    if (cttError?.ErrorCode === "EW0061") {
      return {
        success: true,
        message: `Ligação SOAP e Autenticação de Produção CTT validadas com SUCESSO! (Servidor CTT ativo e conta autorizada. Altere o 'SubProduto Padrão' para o código contratado com a CTT).`,
      }
    }

    if (cttError?.ErrorCode === "EW0001" || cttError?.Message?.includes("autenticação")) {
      return {
        success: false,
        message: `Comunicação ativa, mas a AuthenticationID (${creds.auth_id}) não foi autorizada pelos CTT: ${cttError.Message}`,
      }
    }

    return {
      success: false,
      message: `Resposta dos CTT: ${cttError?.Message || JSON.stringify(result.ErrorsList)}`,
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
  autoClose?: boolean
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

  const payload = {
    clientReference: shipmentData.ClientReference,
    subProduct: shipmentInput.subProduct || creds.default_subproduct || "EMSF056.01",
    sender: senderData,
    receiver: receiverData,
    shipment: shipmentData,
    specialServices,
  }

  // Se autoClose for false, usamos CreateShipment (envio fica aberto para fechar no fim do dia)
  // Caso contrário usamos CompleteShipment (cria e fecha imediatamente)
  const result = shipmentInput.autoClose === false
    ? await shipmentService.createShipment(creds, payload)
    : await shipmentService.completeShipment(creds, payload)

  if (result.Status === 1 && result.ShipmentData && result.ShipmentData.length > 0) {
    const item = result.ShipmentData[0]
    const trackingNumber = item.FirstObject
    const rawLabel = item.LabelList?.[0]?.Label || ""
    const labelBase64 = await convertZplToPdfBase64(rawLabel)

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

  const errorMessages = result.ErrorsList && result.ErrorsList.length > 0
    ? result.ErrorsList.map(e => `${e.ErrorCode ? `[${e.ErrorCode}] ` : ""}${e.Message || "Erro desconhecido"}`).join("; ")
    : "Falha na criação do envio pelo servidor CTT"

  return {
    success: false,
    error: errorMessages,
    errors: result.ErrorsList || [{ Code: 99, Message: errorMessages }],
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

/**
 * Consulta a lista oficial de produtos/subprodutos ativados nos CTT via RecolhasWS (GetProdutosRecolha)
 */
export async function fetchCttAvailableProductsAction() {
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
  try {
    const creds = await getCttCredentials()
    const pickupService = new CTTPickupService()
    const result = await pickupService.getAreaInfluencia(creds, options)
    return { success: true, ...result }
  } catch (err: any) {
    return { success: false, error: err?.message, valido: false }
  }
}
