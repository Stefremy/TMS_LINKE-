import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const correosBaseServices = [
    {
      name: 'Correos Paq 24',
      code: 'COR-PAQ24',
      description: 'Entrega en 24h peninsula',
      preferred_carrier_name: 'Correos Express',
      webservice_service_code: '93',
      is_commercial_service: false,
      transit_time_label: '24h',
      pricing_profile: 'Standard / Geral',
      category: 'Nacional'
    },
    {
      name: 'Correos E-Paq 24',
      code: 'COR-EPAQ24',
      description: 'E-commerce 24h',
      preferred_carrier_name: 'Correos Express',
      webservice_service_code: '63',
      is_commercial_service: false,
      transit_time_label: '24h',
      pricing_profile: 'Standard / Geral',
      category: 'Nacional'
    },
    {
      name: 'Correos Paq 48',
      code: 'COR-PAQ48',
      description: 'Entrega Islas 48h',
      preferred_carrier_name: 'Correos Express',
      webservice_service_code: '62',
      is_commercial_service: false,
      transit_time_label: '48h',
      pricing_profile: 'Standard / Geral',
      category: 'Ilhas'
    }
  ]

  for (const s of correosBaseServices) {
    const { data, error } = await supabase.from('servicos_linke').insert(s)
    if (error) console.error("Error inserting", s.name, error)
    else console.log("Inserted", s.name)
  }
}
main()
