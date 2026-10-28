"use server"

import { getServiceParcelLimitProduct } from "@/lib/pricing/oversize-surcharge"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { getFornecedoresAction, saveFornecedorAction } from "@/app/actions/fornecedores"
import { getCarrierConnectionsAction } from "@/app/actions/ctt"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { getServiceVolumetricRule } from "@/lib/pricing/chargeable-weight"
import {
  PRIMORDIAL_SERVICE_CODES,
  canManagePrimordialServices,
  isPrimordialServico,
} from "@/app/ops/configuracao/servicos/types"
import { getTenantId, requireUser, requireEmployee } from "@/lib/auth/context"
import { buildOfficialLinkeInternationalZones, buildOfficialCeTruckZones } from "@/lib/services/geo/international-zones"
import { isTemporarilyWithdrawnService } from "@/lib/services/service-availability"
import {
  ZONE_DISPLAY_NAMES,
  buildDefaultCustomServiceCode,
  buildSubproductContractZones,
  detectCarrierGroup,
  normalizeServiceZoneCode,
} from "@/lib/pricing/carrier-zone-templates"

const DEFAULT_SERVICOS_LINKE: ServicoLinke[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. PARA AMANHÃ (24H) — Guia DD — EMSF056.01
  //    Preços custo: exatos do contrato CTT
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_dd_std",
    code: "LK-DD-STD",
    name: "Linke Para Amanhã 24H (Guia DD)",
    description: "Entrega no dia útil seguinte em Portugal Continental, Ilhas (Açores e Madeira) e Espanha Peninsular. Emissão de Guia DD via CTT Expresso.",
    category: "Nacional",
    color: "#059669",
    is_active: true,
    is_primordial: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Clientes Gerais",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_2",
    preferred_carrier_name: "CTT Expresso",
    webservice_connection_id: "ctt_expresso",
    webservice_service_code: "EMSF056.01",
    transit_time_label: "24h",
    global_markup_pct: 25.0,
    fuel_surcharge_pct: 12.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    allowed_zones: ["PT-CONT", "PT-ILHAS", "ES-PENIN"],
    created_at: "2026-09-01T10:00:00Z",
    zones: [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental",
        tiers: [
          { id: "dd_std_1",   label: "Até 1 Kg",            weight_max: 1,   cost_price: 2.96, margin_pct: 25, sell_price: 3.70, delivery_time: "24h", enabled: true },
          { id: "dd_std_5",   label: "Até 5 Kg",            weight_max: 5,   cost_price: 3.15, margin_pct: 25, sell_price: 3.94, delivery_time: "24h", enabled: true },
          { id: "dd_std_10",  label: "Até 10 Kg",           weight_max: 10,  cost_price: 3.47, margin_pct: 25, sell_price: 4.34, delivery_time: "24h", enabled: true },
          { id: "dd_std_15",  label: "Até 15 Kg",           weight_max: 15,  cost_price: 4.21, margin_pct: 25, sell_price: 5.26, delivery_time: "24h", enabled: true },
          { id: "dd_std_20",  label: "Até 20 Kg",           weight_max: 20,  cost_price: 4.95, margin_pct: 25, sell_price: 6.19, delivery_time: "24h", enabled: true },
          { id: "dd_std_25",  label: "Até 25 Kg",           weight_max: 25,  cost_price: 5.78, margin_pct: 25, sell_price: 7.23, delivery_time: "24h", enabled: true },
          { id: "dd_std_30",  label: "Até 30 Kg",           weight_max: 30,  cost_price: 6.54, margin_pct: 25, sell_price: 8.18, delivery_time: "24h", enabled: true },
          { id: "dd_std_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.21, margin_pct: 25, sell_price: 0.26, delivery_time: "24h", enabled: true },
        ],
      },
      {
        zone_code: "PT-ILHAS",
        zone_name: "PT — Ilhas Açores & Madeira",
        tiers: [
          { id: "dd_acr_1",   label: "Até 1 Kg",            weight_max: 1,   cost_price: 10.33, margin_pct: 25, sell_price: 12.91, delivery_time: "48-72h", enabled: true },
          { id: "dd_acr_5",   label: "Até 5 Kg",            weight_max: 5,   cost_price: 16.78, margin_pct: 25, sell_price: 20.98, delivery_time: "48-72h", enabled: true },
          { id: "dd_acr_add", label: "Kg Adicional (+5kg)",  weight_max: 999, cost_price: 2.51,  margin_pct: 25, sell_price: 3.14,  delivery_time: "48-72h", enabled: true },
        ],
      },
      {
        zone_code: "ES-PENIN",
        zone_name: "Espanha Peninsular",
        tiers: [
          { id: "dd_es_1",   label: "Até 1 Kg",             weight_max: 1,   cost_price: 3.26, margin_pct: 25, sell_price: 4.07,  delivery_time: "24-48h", enabled: true },
          { id: "dd_es_5",   label: "Até 5 Kg",             weight_max: 5,   cost_price: 4.05, margin_pct: 25, sell_price: 5.06,  delivery_time: "24-48h", enabled: true },
          { id: "dd_es_10",  label: "Até 10 Kg",            weight_max: 10,  cost_price: 5.14, margin_pct: 25, sell_price: 6.42,  delivery_time: "24-48h", enabled: true },
          { id: "dd_es_15",  label: "Até 15 Kg",            weight_max: 15,  cost_price: 6.12, margin_pct: 25, sell_price: 7.65,  delivery_time: "24-48h", enabled: true },
          { id: "dd_es_20",  label: "Até 20 Kg",            weight_max: 20,  cost_price: 7.80, margin_pct: 25, sell_price: 9.75,  delivery_time: "24-48h", enabled: true },
          { id: "dd_es_25",  label: "Até 25 Kg",            weight_max: 25,  cost_price: 8.50, margin_pct: 25, sell_price: 10.63, delivery_time: "24-48h", enabled: true },
          { id: "dd_es_30",  label: "Até 30 Kg",            weight_max: 30,  cost_price: 9.82, margin_pct: 25, sell_price: 12.28, delivery_time: "24-48h", enabled: true },
          { id: "dd_es_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.34, margin_pct: 25, sell_price: 0.43,  delivery_time: "24-48h", enabled: true },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. EM 2 DIAS (48H) — Guia DB — EMSF057.01
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_db_std",
    code: "LK-DB-STD",
    name: "Linke Em 2 Dias 48H (Guia DB)",
    description: "Entrega em 2 dias úteis em Portugal Continental, Ilhas (Açores e Madeira) e Espanha Peninsular. Emissão de Guia DB via CTT Expresso.",
    category: "Nacional",
    color: "#0891b2",
    is_active: true,
    is_primordial: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Todos os Clientes",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_2",
    preferred_carrier_name: "CTT Expresso",
    webservice_connection_id: "ctt_expresso",
    webservice_service_code: "EMSF057.01",
    transit_time_label: "48h",
    global_markup_pct: 25.0,
    fuel_surcharge_pct: 12.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    allowed_zones: ["PT-CONT", "PT-ILHAS", "ES-PENIN"],
    created_at: "2026-09-01T10:10:00Z",
    zones: [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental",
        tiers: [
          { id: "db_std_1",   label: "Até 1 Kg",            weight_max: 1,   cost_price: 2.81, margin_pct: 25, sell_price: 3.51, delivery_time: "48h", enabled: true },
          { id: "db_std_5",   label: "Até 5 Kg",            weight_max: 5,   cost_price: 3.09, margin_pct: 25, sell_price: 3.86, delivery_time: "48h", enabled: true },
          { id: "db_std_10",  label: "Até 10 Kg",           weight_max: 10,  cost_price: 3.40, margin_pct: 25, sell_price: 4.25, delivery_time: "48h", enabled: true },
          { id: "db_std_15",  label: "Até 15 Kg",           weight_max: 15,  cost_price: 4.13, margin_pct: 25, sell_price: 5.16, delivery_time: "48h", enabled: true },
          { id: "db_std_20",  label: "Até 20 Kg",           weight_max: 20,  cost_price: 4.85, margin_pct: 25, sell_price: 6.06, delivery_time: "48h", enabled: true },
          { id: "db_std_25",  label: "Até 25 Kg",           weight_max: 25,  cost_price: 5.66, margin_pct: 25, sell_price: 7.08, delivery_time: "48h", enabled: true },
          { id: "db_std_30",  label: "Até 30 Kg",           weight_max: 30,  cost_price: 6.41, margin_pct: 25, sell_price: 8.01, delivery_time: "48h", enabled: true },
          { id: "db_std_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.20, margin_pct: 25, sell_price: 0.25, delivery_time: "48h", enabled: true },
        ],
      },
      {
        zone_code: "PT-ILHAS",
        zone_name: "PT — Ilhas Açores & Madeira",
        tiers: [
          { id: "db_ilh_1",   label: "Até 1 Kg",            weight_max: 1,   cost_price: 5.42,  margin_pct: 20, sell_price: 6.50,  delivery_time: "72-96h", enabled: true },
          { id: "db_ilh_5",   label: "Até 5 Kg",            weight_max: 5,   cost_price: 7.55,  margin_pct: 20, sell_price: 9.06,  delivery_time: "72-96h", enabled: true },
          { id: "db_ilh_10",  label: "Até 10 Kg",           weight_max: 10,  cost_price: 9.23,  margin_pct: 20, sell_price: 11.08, delivery_time: "72-96h", enabled: true },
          { id: "db_ilh_15",  label: "Até 15 Kg",           weight_max: 15,  cost_price: 13.09, margin_pct: 20, sell_price: 15.71, delivery_time: "72-96h", enabled: true },
          { id: "db_ilh_20",  label: "Até 20 Kg",           weight_max: 20,  cost_price: 16.88, margin_pct: 20, sell_price: 20.26, delivery_time: "72-96h", enabled: true },
          { id: "db_ilh_25",  label: "Até 25 Kg",           weight_max: 25,  cost_price: 20.78, margin_pct: 20, sell_price: 24.94, delivery_time: "72-96h", enabled: true },
          { id: "db_ilh_30",  label: "Até 30 Kg",           weight_max: 30,  cost_price: 24.69, margin_pct: 20, sell_price: 29.63, delivery_time: "72-96h", enabled: true },
          { id: "db_ilh_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 1.13,  margin_pct: 20, sell_price: 1.36,  delivery_time: "72-96h", enabled: true },
        ],
      },
      {
        zone_code: "ES-PENIN",
        zone_name: "Espanha Peninsular",
        tiers: [
          { id: "db_es_1",   label: "Até 1 Kg",             weight_max: 1,   cost_price: 3.19, margin_pct: 28, sell_price: 4.08,  delivery_time: "48-72h", enabled: true },
          { id: "db_es_5",   label: "Até 5 Kg",             weight_max: 5,   cost_price: 3.97, margin_pct: 28, sell_price: 5.08,  delivery_time: "48-72h", enabled: true },
          { id: "db_es_10",  label: "Até 10 Kg",            weight_max: 10,  cost_price: 5.03, margin_pct: 28, sell_price: 6.44,  delivery_time: "48-72h", enabled: true },
          { id: "db_es_15",  label: "Até 15 Kg",            weight_max: 15,  cost_price: 6.00, margin_pct: 28, sell_price: 7.68,  delivery_time: "48-72h", enabled: true },
          { id: "db_es_20",  label: "Até 20 Kg",            weight_max: 20,  cost_price: 7.64, margin_pct: 28, sell_price: 9.78,  delivery_time: "48-72h", enabled: true },
          { id: "db_es_25",  label: "Até 25 Kg",            weight_max: 25,  cost_price: 8.32, margin_pct: 28, sell_price: 10.65, delivery_time: "48-72h", enabled: true },
          { id: "db_es_30",  label: "Até 30 Kg",            weight_max: 30,  cost_price: 9.62, margin_pct: 28, sell_price: 12.31, delivery_time: "48-72h", enabled: true },
          { id: "db_es_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.34, margin_pct: 28, sell_price: 0.44,  delivery_time: "48-72h", enabled: true },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. ECONÓMICO / 48 (CONTINENTE) — Guia EQ — ENCF008.01
  //    (código real validado contra a API CTT em produção)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_eq_std",
    code: "LK-EQ-STD",
    name: "Linke Económico 48 Continente (Guia EQ)",
    description: "Serviço económico com entrega em 48H no Continente. Emissão de Guia EQ via CTT Expresso.",
    category: "Nacional",
    color: "#6366f1",
    is_active: true,
    is_primordial: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Todos os Clientes",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_2",
    preferred_carrier_name: "CTT Expresso",
    webservice_connection_id: "ctt_expresso",
    webservice_service_code: "ENCF008.01",
    transit_time_label: "48h",
    global_markup_pct: 25.0,
    fuel_surcharge_pct: 12.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    allowed_zones: ["PT-CONT"],
    created_at: "2026-09-01T10:20:00Z",
    zones: [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental",
        tiers: [
          { id: "eq_std_1",   label: "Até 1 Kg",            weight_max: 1,   cost_price: 2.71, margin_pct: 25, sell_price: 3.39, delivery_time: "48h", enabled: true },
          { id: "eq_std_5",   label: "Até 5 Kg",            weight_max: 5,   cost_price: 2.98, margin_pct: 25, sell_price: 3.73, delivery_time: "48h", enabled: true },
          { id: "eq_std_10",  label: "Até 10 Kg",           weight_max: 10,  cost_price: 3.28, margin_pct: 25, sell_price: 4.10, delivery_time: "48h", enabled: true },
          { id: "eq_std_15",  label: "Até 15 Kg",           weight_max: 15,  cost_price: 3.98, margin_pct: 25, sell_price: 4.98, delivery_time: "48h", enabled: true },
          { id: "eq_std_20",  label: "Até 20 Kg",           weight_max: 20,  cost_price: 4.68, margin_pct: 25, sell_price: 5.85, delivery_time: "48h", enabled: true },
          { id: "eq_std_25",  label: "Até 25 Kg",           weight_max: 25,  cost_price: 5.46, margin_pct: 25, sell_price: 6.83, delivery_time: "48h", enabled: true },
          { id: "eq_std_30",  label: "Até 30 Kg",           weight_max: 30,  cost_price: 6.19, margin_pct: 25, sell_price: 7.74, delivery_time: "48h", enabled: true },
          { id: "eq_std_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.20, margin_pct: 25, sell_price: 0.25, delivery_time: "48h", enabled: true },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3b. CTT EXPRESSO ECONÓMICO 48 (Guia EQ) — ENCF008.01 — Grandes Contas
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_1793009571268",
    code: "LK-EQ-VIP",
    name: "CTT Expresso Económico 48 (Guia EQ)",
    description: "Tabela de preços personalizada com desconto de 1% para: Grandes Contas (>300 envios/mês)",
    category: "Nacional",
    color: "#6366f1",
    is_active: true,
    is_primordial: true,
    pricing_profile: "VIP / Alto Volume",
    target_client_name: "Grandes Contas (>300 envios/mês)",
    discount_vs_standard_pct: 1,
    preferred_carrier_id: "forn_2",
    preferred_carrier_name: "CTT Expresso",
    webservice_connection_id: "ctt_expresso",
    webservice_service_code: "ENCF008.01",
    transit_time_label: "48h",
    global_markup_pct: 25.0,
    fuel_surcharge_pct: 12.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    saturday_fee: 15,
    return_guide_fee: 3.5,
    allowed_zones: ["PT-CONT"],
    created_at: "2026-10-26T10:12:51.268Z",
    zones: [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental",
        tiers: [
          { id: "t_clone_1793009571268_0", label: "Até 1 Kg",            weight_max: 1,   cost_price: 2.81, margin_pct: 23, sell_price: 3.45, delivery_time: "48h", enabled: true },
          { id: "t_clone_1793009571268_1", label: "Até 5 Kg",            weight_max: 5,   cost_price: 2.98, margin_pct: 22, sell_price: 3.65, delivery_time: "48h", enabled: true },
          { id: "t_clone_1793009571268_2", label: "Até 10 Kg",           weight_max: 10,  cost_price: 3.28, margin_pct: 23, sell_price: 4.02, delivery_time: "48h", enabled: true },
          { id: "t_clone_1793009571268_3", label: "Até 15 Kg",           weight_max: 15,  cost_price: 3.98, margin_pct: 23, sell_price: 4.88, delivery_time: "48h", enabled: true },
          { id: "t_clone_1793009571268_4", label: "Até 20 Kg",           weight_max: 20,  cost_price: 4.68, margin_pct: 22, sell_price: 5.73, delivery_time: "48h", enabled: true },
          { id: "t_clone_1793009571268_5", label: "Até 25 Kg",           weight_max: 25,  cost_price: 5.46, margin_pct: 23, sell_price: 6.69, delivery_time: "48h", enabled: true },
          { id: "t_clone_1793009571268_6", label: "Até 30 Kg",           weight_max: 30,  cost_price: 6.19, margin_pct: 22, sell_price: 7.58, delivery_time: "48h", enabled: true },
          { id: "t_clone_1793009571268_7", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.20, margin_pct: 25, sell_price: 0.25, delivery_time: "48h", enabled: true },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. 19 MÚLTIPLO — Continente → Continente — EMSF010.01
  //    Para remessas de 10+ volumes com mesmo produto/origem/destino/data
  //    (código real validado contra a API CTT em produção — gera prefixo EG)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_multiplo_std",
    code: "LK-MULT-STD",
    name: "Linke 19 Múltiplo (10+ volumes)",
    description: "Tarifa múltiplo para remessas de 10 ou mais volumes com o mesmo produto, data, origem e destino em Portugal Continental. Preço mais baixo por volume.",
    category: "Nacional",
    color: "#0d9488",
    is_active: true,
    is_primordial: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Clientes com Grande Volume (10+ volumes/remessa)",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_2",
    preferred_carrier_name: "CTT Expresso",
    webservice_connection_id: "ctt_expresso",
    webservice_service_code: "EMSF010.01",
    transit_time_label: "24h",
    global_markup_pct: 22.0,
    fuel_surcharge_pct: 12.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    allowed_zones: ["PT-CONT"],
    created_at: "2026-09-01T10:30:00Z",
    zones: [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental (mín. 10 volumes)",
        tiers: [
          { id: "mu_std_1",   label: "Até 1 Kg",            weight_max: 1,   cost_price: 2.85, margin_pct: 22, sell_price: 3.48, delivery_time: "24h", enabled: true },
          { id: "mu_std_5",   label: "Até 5 Kg",            weight_max: 5,   cost_price: 3.04, margin_pct: 22, sell_price: 3.71, delivery_time: "24h", enabled: true },
          { id: "mu_std_10",  label: "Até 10 Kg",           weight_max: 10,  cost_price: 3.35, margin_pct: 22, sell_price: 4.09, delivery_time: "24h", enabled: true },
          { id: "mu_std_15",  label: "Até 15 Kg",           weight_max: 15,  cost_price: 4.06, margin_pct: 22, sell_price: 4.95, delivery_time: "24h", enabled: true },
          { id: "mu_std_20",  label: "Até 20 Kg",           weight_max: 20,  cost_price: 4.78, margin_pct: 22, sell_price: 5.83, delivery_time: "24h", enabled: true },
          { id: "mu_std_25",  label: "Até 25 Kg",           weight_max: 25,  cost_price: 5.58, margin_pct: 22, sell_price: 6.81, delivery_time: "24h", enabled: true },
          { id: "mu_std_30",  label: "Até 30 Kg",           weight_max: 30,  cost_price: 6.32, margin_pct: 22, sell_price: 7.71, delivery_time: "24h", enabled: true },
          { id: "mu_std_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.21, margin_pct: 22, sell_price: 0.26, delivery_time: "24h", enabled: true },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. EUROPA & MUNDIAL — EMS Internacional — Guia EE — EMSF001.02
  //    (código real validado contra a API CTT em produção)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_europa_air",
    code: "LK-EU-AIR",
    name: "Linke EMS Internacional Aéreo (Guia EE)",
    description: "Tarifas oficiais de exportação aérea internacional prioritária em 8 zonas mundiais (Europa 1, 2 e 3, América do Norte, América do Sul, Oriente 1 e 2, África) via CTT EMS Internacional (Guia EE · EMSF001.02).",
    category: "Internacional",
    color: "#7c3aed",
    is_active: true,
    is_primordial: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Todos os Clientes",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_2",
    preferred_carrier_name: "CTT Expresso",
    webservice_connection_id: "ctt_expresso",
    webservice_service_code: "EMSF001.02",
    transit_time_label: "3-7 dias úteis",
    global_markup_pct: 22.0,
    fuel_surcharge_pct: 8.5,
    cod_fee_pct: 0,
    cod_min_fee: 0,
    allowed_zones: ["EU 1", "EU 2", "EU 3", "NA", "SA", "O1", "O2", "A", "EU-Z1", "EU-Z2", "EU-Z3", "INTL-AERO", "INTL"],
    created_at: "2026-09-01T10:40:00Z",
    zones: buildOfficialLinkeInternationalZones(22),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5b. EUROPA RODOVIÁRIO (CAMIÃO) — EMS Economy — Guia CE — ENCF008.02
  //    Contrato CTT oficial (public/Capa.pdf): Exclusivamente Zona 2 e Zona 3
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_ce_std",
    code: "LK-CE-STD",
    name: "Linke Europa Terrestre Económico (Guia CE)",
    description: "Tarifas oficiais de exportação rodoviária / camião para a Europa (Zona 2 e Zona 3) via CTT EMS Economy (Guia CE · ENCF008.02).",
    category: "Internacional",
    color: "#2563eb",
    is_active: true,
    is_primordial: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Todos os Clientes",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_2",
    preferred_carrier_name: "CTT Expresso",
    webservice_connection_id: "ctt_expresso",
    webservice_service_code: "ENCF008.02",
    transit_time_label: "3-5 dias úteis",
    global_markup_pct: 15.0,
    fuel_surcharge_pct: 8.5,
    cod_fee_pct: 0,
    cod_min_fee: 0,
    allowed_zones: ["Zona 2", "Zona 3"],
    created_at: "2026-09-01T10:45:00Z",
    zones: buildOfficialCeTruckZones(),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. PONTO CTT (Entrega em Ponto de Contacto CTT)
  //    Preços da coluna "Ponto CTT" do contrato (Para Amanhã)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_ponto_ctt",
    code: "LK-PONTO",
    name: "Linke Ponto CTT / Cacifo Locky",
    description: "Entrega em mais de 2.000 Pontos CTT e Cacifos Inteligentes Locky 24H. Preço de Ponto conforme contrato.",
    category: "Ponto / Locky",
    color: "#d97706",
    is_active: true,
    pricing_profile: "E-Commerce PME",
    target_client_name: "Lojas Online & E-commerce",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_2",
    preferred_carrier_name: "CTT Expresso",
    webservice_connection_id: "ctt_expresso",
    webservice_service_code: "EMSF056.01",
    transit_time_label: "24h",
    global_markup_pct: 25.0,
    fuel_surcharge_pct: 12.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    allowed_zones: ["PT-CONT"],
    created_at: "2026-09-01T10:50:00Z",
    zones: [
      {
        zone_code: "PT-PONTO",
        zone_name: "Rede Nacional Pontos CTT & Cacifos Locky",
        tiers: [
          { id: "ponto_1",   label: "Até 1 Kg",            weight_max: 1,   cost_price: 2.67, margin_pct: 25, sell_price: 3.34, delivery_time: "24h", enabled: true },
          { id: "ponto_5",   label: "Até 5 Kg",            weight_max: 5,   cost_price: 2.87, margin_pct: 25, sell_price: 3.59, delivery_time: "24h", enabled: true },
          { id: "ponto_10",  label: "Até 10 Kg",           weight_max: 10,  cost_price: 3.18, margin_pct: 25, sell_price: 3.98, delivery_time: "24h", enabled: true },
          { id: "ponto_15",  label: "Até 15 Kg",           weight_max: 15,  cost_price: 3.93, margin_pct: 25, sell_price: 4.91, delivery_time: "24h", enabled: true },
          { id: "ponto_20",  label: "Até 20 Kg",           weight_max: 20,  cost_price: 4.67, margin_pct: 25, sell_price: 5.84, delivery_time: "24h", enabled: true },
          { id: "ponto_25",  label: "Até 25 Kg",           weight_max: 25,  cost_price: 5.49, margin_pct: 25, sell_price: 6.86, delivery_time: "24h", enabled: true },
          { id: "ponto_30",  label: "Até 30 Kg",           weight_max: 30,  cost_price: 6.26, margin_pct: 25, sell_price: 7.83, delivery_time: "24h", enabled: true },
          { id: "ponto_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.21, margin_pct: 25, sell_price: 0.26, delivery_time: "24h", enabled: true },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. CORREOS EXPRESS PAQ 24 — LK-COR-24
  //    Contrato Correos Express Portugal (CEP II) - Ibérico 24H
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_cor_24",
    code: "LK-COR-24",
    name: "Linke Ibérico 24H (Correos Paq 24)",
    description: "Serviço expresso porta-a-porta Portugal Continental e Espanha Peninsular com entrega em 24h via Correos Express.",
    category: "Ibérico",
    color: "#00a3e0",
    is_active: true,
    is_primordial: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Clientes Gerais",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CORREOS.EXPRESS",
    webservice_connection_id: "correos_express",
    webservice_service_code: "61",
    transit_time_label: "24h",
    global_markup_pct: 22.0,
    fuel_surcharge_pct: 11.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    allowed_zones: ["PT-CONT", "ES-PENIN"],
    created_at: "2026-09-01T11:00:00Z",
    zones: [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental",
        tiers: [
          { id: "cor24_pt_1",   label: "Até 1 Kg",            weight_max: 1,   cost_price: 2.85, margin_pct: 22, sell_price: 3.48, delivery_time: "24h", enabled: true },
          { id: "cor24_pt_2",   label: "Até 2 Kg",            weight_max: 2,   cost_price: 3.15, margin_pct: 22, sell_price: 3.84, delivery_time: "24h", enabled: true },
          { id: "cor24_pt_5",   label: "Até 5 Kg",            weight_max: 5,   cost_price: 3.75, margin_pct: 22, sell_price: 4.58, delivery_time: "24h", enabled: true },
          { id: "cor24_pt_10",  label: "Até 10 Kg",           weight_max: 10,  cost_price: 4.60, margin_pct: 22, sell_price: 5.61, delivery_time: "24h", enabled: true },
          { id: "cor24_pt_15",  label: "Até 15 Kg",           weight_max: 15,  cost_price: 5.40, margin_pct: 22, sell_price: 6.59, delivery_time: "24h", enabled: true },
          { id: "cor24_pt_20",  label: "Até 20 Kg",           weight_max: 20,  cost_price: 6.20, margin_pct: 22, sell_price: 7.56, delivery_time: "24h", enabled: true },
          { id: "cor24_pt_30",  label: "Até 30 Kg",           weight_max: 30,  cost_price: 7.90, margin_pct: 22, sell_price: 9.64, delivery_time: "24h", enabled: true },
          { id: "cor24_pt_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.28, margin_pct: 22, sell_price: 0.34, delivery_time: "24h", enabled: true },
        ],
      },
      {
        zone_code: "ES-PENIN",
        zone_name: "Espanha Peninsular",
        tiers: [
          { id: "cor24_es_1",   label: "Até 1 Kg",             weight_max: 1,   cost_price: 4.20, margin_pct: 25, sell_price: 5.25, delivery_time: "24-48h", enabled: true },
          { id: "cor24_es_2",   label: "Até 2 Kg",             weight_max: 2,   cost_price: 4.80, margin_pct: 25, sell_price: 6.00, delivery_time: "24-48h", enabled: true },
          { id: "cor24_es_5",   label: "Até 5 Kg",             weight_max: 5,   cost_price: 5.90, margin_pct: 25, sell_price: 7.38, delivery_time: "24-48h", enabled: true },
          { id: "cor24_es_10",  label: "Até 10 Kg",            weight_max: 10,  cost_price: 7.50, margin_pct: 25, sell_price: 9.38, delivery_time: "24-48h", enabled: true },
          { id: "cor24_es_15",  label: "Até 15 Kg",            weight_max: 15,  cost_price: 9.35, margin_pct: 25, sell_price: 11.69, delivery_time: "24-48h", enabled: true },
          { id: "cor24_es_20",  label: "Até 20 Kg",            weight_max: 20,  cost_price: 11.20, margin_pct: 25, sell_price: 14.00, delivery_time: "24-48h", enabled: true },
          { id: "cor24_es_30",  label: "Até 30 Kg",            weight_max: 30,  cost_price: 14.90, margin_pct: 25, sell_price: 18.63, delivery_time: "24-48h", enabled: true },
          { id: "cor24_es_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.45,  margin_pct: 25, sell_price: 0.56,  delivery_time: "24-48h", enabled: true },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. CORREOS EXPRESS PAQ 48 — LK-COR-48
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_cor_48",
    code: "LK-COR-48",
    name: "Linke Ibérico 48H (Correos Paq 48)",
    description: "Serviço económico ibérico para encomendas com prazo de entrega de 48h via Correos Express.",
    category: "Ibérico",
    color: "#0284c7",
    is_active: true,
    is_primordial: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Todos os Clientes",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CORREOS.EXPRESS",
    webservice_connection_id: "correos_express",
    webservice_service_code: "62",
    transit_time_label: "48h",
    global_markup_pct: 22.0,
    fuel_surcharge_pct: 11.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    allowed_zones: ["PT-CONT", "ES-PENIN"],
    created_at: "2026-09-01T11:10:00Z",
    zones: [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental",
        tiers: [
          { id: "cor48_pt_1",   label: "Até 1 Kg",            weight_max: 1,   cost_price: 2.65, margin_pct: 22, sell_price: 3.23, delivery_time: "48h", enabled: true },
          { id: "cor48_pt_5",   label: "Até 5 Kg",            weight_max: 5,   cost_price: 3.40, margin_pct: 22, sell_price: 4.15, delivery_time: "48h", enabled: true },
          { id: "cor48_pt_10",  label: "Até 10 Kg",           weight_max: 10,  cost_price: 4.15, margin_pct: 22, sell_price: 5.06, delivery_time: "48h", enabled: true },
          { id: "cor48_pt_20",  label: "Até 20 Kg",           weight_max: 20,  cost_price: 5.60, margin_pct: 22, sell_price: 6.83, delivery_time: "48h", enabled: true },
          { id: "cor48_pt_30",  label: "Até 30 Kg",           weight_max: 30,  cost_price: 7.10, margin_pct: 22, sell_price: 8.66, delivery_time: "48h", enabled: true },
          { id: "cor48_pt_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.25, margin_pct: 22, sell_price: 0.31, delivery_time: "48h", enabled: true },
        ],
      },
      {
        zone_code: "ES-PENIN",
        zone_name: "Espanha Peninsular",
        tiers: [
          { id: "cor48_es_1",   label: "Até 1 Kg",             weight_max: 1,   cost_price: 3.90, margin_pct: 25, sell_price: 4.88,  delivery_time: "48-72h", enabled: true },
          { id: "cor48_es_5",   label: "Até 5 Kg",             weight_max: 5,   cost_price: 5.20, margin_pct: 25, sell_price: 6.50,  delivery_time: "48-72h", enabled: true },
          { id: "cor48_es_10",  label: "Até 10 Kg",            weight_max: 10,  cost_price: 6.80, margin_pct: 25, sell_price: 8.50,  delivery_time: "48-72h", enabled: true },
          { id: "cor48_es_20",  label: "Até 20 Kg",            weight_max: 20,  cost_price: 9.90, margin_pct: 25, sell_price: 12.38, delivery_time: "48-72h", enabled: true },
          { id: "cor48_es_30",  label: "Até 30 Kg",            weight_max: 30,  cost_price: 13.50, margin_pct: 25, sell_price: 16.88, delivery_time: "48-72h", enabled: true },
          { id: "cor48_es_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.40,  margin_pct: 25, sell_price: 0.50,  delivery_time: "48-72h", enabled: true },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9. CORREOS EXPRESS EPAQ 24 B2C — LK-COR-ECOM
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_cor_ecom",
    code: "LK-COR-ECOM",
    name: "Linke e-Paq 24 B2C (Correos Express)",
    description: "Solução especializada para lojas de comércio eletrónico B2C com alertas SMS e previsão de entrega.",
    category: "Nacional",
    color: "#0369a1",
    is_active: true,
    is_primordial: true,
    pricing_profile: "E-Commerce PME",
    target_client_name: "Lojas Online & E-commerce",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CORREOS.EXPRESS",
    webservice_connection_id: "correos_express",
    webservice_service_code: "93",
    transit_time_label: "24h",
    global_markup_pct: 25.0,
    fuel_surcharge_pct: 11.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    allowed_zones: ["PT-CONT"],
    created_at: "2026-09-01T11:20:00Z",
    zones: [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental B2C",
        tiers: [
          { id: "corecom_1",   label: "Até 1 Kg",            weight_max: 1,   cost_price: 2.75, margin_pct: 25, sell_price: 3.44, delivery_time: "24h", enabled: true },
          { id: "corecom_2",   label: "Até 2 Kg",            weight_max: 2,   cost_price: 3.05, margin_pct: 25, sell_price: 3.81, delivery_time: "24h", enabled: true },
          { id: "corecom_5",   label: "Até 5 Kg",            weight_max: 5,   cost_price: 3.60, margin_pct: 25, sell_price: 4.50, delivery_time: "24h", enabled: true },
          { id: "corecom_10",  label: "Até 10 Kg",           weight_max: 10,  cost_price: 4.40, margin_pct: 25, sell_price: 5.50, delivery_time: "24h", enabled: true },
          { id: "corecom_20",  label: "Até 20 Kg",           weight_max: 20,  cost_price: 5.95, margin_pct: 25, sell_price: 7.44, delivery_time: "24h", enabled: true },
          { id: "corecom_30",  label: "Até 30 Kg",           weight_max: 30,  cost_price: 7.60, margin_pct: 25, sell_price: 9.50, delivery_time: "24h", enabled: true },
          { id: "corecom_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.26, margin_pct: 25, sell_price: 0.33, delivery_time: "24h", enabled: true },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10. CORREOS EXPRESS ILHAS BALEARES & CANÁRIAS — LK-COR-ISLAS
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_cor_islas",
    code: "LK-COR-ISLAS",
    name: "Linke Ilhas Espanholas (Correos Express)",
    description: "Serviço expresso para as ilhas espanholas (Baleares e Canárias) com gestão aduaneira e tracking integrado.",
    category: "Ilhas",
    color: "#0ea5e9",
    is_active: true,
    is_primordial: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Clientes Gerais",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CORREOS.EXPRESS",
    webservice_connection_id: "correos_express",
    webservice_service_code: "66",
    transit_time_label: "48-72h",
    global_markup_pct: 25.0,
    fuel_surcharge_pct: 12.0,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    allowed_zones: ["ES-ILHAS"],
    created_at: "2026-09-01T11:30:00Z",
    zones: [
      {
        zone_code: "ES-ILHAS",
        zone_name: "Espanha — Ilhas Baleares",
        tiers: [
          { id: "coris_1",   label: "Até 1 Kg",            weight_max: 1,   cost_price: 8.90,  margin_pct: 25, sell_price: 11.13, delivery_time: "48-72h", enabled: true },
          { id: "coris_2",   label: "Até 2 Kg",            weight_max: 2,   cost_price: 11.50, margin_pct: 25, sell_price: 14.38, delivery_time: "48-72h", enabled: true },
          { id: "coris_5",   label: "Até 5 Kg",            weight_max: 5,   cost_price: 16.80, margin_pct: 25, sell_price: 21.00, delivery_time: "48-72h", enabled: true },
          { id: "coris_10",  label: "Até 10 Kg",           weight_max: 10,  cost_price: 24.50, margin_pct: 25, sell_price: 30.63, delivery_time: "48-72h", enabled: true },
          { id: "coris_add", label: "Kg Adicional (+10kg)", weight_max: 999, cost_price: 1.80,  margin_pct: 25, sell_price: 2.25,  delivery_time: "48-72h", enabled: true },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 11. CORREOS EXPRESS INTERNACIONAL — International Express Exportação — LK-COR-INTL
  //    Contrato Oficial Correos Express Internacional:
  //    - TABELA INTERNACIONAL (2).pdf (Tarifas Produtos Internacional Exportação - Aéreo)
  //    - ZONAS INTERNACIONAIS.pdf (8 Zonas Internacionais, ~200 países)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_cor_intl",
    code: "LK-COR-INTL",
    name: "Linke Internacional Expresso (Correos Express)",
    description: "Tarifas oficiais de exportação aérea internacional da Correos Express (International Express Exportação) em 8 zonas mundiais (Europa 1, 2 e 3, América do Norte, América do Sul, Oriente 1 e 2, África) conforme contrato oficial (TABELA INTERNACIONAL (2).pdf e ZONAS INTERNACIONAIS.pdf).",
    category: "Internacional",
    color: "#0284c7",
    is_active: true,
    is_primordial: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Todos os Clientes",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CORREOS.EXPRESS",
    webservice_connection_id: "correos_express",
    webservice_service_code: "90",
    transit_time_label: "3-7 dias úteis",
    global_markup_pct: 22.0,
    fuel_surcharge_pct: 8.5,
    cod_fee_pct: 0,
    cod_min_fee: 0,
    allowed_zones: ["EU 1", "EU 2", "EU 3", "NA", "SA", "O1", "O2", "A", "EU-Z1", "EU-Z2", "EU-Z3", "INTL-AERO", "INTL"],
    created_at: "2026-09-01T11:40:00Z",
    zones: buildOfficialLinkeInternationalZones(22),
  },
]

/** Resolve the stored base-table marker and whether a catalogue entry exists. */
async function readStoredServiceProtection(supabase: ReturnType<typeof createAdminClient>, id: string, tenantId: string) {
  if (isPrimordialServico({ id })) return { found: true, isProtected: true }
  const { data: native, error: nativeError } = await supabase.from("servicos_linke")
    .select("*").eq("id", id).maybeSingle()
  // Legacy services use text IDs and may exist only in audit_log when the native table uses UUIDs.
  if (nativeError && !["42P01", "PGRST205", "22P02"].includes(nativeError.code)) {
    throw new Error("Não foi possível verificar a proteção da tabela. Tente novamente.")
  }
  if (isPrimordialServico(native)) return { found: true, isProtected: true }
  const { data: logs, error: auditError } = await supabase.from("audit_log").select("id, details")
    .eq("tenant_id", tenantId).eq("action", "servicos_linke_data").eq("details->>id", id)
  if (auditError) throw new Error("Não foi possível verificar a proteção da tabela. Tente novamente.")
  return {
    found: Boolean(native || logs?.length),
    isProtected: (logs || []).some((log: { details?: Partial<ServicoLinke> }) => isPrimordialServico(log.details)),
  }
}

function getCarrierRank(s: Partial<ServicoLinke>): number {
  const c = (s.preferred_carrier_name || "").toLowerCase()
  if (c.includes("ctt")) return 1
  if (c.includes("correos")) return 2
  return 3
}

/**
 * Normalizes legacy zone codes (`PT-ACORES` -> `PT-ILHAS`, missing single-zone domestic `zone_code` -> `PT-CONT`)
 * and attaches `is_primordial` + safe `carrier_group` before client cost redaction.
 */
function normalizeLoadedServico(s: any): any {
  const rawZones = Array.isArray(s.zones) ? s.zones : []
  const normalizedZones = rawZones.map((z: any) => {
    const rawCode = typeof z?.zone_code === "string" ? z.zone_code.trim() : ""
    const canonicalCode = rawCode
      ? normalizeServiceZoneCode(rawCode)
      : rawZones.length === 1
      ? "PT-CONT"
      : ""
    const nextZone: any = {
      ...z,
      ...(canonicalCode ? { zone_code: canonicalCode } : {}),
    }
    if (!z?.zone_name && ((z as any)?.name || !rawCode)) {
      nextZone.zone_name = (z as any)?.name || ZONE_DISPLAY_NAMES[canonicalCode] || canonicalCode
    } else if (
      (rawCode.toUpperCase() === "PT-ACORES" || rawCode.toUpperCase() === "PT-MADEIRA") &&
      canonicalCode === "PT-ILHAS"
    ) {
      nextZone.zone_name = "PT — Ilhas Açores & Madeira"
    }
    return nextZone
  })

  const normalizedAllowed = Array.isArray(s.allowed_zones)
    ? Array.from(new Set(s.allowed_zones.map((c: string) => normalizeServiceZoneCode(c) || c)))
    : !s.allowed_zones && rawZones.length === 1 && !rawZones[0]?.zone_code
    ? ["PT-CONT"]
    : s.allowed_zones

  const carrierGroup = detectCarrierGroup(s)

  return {
    ...s,
    is_primordial: isPrimordialServico(s),
    volumetric_rule: getServiceVolumetricRule(s),
    parcel_limit_product: getServiceParcelLimitProduct(s),
    ...(carrierGroup ? { carrier_group: carrierGroup } : {}),
    ...(normalizedAllowed !== undefined ? { allowed_zones: normalizedAllowed } : {}),
    ...(Array.isArray(s.zones) ? { zones: normalizedZones } : {}),
  }
}

/**
 * Obtém todos os Serviços Linke configurados
 */
export async function getServicosLinkeAction(): Promise<ServicoLinke[]> {
  const ctx = await requireUser()
  // Authorization and cost redaction must depend only on the verified session.
  const isClient = ctx.role === "client"
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
      return data
        .filter((s: any) => !deletedIds.has(s.id) && !isTemporarilyWithdrawnService(s))
        .sort((a: any, b: any) => getCarrierRank(a) - getCarrierRank(b))
        .map((s: any) => normalizeLoadedServico(s))
        .filter((s: any) => {
          if (isClient && s.client_id && s.client_id !== ctx.client_id) return false;
          return true;
        })
        .map((s: any) => {
          if (isClient) {
            return {
              ...s,
              global_markup_pct: undefined,
              preferred_carrier_id: undefined,
              preferred_carrier_name: undefined,
              webservice_connection_id: undefined,
              webservice_service_code: undefined,
              zones: s.zones?.map((z: any) => ({
                ...z,
                tiers: z.tiers?.map((t: any) => ({
                  ...t,
                  cost_price: undefined,
                  margin_pct: undefined
                }))
              }))
            }
          }
          return s;
        })
    }
  } catch {}

  // 2. Fallback resiliente: audit_log + DEFAULT_SERVICOS_LINKE
  const servicosMap = new Map<string, ServicoLinke>()
  
  // Preencher com defaults
  DEFAULT_SERVICOS_LINKE.forEach(s => servicosMap.set(s.id, s))

  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .eq("action", "servicos_linke_data")
      .order("created_at", { ascending: true })

    if (logs && logs.length > 0) {
      logs.forEach((l: any) => {
        if (l.details && l.details.id) {
          servicosMap.set(l.details.id, l.details as ServicoLinke)
        }
      })
    }
  } catch {}

  // 3. Converter map para array e filtrar os apagados
  const merged = Array.from(servicosMap.values())
  return merged
    .filter((s) => !deletedIds.has(s.id) && !isTemporarilyWithdrawnService(s))
    .sort((a, b) => getCarrierRank(a) - getCarrierRank(b))
    .map((s) => normalizeLoadedServico(s))
    .filter((s: any) => {
      if (isClient && s.client_id && s.client_id !== ctx.client_id) return false;
      return true;
    })
    .map((s: any) => {
      if (isClient) {
        return {
          ...s,
          global_markup_pct: undefined,
          preferred_carrier_id: undefined,
          preferred_carrier_name: undefined,
          webservice_connection_id: undefined,
          webservice_service_code: undefined,
          zones: s.zones?.map((z: any) => ({
            ...z,
            tiers: z.tiers?.map((t: any) => ({
              ...t,
              cost_price: undefined,
              margin_pct: undefined
            }))
          }))
        } as ServicoLinke
      }
      return s as ServicoLinke
    })
}

/**
 * Grava ou atualiza um Serviço Linke (criação ilimitada com suporte a perfis de cliente)
 */
export async function saveServicoLinkeAction(
  servico: Partial<ServicoLinke>
): Promise<{ success: boolean; data?: ServicoLinke; error?: string }> {
  const ctx = await requireEmployee()
  const supabase = createAdminClient()

  const id = servico.id || `srv_linke_${Date.now()}`
  let storedProtected = false
  try {
    storedProtected = (await readStoredServiceProtection(supabase, id, ctx.tenant_id)).isProtected
  } catch {
    return {
      success: false,
      error: "Não foi possível verificar a proteção da tabela. Tente novamente.",
    }
  }
  const isProtected = isPrimordialServico(servico) || storedProtected
  if (isProtected && !canManagePrimordialServices(ctx.user?.email)) {
    return {
      success: false,
      error: "Esta tabela base contratada está bloqueada. Apenas stefano.remy e geral@linke podem editar tabelas base.",
    }
  }
  
  const carrier = detectCarrierGroup(servico) || "ctt"

  // Processamento e normalização de zonas e escalões
  const rawZones = servico.zones || []
  const processedZones = rawZones.map((zone) => {
    const rawCode = (zone.zone_code || "").trim()
    const canonicalCode = rawCode
      ? normalizeServiceZoneCode(rawCode)
      : rawZones.length === 1
      ? "PT-CONT"
      : ""
    const canonicalName =
      (rawCode.toUpperCase() === "PT-ACORES" || rawCode.toUpperCase() === "PT-MADEIRA") && canonicalCode === "PT-ILHAS"
        ? "PT — Ilhas Açores & Madeira"
        : zone.zone_name || (zone as any).name || ZONE_DISPLAY_NAMES[canonicalCode] || canonicalCode

    return {
      ...zone,
      zone_code: canonicalCode,
      zone_name: canonicalName,
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
      }),
    }
  })

  const fallbackContract =
    processedZones.length === 0
      ? buildSubproductContractZones(carrier, servico.webservice_service_code, servico.global_markup_pct)
      : null
  const finalZones = processedZones.length > 0 ? processedZones : fallbackContract!.zones
  const finalAllowedZones =
    servico.allowed_zones !== undefined
      ? Array.from(new Set(servico.allowed_zones.map((c) => normalizeServiceZoneCode(c) || c)))
      : finalZones.map((z) => z.zone_code).filter(Boolean)

  const fullRecord: ServicoLinke = {
    id,
    is_primordial: isProtected,
    code: servico.code || buildDefaultCustomServiceCode(carrier, servico.webservice_service_code),
    name: servico.name || "Novo Serviço Linke",
    description: servico.description || "",
    category: servico.category || "Nacional",
    color: servico.color || "#059669",
    is_active: servico.is_active ?? true,
    pricing_profile: servico.pricing_profile || "Standard / Geral",
    target_client_name: servico.target_client_name || "Clientes Gerais",
    discount_vs_standard_pct: servico.discount_vs_standard_pct ?? 0,
    preferred_carrier_id: servico.preferred_carrier_id || "forn_2",
    preferred_carrier_name: servico.preferred_carrier_name || "CTT Expresso",
    webservice_connection_id: servico.webservice_connection_id || undefined,
    webservice_service_code: servico.webservice_service_code || undefined,
    transit_time_label: servico.transit_time_label || "24h",
    global_markup_pct: servico.global_markup_pct ?? 20.0,
    fuel_surcharge_pct: servico.fuel_surcharge_pct ?? 12.0,
    cod_fee_pct: servico.cod_fee_pct ?? 2.5,
    cod_min_fee: servico.cod_min_fee ?? 2.50,
    saturday_fee: servico.saturday_fee ?? 15.0,
    return_guide_fee: servico.return_guide_fee ?? 3.5,
    allowed_zones: finalAllowedZones.length > 0 ? finalAllowedZones : ["PT-CONT"],
    zones: finalZones,
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
        if (d.id && d.details?.id === id) {
          await supabase.from("audit_log").delete().eq("id", d.id)
        }
      }
    }
  } catch {}

  // 1. Tentar gravar na tabela
  try {
    const { error } = await supabase.from("servicos_linke").upsert(fullRecord)
    if (error && ["PGRST204", "42703"].includes(error.code) && error.message.includes("is_primordial")) {
      // Older native schemas keep this marker in the full audit snapshot instead.
      const nativeRecord = { ...fullRecord }
      delete nativeRecord.is_primordial
      await supabase.from("servicos_linke").upsert(nativeRecord)
    }
  } catch {}

  // 2. Gravar em audit_log
  try {
    const { data: existing } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "servicos_linke_data")

    if (existing) {
      for (const item of existing) {
        if (item.id && item.details?.id === id) {
          await supabase.from("audit_log").delete().eq("id", item.id)
        }
      }
    }

    await supabase.from("audit_log").insert({
      tenant_id: (await getTenantId()),
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
): Promise<{ success: boolean; data?: ServicoLinke; error?: string }> {
  await requireEmployee()
  const servicos = await getServicosLinkeAction()
  const source = servicos.find((s) => s.id === sourceServicoId)
  if (!source) return { success: false }

  const newId = `srv_linke_${Date.now()}`
  const rawNewCode = `${source.code.replace(/-VIP|-STD|-PRO/, "")}-${targetProfile === "VIP / Alto Volume" ? "VIP" : targetProfile === "E-Commerce PME" ? "ECOM" : "CUST"}`
  const newCode = PRIMORDIAL_SERVICE_CODES.has(rawNewCode.trim().toUpperCase())
    ? `${rawNewCode}-CUSTOM`
    : rawNewCode

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
    is_primordial: false,
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
): Promise<{ success: boolean; error?: string }> {
  await requireEmployee()
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

  const res = await saveServicoLinkeAction({
    ...target,
    global_markup_pct: newMarkupPct,
    zones: updatedZones,
  })
  if (!res.success) return { success: false, error: res.error }

  return { success: true }
}

/**
 * Altera status ativo/inativo de um Serviço Linke
 */
export async function toggleServicoLinkeStatusAction(
  id: string,
  is_active: boolean
): Promise<{ success: boolean; error?: string }> {
  await requireEmployee()
  const servicos = await getServicosLinkeAction()
  const target = servicos.find((s) => s.id === id)
  if (!target) return { success: false }

  const res = await saveServicoLinkeAction({
    ...target,
    is_active,
  })
  if (!res.success) return { success: false, error: res.error }

  return { success: true }
}

/**
 * Elimina um Serviço Linke personalizado. Tabelas base contratadas (primordiais) estão bloqueadas contra eliminação.
 */
export async function deleteServicoLinkeAction(id: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireEmployee()
  const supabase = createAdminClient()
  let protection: { found: boolean; isProtected: boolean }
  try {
    protection = await readStoredServiceProtection(supabase, id, ctx.tenant_id)
  } catch {
    return { success: false, error: "Não foi possível verificar a tabela. Tente novamente." }
  }
  if (!protection.found) return { success: false, error: "Tabela não encontrada. A eliminação foi recusada." }
  if (protection.isProtected) {
    return {
      success: false,
      error: "Esta tabela base contratada está bloqueada e não pode ser eliminada.",
    }
  }

  // Persist the tombstone first so default/fallback tables cannot reappear after a refresh.
  try {
    const { error } = await supabase.from("audit_log").insert({
      tenant_id: ctx.tenant_id,
      action: "deleted_servico_linke",
      details: { id, deleted_at: new Date().toISOString() },
    })
    if (error) return { success: false, error: "Não foi possível eliminar esta tabela. Tente novamente." }
  } catch {
    return { success: false, error: "Não foi possível eliminar esta tabela. Tente novamente." }
  }

  // Best-effort cleanup: the tombstone also covers legacy schemas and referenced rows.
  try {
    await supabase.from("servicos_linke").delete().eq("id", id)
  } catch {}

  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("tenant_id", ctx.tenant_id)
      .eq("action", "servicos_linke_data")

    if (logs) {
      for (const item of logs) {
        if (item.id && item.details?.id === id) {
          await supabase.from("audit_log").delete().eq("tenant_id", ctx.tenant_id).eq("id", item.id)
        }
      }
    }
  } catch {}

  revalidatePath("/ops/configuracao/servicos")
  return { success: true }
}

/**
 * Obtém os dados consolidados de Fornecedores, Serviços Linke e Webservices para o Módulo
 */
export async function getServicosDashboardDataAction() {
  const ctx = await requireEmployee()
  const [servicos, fornecedores, webservices] = await Promise.all([
    getServicosLinkeAction(),
    getFornecedoresAction(),
    getCarrierConnectionsAction(),
  ])

  return {
    servicos,
    fornecedores,
    webservices: webservices || [],
    canManageBaseTables: canManagePrimordialServices(ctx.user?.email),
  }
}
