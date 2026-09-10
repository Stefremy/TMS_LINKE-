"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { getFornecedoresAction, saveFornecedorAction } from "@/app/actions/fornecedores"
import { getCarrierConnectionsAction } from "@/app/actions/ctt"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"

const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"

const DEFAULT_SERVICOS_LINKE: ServicoLinke[] = [
  {
    id: "srv_linke_exp_24h_std",
    code: "LK-EXP24-STD",
    name: "Linke Expresso 24H (Tabela Geral / Standard)",
    description: "Serviço prioritário porta-a-porta Portugal Continental para clientes padrão e pequenas empresas.",
    category: "Nacional",
    color: "#059669",
    is_active: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Clientes Gerais (Volume Base)",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CORREOS EXPRESS",
    transit_time_label: "24h",
    global_markup_pct: 25.0,
    fuel_surcharge_pct: 12.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    created_at: "2026-09-01T10:00:00Z",
    zones: [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental",
        tiers: [
          { id: "lk_std_1", label: "Até 1 Kg", weight_max: 1, cost_price: 2.85, margin_pct: 25, sell_price: 3.56, delivery_time: "24h", enabled: true },
          { id: "lk_std_2", label: "Até 2 Kg", weight_max: 2, cost_price: 3.15, margin_pct: 25, sell_price: 3.94, delivery_time: "24h", enabled: true },
          { id: "lk_std_5", label: "Até 5 Kg", weight_max: 5, cost_price: 3.75, margin_pct: 22, sell_price: 4.58, delivery_time: "24h", enabled: true },
          { id: "lk_std_10", label: "Até 10 Kg", weight_max: 10, cost_price: 4.60, margin_pct: 22, sell_price: 5.61, delivery_time: "24h", enabled: true },
          { id: "lk_std_20", label: "Até 20 Kg", weight_max: 20, cost_price: 6.20, margin_pct: 20, sell_price: 7.44, delivery_time: "24h", enabled: true },
          { id: "lk_std_30", label: "Até 30 Kg", weight_max: 30, cost_price: 7.90, margin_pct: 20, sell_price: 9.48, delivery_time: "24h", enabled: true },
          { id: "lk_std_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.28, margin_pct: 25, sell_price: 0.35, delivery_time: "24h", enabled: true },
        ]
      }
    ]
  },
  {
    id: "srv_linke_exp_24h_vip",
    code: "LK-EXP24-VIP",
    name: "Linke Expresso 24H (VIP / Alto Volume)",
    description: "Tarifa com desconto agressivo para clientes de grande expedição (>300 envios/mês). Preço reduzido com margem garantida.",
    category: "Nacional",
    color: "#0d9488",
    is_active: true,
    pricing_profile: "VIP / Alto Volume",
    target_client_name: "Clientes Grandes Contas (>300 envios/mês)",
    discount_vs_standard_pct: 12.0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CORREOS EXPRESS",
    transit_time_label: "24h",
    global_markup_pct: 15.0,
    fuel_surcharge_pct: 10.0,
    cod_fee_pct: 2.0,
    cod_min_fee: 2.00,
    created_at: "2026-09-01T11:00:00Z",
    zones: [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental",
        tiers: [
          { id: "lk_vip_1", label: "Até 1 Kg", weight_max: 1, cost_price: 2.85, margin_pct: 15, sell_price: 3.28, delivery_time: "24h", enabled: true },
          { id: "lk_vip_2", label: "Até 2 Kg", weight_max: 2, cost_price: 3.15, margin_pct: 15, sell_price: 3.62, delivery_time: "24h", enabled: true },
          { id: "lk_vip_5", label: "Até 5 Kg", weight_max: 5, cost_price: 3.75, margin_pct: 14, sell_price: 4.28, delivery_time: "24h", enabled: true },
          { id: "lk_vip_10", label: "Até 10 Kg", weight_max: 10, cost_price: 4.60, margin_pct: 14, sell_price: 5.24, delivery_time: "24h", enabled: true },
          { id: "lk_vip_20", label: "Até 20 Kg", weight_max: 20, cost_price: 6.20, margin_pct: 12, sell_price: 6.94, delivery_time: "24h", enabled: true },
          { id: "lk_vip_30", label: "Até 30 Kg", weight_max: 30, cost_price: 7.90, margin_pct: 12, sell_price: 8.85, delivery_time: "24h", enabled: true },
          { id: "lk_vip_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.28, margin_pct: 15, sell_price: 0.32, delivery_time: "24h", enabled: true },
        ]
      }
    ]
  },
  {
    id: "srv_linke_ib_48h",
    code: "LK-IB48-STD",
    name: "Linke Ibérico 48H (Espanha Peninsular)",
    description: "Conexão direta Portugal ↔ Espanha Peninsular com rastreamento integrado e entrega garantida em 24/48h.",
    category: "Ibérico",
    color: "#2563eb",
    is_active: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Todos os Clientes",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CORREOS EXPRESS",
    transit_time_label: "24-48h",
    global_markup_pct: 25.0,
    fuel_surcharge_pct: 14.0,
    cod_fee_pct: 3.0,
    cod_min_fee: 3.50,
    created_at: "2026-09-02T10:00:00Z",
    zones: [
      {
        zone_code: "ES-PENIN",
        zone_name: "Espanha Peninsular",
        tiers: [
          { id: "lk_ib_1", label: "Até 1 Kg", weight_max: 1, cost_price: 4.20, margin_pct: 28, sell_price: 5.38, delivery_time: "24/48h", enabled: true },
          { id: "lk_ib_2", label: "Até 2 Kg", weight_max: 2, cost_price: 4.80, margin_pct: 28, sell_price: 6.14, delivery_time: "24/48h", enabled: true },
          { id: "lk_ib_5", label: "Até 5 Kg", weight_max: 5, cost_price: 5.90, margin_pct: 25, sell_price: 7.38, delivery_time: "24/48h", enabled: true },
          { id: "lk_ib_10", label: "Até 10 Kg", weight_max: 10, cost_price: 7.50, margin_pct: 25, sell_price: 9.38, delivery_time: "24/48h", enabled: true },
          { id: "lk_ib_20", label: "Até 20 Kg", weight_max: 20, cost_price: 11.20, margin_pct: 22, sell_price: 13.66, delivery_time: "24/48h", enabled: true },
          { id: "lk_ib_30", label: "Até 30 Kg", weight_max: 30, cost_price: 14.90, margin_pct: 22, sell_price: 18.18, delivery_time: "24/48h", enabled: true },
          { id: "lk_ib_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.45, margin_pct: 25, sell_price: 0.56, delivery_time: "24/48h", enabled: true },
        ]
      }
    ]
  },
  {
    id: "srv_linke_ilhas_air",
    code: "LK-ILHAS",
    name: "Linke Ilhas Expresso Aéreo (Açores & Madeira)",
    description: "Expedição aérea prioritária para os arquipélagos dos Açores e da Madeira.",
    category: "Ilhas",
    color: "#d97706",
    is_active: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Todos os Clientes",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_2",
    preferred_carrier_name: "CTT EXPRESSO",
    transit_time_label: "48-72h",
    global_markup_pct: 22.0,
    fuel_surcharge_pct: 15.0,
    created_at: "2026-09-03T10:00:00Z",
    zones: [
      {
        zone_code: "PT-ILHAS",
        zone_name: "Açores & Madeira (Aéreo)",
        tiers: [
          { id: "lk_ilh_1", label: "Até 1 Kg", weight_max: 1, cost_price: 8.50, margin_pct: 24, sell_price: 10.54, delivery_time: "48/72h", enabled: true },
          { id: "lk_ilh_2", label: "Até 2 Kg", weight_max: 2, cost_price: 11.20, margin_pct: 22, sell_price: 13.66, delivery_time: "48/72h", enabled: true },
          { id: "lk_ilh_5", label: "Até 5 Kg", weight_max: 5, cost_price: 16.80, margin_pct: 20, sell_price: 20.16, delivery_time: "48/72h", enabled: true },
          { id: "lk_ilh_10", label: "Até 10 Kg", weight_max: 10, cost_price: 24.50, margin_pct: 20, sell_price: 29.40, delivery_time: "48/72h", enabled: true },
        ]
      }
    ]
  },
  {
    id: "srv_linke_pickup_locky",
    code: "LK-PICKUP",
    name: "Linke Dropoff / Ponto CTT & Cacifo Locky",
    description: "Entrega em mais de 2.000 Pontos CTT e Cacifos Inteligentes Locky 24H.",
    category: "Ponto / Locky",
    color: "#7c3aed",
    is_active: true,
    pricing_profile: "E-Commerce PME",
    target_client_name: "Lojas Online & E-commerce",
    discount_vs_standard_pct: 5.0,
    preferred_carrier_id: "forn_2",
    preferred_carrier_name: "CTT EXPRESSO",
    transit_time_label: "24h",
    global_markup_pct: 25.0,
    created_at: "2026-09-04T10:00:00Z",
    zones: [
      {
        zone_code: "PT-PICKUP",
        zone_name: "Rede Nacional Pontos & Cacifos",
        tiers: [
          { id: "lk_ponto_2", label: "Ponto CTT / Cacifo (0-2kg)", weight_max: 2, cost_price: 2.30, margin_pct: 30, sell_price: 2.99, delivery_time: "24h", enabled: true },
          { id: "lk_ponto_5", label: "Ponto CTT / Cacifo (2-5kg)", weight_max: 5, cost_price: 2.50, margin_pct: 28, sell_price: 3.20, delivery_time: "24h", enabled: true },
          { id: "lk_ponto_10", label: "Cacifo Locky Max (5-10kg)", weight_max: 10, cost_price: 2.65, margin_pct: 25, sell_price: 3.31, delivery_time: "24h", enabled: true },
        ]
      }
    ]
  },
  {
    id: "srv_linke_recolhas_coletas",
    code: "LK-COLETA",
    name: "Linke Recolhas & Coletas no Fornecedor",
    description: "Agendamento de recolha pontual ou regular no remetente para posterior consolidação.",
    category: "Especial / Recolhas",
    color: "#0284c7",
    is_active: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Todos os Clientes",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk002",
    preferred_carrier_name: "DPD PORTUGAL",
    transit_time_label: "Mesmo Dia",
    global_markup_pct: 20.0,
    created_at: "2026-09-05T10:00:00Z",
    zones: [
      {
        zone_code: "PT-COLETA",
        zone_name: "Portugal Continental (Coletas)",
        tiers: [
          { id: "lk_rec_std", label: "Coleta Standard (0-10kg)", weight_max: 10, cost_price: 2.10, margin_pct: 20, sell_price: 2.52, delivery_time: "Mesmo Dia", enabled: true },
          { id: "lk_rec_heavy", label: "Coleta Volume Pesado (>10kg)", weight_max: 100, cost_price: 5.50, margin_pct: 20, sell_price: 6.60, delivery_time: "Mesmo Dia", enabled: true },
        ]
      }
    ]
  },
]

/**
 * Obtém todos os Serviços Linke configurados
 */
export async function getServicosLinkeAction(): Promise<ServicoLinke[]> {
  const supabase = createAdminClient()

  // 0. Obter lista de IDs eliminados (tombstones)
  const deletedIds = new Set<string>()
  try {
    const { data: deletedLogs } = await supabase
      .from("audit_log")
      .select("details")
      .eq("action", "deleted_servico_linke")

    if (deletedLogs) {
      deletedLogs.forEach((log: any) => {
        if (log.details?.id) {
          deletedIds.add(log.details.id)
        }
      })
    }
  } catch {}

  // 1. Tentar ler da tabela servicos_linke se existir
  try {
    const { data, error } = await supabase
      .from("servicos_linke")
      .select("*")
      .order("created_at", { ascending: true })

    if (!error && data && data.length > 0) {
      return data.filter((s: any) => !deletedIds.has(s.id))
    }
  } catch {}

  // 2. Fallback resiliente: audit_log
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .eq("action", "servicos_linke_data")
      .order("created_at", { ascending: false })

    if (logs && logs.length > 0) {
      const parsed = logs
        .map((l: any) => l.details)
        .filter(Boolean) as ServicoLinke[]

      if (parsed.length > 0) {
        return parsed.filter((s) => !deletedIds.has(s.id))
      }
    }
  } catch {}

  // 3. Fallback inicial padrão
  return DEFAULT_SERVICOS_LINKE.filter((s) => !deletedIds.has(s.id))
}

