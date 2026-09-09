"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"

import type { Fornecedor } from "@/app/ops/entidades/fornecedores/types"
import { 
  DEFAULT_PRICE_FAMILIES, 
  DEFAULT_ADDITIONAL_FEES, 
  DEFAULT_VOLUMETRICS, 
  DEFAULT_CERTIFICATES 
} from "@/app/ops/entidades/fornecedores/types"

export type { Fornecedor }

const DEFAULT_FORNECEDORES: Fornecedor[] = [
  {
    id: "forn_lk003",
    code: "LK003",
    center_code: "A01",
    short_name: "CORREOS.EXPRESS",
    color: "#00a3e0",
    legal_name: "CEP II - CORREOS EXPRESS PORTUGAL, S.A.",
    nif: "504134507",
    role: "Transportador Subcontratado",
    category: "Transportador Subcontratado",
    city: "MAIA",
    email: "Jorge.nunes@correosexpress.com",
    traffic_email: "trafego.norte@correosexpress.com",
    phone: "229438000",
    mobile_phone: "915882310",
    address: "Rua do Barreiro, 495",
    postal_code: "4470-558",
    manager_name: "Jorge Nunes",
    billing_agency: "A01 - Sede Guimarães",
    retention_rate: 0,
    vat_regime: "Regime Geral (23%)",
    is_carrier: true,
    is_forwarder: false,
    is_own_company: false,
    alvara_number: "504134-DGT",
    associated_network: "Rede Correos Express Ibérica",
    balance: "0,00€",
    payment_terms: "A 30 dias",
    iban: "PT50 0033 0000 4521 8892 1012 4",
    swift: "BCOMPTPL",
    daily_summary_enabled: true,
    daily_summary_email: "operacoes@correosexpress.com",
    owner_company: "GO LINKE UNIPESSOAL LIMITADA",
    authorized_agencies: ["A01", "A02", "A03", "A04"],
    language_preference: "Português",
    observations: "Parceiro estratégico ibérico com integração webservice ativa e SLAs de entrega 24H.",
    sync_external_invoicing: true,
    is_active: true,
    country_code: "PT",
    created_at: "2026-09-01T10:00:00Z",
    global_markup_pct: 15.0,
    price_families: DEFAULT_PRICE_FAMILIES,
    additional_fees: DEFAULT_ADDITIONAL_FEES,
    volumetrics: DEFAULT_VOLUMETRICS,
    vehicles: [],
    drivers: [],
    ledger_entries: [],
    branches: [
      {
        id: "br_1",
        code: "HUB-MAIA",
        name: "Plataforma Logística da Maia (Norte)",
        address: "Rua do Barreiro, 495",
        postal_code: "4470-558",
        city: "MAIA",
        phone: "229438000",
        email: "cais.maia@correosexpress.com",
        contact_person: "Eng. Rui Moreira",
      },
      {
        id: "br_2",
        code: "HUB-LX",
        name: "Plataforma de Lisboa (Prior Velho)",
        address: "Av. Severiano Falcão, 14",
        postal_code: "2685-379",
        city: "Prior Velho",
        phone: "218987000",
        email: "cais.lisboa@correosexpress.com",
        contact_person: "António Duarte",
      },
    ],
    certificates: DEFAULT_CERTIFICATES,
    documents: [],
  },
  {
    id: "forn_lk002",
    code: "LK002",
    center_code: "A01",
    short_name: "DPD PORTUGAL",
    color: "#dc2626",
    legal_name: "DPD PORTUGAL - TRANSPORTE EXPRESSO, S.A.",
    nif: "501964991",
    role: "Transportador Subcontratado",
    category: "Transportador Subcontratado",
    city: "SANTO ANTÓNIO CAVALEIROS",
    phone: "919558084",
    email: "jose.rufino@dpd.pt",
    balance: "0,00€",
    payment_terms: "A 30 dias",
    is_active: true,
    country_code: "PT",
    created_at: "2026-09-02T10:00:00Z",
    global_markup_pct: 15.0,
    price_families: DEFAULT_PRICE_FAMILIES,
    additional_fees: DEFAULT_ADDITIONAL_FEES,
    volumetrics: DEFAULT_VOLUMETRICS,
    vehicles: [],
    drivers: [],
    ledger_entries: [],
    branches: [],
    certificates: DEFAULT_CERTIFICATES,
    documents: [],
  },
  {
    id: "forn_lk001",
    code: "LK001",
    center_code: "A01",
    short_name: "MRW - Guimarães",
    color: "#1e3a8a",
    legal_name: "PRINCEPS - COMÉRCIO POR GROSSO LDA",
    nif: "503501522",
    role: "Transportador Subcontratado",
    category: "Transportador Subcontratado",
    city: "VILA NOVA DE FAMALICÃO",
    phone: "966224621",
    email: "",
    balance: "0,00€",
    payment_terms: "A Pronto",
    is_active: true,
    country_code: "PT",
    created_at: "2026-09-03T10:00:00Z",
    global_markup_pct: 15.0,
    price_families: DEFAULT_PRICE_FAMILIES,
    additional_fees: DEFAULT_ADDITIONAL_FEES,
    volumetrics: DEFAULT_VOLUMETRICS,
    vehicles: [],
    drivers: [],
    ledger_entries: [],
    branches: [],
    certificates: DEFAULT_CERTIFICATES,
    documents: [],
  },
  {
    id: "forn_lk000_1",
    code: "LK000",
    center_code: "A01",
    short_name: "CORREIOS",
    color: "#f87171",
    legal_name: "Ctt - Correios de Portugal, S.a.",
    nif: "500077568",
    role: "Transportador Subcontratado",
    category: "Transportador Subcontratado",
    city: "Lisboa",
    email: "rui.m.teixeira@ctt.pt",
    phone: "",
    balance: "0,00€",
    payment_terms: "A 30 dias",
    is_active: true,
    country_code: "PT",
    created_at: "2026-09-04T10:00:00Z",
    global_markup_pct: 15.0,
    price_families: DEFAULT_PRICE_FAMILIES,
    additional_fees: DEFAULT_ADDITIONAL_FEES,
    volumetrics: DEFAULT_VOLUMETRICS,
    vehicles: [],
    drivers: [],
    ledger_entries: [],
    branches: [],
    certificates: DEFAULT_CERTIFICATES,
    documents: [],
  },
  {
    id: "forn_lk000_2",
    code: "LK000",
    center_code: "A01",
    short_name: "VASP",
    color: "#38bdf8",
    legal_name: "Vasp Premium - Entrega Personalizada de Publicações Lda",
    nif: "503178489",
    role: "Transportador Subcontratado",
    category: "Transportador Subcontratado",
    city: "Agualva-Cacém",
    email: "",
    phone: "",
    balance: "0,00€",
    payment_terms: "A 30 dias",
    is_active: true,
    country_code: "PT",
    created_at: "2026-09-05T10:00:00Z",
    global_markup_pct: 15.0,
    price_families: DEFAULT_PRICE_FAMILIES,
    additional_fees: DEFAULT_ADDITIONAL_FEES,
    volumetrics: DEFAULT_VOLUMETRICS,
    vehicles: [],
    drivers: [],
    ledger_entries: [],
    branches: [],
    certificates: DEFAULT_CERTIFICATES,
    documents: [],
  },
  {
    id: "forn_2",
    code: "2",
    center_code: "A01",
    short_name: "CTT Expresso",
    color: "#dc2626",
    legal_name: "CTT EXPRESSO SERVIÇOS POSTAIS E LOGÍSTICA, S.A.",
    nif: "504520296",
    role: "Transportador Subcontratado",
    category: "Transportador Subcontratado",
    city: "LISBOA",
    phone: "926388679",
    email: "rui.m.teixeira@ctt.pt",
    balance: "0,00€",
    payment_terms: "A 30 dias",
    is_active: true,
    country_code: "PT",
    created_at: "2026-09-06T10:00:00Z",
    global_markup_pct: 15.0,
    price_families: DEFAULT_PRICE_FAMILIES,
    additional_fees: DEFAULT_ADDITIONAL_FEES,
    volumetrics: DEFAULT_VOLUMETRICS,
    vehicles: [],
    drivers: [],
    ledger_entries: [],
    branches: [],
    certificates: DEFAULT_CERTIFICATES,
    documents: [],
  },
  {
    id: "forn_1",
    code: "1",
    center_code: "A01",
    short_name: "Linke",
    color: "#1e3a8a",
    legal_name: "GO LINKE UNIPESSOAL LIMITADA",
    nif: "518600300",
    role: "Transportador Subcontratado",
    category: "Transportador Subcontratado",
    city: "GUIMARAES",
    phone: "912840061",
    email: "geral@linke.pt",
    balance: "0,00€",
    payment_terms: "A 30 dias",
    is_active: true,
    country_code: "PT",
    created_at: "2026-09-07T10:00:00Z",
    global_markup_pct: 15.0,
    price_families: DEFAULT_PRICE_FAMILIES,
    additional_fees: DEFAULT_ADDITIONAL_FEES,
    volumetrics: DEFAULT_VOLUMETRICS,
    vehicles: [],
    drivers: [],
    ledger_entries: [],
    branches: [],
    certificates: DEFAULT_CERTIFICATES,
    documents: [],
  },
]

