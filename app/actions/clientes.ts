"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import type { Cliente } from "@/app/ops/entidades/clientes/types"

const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"

const DEFAULT_CLIENTES: Cliente[] = [
  {
    id: "22222222-2222-2222-2222-222222222222",
    code: "CL001",
    short_name: "CACTO",
    legal_name: "Cacto Moda & Acessórios, Lda",
    color: "#10b981",
    nif: "514987123",
    category: "Cliente Conta Corrente",
    city: "Guimarães",
    address: "Avenida Dom Afonso Henriques, 45",
    postal_code: "4800-043",
    country_code: "PT",
    email: "encomendas@cacto.pt",
    billing_email: "financeiro@cacto.pt",
    phone: "253512345",
    mobile_phone: "912345678",
    manager_name: "Rui Barbosa",
    billing_agency: "A01 - Sede Guimarães",
    payment_terms: "A 30 dias",
    iban: "PT50 0033 0000 8765 4321 0987 1",
    credit_limit: 5000,
    balance: "0,00€",
    assigned_seller: "Gestão Comercial Norte",
    observations: "Cliente prioritário do setor têxtil com entregas diárias e recolhas às 17h00.",
    is_active: true,
    created_at: "2026-09-01T09:00:00Z",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    code: "CL002",
    short_name: "DETAILER",
    legal_name: "Detailer Car Care Unipessoal Lda",
    color: "#0284c7",
    nif: "509123876",
    category: "E-Commerce & Retalho",
    city: "Porto",
    address: "Rua de Santa Catarina, 890",
    postal_code: "4000-447",
    country_code: "PT",
    email: "logistica@detailer.pt",
    billing_email: "contabilidade@detailer.pt",
    phone: "220198765",
    mobile_phone: "919876543",
    manager_name: "André Silva",
    billing_agency: "A03 - Porto",
    payment_terms: "Pronto Pagamento",
    iban: "PT50 0035 0100 1234 5678 9012 3",
    credit_limit: 2500,
    balance: "142,50€",
    assigned_seller: "Equipa Digital / E-Commerce",
    observations: "Expedições e-commerce com envio direto de tracking SMS aos destinatários.",
    is_active: true,
    created_at: "2026-09-02T11:30:00Z",
  },
  {
    id: "client_linke_store",
    code: "CL003",
    short_name: "LINKE STORE",
    legal_name: "Linke Distribuição & Logística, Lda",
    color: "#8b5cf6",
    nif: "516345980",
    category: "Grande Conta (Key Account)",
    city: "Lisboa",
    address: "Parque das Nações, Alameda dos Oceanos, Lote 2",
    postal_code: "1990-203",
    country_code: "PT",
    email: "geral@linkestore.pt",
    billing_email: "faturacao@linkestore.pt",
    phone: "213456789",
    mobile_phone: "931234567",
    manager_name: "Carla Mendes",
    billing_agency: "A02 - Lisboa",
    payment_terms: "A 60 dias",
    iban: "PT50 0018 0000 9988 7766 5544 3",
    credit_limit: 15000,
    balance: "0,00€",
    assigned_seller: "Direção Geral",
    observations: "Conta institucional e rede interna de distribuição.",
    is_active: true,
    created_at: "2026-09-03T14:15:00Z",
  },
]

/**
 * Obtém todos os clientes para listagem
 */
export async function getClientesAction(): Promise<Cliente[]> {
  const supabase = createAdminClient()

  let dbClients: any[] = []
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("tenant_id", LINKE_TENANT_ID)
      .order("created_at", { ascending: false })

    if (!error && data) {
      dbClients = data
    }
  } catch (err: any) {
    console.warn("Could not query clients table:", err?.message)
  }

  // Obter detalhes ricos de audit_log
  let auditClients: Record<string, Cliente> = {}
  try {
    const { data: logs, error } = await supabase
      .from("audit_log")
      .select("details")
      .eq("action", "client_data")
      .order("created_at", { ascending: false })

    if (!error && logs) {
      logs.forEach((log: any) => {
        const d = log.details as Cliente
        if (d && d.id && !auditClients[d.id]) {
          auditClients[d.id] = d
        }
      })
    }
  } catch (err: any) {
    console.warn("Could not query audit_log for clients:", err?.message)
  }

  // Mapa final combinando defaults, base de dados e logs
  const clientMap = new Map<string, Cliente>()

  // 1. Defaults base
  DEFAULT_CLIENTES.forEach((c) => clientMap.set(c.id, c))

  // 2. Clientes da tabela
  dbClients.forEach((db) => {
    const existing = clientMap.get(db.id)
    if (existing) {
      clientMap.set(db.id, {
        ...existing,
        short_name: db.name || existing.short_name,
        legal_name: db.legal_name || existing.legal_name || db.name,
      })
    } else {
      clientMap.set(db.id, {
        id: db.id,
        code: db.code || `CL${Math.floor(100 + Math.random() * 900)}`,
        short_name: db.name || "Novo Cliente",
        legal_name: db.legal_name || db.name || "Novo Cliente, Lda",
        color: "#10b981",
        nif: db.nif || "",
        category: "Cliente Conta Corrente",
        city: db.city || "Portugal",
        address: db.address || "",
        postal_code: db.postal_code || "",
        country_code: "PT",
        email: db.email || "",
        phone: db.phone || "",
        billing_agency: "A01 - Sede Guimarães",
        payment_terms: "A 30 dias",
        balance: "0,00€",
        is_active: db.is_active !== false,
        created_at: db.created_at || new Date().toISOString(),
      })
    }
  })

  // 3. Sobrescrever com audit_log atualizado
  Object.values(auditClients).forEach((aud) => {
    clientMap.set(aud.id, aud)
  })

  return Array.from(clientMap.values()).sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

