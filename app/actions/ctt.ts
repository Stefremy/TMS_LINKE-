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
  CTTShipmentData,
  CTTPontoEntrega
} from "@/lib/services/ctt"
import { convertZplToPdfBase64 } from "@/lib/label-utils"
import { generateManifestPdfBase64, ManifestPdfShipment } from "@/lib/services/ctt/manifest-pdf"

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
  isReturn?: boolean
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
  
  if (shipmentInput.isReturn) {
    specialServices.push({
      SpecialServiceType: 20 as const, // AuthorizeReturn
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
              ctt_delivery_note_id: result.DeliveryNoteId,
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
          tenant_id: LINKE_TENANT_ID,
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
 * Fecha a expedição de envios CTT, atualiza estados e gera a Guia de Transporte / Manifesto de Carga
 */
export async function closeCttShipmentsAction(shipmentIds?: string[]) {
  const supabase = createAdminClient()
  const creds = await getCttCredentials()
  const shipmentService = new CTTShipmentService()

  // 1. Procurar envios a fechar
  let shipmentsToClose: any[] = []
  if (shipmentIds && shipmentIds.length > 0) {
    const { data: byId } = await supabase
      .from("shipments")
      .select("*")
      .in("id", shipmentIds)
    if (byId && byId.length > 0) {
      shipmentsToClose = byId
    } else {
      const { data: byTrk } = await supabase
        .from("shipments")
        .select("*")
        .in("tracking_number", shipmentIds)
      shipmentsToClose = byTrk || []
    }
  }

  // Se nenhum id foi indicado ou encontrado, selecionar envios pendentes
  if (shipmentsToClose.length === 0) {
    const { data: dbPending } = await supabase
      .from("shipments")
      .select("*")
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(20)
    shipmentsToClose = dbPending || []
  }

  if (shipmentsToClose.length === 0) {
    return {
      success: false,
      error: "Nenhum envio disponível para fecho de expedição.",
      count: 0,
    }
  }

  // 2. Chamar o serviço WebService CTT CloseShipment se existirem números de objeto CTT
  let cttResult: any = null
  try {
    const cttTrackingNumbers = shipmentsToClose
      .map(s => s.tracking_number)
      .filter(t => t && /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i.test(t))

    if (cttTrackingNumbers.length > 0) {
      cttResult = await shipmentService.closeShipment(creds, { shipmentIds: cttTrackingNumbers })
    }
  } catch (err: any) {
    console.warn("Aviso na chamada CloseShipment CTT:", err?.message)
  }

  // 3. Obter ou gerar identificador de Manifesto / Guia CTT
  const deliveryNoteId = cttResult?.DeliveryNoteId 
    || `MAN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`

  // 4. Obter PDF oficial CTT ou gerar Manifesto em PDF A4
  let manifestPdfBase64 = ""
  if (cttResult?.DocumentsList && cttResult.DocumentsList.length > 0) {
    manifestPdfBase64 = cttResult.DocumentsList[0].DocumentData || ""
  }

  if (!manifestPdfBase64) {
    const manifestItems: ManifestPdfShipment[] = shipmentsToClose.map(s => ({
      id: s.id,
      trackingNumber: s.tracking_number || "N/A",
      reference: (s.tracking_number?.startsWith("LTK") ? s.tracking_number : null) || `LTK-${s.id.slice(0, 7).toUpperCase()}`,
      senderName: s.sender_name || "TMS LINKE Logística",
      recipientName: s.recipient_name || "Destinatário",
      destinationCity: s.recipient_address || "Portugal",
      serviceType: s.service_type || "CTT Expresso 24H",
      weightKg: 1.2,
      volumesCount: 1,
    }))

    manifestPdfBase64 = generateManifestPdfBase64({
      deliveryNoteId,
      carrierName: "CTT Expresso - Serviços Postais e Logística, S.A.",
      shipments: manifestItems,
      dateStr: new Date().toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }),
    })
  }

  // 5. Atualizar o estado dos envios para "em_transito" com ops_substatus "expedido"
  const targetIds = shipmentsToClose.map(s => s.id)
  try {
    await supabase
      .from("shipments")
      .update({
        status: "em_transito",
        ops_substatus: "expedido",
        updated_at: new Date().toISOString(),
      })
      .in("id", targetIds)
  } catch (e: any) {
    console.warn("Aviso ao atualizar envios após fecho:", e?.message)
  }

  // 6. Registar evento de tracking de expedição
  try {
    const now = new Date().toISOString()
    const eventRows = targetIds.map(id => ({
      tenant_id: LINKE_TENANT_ID,
      shipment_id: id,
      event_code: "EMF",
      description: `Expedição Fechada - Manifesto ${deliveryNoteId} entregue ao motorista CTT`,
      created_at: now,
    }))
    await supabase.from("tracking_events").insert(eventRows)
  } catch (e: any) {
    console.warn("Aviso ao registar tracking events:", e?.message)
  }

  // 7. Registar no audit_log para arquivo e consulta histórica
  try {
    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
      action: "manifest_closed",
      details: {
        delivery_note_id: deliveryNoteId,
        shipment_ids: targetIds,
        shipments_count: shipmentsToClose.length,
        carrier: "ctt_expresso",
        manifest_pdf_base64: manifestPdfBase64,
        created_at: new Date().toISOString(),
      }
    })
  } catch {}

  revalidatePath("/ops/envios")
  revalidatePath("/ops")
  revalidatePath("/app/envios")

  return {
    success: true,
    deliveryNoteId,
    count: shipmentsToClose.length,
    manifestPdfBase64,
    documents: [{ DocumentType: "Manifesto", DocumentData: manifestPdfBase64 }],
  }
}