/**
 * Grava ou atualiza um Serviço Linke (criação ilimitada com suporte a perfis de cliente)
 */
export async function saveServicoLinkeAction(
  servico: Partial<ServicoLinke>
): Promise<{ success: boolean; data: ServicoLinke }> {
  const supabase = createAdminClient()

  const id = servico.id || `srv_linke_${Date.now()}`
  
  // Processamento de zonas e escalões
  const processedZones = (servico.zones || []).map((zone) => ({
    ...zone,
    tiers: (zone.tiers || []).map((t, idx) => {
      const margin = t.margin_pct ?? servico.global_markup_pct ?? 20
      const cost = Number(t.cost_price || 0)
      const sell = t.sell_price > 0 ? Number(t.sell_price) : Number((cost * (1 + margin / 100)).toFixed(2))
      return {
        ...t,
        id: t.id || `tier_${Date.now()}_${idx}`,
        margin_pct: margin,
        cost_price: cost,
        sell_price: sell,
        delivery_time: t.delivery_time || servico.transit_time_label || "24h",
        enabled: t.enabled ?? true,
      }
    })
  }))

  const fullRecord: ServicoLinke = {
    id,
    code: servico.code || `LK-${Math.floor(100 + Math.random() * 900)}`,
    name: servico.name || "Novo Serviço Linke",
    description: servico.description || "",
    category: servico.category || "Nacional",
    color: servico.color || "#059669",
    is_active: servico.is_active ?? true,
    pricing_profile: servico.pricing_profile || "Standard / Geral",
    target_client_name: servico.target_client_name || "Clientes Gerais",
    discount_vs_standard_pct: servico.discount_vs_standard_pct ?? 0,
    preferred_carrier_id: servico.preferred_carrier_id || "forn_lk003",
    preferred_carrier_name: servico.preferred_carrier_name || "CORREOS EXPRESS",
    webservice_connection_id: servico.webservice_connection_id || undefined,
    webservice_service_code: servico.webservice_service_code || undefined,
    transit_time_label: servico.transit_time_label || "24h",
    global_markup_pct: servico.global_markup_pct ?? 20.0,
    fuel_surcharge_pct: servico.fuel_surcharge_pct ?? 12.0,
    cod_fee_pct: servico.cod_fee_pct ?? 2.5,
    cod_min_fee: servico.cod_min_fee ?? 2.50,
    saturday_fee: servico.saturday_fee ?? 15.0,
    return_guide_fee: servico.return_guide_fee ?? 3.5,
    zones: processedZones.length > 0 ? processedZones : [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental",
        tiers: [
          { id: `t_${Date.now()}_1`, label: "Até 1 Kg", weight_max: 1, cost_price: 2.85, margin_pct: 20, sell_price: 3.42, delivery_time: "24h", enabled: true },
          { id: `t_${Date.now()}_2`, label: "Até 2 Kg", weight_max: 2, cost_price: 3.15, margin_pct: 20, sell_price: 3.78, delivery_time: "24h", enabled: true },
          { id: `t_${Date.now()}_5`, label: "Até 5 Kg", weight_max: 5, cost_price: 3.75, margin_pct: 20, sell_price: 4.50, delivery_time: "24h", enabled: true },
          { id: `t_${Date.now()}_10`, label: "Até 10 Kg", weight_max: 10, cost_price: 4.60, margin_pct: 20, sell_price: 5.52, delivery_time: "24h", enabled: true },
          { id: `t_${Date.now()}_20`, label: "Até 20 Kg", weight_max: 20, cost_price: 6.20, margin_pct: 20, sell_price: 7.44, delivery_time: "24h", enabled: true },
          { id: `t_${Date.now()}_30`, label: "Até 30 Kg", weight_max: 30, cost_price: 7.90, margin_pct: 20, sell_price: 9.48, delivery_time: "24h", enabled: true },
          { id: `t_${Date.now()}_add`, label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.28, margin_pct: 20, sell_price: 0.34, delivery_time: "24h", enabled: true },
        ]
      }
    ],
    created_at: servico.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Se estava tombstone, remover
  try {
    const { data: delLogs } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "deleted_servico_linke")

    if (delLogs) {
      for (const d of delLogs) {
        if (d.details?.id === id) {
          await supabase.from("audit_log").delete().eq("id", d.id)
        }
      }
    }
  } catch {}

  // 1. Tentar gravar na tabela
  try {
    await supabase.from("servicos_linke").upsert(fullRecord)
  } catch {}

  // 2. Gravar em audit_log
  try {
    const { data: existing } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "servicos_linke_data")

    if (existing) {
      for (const item of existing) {
        if (item.details?.id === id) {
          await supabase.from("audit_log").delete().eq("id", item.id)
        }
      }
    }

    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
      action: "servicos_linke_data",
      details: fullRecord,
    })
  } catch (err: any) {
    console.warn("Audit log save servico error:", err?.message)
  }

  revalidatePath("/ops/configuracao/servicos")
  return { success: true, data: fullRecord }
}