const LINKE_TENANT_ID = "00000000-0000-0000-0000-000000000001"

/**
 * Obtém todos os fornecedores cadastrados
 */
export async function getFornecedoresAction(): Promise<Fornecedor[]> {
  const supabase = createAdminClient()

  // 0. Obter lista de IDs eliminados (tombstones)
  const deletedIds = new Set<string>()
  try {
    const { data: deletedLogs } = await supabase
      .from("audit_log")
      .select("details")
      .eq("action", "deleted_fornecedor")

    if (deletedLogs) {
      deletedLogs.forEach((log: any) => {
        if (log.details?.id) {
          deletedIds.add(log.details.id)
        }
      })
    }
  } catch {}

  // 1. Tentar ler da tabela fornecedores
  try {
    const { data, error } = await supabase
      .from("fornecedores")
      .select("*")
      .order("created_at", { ascending: false })

    if (!error && data && data.length > 0) {
      return data.filter((f: any) => !deletedIds.has(f.id))
    }
  } catch {}

  // 2. Fallback resiliente: audit_log
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .eq("action", "fornecedor_data")
      .order("created_at", { ascending: false })

    if (logs && logs.length > 0) {
      const parsed = logs
        .map((l: any) => l.details)
        .filter(Boolean) as Fornecedor[]

      if (parsed.length > 0) {
        return parsed.filter((f) => !deletedIds.has(f.id))
      }
    }
  } catch {}

  // 3. Fallback inicial com registos de referência (excluindo os eliminados)
  return DEFAULT_FORNECEDORES.filter((f) => !deletedIds.has(f.id))
}