/**
 * Grava ou atualiza um cliente
 */
export async function saveClienteAction(cliente: Partial<Cliente>) {
  const supabase = createAdminClient()

  const id = cliente.id || `cli_${Date.now()}`
  const fullRecord: Cliente = {
    id,
    code: cliente.code?.trim().toUpperCase() || `CL${Math.floor(100 + Math.random() * 900)}`,
    short_name: cliente.short_name?.trim() || cliente.legal_name?.trim() || "Novo Cliente",
    legal_name: cliente.legal_name?.trim() || cliente.short_name?.trim() || "Novo Cliente, Lda",
    color: cliente.color || "#10b981",
    nif: cliente.nif?.trim() || "",
    category: cliente.category || "Cliente Conta Corrente",
    city: cliente.city?.trim() || "Portugal",
    address: cliente.address?.trim() || "",
    postal_code: cliente.postal_code?.trim() || "",
    country_code: cliente.country_code || "PT",
    email: cliente.email?.trim() || "",
    billing_email: cliente.billing_email?.trim() || "",
    phone: cliente.phone?.trim() || "",
    mobile_phone: cliente.mobile_phone?.trim() || "",
    manager_name: cliente.manager_name?.trim() || "",
    billing_agency: cliente.billing_agency || "A01 - Sede Guimarães",
    payment_terms: cliente.payment_terms || "A 30 dias",
    iban: cliente.iban?.trim() || "",
    credit_limit: cliente.credit_limit ?? 5000,
    balance: cliente.balance || "0,00€",
    assigned_seller: cliente.assigned_seller?.trim() || "Gestão Comercial",
    observations: cliente.observations?.trim() || "",
    is_active: cliente.is_active ?? true,
    created_at: cliente.created_at || new Date().toISOString(),
  }

  // 1. Tentar gravar na tabela de clients (inserção de chave primária para integridade referencial)
  try {
    await supabase.from("clients").upsert({
      id,
      tenant_id: LINKE_TENANT_ID,
      name: fullRecord.short_name,
    })
  } catch (err: any) {
    console.warn("Could not upsert into clients table:", err?.message)
  }

  // 2. Gravar detalhes ricos em audit_log
  try {
    const { data: existing } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "client_data")

    if (existing) {
      for (const item of existing) {
        if (item.details?.id === id) {
          await supabase.from("audit_log").delete().eq("id", item.id)
        }
      }
    }

    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
      action: "client_data",
      details: fullRecord,
    })
  } catch (err: any) {
    console.warn("Could not save to audit_log:", err?.message)
  }

  revalidatePath("/ops/entidades/clientes")
  revalidatePath("/ops/clientes")
  return { success: true, data: fullRecord }
}

/**
 * Alterna estado de cliente (Ativo / Inativo)
 */
export async function toggleClienteStatusAction(id: string, is_active: boolean) {
  const supabase = createAdminClient()

  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "client_data")

    if (logs) {
      for (const item of logs) {
        if (item.details?.id === id) {
          await supabase
            .from("audit_log")
            .update({
              details: { ...item.details, is_active },
            })
            .eq("id", item.id)
        }
      }
    }
  } catch {}

  revalidatePath("/ops/entidades/clientes")
  revalidatePath("/ops/clientes")
  return { success: true }
}

/**
 * Elimina cliente
 */
export async function deleteClienteAction(id: string) {
  const supabase = createAdminClient()

  try {
    await supabase.from("clients").delete().eq("id", id)
  } catch {}

  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "client_data")

    if (logs) {
      for (const item of logs) {
        if (item.details?.id === id) {
          await supabase.from("audit_log").delete().eq("id", item.id)
        }
      }
    }
  } catch {}

  revalidatePath("/ops/entidades/clientes")
  revalidatePath("/ops/clientes")
  return { success: true }
}

/**
 * Backwards compatibility for existing /ops/clientes
 */
export async function getClientes() {
  return getClientesAction()
}

export async function createCliente(formData: FormData) {
  const name = (formData.get("name") as string) || "Novo Cliente"
  await saveClienteAction({
    short_name: name,
    legal_name: name,
  })
  revalidatePath("/ops/clientes")
  revalidatePath("/ops/entidades/clientes")
  redirect("/ops/entidades/clientes")
}
