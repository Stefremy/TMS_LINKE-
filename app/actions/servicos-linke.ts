"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { getFornecedoresAction, saveFornecedorAction } from "@/app/actions/fornecedores"
import { getCarrierConnectionsAction } from "@/app/actions/ctt"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"

const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"

const DEFAULT_SERVICOS_LINKE: ServicoLinke[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. PARA AMANHÃ (24H) — Guia DD — EMSF056.01
  //    Preços custo: exatos do contrato CTT 300330941
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_dd_std",
    code: "LK-DD-STD",
    name: "Linke Para Amanhã 24H (Guia DD)",
    description: "Entrega no dia útil seguinte em Portugal Continental. Emissão de Guia DD via CTT Expresso.",
    category: "Nacional",
    color: "#059669",
    is_active: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Clientes Gerais",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CTT EXPRESSO",
    webservice_service_code: "EMSF056.01",
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
        zone_code: "PT-ACORES",
        zone_name: "PT — Ilhas Açores",
        tiers: [
          { id: "dd_acr_1",   label: "Até 1 Kg",            weight_max: 1,   cost_price: 10.33, margin_pct: 20, sell_price: 12.40, delivery_time: "48-72h", enabled: true },
          { id: "dd_acr_5",   label: "Até 5 Kg",            weight_max: 5,   cost_price: 16.78, margin_pct: 20, sell_price: 20.14, delivery_time: "48-72h", enabled: true },
          { id: "dd_acr_add", label: "Kg Adicional (+5kg)",  weight_max: 999, cost_price: 2.51,  margin_pct: 20, sell_price: 3.01,  delivery_time: "48-72h", enabled: true },
        ],
      },
      {
        zone_code: "ES-PENIN",
        zone_name: "Espanha Peninsular",
        tiers: [
          { id: "dd_es_1",   label: "Até 1 Kg",             weight_max: 1,   cost_price: 3.26, margin_pct: 28, sell_price: 4.17, delivery_time: "24-48h", enabled: true },
          { id: "dd_es_5",   label: "Até 5 Kg",             weight_max: 5,   cost_price: 4.05, margin_pct: 28, sell_price: 5.18, delivery_time: "24-48h", enabled: true },
          { id: "dd_es_10",  label: "Até 10 Kg",            weight_max: 10,  cost_price: 5.14, margin_pct: 28, sell_price: 6.58, delivery_time: "24-48h", enabled: true },
          { id: "dd_es_15",  label: "Até 15 Kg",            weight_max: 15,  cost_price: 6.12, margin_pct: 28, sell_price: 7.83, delivery_time: "24-48h", enabled: true },
          { id: "dd_es_20",  label: "Até 20 Kg",            weight_max: 20,  cost_price: 7.80, margin_pct: 28, sell_price: 9.98, delivery_time: "24-48h", enabled: true },
          { id: "dd_es_25",  label: "Até 25 Kg",            weight_max: 25,  cost_price: 8.50, margin_pct: 28, sell_price: 10.88, delivery_time: "24-48h", enabled: true },
          { id: "dd_es_30",  label: "Até 30 Kg",            weight_max: 30,  cost_price: 9.82, margin_pct: 28, sell_price: 12.57, delivery_time: "24-48h", enabled: true },
          { id: "dd_es_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.34, margin_pct: 28, sell_price: 0.44,  delivery_time: "24-48h", enabled: true },
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
    description: "Entrega em 2 dias úteis. Emissão de Guia DB via CTT Expresso.",
    category: "Nacional",
    color: "#0891b2",
    is_active: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Todos os Clientes",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CTT EXPRESSO",
    webservice_service_code: "EMSF057.01",
    transit_time_label: "48h",
    global_markup_pct: 25.0,
    fuel_surcharge_pct: 12.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
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
    pricing_profile: "Standard / Geral",
    target_client_name: "Todos os Clientes",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CTT EXPRESSO",
    webservice_service_code: "ENCF008.01",
    transit_time_label: "48h",
    global_markup_pct: 25.0,
    fuel_surcharge_pct: 12.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
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
  // 4. 19 MÚLTIPLO — Continente → Continente — EMSF010.01
  //    Para remessas de 10+ volumes com mesmo produto/origem/destino/data
  //    (código real validado contra a API CTT em produção — gera prefixo EG)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_multiplo_std",
    code: "LK-MULT-STD",
    name: "Linke 19 Múltiplo (10+ volumes)",
    description: "Tarifa múltiplo para remessas de 10 ou mais volumes com o mesmo produto, data, origem e destino. Preço mais baixo por volume.",
    category: "Nacional",
    color: "#0d9488",
    is_active: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Clientes com Grande Volume (10+ volumes/remessa)",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CTT EXPRESSO",
    webservice_service_code: "EMSF010.01",
    transit_time_label: "24h",
    global_markup_pct: 22.0,
    fuel_surcharge_pct: 12.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
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
  // 5. EUROPA — Avião / Economy — Zona 2 e Zona 3
  //    Nota: código EMSF a confirmar com CTT (EMSF081.01 = Int'l Avião Express)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "srv_linke_europa_air",
    code: "LK-EU-AIR",
    name: "Linke Europa Aéreo (Zona 2 & Zona 3)",
    description: "Envios internacionais para toda a Europa por via aérea. Zona 2: Europa Ocidental. Zona 3: Europa do Norte/Leste.",
    category: "Internacional",
    color: "#7c3aed",
    is_active: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Todos os Clientes",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CTT EXPRESSO",
    webservice_service_code: "EMSF081.01",
    transit_time_label: "3-5 dias úteis",
    global_markup_pct: 22.0,
    fuel_surcharge_pct: 15.0,
    cod_fee_pct: 0,
    cod_min_fee: 0,
    created_at: "2026-09-01T10:40:00Z",
    zones: [
      {
        zone_code: "EU-ZONA2",
        zone_name: "Europa Zona 2 (Alemanha, França, Espanha, Itália...)",
        tiers: [
          { id: "eu2_1",   label: "Até 1 Kg",             weight_max: 1,   cost_price: 13.00, margin_pct: 22, sell_price: 15.86, delivery_time: "3-4 dias úteis", enabled: true },
          { id: "eu2_2",   label: "Até 2 Kg",             weight_max: 2,   cost_price: 13.95, margin_pct: 22, sell_price: 17.02, delivery_time: "3-4 dias úteis", enabled: true },
          { id: "eu2_3",   label: "Até 3 Kg",             weight_max: 3,   cost_price: 15.85, margin_pct: 22, sell_price: 19.34, delivery_time: "3-4 dias úteis", enabled: true },
          { id: "eu2_4",   label: "Até 4 Kg",             weight_max: 4,   cost_price: 17.74, margin_pct: 22, sell_price: 21.64, delivery_time: "3-4 dias úteis", enabled: true },
          { id: "eu2_5",   label: "Até 5 Kg",             weight_max: 5,   cost_price: 18.64, margin_pct: 22, sell_price: 22.74, delivery_time: "3-4 dias úteis", enabled: true },
          { id: "eu2_10",  label: "Até 10 Kg",            weight_max: 10,  cost_price: 25.32, margin_pct: 22, sell_price: 30.89, delivery_time: "3-4 dias úteis", enabled: true },
          { id: "eu2_15",  label: "Até 15 Kg",            weight_max: 15,  cost_price: 34.80, margin_pct: 22, sell_price: 42.46, delivery_time: "3-4 dias úteis", enabled: true },
          { id: "eu2_20",  label: "Até 20 Kg",            weight_max: 20,  cost_price: 44.28, margin_pct: 22, sell_price: 54.02, delivery_time: "3-4 dias úteis", enabled: true },
          { id: "eu2_25",  label: "Até 25 Kg",            weight_max: 25,  cost_price: 53.78, margin_pct: 22, sell_price: 65.61, delivery_time: "3-4 dias úteis", enabled: true },
          { id: "eu2_30",  label: "Até 30 Kg",            weight_max: 30,  cost_price: 63.29, margin_pct: 22, sell_price: 77.21, delivery_time: "3-4 dias úteis", enabled: true },
          { id: "eu2_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 2.30,  margin_pct: 22, sell_price: 2.81,  delivery_time: "3-4 dias úteis", enabled: true },
        ],
      },
      {
        zone_code: "EU-ZONA3",
        zone_name: "Europa Zona 3 (Dinamarca, Finlândia, Noruega, Polónia, Suécia...)",
        tiers: [
          { id: "eu3_1",   label: "Até 1 Kg",             weight_max: 1,   cost_price: 13.95, margin_pct: 22, sell_price: 17.02, delivery_time: "4-5 dias úteis", enabled: true },
          { id: "eu3_2",   label: "Até 2 Kg",             weight_max: 2,   cost_price: 15.31, margin_pct: 22, sell_price: 18.68, delivery_time: "4-5 dias úteis", enabled: true },
          { id: "eu3_3",   label: "Até 3 Kg",             weight_max: 3,   cost_price: 16.23, margin_pct: 22, sell_price: 19.80, delivery_time: "4-5 dias úteis", enabled: true },
          { id: "eu3_4",   label: "Até 4 Kg",             weight_max: 4,   cost_price: 21.15, margin_pct: 22, sell_price: 25.80, delivery_time: "4-5 dias úteis", enabled: true },
          { id: "eu3_5",   label: "Até 5 Kg",             weight_max: 5,   cost_price: 24.05, margin_pct: 22, sell_price: 29.34, delivery_time: "4-5 dias úteis", enabled: true },
          { id: "eu3_10",  label: "Até 10 Kg",            weight_max: 10,  cost_price: 32.81, margin_pct: 22, sell_price: 40.03, delivery_time: "4-5 dias úteis", enabled: true },
          { id: "eu3_15",  label: "Até 15 Kg",            weight_max: 15,  cost_price: 47.40, margin_pct: 22, sell_price: 57.83, delivery_time: "4-5 dias úteis", enabled: true },
          { id: "eu3_20",  label: "Até 20 Kg",            weight_max: 20,  cost_price: 61.98, margin_pct: 22, sell_price: 75.62, delivery_time: "4-5 dias úteis", enabled: true },
          { id: "eu3_25",  label: "Até 25 Kg",            weight_max: 25,  cost_price: 78.57, margin_pct: 22, sell_price: 95.86, delivery_time: "4-5 dias úteis", enabled: true },
          { id: "eu3_30",  label: "Até 30 Kg",            weight_max: 30,  cost_price: 81.15, margin_pct: 22, sell_price: 99.00, delivery_time: "4-5 dias úteis", enabled: true },
          { id: "eu3_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 3.31,  margin_pct: 22, sell_price: 4.04,  delivery_time: "4-5 dias úteis", enabled: true },
        ],
      },
    ],
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
    preferred_carrier_id: "forn_lk003",
    preferred_carrier_name: "CTT EXPRESSO",
    webservice_service_code: "EMSF056.01",
    transit_time_label: "24h",
    global_markup_pct: 25.0,
    fuel_surcharge_pct: 12.5,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
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
  return merged.filter((s) => !deletedIds.has(s.id))
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
