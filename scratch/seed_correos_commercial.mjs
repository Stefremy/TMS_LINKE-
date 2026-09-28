import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
)

async function main() {
  const { data: audits } = await supabase.from('audit_log').select('tenant_id').not('tenant_id', 'is', null).limit(1)
  const tenant_id = audits?.[0]?.tenant_id

  if (!tenant_id) {
    console.error("No tenant_id found")
    return
  }

  // Get Correos Express Fornecedor ID if it exists in audit_log or just use forn_lk003
  let carrierId = "forn_lk003" // Default from code
  let carrierName = "CORREOS.EXPRESS"

  const commercialServices = [
    {
      id: crypto.randomUUID(),
      name: 'Linke Correos Express 24h',
      code: 'LK-COR-24',
      description: 'Envios urgentes para a península ibérica em 24h.',
      preferred_carrier_id: carrierId,
      preferred_carrier_name: carrierName,
      webservice_service_code: '93',
      is_commercial_service: true,
      transit_time_label: '24h',
      pricing_profile: 'Standard / Geral',
      category: 'Nacional',
      global_markup_pct: 15.0,
      target_client_id: null,
      target_client_name: 'Todos os Clientes',
      zones: [
        {
          id: crypto.randomUUID(),
          name: "Espanha Peninsular",
          tiers: [
            { id: crypto.randomUUID(), min_weight: 0, max_weight: 1, cost_price: 3.50, sell_price: 4.02, margin_pct: 15 },
            { id: crypto.randomUUID(), min_weight: 1.01, max_weight: 5, cost_price: 4.50, sell_price: 5.17, margin_pct: 15 }
          ]
        }
      ],
      is_active: true
    },
    {
      id: crypto.randomUUID(),
      name: 'Linke Correos E-Commerce',
      code: 'LK-COR-ECOM',
      description: 'Envios e-commerce rápidos.',
      preferred_carrier_id: carrierId,
      preferred_carrier_name: carrierName,
      webservice_service_code: '63',
      is_commercial_service: true,
      transit_time_label: '24h',
      pricing_profile: 'E-Commerce PME',
      category: 'Nacional',
      global_markup_pct: 12.0,
      target_client_id: null,
      target_client_name: 'Lojas Online & E-commerce',
      zones: [
        {
          id: crypto.randomUUID(),
          name: "Ibérica E-commerce",
          tiers: [
            { id: crypto.randomUUID(), min_weight: 0, max_weight: 1, cost_price: 3.20, sell_price: 3.58, margin_pct: 12 },
            { id: crypto.randomUUID(), min_weight: 1.01, max_weight: 3, cost_price: 3.80, sell_price: 4.25, margin_pct: 12 }
          ]
        }
      ],
      is_active: true
    },
    {
      id: crypto.randomUUID(),
      name: 'Linke Correos Islas 48h',
      code: 'LK-COR-ISLAS',
      description: 'Envios para as ilhas espanholas em 48h.',
      preferred_carrier_id: carrierId,
      preferred_carrier_name: carrierName,
      webservice_service_code: '62',
      is_commercial_service: true,
      transit_time_label: '48h',
      pricing_profile: 'Standard / Geral',
      category: 'Ilhas',
      global_markup_pct: 20.0,
      target_client_id: null,
      target_client_name: 'Todos os Clientes',
      zones: [
        {
          id: crypto.randomUUID(),
          name: "Baleares / Canárias",
          tiers: [
            { id: crypto.randomUUID(), min_weight: 0, max_weight: 2, cost_price: 15.00, sell_price: 18.00, margin_pct: 20 },
            { id: crypto.randomUUID(), min_weight: 2.01, max_weight: 5, cost_price: 20.00, sell_price: 24.00, margin_pct: 20 }
          ]
        }
      ],
      is_active: true
    }
  ];

  for (const s of commercialServices) {
    const payload = {
      action: "SERVICO_LINKE_COMERCIAL",
      details: {
        new_data: s
      },
      tenant_id
    }
    const { data, error } = await supabase.from('audit_log').insert(payload)
    if (error) {
      console.error("Error inserting", s.name, error)
    } else {
      console.log("Inserted", s.name)
    }
  }
}
main()