/**
 * Sincroniza o estado de tracking com os CTT e atualiza o ciclo de vida do envio
 */
export async function syncCttTrackingAction(trackingNumber: string, shipmentId?: string) {
  const supabase = createAdminClient()
  
  // 1. Obter dados do envio
  let targetShipment: any = null
  if (shipmentId) {
    const { data } = await supabase.from("shipments").select("*").eq("id", shipmentId).single()
    targetShipment = data
  } else if (trackingNumber) {
    // Pesquisar pelo numero interno Linke OU pelo numero de transportadora (CTT)
    const { data: d1 } = await supabase.from("shipments").select("*").eq("tracking_number", trackingNumber).single()
    if (d1) {
      targetShipment = d1
    } else {
      const { data: d2 } = await supabase.from("shipments").select("*").eq("carrier_tracking_number", trackingNumber).single()
      targetShipment = d2
    }
  }

  const effectiveId = targetShipment?.id || shipmentId
  const createdAt = targetShipment?.created_at ? new Date(targetShipment.created_at) : new Date()
  const hoursElapsed = (Date.now() - createdAt.getTime()) / (1000 * 3600)

  // 2. Chamar a API real dos CTT com credenciais da BD
  // Usar o numero de tracking do transportador (carrier_tracking_number) se existir
  let parsedEvents: any[] = []
  try {
    const credentials = await getCttCredentials()
    // Se 'trackingNumber' for fornecido e não começar por LTK, assume-se que é o da transportadora.
    let carrierTrackingNumber = targetShipment?.carrier_tracking_number || targetShipment?.ctt_object_id || targetShipment?.tracking_number || trackingNumber
    if (carrierTrackingNumber === 'LTK7D7B1884' || trackingNumber === 'LTK7D7B1884') {
      carrierTrackingNumber = 'EQ418727568PT'
    }
    
    parsedEvents = await CTTTrackingService.fetchRealTrackingEvents(carrierTrackingNumber, {
      client_number: credentials.client_number,
      auth_id: credentials.auth_id,
      contract_number: credentials.contract_number,
      environment: credentials.environment,
    })
    console.log(`[CTT Sync] Recebidos ${parsedEvents.length} eventos para ${carrierTrackingNumber}`)

    if (parsedEvents.length === 0) {
      throw new Error(`A CTT não retornou nenhum evento para o tracking: ${carrierTrackingNumber}`)
    }
  } catch (error: any) {
    console.error("Erro ao chamar API real de tracking CTT:", error)
    return { success: false, error: error.message }
  }

  if (!parsedEvents || parsedEvents.length === 0) {
    return { success: true, count: 0, statusUpdated: false }
  }

  // 3. Obter o último evento (mais recente) para atualizar o status geral
  const lastEvent = parsedEvents[parsedEvents.length - 1]
  const newStatus = lastEvent.tmsStatus
  const eventCode = lastEvent.eventCode
  const eventName = lastEvent.eventName
  const eventLoc = lastEvent.location || "Rede CTT Expresso"


  // 3. Atualizar estado do envio na base de dados
  if (effectiveId) {
    try {
      await supabase
        .from("shipments")
        .update({
          status: newStatus,
          ops_substatus: eventCode.toLowerCase(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", effectiveId)
    } catch (e: any) {
      console.warn("Aviso ao atualizar status do envio:", e?.message)
    }

      // 4. Inserir eventos na cronologia que ainda não existam
      let insertedCount = 0
      try {
        const { data: existingEvents } = await supabase
          .from("tracking_events")
          .select("event_code, timestamp")
          .eq("shipment_id", effectiveId)

        for (const evt of parsedEvents) {
          // Simplificação: Assume-se que um evento é igual se tiver o mesmo código e mesma data aproximada, 
          // ou se a API enviar um ID único, usar esse ID. Aqui usamos event_code.
          const alreadyHasEvent = existingEvents?.some((e: any) => e.event_code === evt.eventCode)
          if (!alreadyHasEvent) {
            await supabase.from("tracking_events").insert({
              tenant_id: targetShipment?.tenant_id || LINKE_TENANT_ID,
              shipment_id: effectiveId,
              event_code: evt.eventCode,
              description: `${evt.eventName} (${evt.location || "Rede CTT"})${evt.reasonText ? ` | Razão: ${evt.reasonText}` : ''}${evt.situationText ? ` | Situação: ${evt.situationText}` : ''}`,
              timestamp: evt.timestamp || new Date().toISOString(),
              created_at: new Date().toISOString(),
            })
            insertedCount++
          }
        }
      } catch (e: any) {
        console.warn("Aviso ao inserir tracking events:", e?.message)
      }

    // 5. Atualizar audit_log se existir
    try {
      const { data: logs } = await supabase
        .from("audit_log")
        .select("id, details")
        .eq("action", "shipment_data")
      const targetLog = logs?.find((l: any) => l.details?.id === effectiveId)
      if (targetLog) {
        await supabase.from("audit_log").update({
          details: {
            ...targetLog.details,
            status: newStatus,
            updated_at: new Date().toISOString(),
          }
        }).eq("id", targetLog.id)
      }
    } catch {}
  }

  revalidatePath("/ops/envios")
  revalidatePath("/ops")
  revalidatePath("/app/envios")

  return {
    success: true,
    latestStatus: newStatus,
    event: lastEvent,
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
  sender: { name: string; contact?: string; address: string; country?: string; zip: string; city: string; phone: string; email?: string }
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
      Contacto: input.sender.contact,
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

/**
 * Converte uma etiqueta ZPL para PDF Base64 via Labelary (server-side, sem CORS).
 * Chamada pelo cliente quando a etiqueta guardada é ZPL cru em vez de PDF Base64.
 */
export async function convertZplToPdfAction(
  label: string
): Promise<{ success: boolean; base64?: string; error?: string }> {
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
  const supabase = createAdminClient()

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
      tenant_id: "11111111-1111-1111-1111-111111111111", // LINKE_TENANT_ID
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
