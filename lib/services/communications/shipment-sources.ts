import { createAdminClient } from "@/lib/supabase/server"
import { loadCommunicationsConfig, type CommunicationsConfig, type NotificationSourceMode } from "./config"

export type AutoNotificationType = "em_distribuicao" | "em_transporte" | "incidencia"

export interface UnifiedNotificationShipmentRow {
  parcelId: string
  providerTrackingCode: string
  service: string
  sender: string
  recipient: string
  finalClientPhone: string
  pickupDate: string
  deliveryDate: string
  status: string
  incidence: string
  incidentReason: string
  hasCharge: boolean
  chargeAmount: string
  shipmentId?: string | null
  sourceSystem: "legacy_tms" | "tms_linke"
}

function decodeHtmlEntities(input: unknown): string {
  return String(input || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
}

function stripHtml(input: unknown): string {
  return decodeHtmlEntities(String(input || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeDatatableTextCell(input: unknown): string {
  const seen = new WeakSet<object>()

  function visit(value: unknown): string {
    if (value == null) return ""
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return stripHtml(value)
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const normalized = visit(item)
        if (normalized) return normalized
      }
      return ""
    }
    if (typeof value === "object") {
      if (seen.has(value)) return ""
      seen.add(value)
      const rec = value as Record<string, unknown>
      const candidates = [rec.display, rec.label, rec.text, rec.name, rec.title, rec.value, rec.html]
      for (const candidate of candidates) {
        const normalized = visit(candidate)
        if (normalized) return normalized
      }
      for (const nested of Object.values(rec)) {
        const normalized = visit(nested)
        if (normalized) return normalized
      }
    }
    return ""
  }

  return visit(input)
}

function splitSetCookieHeader(headerValue: string): string[] {
  if (!headerValue) return []
  return String(headerValue)
    .split(/,(?=[^;,\s]+=)/g)
    .map((cookie) => cookie.trim())
    .filter(Boolean)
}

function getSetCookieHeaders(response: Response): string[] {
  const headersWithSetCookie = response.headers as unknown as { getSetCookie?: () => string[] }
  const direct = typeof headersWithSetCookie.getSetCookie === "function" ? headersWithSetCookie.getSetCookie() : null
  if (Array.isArray(direct) && direct.length > 0) {
    return direct
  }
  const single = response.headers.get("set-cookie") || ""
  return splitSetCookieHeader(single)
}

function updateCookieJar(cookieJar: Map<string, string>, setCookieHeaders: string[]) {
  for (const cookie of setCookieHeaders) {
    const pair = cookie.split(";")[0] || ""
    const eqIndex = pair.indexOf("=")
    if (eqIndex <= 0) continue
    const key = pair.slice(0, eqIndex).trim()
    const value = pair.slice(eqIndex + 1).trim()
    if (!key) continue
    cookieJar.set(key, value)
  }
}

function cookieJarHeader(cookieJar: Map<string, string>): string {
  return Array.from(cookieJar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ")
}

function extractIncidentReasonFromShipmentRow(row: Record<string, unknown>): string {
  const lastIncidence =
    row?.last_incidence && typeof row.last_incidence === "object"
      ? (row.last_incidence as Record<string, unknown>)
      : null

  if (lastIncidence) {
    const nestedInc =
      lastIncidence.incidence && typeof lastIncidence.incidence === "object"
        ? (lastIncidence.incidence as Record<string, unknown>)
        : null
    const incidenceName = normalizeDatatableTextCell(nestedInc?.name || lastIncidence.incidence_name || "")
    const obs = normalizeDatatableTextCell(lastIncidence.obs || "")
    if (obs && incidenceName) return `${incidenceName}: ${obs}`.trim()
    if (obs) return obs
    if (incidenceName) return incidenceName
  }

  const directCandidates = [
    row?.incident_reason,
    row?.incidence_reason,
    row?.reason,
    row?.reason_name,
    row?.reason_description,
    row?.status_reason,
    row?.incident_notes,
    row?.incidence,
  ]

  for (const candidate of directCandidates) {
    const normalized = normalizeDatatableTextCell(candidate)
    if (normalized) {
      return normalized.replace(/^motivo\s*:\s*/i, "").trim()
    }
  }

  const htmlCandidates = [row?.status, row?.delivery_date, row?.last_incidence]
  for (const candidate of htmlCandidates) {
    const raw = String(candidate || "")
    if (!raw) continue

    const motivoMatch = raw.match(/motivo\s*:\s*([^<\n\r"]+)/i)
    if (motivoMatch?.[1]) {
      return stripHtml(motivoMatch[1]).replace(/^motivo\s*:\s*/i, "").trim()
    }

    const titleMatch = raw.match(/title\s*=\s*"([^"]+)"/i)
    const titleText = titleMatch?.[1] ? stripHtml(titleMatch[1]) : ""
    if (/motivo\s*:/i.test(titleText)) {
      return titleText.replace(/^.*?motivo\s*:\s*/i, "").trim()
    }
  }

  return ""
}

function parseEuroLikeAmount(rawValue: unknown): number {
  const raw = stripHtml(String(rawValue || "")).replace(/\u00A0/g, " ").trim()
  if (!raw) return NaN

  function parseNormalized(token: string): number {
    let normalized = String(token || "").replace(/\s+/g, "")
    if (!normalized) return NaN
    if (normalized.includes(",") && normalized.includes(".")) {
      if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".")
      } else {
        normalized = normalized.replace(/,/g, "")
      }
    } else if (normalized.includes(",")) {
      normalized = normalized.replace(",", ".")
    }
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : NaN
  }

  const euroMatch = raw.match(/(-?\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?)\s*€/i)
  if (euroMatch?.[1]) return parseNormalized(euroMatch[1])

  const decimalMatch = raw.match(/-?\d{1,3}(?:[.\s]\d{3})*[.,]\d+|-?\d+[.,]\d+/)
  if (decimalMatch?.[0]) return parseNormalized(decimalMatch[0])

  if (/^-?\d+(?:[.,]\d+)?$/.test(raw)) return parseNormalized(raw)

  return NaN
}

function parseLegacyTmsShipmentsDatatable(payload: unknown): UnifiedNotificationShipmentRow[] {
  const rec = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
  const data = Array.isArray(rec.data) ? rec.data : []

  return data.map((rawRow) => {
    const row = (rawRow && typeof rawRow === "object" ? rawRow : {}) as Record<string, unknown>
    const chargeAmountCandidates = [
      row.valor_transporte,
      row.valorTransporte,
      row.shipping_price,
      row.transport_value,
      row.shipping_cost,
      row.charge_price,
      row.cod,
    ]

    let chargeAmountNumber = NaN
    for (const candidate of chargeAmountCandidates) {
      const parsed = parseEuroLikeAmount(candidate)
      if (Number.isFinite(parsed) && parsed > 0) {
        chargeAmountNumber = parsed
        break
      }
    }

    const hasChargeByAmount = Number.isFinite(chargeAmountNumber) && chargeAmountNumber > 0
    const hasChargeByHtmlHint = /cobran[çc]a|€/i.test(
      String(row.delivery_date || row.valor_transporte || row.service || "")
    )
    const hasCharge = hasChargeByAmount || hasChargeByHtmlHint

    return {
      parcelId: String(row.tracking_code || "").trim() || stripHtml(row.id || ""),
      providerTrackingCode: String(row.provider_tracking_code || "").trim(),
      service: normalizeDatatableTextCell(
        row.service ||
          row.service_name ||
          row.provider ||
          row.provider_name ||
          row.shipment_method ||
          row.method ||
          row.courier ||
          row.operator ||
          row.shipping_provider ||
          row.shipping_provider_name ||
          row.provider_code ||
          row.delivery_provider ||
          row.service_id ||
          row.webservice_method ||
          ""
      ),
      sender: stripHtml(row.sender_name || ""),
      recipient: stripHtml(row.recipient_name || ""),
      finalClientPhone: String(row.recipient_phone || "").trim(),
      pickupDate: normalizeDatatableTextCell(
        row.pickup_date ||
          row.collection_date ||
          row.recolha_date ||
          row.date_pickup ||
          row.pickup_at ||
          row.collected_at ||
          row.created_at ||
          ""
      ),
      deliveryDate: normalizeDatatableTextCell(row.delivery_date || row.delivery_at || ""),
      status: normalizeDatatableTextCell(row.status || row.status_id || ""),
      incidence: normalizeDatatableTextCell(row.last_incidence || ""),
      incidentReason: extractIncidentReasonFromShipmentRow(row),
      hasCharge,
      chargeAmount: hasChargeByAmount ? chargeAmountNumber.toFixed(2) : "",
      shipmentId: null,
      sourceSystem: "legacy_tms",
    }
  })
}

const LEGACY_STATUS_CODE_BY_TYPE: Record<AutoNotificationType, string> = {
  em_transporte: "3",
  em_distribuicao: "4",
  incidencia: "9",
}

/**
 * 1. SCRAPER HTML / DATATABLE DO TMS ANTIGO (idêntico ao WhatsappNathalia)
 */
export async function fetchLegacyTmsShipmentsByType(
  type: AutoNotificationType,
  options: { limit?: number; maxPages?: number; config?: CommunicationsConfig } = {}
): Promise<{ rows: UnifiedNotificationShipmentRow[]; error?: string }> {
  const cfg = options.config || (await loadCommunicationsConfig())

  if (!cfg.legacyTmsEnabled) {
    return { rows: [], error: "Scraping Legacy TMS desativado nas configurações." }
  }

  const baseUrl = cfg.legacyTmsBaseUrl.replace(/\/$/, "")
  const email = cfg.legacyTmsAdminEmail
  const password = cfg.legacyTmsAdminPassword

  if (!baseUrl || !email || !password) {
    return {
      rows: [],
      error: "Credenciais do Legacy TMS (TMS_BASE_URL, TMS_ADMIN_EMAIL, TMS_ADMIN_PASSWORD) não configuradas.",
    }
  }

  const safeLimit = Math.max(10, Math.min(250, Math.trunc(Number(options.limit || 150))))
  const safeMaxPages = Math.max(1, Math.min(20, Math.trunc(Number(options.maxPages || 4))))
  const statusCode = LEGACY_STATUS_CODE_BY_TYPE[type]

  try {
    const cookieJar = new Map<string, string>()
    const loginUrl = `${baseUrl}/admin/login`

    const loginPageRes = await fetch(loginUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    })
    updateCookieJar(cookieJar, getSetCookieHeaders(loginPageRes))
    const loginHtml = await loginPageRes.text()
    const tokenMatch = loginHtml.match(/name="_token"\s+type="hidden"\s+value="([^"]+)"/i)
    const csrfToken = tokenMatch?.[1] || ""
    if (!csrfToken) {
      return { rows: [], error: "Não foi possível extrair o CSRF _token do login do Legacy TMS." }
    }

    const loginBody = new URLSearchParams()
    loginBody.set("_token", csrfToken)
    loginBody.set("email", email)
    loginBody.set("password", password)
    loginBody.set("remember", "on")

    const loginSubmitRes = await fetch(loginUrl, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: loginUrl,
        Cookie: cookieJarHeader(cookieJar),
      },
      body: loginBody.toString(),
      signal: AbortSignal.timeout(12000),
    })
    updateCookieJar(cookieJar, getSetCookieHeaders(loginSubmitRes))

    const shipmentsEndpoint = `${baseUrl}/admin/shipments/datatable`

    async function fetchDatatablePage(draw: number, start: number, length: number) {
      const requestBody = new URLSearchParams()
      requestBody.set("_token", csrfToken)
      requestBody.set("draw", String(draw))
      requestBody.set("start", String(Math.max(0, Math.trunc(start))))
      requestBody.set("length", String(Math.max(1, Math.trunc(length))))
      requestBody.set("filter", "1")
      requestBody.set("status", statusCode)

      const shipmentsRes = await fetch(shipmentsEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${baseUrl}/admin/shipments?filter=1&status=${encodeURIComponent(statusCode)}`,
          Cookie: cookieJarHeader(cookieJar),
        },
        body: requestBody.toString(),
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      })

      if (!shipmentsRes.ok) {
        throw new Error(`Legacy TMS datatable respondeu com HTTP ${shipmentsRes.status}`)
      }

      return shipmentsRes.json().catch(() => ({}))
    }

    const probePayload = (await fetchDatatablePage(1, 0, 1)) as Record<string, unknown>
    const total = Number(probePayload?.recordsFiltered ?? probePayload?.recordsTotal ?? 0) || 0
    if (total === 0) {
      return { rows: [] }
    }

    const totalPages = Math.max(1, Math.ceil(total / safeLimit))
    const allRows: UnifiedNotificationShipmentRow[] = []

    for (let page = 1; page <= totalPages && page <= safeMaxPages; page += 1) {
      const boundedPage = Math.min(page, totalPages)
      const sourceStart = Math.max(0, total - boundedPage * safeLimit)
      const sourceEndExclusive = Math.max(0, total - (boundedPage - 1) * safeLimit)
      const sourceLength = Math.max(1, sourceEndExclusive - sourceStart)

      const payload = await fetchDatatablePage(boundedPage, sourceStart, sourceLength)
      const rows = parseLegacyTmsShipmentsDatatable(payload).reverse()
      allRows.push(...rows)
    }

    return { rows: allRows }
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "Erro ao fazer scraping ao Legacy TMS",
    }
  }
}

/**
 * 2. LEITOR NATIVO DO TMS LINKE (public.shipments no Supabase)
 */
const NATIVE_STATUS_BY_TYPE: Record<AutoNotificationType, string> = {
  em_transporte: "entrada_rede",
  em_distribuicao: "em_distribuicao",
  incidencia: "incidencia",
}

export async function fetchNativeTmsShipmentsByType(
  type: AutoNotificationType,
  options: { limit?: number } = {}
): Promise<{ rows: UnifiedNotificationShipmentRow[]; error?: string }> {
  try {
    const supabase = createAdminClient()
    const targetStatus = NATIVE_STATUS_BY_TYPE[type]
    const safeLimit = Math.max(10, Math.min(1000, Math.trunc(Number(options.limit || 300))))

    const { data, error } = await supabase
      .from("shipments")
      .select(
        "id, tracking_number, carrier_tracking_number, service_type, sender_name, recipient_name, recipient_phone, status, ops_substatus, created_at, updated_at"
      )
      .eq("status", targetStatus)
      .order("updated_at", { ascending: false })
      .limit(safeLimit)

    if (error) {
      return { rows: [], error: error.message }
    }

    const rows: UnifiedNotificationShipmentRow[] = (data || []).map((row) => ({
      parcelId: String(row.tracking_number || "").trim(),
      providerTrackingCode: String(row.carrier_tracking_number || row.tracking_number || "").trim(),
      service: String(row.service_type || "").trim(),
      sender: String(row.sender_name || "Linke").trim(),
      recipient: String(row.recipient_name || "").trim(),
      finalClientPhone: String(row.recipient_phone || "").trim(),
      pickupDate: String(row.created_at || "").slice(0, 10),
      deliveryDate: String(row.updated_at || "").slice(0, 10),
      status: String(row.status || "").trim(),
      incidence: type === "incidencia" ? String(row.ops_substatus || "Incidência em curso").trim() : "",
      incidentReason: type === "incidencia" ? String(row.ops_substatus || "Atraso / incidência na entrega").trim() : "",
      hasCharge: false,
      chargeAmount: "",
      shipmentId: row.id,
      sourceSystem: "tms_linke",
    }))

    return { rows }
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "Erro ao ler envios nativos do TMS Linke",
    }
  }
}

/**
 * 3. MOTOR UNIFICADO (DUAL-SOURCE: LEGACY SCRAPING + NATIVO TMS LINKE)
 * Combina as duas fontes (ou usa a escolhida) e desduplica por código de envio/tracking.
 */
export async function fetchUnifiedShipmentsForAutoNotification(
  type: AutoNotificationType,
  options: {
    sourceMode?: NotificationSourceMode
    limit?: number
    maxPages?: number
    config?: CommunicationsConfig
  } = {}
): Promise<{
  rows: UnifiedNotificationShipmentRow[]
  sourcesUsed: string[]
  countsBySource: { tms_linke: number; legacy_tms: number; combinedDeduped: number }
  warnings: string[]
}> {
  const cfg = options.config || (await loadCommunicationsConfig())
  const mode: NotificationSourceMode = options.sourceMode || cfg.sourceMode || "both"
  const warnings: string[] = []
  const sourcesUsed: string[] = []

  let nativeRows: UnifiedNotificationShipmentRow[] = []
  let legacyRows: UnifiedNotificationShipmentRow[] = []

  if (mode === "both" || mode === "tms_linke") {
    sourcesUsed.push("tms_linke")
    const nativeRes = await fetchNativeTmsShipmentsByType(type, { limit: options.limit || 300 })
    nativeRows = nativeRes.rows
    if (nativeRes.error) {
      warnings.push(`[TMS Linke Nativo] ${nativeRes.error}`)
    }
  }

  if (mode === "both" || mode === "legacy_tms") {
    sourcesUsed.push("legacy_tms")
    const legacyRes = await fetchLegacyTmsShipmentsByType(type, {
      limit: options.limit || 150,
      maxPages: options.maxPages || 4,
      config: cfg,
    })
    legacyRows = legacyRes.rows
    if (legacyRes.error) {
      warnings.push(`[Legacy TMS Scraping] ${legacyRes.error}`)
    }
  }

  // Deduplicar entre os dois sistemas dando prioridade ao registo nativo (que já tem shipmentId UUID)
  const deduped = new Map<string, UnifiedNotificationShipmentRow>()
  for (const row of [...nativeRows, ...legacyRows]) {
    const key = String(row.providerTrackingCode || row.parcelId || "")
      .trim()
      .toUpperCase()
    if (!key) continue
    if (!deduped.has(key)) {
      deduped.set(key, row)
    }
  }

  const combined = Array.from(deduped.values())
  return {
    rows: combined,
    sourcesUsed,
    countsBySource: {
      tms_linke: nativeRows.length,
      legacy_tms: legacyRows.length,
      combinedDeduped: combined.length,
    },
    warnings,
  }
}

/**
 * 4. PESQUISA DE GUIA PARA AUTO-PREENCHER TEMPLATES (Nativo TMS Linke + Fallback Legacy)
 */
export async function lookupShipmentByTracking(query: string): Promise<UnifiedNotificationShipmentRow | null> {
  const clean = String(query || "").trim()
  if (!clean) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("shipments")
    .select(
      "id, tracking_number, carrier_tracking_number, service_type, sender_name, recipient_name, recipient_phone, status, ops_substatus, created_at, updated_at"
    )
    .or(`tracking_number.ilike.%${clean}%,carrier_tracking_number.ilike.%${clean}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data) {
    return {
      parcelId: String(data.tracking_number || "").trim(),
      providerTrackingCode: String(data.carrier_tracking_number || data.tracking_number || "").trim(),
      service: String(data.service_type || "").trim(),
      sender: String(data.sender_name || "Linke").trim(),
      recipient: String(data.recipient_name || "").trim(),
      finalClientPhone: String(data.recipient_phone || "").trim(),
      pickupDate: String(data.created_at || "").slice(0, 10),
      deliveryDate: String(data.updated_at || "").slice(0, 10),
      status: String(data.status || "").trim(),
      incidence: String(data.ops_substatus || "").trim(),
      incidentReason: String(data.ops_substatus || "").trim(),
      hasCharge: false,
      chargeAmount: "",
      shipmentId: data.id,
      sourceSystem: "tms_linke",
    }
  }

  return null
}

