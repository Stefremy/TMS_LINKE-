export interface ChatLogItem {
  id: number | string
  created_at: string
  direction: "in" | "out"
  channel: string
  to_number: string
  contact_name: string | null
  message_text: string | null
  template_name: string | null
  status: string | null
  api_message_id: string | null
  tracking_number: string | null
  media_type: string | null
  media_id: string | null
  error_reason?: string | null
}

export function extractMediaFromPayload(payload: unknown): { mediaType: string | null; mediaId: string | null } {
  if (!payload || typeof payload !== "object") {
    return { mediaType: null, mediaId: null }
  }
  const root = payload as Record<string, unknown>

  // Outbound media uploaded via TMS Linke
  if (root.uploadedMediaId) {
    return {
      mediaType: String(root.mediaType || "document").toLowerCase(),
      mediaId: String(root.uploadedMediaId).trim(),
    }
  }

  // Inbound webhook media stored under payload.message
  const msg = root.message && typeof root.message === "object" ? (root.message as Record<string, unknown>) : null
  if (!msg) return { mediaType: null, mediaId: null }

  const type = String(msg.type || "").trim().toLowerCase()
  if (!type || type === "text" || type === "button" || type === "interactive") {
    return { mediaType: null, mediaId: null }
  }

  const mediaNode = msg[type] && typeof msg[type] === "object" ? (msg[type] as Record<string, unknown>) : null
  const mediaId = String(mediaNode?.id || "").trim()
  if (!mediaId) return { mediaType: null, mediaId: null }

  return {
    mediaType: type,
    mediaId,
  }
}

export function extractErrorReasonFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const root = payload as Record<string, unknown>

  const statusEvent =
    root.statusEvent && typeof root.statusEvent === "object"
      ? (root.statusEvent as Record<string, unknown>)
      : null
  const statusErrors = Array.isArray(statusEvent?.errors) ? statusEvent.errors : []
  const firstWebhookError =
    statusErrors[0] && typeof statusErrors[0] === "object"
      ? (statusErrors[0] as Record<string, unknown>)
      : null

  if (firstWebhookError) {
    const code = firstWebhookError.code ? `[${firstWebhookError.code}] ` : ""
    const errData =
      firstWebhookError.error_data && typeof firstWebhookError.error_data === "object"
        ? (firstWebhookError.error_data as Record<string, unknown>)
        : null
    const detail = String(
      errData?.details || firstWebhookError.message || firstWebhookError.title || ""
    ).trim()
    if (detail) return `${code}${detail}`.trim()
  }

  const graphError =
    root.error && typeof root.error === "object"
      ? (root.error as Record<string, unknown>)
      : null
  if (graphError) {
    const code = graphError.code ? `[${graphError.code}] ` : ""
    const errData =
      graphError.error_data && typeof graphError.error_data === "object"
        ? (graphError.error_data as Record<string, unknown>)
        : null
    const detail = String(errData?.details || graphError.message || "").trim()
    if (detail) return `${code}${detail}`.trim()
  }

  return null
}

export function mapRowToChatLogItem(raw: Record<string, unknown>): ChatLogItem {
  const payload = raw.payload && typeof raw.payload === "object" ? (raw.payload as Record<string, unknown>) : {}
  const trackerCtx =
    payload.trackerContext && typeof payload.trackerContext === "object"
      ? (payload.trackerContext as Record<string, unknown>)
      : {}
  const trackingNumber = String(
    raw.tracking_number || trackerCtx.parcelId || payload.parcelId || payload.tracking_number || ""
  ).trim()
  const contactName = String(raw.contact_name || trackerCtx.clientName || "").trim()
  const { mediaType, mediaId } = extractMediaFromPayload(payload)
  const errorReason = extractErrorReasonFromPayload(payload)

  return {
    id: raw.id as number | string,
    created_at: String(raw.created_at || new Date().toISOString()),
    direction: String(raw.direction || "out").toLowerCase() === "in" ? "in" : "out",
    channel: String(raw.channel || "chat").toLowerCase(),
    to_number: String(raw.to_number || "").trim(),
    contact_name: contactName || null,
    message_text: raw.message_text ? String(raw.message_text) : null,
    template_name: raw.template_name ? String(raw.template_name) : null,
    status: raw.status ? String(raw.status) : null,
    api_message_id: raw.api_message_id ? String(raw.api_message_id) : null,
    tracking_number: trackingNumber || null,
    media_type: mediaType,
    media_id: mediaId,
    error_reason: errorReason,
  }
}