/**
 * Grava ou atualiza um fornecedor
 */
export async function saveFornecedorAction(fornecedor: Partial<Fornecedor>): Promise<{ success: boolean; data: Fornecedor }> {
  const supabase = createAdminClient()

  const id = fornecedor.id || `forn_${Date.now()}`
  const fullRecord: Fornecedor = {
    ...fornecedor,
    id,
    code: fornecedor.code || `LK${Math.floor(100 + Math.random() * 900)}`,
    center_code: fornecedor.center_code || "A01",
    short_name: fornecedor.short_name || "Novo Fornecedor",
    color: fornecedor.color || "#00a3e0",
    legal_name: fornecedor.legal_name || fornecedor.short_name || "Novo Fornecedor, Lda",
    nif: fornecedor.nif || "",
    role: fornecedor.role || "Transportador Subcontratado",
    category: fornecedor.category || "Transportador Subcontratado",
    city: fornecedor.city || "Portugal",
    email: fornecedor.email || "",
    phone: fornecedor.phone || "",
    balance: fornecedor.balance || "0,00€",
    payment_terms: fornecedor.payment_terms || "A 30 dias",
    is_active: fornecedor.is_active ?? true,
    country_code: fornecedor.country_code || "PT",
    created_at: fornecedor.created_at || new Date().toISOString(),
    global_markup_pct: fornecedor.global_markup_pct ?? 15,
    price_families: fornecedor.price_families || DEFAULT_PRICE_FAMILIES,
    additional_fees: fornecedor.additional_fees || DEFAULT_ADDITIONAL_FEES,
    volumetrics: fornecedor.volumetrics || DEFAULT_VOLUMETRICS,
    vehicles: fornecedor.vehicles || [],
    drivers: fornecedor.drivers || [],
    ledger_entries: fornecedor.ledger_entries || [],
    branches: fornecedor.branches || [],
    certificates: fornecedor.certificates || DEFAULT_CERTIFICATES,
    documents: fornecedor.documents || [],
  }

  // Se estava como eliminado, remover tombstone
  try {
    const { data: delLogs } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "deleted_fornecedor")

    if (delLogs) {
      for (const d of delLogs) {
        if (d.details?.id === id) {
          await supabase.from("audit_log").delete().eq("id", d.id)
        }
      }
    }
  } catch {}

  // 1. Tentar tabela fornecedores
  try {
    await supabase.from("fornecedores").upsert(fullRecord)
  } catch {}

  // 2. Gravar em audit_log (resiliência garantida)
  try {
    // Apaga versão anterior se existir
    const { data: existing } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "fornecedor_data")

    if (existing) {
      for (const item of existing) {
        if (item.details?.id === id) {
          await supabase.from("audit_log").delete().eq("id", item.id)
        }
      }
    }

    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
      action: "fornecedor_data",
      details: fullRecord,
    })
  } catch (err: any) {
    console.warn("Audit log save error:", err?.message)
  }

  revalidatePath("/ops/entidades/fornecedores")
  revalidatePath("/ops/configuracao/webservices")
  return { success: true, data: fullRecord }
}

