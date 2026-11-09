#!/usr/bin/env node
import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

// Load .env.local
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) {
      const k = m[1].trim()
      const v = m[2].trim().replace(/^["']|["']$/g, "")
      if (!process.env[k]) process.env[k] = v
    }
  }
}

const oldUrl = process.env.LEGACY_WHATSAPP_SUPABASE_URL
const oldKey = process.env.LEGACY_WHATSAPP_SUPABASE_SERVICE_ROLE_KEY
const newUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const newKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!oldUrl || !oldKey) {
  console.error("Faltam LEGACY_WHATSAPP_SUPABASE_URL / LEGACY_WHATSAPP_SUPABASE_SERVICE_ROLE_KEY no .env.local")
  process.exit(1)
}
if (!newUrl || !newKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY no .env.local")
  process.exit(1)
}

const oldSb = createClient(oldUrl, oldKey, { auth: { persistSession: false } })
const newSb = createClient(newUrl, newKey, { auth: { persistSession: false } })

async function main() {
  // 1. Check if public.whatsapp_logs exists in new Supabase
  const probe = await newSb.from("whatsapp_logs").select("id").limit(1)
  if (probe.error) {
    console.error(
      "A tabela public.whatsapp_logs ainda não existe no projeto Supabase do TMS Linke:",
      probe.error.message
    )
    console.error("Corre primeiro o SQL de supabase/migrations/20261109120000_whatsapp_sms_communications.sql no SQL Editor.")
    process.exit(1)
  }

  console.log("Tabela public.whatsapp_logs pronta. Registos atuais no destino:", probe.count || 0)

  // Find highest existing ID in destination to resume safely if interrupted
  const { data: maxRow } = await newSb
    .from("whatsapp_logs")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()

  let lastId = maxRow?.id ? Number(maxRow.id) : 0
  const batchSize = 1000
  let totalImported = 0

  while (true) {
    const { data: rows, error } = await oldSb
      .from("whatsapp_logs")
      .select("id, created_at, direction, channel, to_number, contact_name, message_text, template_name, status, api_message_id, payload")
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(batchSize)

    if (error) {
      throw new Error(`Erro ao ler whatsapp_logs antigo: ${error.message}`)
    }
    if (!rows || rows.length === 0) {
      break
    }

    const mapped = rows.map((raw) => {
      const payload = raw.payload && typeof raw.payload === "object" ? raw.payload : {}
      const trackerCtx =
        payload.trackerContext && typeof payload.trackerContext === "object" ? payload.trackerContext : {}
      const trackingNumber = String(trackerCtx.parcelId || payload.tracking_number || "").trim() || null
      const contactName = String(raw.contact_name || trackerCtx.clientName || "").trim() || null

      return {
        id: raw.id,
        tenant_id: "11111111-1111-1111-1111-111111111111",
        created_at: raw.created_at,
        direction: raw.direction || "out",
        channel: raw.channel || "template",
        to_number: String(raw.to_number || "").trim(),
        contact_name: contactName,
        message_text: raw.message_text || null,
        template_name: raw.template_name || null,
        status: raw.status || null,
        api_message_id: raw.api_message_id || null,
        tracking_number: trackingNumber,
        source_system: "legacy_tms",
        payload,
      }
    })

    const { error: upsertErr } = await newSb.from("whatsapp_logs").upsert(mapped, { onConflict: "id" })
    if (upsertErr) {
      throw new Error(`Erro ao inserir lote em whatsapp_logs: ${upsertErr.message}`)
    }

    lastId = Number(rows[rows.length - 1].id)
    totalImported += rows.length
    console.log(`Importados ${totalImported} registos (último ID: ${lastId})...`)
  }

  // 2. Import deduplication and chat state from workspace_state
  const { data: stateRows } = await oldSb
    .from("workspace_state")
    .select("key, value, updated_at")
    .in("key", [
      "auto_notificacao_envio_state",
      "auto_notificacao_incidencia_state",
      "contacts",
      "contact_notes",
      "team_reminders",
    ])

  if (Array.isArray(stateRows) && stateRows.length > 0) {
    for (const st of stateRows) {
      await newSb.from("whatsapp_communications_config").upsert(
        [
          {
            key: st.key,
            value: st.value || {},
            updated_at: st.updated_at || new Date().toISOString(),
          },
        ],
        { onConflict: "key" }
      )
    }
    console.log(`Estados de auto-notificação importados (${stateRows.length} chaves).`)
  }

  const { error: seqErr } = await newSb.rpc("sync_whatsapp_logs_sequence")
  if (seqErr) {
    console.warn("Aviso ao sincronizar sequência:", seqErr.message)
  } else {
    console.log("Sequência de IDs sincronizada (sync_whatsapp_logs_sequence).")
  }
  console.log(`Concluído! Total de registos importados para o TMS Linke: ${totalImported}`)
}

main().catch((err) => {
  console.error("Falha na importação:", err)
  process.exit(1)
})
