"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { Destinatario } from "@/app/ops/entidades/destinatarios/types"
import { requireUser } from "@/lib/auth/context"
import { loadScopedClientProfiles } from "@/lib/services/clients/scoped-client-profiles"
import { lookupPostalCode } from "@/lib/services/geo/postal-code.service"

async function requireRecipientAccess() {
  const ctx = await requireUser()
  if (!ctx.tenant_id || !["client", "employee", "admin"].includes(ctx.role || "") || (ctx.role === "client" && !ctx.client_id)) {
    throw new Error("Acesso negado. Conta sem acesso válido.")
  }
  return ctx
}

/**
 * Obtém os destinatários consolidados (guardados na agenda + histórico de envios).
 * - Se for cliente, devolve apenas os destinatários da sua conta.
 * - Se for operador/admin no OPS, pode filtrar por targetClientId ou ver todos.
 */
export async function getDestinatariosAction(targetClientId?: string): Promise<Destinatario[]> {
  const ctx = await requireRecipientAccess()
  try {
    const supabase = createAdminClient()
    const tenantId = ctx.tenant_id

    // Resolução do âmbito de cliente (se for utilizador tipo client, restringe automaticamente)
    const effectiveClientId = ctx.role === "client" ? ctx.client_id : targetClientId

    // 2. Obter destinatários guardados explicitamente na agenda (audit_log: saved_recipient)
    let savedQuery = supabase
      .from("audit_log")
      .select("id, details, created_at")
      .eq("tenant_id", tenantId)
      .eq("action", "saved_recipient")
      .order("created_at", { ascending: false })
      .limit(1000)

    if (effectiveClientId) {
      savedQuery = savedQuery.eq("details->>client_id", effectiveClientId)
    }

    const { data: savedLogs, error: savedErr } = await savedQuery
    if (savedErr) {
      console.warn("Could not query saved recipients from audit_log:", savedErr.message)
    }

    // 3. Obter envios do histórico para agregação de expedições
    let shipmentsQuery = supabase
      .from("shipments")
      .select(
        "id, created_at, client_id, recipient_name, recipient_phone, recipient_email, recipient_address, recipient_zip4, recipient_zip3, sender_name, carrier_tracking_number, tracking_number, status, sell_price, buy_price, service_type"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(3000)

    if (effectiveClientId) {
      shipmentsQuery = shipmentsQuery.eq("client_id", effectiveClientId)
    }

    const { data: dbShipments, error: shipErr } = await shipmentsQuery
    if (shipErr) {
      console.warn("Could not query shipments for destinatarios:", shipErr.message)
    }

    const shipments = dbShipments || []
    const clientIds = [
      ...(savedLogs || []).map((log: { details: { client_id?: string } | null }) => log.details?.client_id),
      ...shipments.map((s: { client_id: string | null }) => s.client_id),
    ].filter((id): id is string => typeof id === "string" && Boolean(id))
    const clientMap = await loadScopedClientProfiles(supabase, tenantId, clientIds)
    const destMap = new Map<string, Destinatario>()

    // Função auxiliar para gerar chave de normalização
    const makeKey = (name: string, zip: string, clientId: string) => {
      const cleanName = (name || "").toLowerCase().trim().replace(/\s+/g, " ")
      const cleanZip = (zip || "").toLowerCase().replace(/[^0-9]/g, "")
      const cleanClient = (clientId || "").toLowerCase().trim()
      return `${cleanName}__${cleanZip}__${cleanClient}`
    }

    // A. Adicionar primeiro os destinatários explicitamente guardados
    if (savedLogs) {
      savedLogs.forEach((log: any) => {
        const d = log.details as Partial<Destinatario>
        if (!d || !d.name) return

        const id = d.id || log.id
        const zip = d.postal_code || ""
        const clientId = d.client_id || ""
        const key = makeKey(d.name, zip, clientId)

        const client = clientId ? clientMap.get(clientId) : null
        const clientName = client?.short_name || client?.legal_name || client?.name || d.client_name || "Cliente Linke"

        destMap.set(key, {
          id,
          name: d.name,
          address: d.address || "",
          postal_code: d.postal_code || "",
          city: d.city || "",
          country: d.country || "PT",
          phone: d.phone,
          email: d.email,
          nif: d.nif,
          observations: d.observations,
          client_id: clientId || undefined,
          client_name: clientName,
          is_saved: true,
          created_at: d.created_at || log.created_at,
          created_by_role: d.created_by_role || "employee",
          total_shipments: 0,
          last_shipment_date: d.created_at || log.created_at || new Date().toISOString(),
          last_tracking_number: "—",
          last_status: "Sem Envios",
          shipments_history: [],
        })
      })
    }

    // B. Cruzar com o histórico real de envios
    shipments.forEach((s: any) => {
      const rawName = (s.recipient_name || "").trim()
      if (!rawName) return

      const rawAddress = (s.recipient_address || "").trim()
      const zip4 = (s.recipient_zip4 || "").trim()
      const zip3 = (s.recipient_zip3 || "").trim()
      const zip = zip4 ? (zip3 ? `${zip4}-${zip3}` : zip4) : ""

      // Determinar localidade/cidade a partir do código postal ou morada
      let city = ""
      if (zip) {
        try {
          const pc = lookupPostalCode(zip, "PT")
          if (pc?.city) city = pc.city
        } catch {}
      }
      if (!city && rawAddress.includes(",")) {
        city = rawAddress.split(",").pop()?.trim() || ""
      }

      const clientId = s.client_id || ""
      const key = makeKey(rawName, zip, clientId)

      const client = clientId ? clientMap.get(clientId) : null
      const clientName = client?.short_name || client?.legal_name || client?.name || s.sender_name || "Cliente Linke"
      const trackingCode = s.carrier_tracking_number || s.tracking_number || "—"

      if (!destMap.has(key)) {
        // Destinatário descoberto a partir de envio passado
        const generatedId = "dest_" + Buffer.from(key).toString("hex").slice(0, 32)
        destMap.set(key, {
          id: generatedId,
          name: rawName,
          address: rawAddress,
          postal_code: zip,
          city: city,
          country: "PT",
          phone: s.recipient_phone,
          email: s.recipient_email,
          client_id: clientId || undefined,
          client_name: clientName,
          is_saved: false,
          total_shipments: 0,
          last_shipment_date: s.created_at,
          last_tracking_number: trackingCode,
          last_status: s.status,
          shipments_history: [],
        })
      }

      const d = destMap.get(key)!
      d.total_shipments += 1

      d.shipments_history.push({
        id: s.id,
        tracking_number: s.tracking_number || trackingCode,
        ctt_object_id: trackingCode,
        created_at: s.created_at,
        status: s.status,
        service_type: s.service_type,
        sell_price: s.sell_price,
        buy_price: s.buy_price,
      })

      // Atualizar dados de contacto mais recentes se vazios
      if (!d.phone && s.recipient_phone) d.phone = s.recipient_phone
      if (!d.email && s.recipient_email) d.email = s.recipient_email

      // Atualizar morada mais recente se o registo não for explicitamente fixado
      if (!d.is_saved && rawAddress && (!d.address || d.address.length < rawAddress.length)) {
        d.address = rawAddress
      }
      if (!d.city && city) d.city = city

      // Atualizar tracking mais recente
      if (
        !d.last_shipment_date ||
        new Date(s.created_at).getTime() >= new Date(d.last_shipment_date).getTime()
      ) {
        d.last_shipment_date = s.created_at
        d.last_tracking_number = trackingCode
        d.last_status = s.status
      }
    })

    // Ordenar histórico de cada destinatário
    destMap.forEach((d) => {
      d.shipments_history.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    })

    // Ordenação global:
    // 1. Destinatários guardados na agenda primeiro
    // 2. Depois pela data de envio mais recente
    return Array.from(destMap.values()).sort((a, b) => {
      if (a.is_saved && !b.is_saved) return -1
      if (!a.is_saved && b.is_saved) return 1
      return new Date(b.last_shipment_date).getTime() - new Date(a.last_shipment_date).getTime()
    })
  } catch (error) {
    console.error("[getDestinatariosAction] Erro ao carregar destinatários:", error)
    return []
  }
}

/**
 * Grava ou atualiza um destinatário na agenda.
 * Pode ser chamado tanto pelo OPS como pela Área de Cliente.
 */
export async function saveDestinatarioAction(data: {
  id?: string
  name: string
  address: string
  postal_code: string
  city: string
  country?: string
  phone?: string
  email?: string
  nif?: string
  observations?: string
  client_id?: string
}): Promise<{ success: boolean; destinatario?: Destinatario; error?: string }> {
  const ctx = await requireRecipientAccess()
  try {
    const supabase = createAdminClient()
    const tenantId = ctx.tenant_id

    if (!data.name || !data.name.trim()) {
      return { success: false, error: "O nome do destinatário é obrigatório." }
    }
    if (!data.address || !data.address.trim()) {
      return { success: false, error: "A morada do destinatário é obrigatória." }
    }
    if (!data.postal_code || !data.postal_code.trim()) {
      return { success: false, error: "O código postal é obrigatório." }
    }

    // Determinar client_id associado
    let assignedClientId = ctx.role === "client" ? ctx.client_id : data.client_id
    if (!assignedClientId && ctx.client_id) {
      assignedClientId = ctx.client_id
    }

    // Obter nome do cliente
    let clientName = "Cliente Linke"
    if (assignedClientId) {
      const clients = await loadScopedClientProfiles(supabase, tenantId, [assignedClientId])
      const c = clients.get(assignedClientId)
      if (!c) return { success: false, error: "Cliente não disponível." }
      clientName = c.short_name || c.legal_name || c.name || "Cliente Linke"
    }

    // History entries have a synthetic dest_ ID; saving one creates a fresh agenda record.
    const requestedId = data.id?.trim()
    const isUpdate = Boolean(requestedId && !requestedId.startsWith("dest_"))
    const id = isUpdate ? requestedId! : crypto.randomUUID()
    const now = new Date().toISOString()

    const destinatarioData: Destinatario = {
      id,
      name: data.name.trim(),
      address: data.address.trim(),
      postal_code: data.postal_code.trim(),
      city: data.city ? data.city.trim() : "",
      country: data.country || "PT",
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      nif: data.nif?.trim() || undefined,
      observations: data.observations?.trim() || undefined,
      client_id: assignedClientId || undefined,
      client_name: clientName,
      is_saved: true,
      created_at: now,
      created_by_role: ctx.role === "client" ? "client" : "employee",
      total_shipments: 0,
      last_shipment_date: now,
      last_tracking_number: "—",
      last_status: "Guardado na Agenda",
      shipments_history: [],
    }

    if (isUpdate) {
      let existingQuery = supabase.from("audit_log").select("id, details")
        .eq("tenant_id", tenantId).eq("action", "saved_recipient").eq("details->>id", id)
      if (ctx.role === "client") existingQuery = existingQuery.eq("details->>client_id", ctx.client_id!)
      const { data: existing, error } = await existingQuery.maybeSingle()
      if (error || !existing) return { success: false, error: "Destinatário não disponível." }

      let updateQuery = supabase
        .from("audit_log")
        .update({
          details: destinatarioData,
        })
        .eq("tenant_id", tenantId)
        .eq("action", "saved_recipient")
        .eq("details->>id", id)
        .eq("id", existing.id)
      if (ctx.role === "client") updateQuery = updateQuery.eq("details->>client_id", ctx.client_id!)
      const { data: updated, error: updErr } = await updateQuery.select("id").maybeSingle()

      if (updErr || !updated) throw new Error("Recipient update failed")
    } else {
      const { error: insErr } = await supabase.from("audit_log").insert({
        tenant_id: tenantId,
        action: "saved_recipient",
        details: destinatarioData,
      })

      if (insErr) throw insErr
    }

    revalidatePath("/ops/entidades/destinatarios")
    revalidatePath("/app/[storeSlug]/destinatarios", "page")
    revalidatePath("/app/[storeSlug]/criar-guia", "page")
    revalidatePath("/ops/envios/novo")

    return { success: true, destinatario: destinatarioData }
  } catch (err: unknown) {
    console.error("[saveDestinatarioAction] Erro ao gravar destinatário:", err)
    return { success: false, error: "Erro ao gravar destinatário." }
  }
}

/**
 * Remove um destinatário guardado da agenda.
 */
export async function deleteDestinatarioAction(id: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireRecipientAccess()
  if (typeof id !== "string" || !id.trim()) return { success: false, error: "Pedido inválido." }
  try {
    const supabase = createAdminClient()

    // Procurar e apagar registo em audit_log
    let deleteQuery = supabase
      .from("audit_log")
      .delete()
      .eq("tenant_id", ctx.tenant_id)
      .eq("action", "saved_recipient")
      .eq("details->>id", id)
    if (ctx.role === "client") deleteQuery = deleteQuery.eq("details->>client_id", ctx.client_id!)
    const { data: deleted, error: delErr } = await deleteQuery.select("id").maybeSingle()

    if (delErr || !deleted) return { success: false, error: "Destinatário não disponível." }

    revalidatePath("/ops/entidades/destinatarios")
    revalidatePath("/app/[storeSlug]/destinatarios", "page")
    revalidatePath("/app/[storeSlug]/criar-guia", "page")
    revalidatePath("/ops/envios/novo")

    return { success: true }
  } catch (err: unknown) {
    console.error("[deleteDestinatarioAction] Erro ao eliminar:", err)
    return { success: false, error: "Erro ao eliminar destinatário." }
  }
}