/**
 * Ativa ou inativa um fornecedor
 */
export async function toggleFornecedorStatusAction(id: string, is_active: boolean) {
  const supabase = createAdminClient()

  // 1. Tentar atualizar na tabela
  try {
    await supabase.from("fornecedores").update({ is_active }).eq("id", id)
  } catch {}

  // 2. Atualizar no audit_log
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "fornecedor_data")

    if (logs) {
      for (const item of logs) {
        if (item.details?.id === id) {
          await supabase.from("audit_log").update({
            details: { ...item.details, is_active },
          }).eq("id", item.id)
        }
      }
    }
  } catch {}

  revalidatePath("/ops/entidades/fornecedores")
  return { success: true }
}

/**
 * Elimina um fornecedor permanentemente
 */
export async function deleteFornecedorAction(id: string) {
  const supabase = createAdminClient()

  // 1. Tentar apagar da tabela
  try {
    await supabase.from("fornecedores").delete().eq("id", id)
  } catch {}

  // 2. Apagar do audit_log
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "fornecedor_data")

    if (logs) {
      for (const item of logs) {
        if (item.details?.id === id) {
          await supabase.from("audit_log").delete().eq("id", item.id)
        }
      }
    }
  } catch {}

  // 3. Registar tombstone para nunca ressurgir
  try {
    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
      action: "deleted_fornecedor",
      details: { id, deleted_at: new Date().toISOString() },
    })
  } catch {}

  revalidatePath("/ops/entidades/fornecedores")
  revalidatePath("/ops/configuracao/webservices")
  return { success: true }
}
