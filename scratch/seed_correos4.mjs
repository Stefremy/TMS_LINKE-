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
  const tenant_id = '11111111-1111-1111-1111-111111111111'

  const correosBaseServices = [
    {
      id: crypto.randomUUID(),
      name: 'Correos Paq 24',
      code: 'COR-PAQ24',
      description: 'Entrega en 24h peninsula',
      preferred_carrier_name: 'Correos Express',
      webservice_service_code: '93',
      is_commercial_service: false,
      transit_time_label: '24h',
      pricing_profile: 'Standard / Geral',
      category: 'Nacional',
      zones: []
    },
    {
      id: crypto.randomUUID(),
      name: 'Correos E-Paq 24',
      code: 'COR-EPAQ24',
      description: 'E-commerce 24h',
      preferred_carrier_name: 'Correos Express',
      webservice_service_code: '63',
      is_commercial_service: false,
      transit_time_label: '24h',
      pricing_profile: 'Standard / Geral',
      category: 'Nacional',
      zones: []
    },
    {
      id: crypto.randomUUID(),
      name: 'Correos Paq 48',
      code: 'COR-PAQ48',
      description: 'Entrega Islas 48h',
      preferred_carrier_name: 'Correos Express',
      webservice_service_code: '62',
      is_commercial_service: false,
      transit_time_label: '48h',
      pricing_profile: 'Standard / Geral',
      category: 'Ilhas',
      zones: []
    }
  ];

  for (const s of correosBaseServices) {
    const payload = {
      action: "SERVICO_LINKE_BASE",
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