/**
 * Clona / Duplica um serviço existente para criar uma tabela especial para outro cliente ou volume
 */
export async function duplicateServicoForClientAction(
  sourceServicoId: string,
  targetProfile: "VIP / Alto Volume" | "E-Commerce PME" | "Tabela Negociada Cliente",
  targetClientName: string,
  discountPct: number
): Promise<{ success: boolean; data?: ServicoLinke }> {
  const servicos = await getServicosLinkeAction()
  const source = servicos.find((s) => s.id === sourceServicoId)
  if (!source) return { success: false }

  const newId = `srv_linke_${Date.now()}`
  const newCode = `${source.code.replace(/-VIP|-STD|-PRO/, "")}-${targetProfile === "VIP / Alto Volume" ? "VIP" : targetProfile === "E-Commerce PME" ? "ECOM" : "CUST"}`

  // Aplicar desconto sobre o PVP base ou ajustar markup
  const clonedZones = source.zones.map((zone) => ({
    ...zone,
    tiers: zone.tiers.map((t, idx) => {
      const discountFactor = 1 - discountPct / 100
      const newSellPrice = Number(Math.max(t.cost_price * 1.05, t.sell_price * discountFactor).toFixed(2))
      const newMargin = Number((((newSellPrice - t.cost_price) / t.cost_price) * 100).toFixed(0))

      return {
        ...t,
        id: `t_clone_${Date.now()}_${idx}`,
        sell_price: newSellPrice,
        margin_pct: newMargin,
      }
    }),
  }))

  const clonedRecord: ServicoLinke = {
    ...source,
    id: newId,
    code: newCode,
    name: `${source.name.replace(/\(.*?\)/g, "").trim()} (${targetProfile})`,
    description: `Tabela de preços personalizada com desconto de ${discountPct}% para: ${targetClientName}`,
    pricing_profile: targetProfile,
    target_client_name: targetClientName,
    discount_vs_standard_pct: discountPct,
    zones: clonedZones,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const result = await saveServicoLinkeAction(clonedRecord)
  return result
}

/**
 * Atualiza markup global e recalcula escalões de um serviço
 */
export async function updateServicoMarkupAction(
  servicoId: string,
  newMarkupPct: number
): Promise<{ success: boolean }> {
  const servicos = await getServicosLinkeAction()
  const target = servicos.find((s) => s.id === servicoId)
  if (!target) return { success: false }

  const updatedZones = target.zones.map((zone) => ({
    ...zone,
    tiers: zone.tiers.map((t) => ({
      ...t,
      margin_pct: newMarkupPct,
      sell_price: Number((t.cost_price * (1 + newMarkupPct / 100)).toFixed(2)),
    })),
  }))

  await saveServicoLinkeAction({
    ...target,
    global_markup_pct: newMarkupPct,
    zones: updatedZones,
  })

  return { success: true }
}

/**
 * Altera status ativo/inativo de um Serviço Linke
 */
export async function toggleServicoLinkeStatusAction(id: string, is_active: boolean) {
  const servicos = await getServicosLinkeAction()
  const target = servicos.find((s) => s.id === id)
  if (!target) return { success: false }

  await saveServicoLinkeAction({
    ...target,
    is_active,
  })

  return { success: true }
}

/**
 * Elimina um Serviço Linke
 */
export async function deleteServicoLinkeAction(id: string) {
  const supabase = createAdminClient()

  try {
    await supabase.from("servicos_linke").delete().eq("id", id)
  } catch {}

  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "servicos_linke_data")

    if (logs) {
      for (const item of logs) {
        if (item.details?.id === id) {
          await supabase.from("audit_log").delete().eq("id", item.id)
        }
      }
    }
  } catch {}

  try {
    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
      action: "deleted_servico_linke",
      details: { id, deleted_at: new Date().toISOString() },
    })
  } catch {}

  revalidatePath("/ops/configuracao/servicos")
  return { success: true }
}

/**
 * Obtém os dados consolidados de Fornecedores, Serviços Linke e Webservices para o Módulo
 */
export async function getServicosDashboardDataAction() {
  const [servicos, fornecedores, webservices] = await Promise.all([
    getServicosLinkeAction(),
    getFornecedoresAction(),
    getCarrierConnectionsAction(),
  ])

  return {
    servicos,
    fornecedores,
    webservices: webservices || [],
  }
}
