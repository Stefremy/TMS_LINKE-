import { createAdminClient } from "@/lib/supabase/server"
import { loadCommunicationsConfig, type NotificationSourceMode } from "./config"
import {
  fetchUnifiedShipmentsForAutoNotification,
  type AutoNotificationType,
  type UnifiedNotificationShipmentRow,
} from "./shipment-sources"
import { normalizeRecipient, sendGenericTemplateMessage } from "./whatsapp-cloud"

export function getLisbonDateKey(date = new Date()): {
  dateKey: string
  weekday: string
  hour: number
  minute: number
} {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    dateKey: `${lookup.year || "0000"}-${lookup.month || "00"}-${lookup.day || "00"}`,
    weekday: String(lookup.weekday || ""),
    hour: Number(lookup.hour || 0),
    minute: Number(lookup.minute || 0),
  }
}

function buildDispatchKey(
  type: AutoNotificationType,
  row: UnifiedNotificationShipmentRow,
  normalizedPhone: string,
  dateKey: string
): string {
  const identity = String(row.providerTrackingCode || row.parcelId || "")
    .trim()
    .toUpperCase()
  if (!identity || !normalizedPhone) return ""

  if (type === "incidencia") {
    // Incidência: deduplicar por guia + data para não repetir no mesmo dia
    return `incidencia|${dateKey}|${identity}|${normalizedPhone}`
  }
  return `${type}|${dateKey}|${identity}|${normalizedPhone}`
}

function isIlhasService(serviceRaw: string): boolean {
  const serviceName = String(serviceRaw || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
  const compact = serviceName.replace(/\s+/g, "")
  const isMaritimo =
    compact.includes("cttmaritimoilhas") || (serviceName.includes("maritimo") && serviceName.includes("ilhas"))
  const isAereo =
    compact.includes("cttaereoilhas") || (serviceName.includes("aereo") && serviceName.includes("ilhas"))
  return isMaritimo || isAereo
}

const inMemorySentDispatchKeys = new Set<string>()

async function loadExistingSentDispatchKeys(type: AutoNotificationType, dateKey: string): Promise<Set<string>> {
  const keys = new Set<string>()
  for (const k of inMemorySentDispatchKeys) {
    if (k.startsWith(`${type}|${dateKey}|`)) {
      keys.add(k)
    }
  }

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("whatsapp_dispatch_locks")
      .select("dispatch_key")
      .eq("notification_type", type)
      .eq("run_date_key", dateKey)
      .eq("status", "sent")

    for (const row of data || []) {
      if (row.dispatch_key) {
        keys.add(String(row.dispatch_key))
      }
    }
  } catch {
    // Table may not exist yet before migration is applied; in-memory set still protects current process
  }

  return keys
}

