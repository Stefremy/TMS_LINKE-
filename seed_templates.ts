import { config } from "dotenv"
config({ path: ".env.local" })
import { createAdminClient } from "./lib/supabase/server"
import { emailTemplates } from "./app/ops/configuracao/notificacoes/templates"

async function run() {
  const supabase = createAdminClient()
  
  const entries = [
    { id: "pickup_scheduled", name: "Aviso de Recolha Agendada", description: "Enviado quando uma recolha CTT/Correos é confirmada." },
    { id: "low_balance", name: "Alerta de Saldo Baixo", description: "Enviado quando o saldo pré-pago do cliente atinge o limite." },
    { id: "in_transit", name: "Em Transporte", description: "Enviado quando a encomenda é recolhida e entra em distribuição." },
    { id: "tracking", name: "Guia de Transporte (Tracking)", description: "Enviado para o destinatário final com o link de tracking." },
    { id: "incident", name: "Incidências / Problemas na Entrega", description: "Enviado quando há uma falha na entrega (ausência, morada incorreta, etc)." }
  ]

  for (const entry of entries) {
    const html = emailTemplates[entry.id]
    if (html) {
      const { error } = await supabase.from("email_templates").upsert({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        html_content: html
      })
      if (error) {
        console.error("Error inserting", entry.id, error)
      } else {
        console.log("Inserted", entry.id)
      }
    }
  }
}
run()