async function recordDispatchResult(input: {
  dispatchKey: string
  type: AutoNotificationType
  row: UnifiedNotificationShipmentRow
  recipientPhone: string
  dateKey: string
  status: "sent" | "failed"
  lastError?: string | null
}) {
  if (input.status === "sent") {
    inMemorySentDispatchKeys.add(input.dispatchKey)
  }

  try {
    const supabase = createAdminClient()
    await supabase.from("whatsapp_dispatch_locks").upsert(
      [
        {
          dispatch_key: input.dispatchKey,
          notification_type: input.type,
          parcel_id: input.row.parcelId || input.row.providerTrackingCode,
          provider_tracking_code: input.row.providerTrackingCode || null,
          recipient_phone: input.recipientPhone,
          recipient_name: input.row.recipient || null,
          sender_name: input.row.sender || null,
          incident_reason: input.row.incidentReason || input.row.incidence || null,
          source_system: input.row.sourceSystem,
          status: input.status,
          last_error: input.lastError || null,
          run_date_key: input.dateKey,
          sent_at: input.status === "sent" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "dispatch_key" }
    )
  } catch {
    // Non-fatal if table not yet migrated
  }
}

export interface AutoNotificationRunOptions {
  type: AutoNotificationType
  dryRun?: boolean
  sourceMode?: NotificationSourceMode
  maxSendsPerRun?: number
  includeIlhas?: boolean
}

export interface AutoNotificationPreviewItem {
  parcelId: string
  providerTrackingCode: string
  recipient: string
  sender: string
  phone: string
  service: string
  incidentReason?: string
  sourceSystem: "legacy_tms" | "tms_linke"
  bodyVariables: string[]
}

export async function runAutoNotificationByType(options: AutoNotificationRunOptions) {
  const cfg = await loadCommunicationsConfig()
  const { dateKey, weekday, hour, minute } = getLisbonDateKey()
  const type = options.type
  const dryRun = Boolean(options.dryRun)
  const sourceMode = options.sourceMode || cfg.sourceMode || "both"

  const templateName =
    type === "em_distribuicao"
      ? cfg.autoEnvioTemplate
      : type === "em_transporte"
        ? cfg.autoTransporteTemplate
        : cfg.autoIncidenciaTemplate

  const fallbackTemplateName = type === "em_transporte" ? cfg.autoTransporteFallbackTemplate : ""

  const languageCode =
    type === "em_distribuicao"
      ? cfg.autoEnvioLanguage
      : type === "em_transporte"
        ? cfg.autoTransporteLanguage
        : cfg.autoIncidenciaLanguage

  const defaultMaxSends =
    type === "em_distribuicao"
      ? cfg.autoEnvioMaxSendsPerRun
      : type === "em_transporte"
        ? cfg.autoTransporteMaxSendsPerRun
        : cfg.autoIncidenciaMaxSendsPerRun

  const maxSendsPerRun =
    options.maxSendsPerRun && Number.isFinite(options.maxSendsPerRun)
      ? Math.max(1, Math.min(500, Math.trunc(options.maxSendsPerRun)))
      : defaultMaxSends

  const includeIlhas =
    options.includeIlhas !== undefined ? Boolean(options.includeIlhas) : cfg.autoTransporteIncludeIlhas

  const unified = await fetchUnifiedShipmentsForAutoNotification(type, {
    sourceMode,
    config: cfg,
  })

  const sentKeysToday = await loadExistingSentDispatchKeys(type, dateKey)

  let processed = 0
  let sent = 0
  let failed = 0
  let skippedMissingPhone = 0
  let skippedAlreadySent = 0
  let skippedIlhas = 0
  let reachedCap = false
  const previewItems: AutoNotificationPreviewItem[] = []
  const errors: string[] = []

  for (const row of unified.rows) {
    if (type === "em_transporte" && !includeIlhas && isIlhasService(row.service)) {
      skippedIlhas += 1
      continue
    }

    const normalizedTo = normalizeRecipient(row.finalClientPhone)
    if (!normalizedTo) {
      skippedMissingPhone += 1
      continue
    }

    const dispatchKey = buildDispatchKey(type, row, normalizedTo, dateKey)
    if (dispatchKey && sentKeysToday.has(dispatchKey)) {
      skippedAlreadySent += 1
      continue
    }

    const recipientName = String(row.recipient || "Cliente").trim()
    const senderName = String(row.sender || "Linke").trim()
    const trackingCode = String(row.providerTrackingCode || row.parcelId || "").trim()

    // No WhatsappNathalia:
    // - Em Distribuição & Em Transporte usam [destinatario, remetente, tracking]
    // - Incidência usa [destinatario, parcelId/tracking, remetente]
    const bodyVariables =
      type === "incidencia"
        ? [recipientName, row.parcelId || trackingCode, senderName]
        : [recipientName, senderName, trackingCode]

    if (previewItems.length < 300) {
      previewItems.push({
        parcelId: row.parcelId,
        providerTrackingCode: row.providerTrackingCode,
        recipient: recipientName,
        sender: senderName,
        phone: normalizedTo,
        service: row.service,
        incidentReason: row.incidentReason || row.incidence || undefined,
        sourceSystem: row.sourceSystem,
        bodyVariables,
      })
    }

    if (dryRun) {
      processed += 1
      continue
    }

    if (processed >= maxSendsPerRun) {
      reachedCap = true
      break
    }

    processed += 1

    const useSeparateIncNumber =
      type === "incidencia" &&
      cfg.incidenciaUseSeparateNumber &&
      Boolean(cfg.incWhatsappPhoneNumberId && cfg.incWhatsappAccessToken)

    let sendRes = await sendGenericTemplateMessage({
      to: normalizedTo,
      templateName,
      languageCode,
      bodyVariables,
      trackerContext: {
        clientName: recipientName,
        parcelId: trackingCode,
        messageType:
          type === "em_distribuicao"
            ? "Em distribuicao"
            : type === "em_transporte"
              ? "Em transporte"
              : "Incidencia",
        notes: type === "incidencia" ? row.incidentReason || senderName : senderName,
        shipmentId: row.shipmentId || null,
        sourceSystem: row.sourceSystem,
      },
      phoneNumberIdOverride: useSeparateIncNumber ? cfg.incWhatsappPhoneNumberId : null,
      accessTokenOverride: useSeparateIncNumber ? cfg.incWhatsappAccessToken : null,
      config: cfg,
    })

    if (!sendRes.ok && type === "em_transporte" && fallbackTemplateName && fallbackTemplateName !== templateName) {
      sendRes = await sendGenericTemplateMessage({
        to: normalizedTo,
        templateName: fallbackTemplateName,
        languageCode,
        bodyVariables,
        trackerContext: {
          clientName: recipientName,
          parcelId: trackingCode,
          messageType: "Em transporte",
          notes: senderName,
          shipmentId: row.shipmentId || null,
          sourceSystem: row.sourceSystem,
        },
        config: cfg,
      })
    }

    if (sendRes.ok) {
      sent += 1
      if (dispatchKey) {
        sentKeysToday.add(dispatchKey)
        await recordDispatchResult({
          dispatchKey,
          type,
          row,
          recipientPhone: normalizedTo,
          dateKey,
          status: "sent",
        })
      }
    } else {
      failed += 1
      const errDetail = String(
        (sendRes.finalBody as Record<string, unknown>)?.error || `HTTP ${sendRes.status}`
      )
      if (errors.length < 5) {
        errors.push(`${trackingCode} (${normalizedTo}): ${errDetail}`)
      }
      if (dispatchKey) {
        await recordDispatchResult({
          dispatchKey,
          type,
          row,
          recipientPhone: normalizedTo,
          dateKey,
          status: "failed",
          lastError: errDetail,
        })
      }
    }
  }

  return {
    ok: true,
    type,
    dryRun,
    sourceMode,
    sourcesUsed: unified.sourcesUsed,
    countsBySource: unified.countsBySource,
    warnings: unified.warnings,
    templateName,
    languageCode,
    fetchedRows: unified.rows.length,
    eligibleToSend: dryRun ? processed : processed,
    processed,
    sent,
    failed,
    skippedAlreadySent,
    skippedMissingPhone,
    skippedIlhas,
    reachedCap,
    maxSendsPerRun,
    previewItems,
    errors,
    lisbonClock: { dateKey, weekday, hour, minute },
    at: new Date().toISOString(),
  }
}

