import { createClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/server"
import { loadCommunicationsConfig, type CommunicationsConfig } from "./config"

export function getLegacyWhatsappSupabaseClient() {
  const url = String(process.env.LEGACY_WHATSAPP_SUPABASE_URL || "").trim()
  const key = String(process.env.LEGACY_WHATSAPP_SUPABASE_SERVICE_ROLE_KEY || "").trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export function normalizeRecipient(input: unknown): string {
  const digits = String(input ?? "").replace(/\D/g, "")
  if (!digits) return ""

  const withoutInternationalPrefix = digits.startsWith("00") ? digits.slice(2) : digits

  // PT fallback: local mobile number (9 digits starting with 9) -> prepend PT country code 351
  if (withoutInternationalPrefix.length === 9 && withoutInternationalPrefix.startsWith("9")) {
    return `351${withoutInternationalPrefix}`
  }

  // ES fallback: local mobile number (9 digits starting with 6 or 7) -> prepend ES country code 34
  if (withoutInternationalPrefix.length === 9 && /^[67]/.test(withoutInternationalPrefix)) {
    return `34${withoutInternationalPrefix}`
  }

  return withoutInternationalPrefix
}

const SMS_FALLBACK_TEMPLATE_BODIES: Record<string, string> = {
  notificaoc_de_incidencia:
    "Ola {{1}}, houve um atraso/problema na entrega da sua encomenda no {{2}}. Encomenda da loja {{3}}. Estamos a trabalhar para resolver o problema o mais rapidamente possivel. Lamentamos qualquer inconveniente. Enviaremos o estado atualizado da entrega assim que possivel.",
  notificacao_de_incidencia:
    "Ola {{1}}, houve um atraso/problema na entrega da sua encomenda no {{2}}. Encomenda da loja {{3}}. Estamos a trabalhar para resolver o problema o mais rapidamente possivel. Lamentamos qualquer inconveniente. Enviaremos o estado atualizado da entrega assim que possivel.",
  notificacao_auto_incidencia:
    "Ola {{1}}, houve um atraso/problema na entrega da sua encomenda no {{2}}. Encomenda da loja {{3}}. Estamos a trabalhar para resolver o problema o mais rapidamente possivel. Lamentamos qualquer inconveniente. Enviaremos o estado atualizado da entrega assim que possivel.",
  notificacao_de_envio:
    "Ola {{1}}, a sua encomenda da loja {{2}} (Tracking: {{3}}) encontra-se em distribuicao para entrega hoje.",
  notificacao_de_envio_em_transporte:
    "Ola {{1}}, a sua encomenda da loja {{2}} (Tracking: {{3}}) ja se encontra em transporte na nossa rede.",
}

function renderTemplateBodyWithVariables(templateBody: string, bodyVariables: string[] = []): string {
  const safeBody = String(templateBody || "").trim()
  if (!safeBody) return ""

  return safeBody
    .replace(/{{\s*(\d+)\s*}}/g, (_match, indexText) => {
      const idx = Number(indexText)
      if (!Number.isFinite(idx) || idx < 1) return ""
      return String(bodyVariables[idx - 1] ?? "").trim()
    })
    .replace(/\s+/g, " ")
    .trim()
}

export function buildTemplateFallbackText(input: {
  templateName: string
  bodyVariables?: string[]
  buttonUrlVariable?: string
}): string {
  const cleanTemplateName = String(input.templateName || "").trim()
  const cleanVars = Array.isArray(input.bodyVariables)
    ? input.bodyVariables.map((value) => String(value ?? "").trim()).filter(Boolean)
    : []
  const cleanButtonVar = String(input.buttonUrlVariable || "").trim()

  const templateKey = cleanTemplateName.toLowerCase()
  const knownTemplateBody = SMS_FALLBACK_TEMPLATE_BODIES[templateKey] || ""
  const renderedKnownBody = renderTemplateBodyWithVariables(knownTemplateBody, cleanVars)

  if (renderedKnownBody) {
    return cleanButtonVar ? `${renderedKnownBody} Link: ${cleanButtonVar}`.trim() : renderedKnownBody
  }

  const parts = [`Linke Envios (${cleanTemplateName})`]
  if (cleanVars.length > 0) {
    parts.push(cleanVars.join(" | "))
  }
  if (cleanButtonVar) {
    parts.push(`Link: ${cleanButtonVar}`)
  }
  return parts.join(" - ").trim()
}

function isFeedbackTemplateName(value: string): boolean {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
  return /feedback|survey|satisfa|inquerito/.test(normalized)
}

function isIncidenciaMessageType(value: string): boolean {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
  return normalized.includes("incid")
}

export interface CreateLogRowInput {
  direction?: "out" | "in"
  channel: string
  to: string
  contactName?: string | null
  messageText?: string | null
  templateName?: string | null
  status?: string | null
  apiMessageId?: string | null
  shipmentId?: string | null
  trackingNumber?: string | null
  sourceSystem?: "tms_linke" | "legacy_tms" | "manual"
  payload?: Record<string, unknown>
}

export async function createCommunicationLogRow(input: CreateLogRowInput): Promise<string | null> {
  try {
    const supabase = createAdminClient()
    const row = {
      direction: input.direction || "out",
      channel: input.channel,
      to_number: String(input.to || "").trim(),
      contact_name: input.contactName ? String(input.contactName).trim() : null,
      message_text: input.messageText ? String(input.messageText).trim() : null,
      template_name: input.templateName ? String(input.templateName).trim() : null,
      status: input.status ? String(input.status).trim() : null,
      api_message_id: input.apiMessageId ? String(input.apiMessageId).trim() : null,
      shipment_id: input.shipmentId || null,
      tracking_number: input.trackingNumber ? String(input.trackingNumber).trim() : null,
      source_system: input.sourceSystem || "manual",
      payload: input.payload && typeof input.payload === "object" ? input.payload : {},
    }

    const { error } = await supabase.from("whatsapp_logs").insert(row)
    if (error) {
      const legacySb = getLegacyWhatsappSupabaseClient()
      if (legacySb) {
        const { error: legacyErr } = await legacySb.from("whatsapp_logs").insert({
          direction: row.direction,
          channel: row.channel,
          to_number: row.to_number,
          contact_name: row.contact_name,
          message_text: row.message_text,
          template_name: row.template_name,
          status: row.status,
          api_message_id: row.api_message_id,
          payload: {
            ...row.payload,
            shipment_id: row.shipment_id,
            tracking_number: row.tracking_number,
            source_system: row.source_system,
          },
        })
        if (!legacyErr) return null
      }
      return error.message
    }
    return null
  } catch (err) {
    return err instanceof Error ? err.message : "Falha ao gravar registo em whatsapp_logs"
  }
}

export async function updateCommunicationLogStatusByMessageId(input: {
  messageId: string
  status: string
  statusEvent?: Record<string, unknown>
}) {
  const normalizedMessageId = String(input.messageId || "").trim()
  const normalizedStatus = String(input.status || "").trim()
  if (!normalizedMessageId || !normalizedStatus) return

  try {
    const supabase = createAdminClient()
    const { data: existing } = await supabase
      .from("whatsapp_logs")
      .select("id, payload")
      .eq("api_message_id", normalizedMessageId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()

    const mergedPayload = {
      ...(existing?.payload && typeof existing.payload === "object" ? existing.payload : {}),
      ...(input.statusEvent ? { statusEvent: input.statusEvent } : {}),
      updatedStatusAt: new Date().toISOString(),
    }

    await supabase
      .from("whatsapp_logs")
      .update({
        status: normalizedStatus,
        payload: mergedPayload,
      })
      .eq("api_message_id", normalizedMessageId)
  } catch {
    // Non-fatal webhook update
  }
}

export interface SendClickSendSmsInput {
  to: string
  message: string
  contactName?: string
  trackingNumber?: string
  shipmentId?: string | null
  source?: string
  templateName?: string
  waStatus?: string
  waResponse?: unknown
  config?: CommunicationsConfig
}

export async function sendClickSendSms(input: SendClickSendSmsInput) {
  const cfg = input.config || (await loadCommunicationsConfig())

  if (!cfg.smsSendingEnabled) {
    return {
      attempted: false,
      ok: false,
      status: "skipped_globally_disabled",
      reason: "Envio de SMS desativado nas configurações.",
    }
  }

  const normalizedTo = normalizeRecipient(input.to)
  const cleanMessage = String(input.message || "").trim()

  if (!normalizedTo || !cleanMessage) {
    return {
      attempted: false,
      ok: false,
      status: "skipped_invalid_input",
      reason: "Número de destinatário e mensagem são obrigatórios.",
    }
  }

  if (!cfg.clicksendUsername || !cfg.clicksendApiKey) {
    return {
      attempted: false,
      ok: false,
      status: "skipped_not_configured",
      reason: "Credenciais ClickSend (CLICKSEND_USERNAME / CLICKSEND_API_KEY) não configuradas.",
    }
  }

  try {
    const endpoint = "https://rest.clicksend.com/v3/sms/send"
    const basicToken = Buffer.from(`${cfg.clicksendUsername}:${cfg.clicksendApiKey}`).toString("base64")
    const payload = {
      messages: [
        {
          source: "tms-linke",
          from: cfg.clicksendFrom || "Linke",
          body: cleanMessage,
          to: normalizedTo,
        },
      ],
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const responseBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
    const dataNode =
      responseBody?.data && typeof responseBody.data === "object"
        ? (responseBody.data as Record<string, unknown>)
        : {}
    const messagesArr = Array.isArray(dataNode.messages) ? dataNode.messages : []
    const firstMsg = (messagesArr[0] && typeof messagesArr[0] === "object" ? messagesArr[0] : {}) as Record<
      string,
      unknown
    >
    const apiMessageId = String(firstMsg.message_id || "").trim()

    const logWarning = await createCommunicationLogRow({
      direction: "out",
      channel: "sms",
      to: normalizedTo,
      contactName: input.contactName || null,
      messageText: cleanMessage,
      templateName: input.templateName || null,
      status: response.ok ? "sent" : `failed_${response.status}`,
      apiMessageId,
      shipmentId: input.shipmentId || null,
      trackingNumber: input.trackingNumber || null,
      sourceSystem: "manual",
      payload: {
        source: input.source || "manual",
        waStatus: input.waStatus || null,
        waResponse: input.waResponse || null,
        clicksendResponse: responseBody,
      },
    })

    return {
      attempted: true,
      ok: response.ok,
      status: response.ok ? "sent" : `failed_${response.status}`,
      source: input.source || "manual",
      to: normalizedTo,
      apiMessageId,
      responseStatus: response.status,
      responseBody,
      logWarning: logWarning || undefined,
    }
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      status: "failed_exception",
      source: input.source || "manual",
      to: normalizedTo,
      error: error instanceof Error ? error.message : "Erro ao enviar SMS via ClickSend",
    }
  }
}

export interface SendTemplateMessageInput {
  to: string
  templateName: string
  languageCode?: string
  bodyVariables?: string[]
  buttonUrlVariable?: string
  trackerContext?: {
    clientName?: string
    parcelId?: string
    messageType?: string
    notes?: string
    shipmentId?: string | null
    sourceSystem?: "tms_linke" | "legacy_tms" | "manual"
  } | null
  phoneNumberIdOverride?: string | null
  accessTokenOverride?: string | null
  config?: CommunicationsConfig
}

export async function sendGenericTemplateMessage(input: SendTemplateMessageInput) {
  const cfg = input.config || (await loadCommunicationsConfig())

  try {
    const normalizedTo = normalizeRecipient(input.to || "")
    const cleanTemplateName = String(input.templateName || "").trim()
    const cleanLanguageCode = String(input.languageCode || cfg.autoEnvioLanguage || "pt_PT").trim() || "pt_PT"
    const cleanBodyVariables = Array.isArray(input.bodyVariables)
      ? input.bodyVariables.map((value) => String(value ?? "").trim()).filter(Boolean)
      : []
    const cleanButtonUrlVariable = String(input.buttonUrlVariable || "").trim()
    const cleanTrackerContext =
      input.trackerContext && typeof input.trackerContext === "object"
        ? {
            clientName: String(input.trackerContext.clientName || cleanBodyVariables[0] || "").trim(),
            parcelId: String(input.trackerContext.parcelId || "").trim(),
            messageType: String(input.trackerContext.messageType || "").trim(),
            notes: String(input.trackerContext.notes || "").trim(),
            shipmentId: input.trackerContext.shipmentId || null,
            sourceSystem: input.trackerContext.sourceSystem || "manual",
          }
        : null

    if (!normalizedTo || !cleanTemplateName) {
      return {
        ok: false,
        status: 400,
        finalBody: {
          error: "Os campos 'to' (telefone) e 'templateName' são obrigatórios.",
        },
      }
    }

    const apiVersion = cfg.whatsappApiVersion || "v23.0"
    const phoneNumberId = input.phoneNumberIdOverride || cfg.whatsappPhoneNumberId
    const token = input.accessTokenOverride || cfg.whatsappAccessToken

    if (!phoneNumberId || !token) {
      return {
        ok: false,
        status: 400,
        finalBody: {
          error:
            "Credenciais WhatsApp Cloud API (WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ACCESS_TOKEN) não configuradas.",
        },
      }
    }

    const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`
    const components: Array<Record<string, unknown>> = []

    if (cleanBodyVariables.length > 0) {
      components.push({
        type: "body",
        parameters: cleanBodyVariables.map((text) => ({ type: "text", text })),
      })
    }

    if (cleanButtonUrlVariable) {
      components.push({
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: cleanButtonUrlVariable }],
      })
    }

    const templatePayload: Record<string, unknown> = {
      name: cleanTemplateName,
      language: {
        code: cleanLanguageCode,
      },
    }

    if (components.length > 0) {
      templatePayload.components = components
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedTo,
      type: "template",
      template: templatePayload,
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const responseBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
    const messagesArr = Array.isArray(responseBody.messages) ? responseBody.messages : []
    const firstMsg = (messagesArr[0] && typeof messagesArr[0] === "object" ? messagesArr[0] : {}) as Record<
      string,
      unknown
    >
    const messageId = String(firstMsg.id || "").trim()

    const logWarning = await createCommunicationLogRow({
      direction: "out",
      channel: input.phoneNumberIdOverride ? "template_incidencias" : "template",
      to: normalizedTo,
      contactName: cleanTrackerContext?.clientName || cleanBodyVariables[0] || null,
      messageText: cleanBodyVariables.join(" | "),
      templateName: cleanTemplateName,
      status: response.ok ? "accepted" : `failed_${response.status}`,
      apiMessageId: messageId,
      shipmentId: cleanTrackerContext?.shipmentId || null,
      trackingNumber: cleanTrackerContext?.parcelId || null,
      sourceSystem: cleanTrackerContext?.sourceSystem || "manual",
      payload: {
        ...responseBody,
        trackerContext: cleanTrackerContext,
      },
    })

    const smsFallbackMessage = buildTemplateFallbackText({
      templateName: cleanTemplateName,
      bodyVariables: cleanBodyVariables,
      buttonUrlVariable: cleanButtonUrlVariable,
    })

    const smsFallbackDisabledForIncidencia =
      isIncidenciaMessageType(cleanTrackerContext?.messageType || "") && !cfg.autoSmsFallbackIncidenciaEnabled
    const smsFallbackDisabledForFeedback = isFeedbackTemplateName(cleanTemplateName)

    let smsFallback: unknown = null
    if (!response.ok) {
      if (!cfg.autoSmsFallbackEnabled) {
        smsFallback = { attempted: false, status: "skipped_auto_disabled" }
      } else if (smsFallbackDisabledForIncidencia) {
        smsFallback = { attempted: false, status: "skipped_for_incidencia" }
      } else if (smsFallbackDisabledForFeedback) {
        smsFallback = { attempted: false, status: "skipped_for_feedback_template" }
      } else {
        smsFallback = await sendClickSendSms({
          to: normalizedTo,
          message: smsFallbackMessage,
          contactName: cleanTrackerContext?.clientName || cleanBodyVariables[0] || undefined,
          trackingNumber: cleanTrackerContext?.parcelId || undefined,
          shipmentId: cleanTrackerContext?.shipmentId || null,
          source: "wa_template_failure",
          templateName: cleanTemplateName,
          waStatus: `failed_${response.status}`,
          waResponse: responseBody,
          config: cfg,
        })
      }
    }

    return {
      ok: response.ok,
      status: response.ok ? 200 : response.status,
      messageId,
      to: normalizedTo,
      finalBody: {
        ...responseBody,
        ...(logWarning ? { _supabaseWarning: logWarning } : {}),
        ...(smsFallback ? { _smsFallback: smsFallback } : {}),
      },
    }
  } catch (error) {
    return {
      ok: false,
      status: 500,
      finalBody: {
        error: "Falha ao enviar template WhatsApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
    }
  }
}

export interface MetaTemplateComponent {
  type: string
  format?: string
  text?: string
  buttons?: Array<{ type: string; text?: string; url?: string }>
}

export interface MetaWhatsappTemplate {
  id: string
  name: string
  language: string
  status: string
  category: string
  components?: MetaTemplateComponent[]
}

export async function listWhatsappTemplates(options: { config?: CommunicationsConfig } = {}) {
  const cfg = options.config || (await loadCommunicationsConfig())
  const apiVersion = cfg.whatsappApiVersion || "v23.0"
  const token = cfg.whatsappAccessToken
  const phoneNumberId = cfg.whatsappPhoneNumberId
  let wabaId = cfg.whatsappBusinessAccountId

  if (!token) {
    return {
      ok: false,
      status: 400,
      error: "WHATSAPP_ACCESS_TOKEN não configurado.",
      data: [] as MetaWhatsappTemplate[],
    }
  }

  if (!phoneNumberId && !wabaId) {
    return {
      ok: false,
      status: 400,
      error: "Configure WHATSAPP_PHONE_NUMBER_ID ou WHATSAPP_BUSINESS_ACCOUNT_ID.",
      data: [] as MetaWhatsappTemplate[],
    }
  }

  try {
    if (!wabaId && phoneNumberId) {
      const phoneLookupUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=whatsapp_business_account`
      const lookupRes = await fetch(phoneLookupUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const lookupBody = (await lookupRes.json().catch(() => ({}))) as Record<string, unknown>
      if (lookupRes.ok) {
        const wabaNode =
          lookupBody.whatsapp_business_account && typeof lookupBody.whatsapp_business_account === "object"
            ? (lookupBody.whatsapp_business_account as Record<string, unknown>)
            : null
        wabaId = String(wabaNode?.id || "").trim()
      }
    }

    if (!wabaId) {
      return {
        ok: false,
        status: 400,
        error:
          "Não foi possível resolver o WABA ID a partir do Phone Number ID. Preencha o WABA ID (WHATSAPP_BUSINESS_ACCOUNT_ID) nas configurações.",
        data: [] as MetaWhatsappTemplate[],
      }
    }

    const templates: MetaWhatsappTemplate[] = []
    let nextUrl = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates?limit=100&fields=id,name,language,status,category,quality_score,components`
    let pagesFetched = 0

    while (nextUrl && pagesFetched < 15) {
      const pageRes = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const pageBody = (await pageRes.json().catch(() => ({}))) as Record<string, unknown>

      if (!pageRes.ok) {
        return {
          ok: false,
          status: pageRes.status,
          error:
            (pageBody.error && typeof pageBody.error === "object"
              ? String((pageBody.error as Record<string, unknown>).message || "")
              : "") || `Erro da Meta Graph API (${pageRes.status})`,
          data: [] as MetaWhatsappTemplate[],
        }
      }

      const pageData = Array.isArray(pageBody.data) ? (pageBody.data as MetaWhatsappTemplate[]) : []
      templates.push(...pageData)
      const paging =
        pageBody.paging && typeof pageBody.paging === "object"
          ? (pageBody.paging as Record<string, unknown>)
          : null
      nextUrl = String(paging?.next || "").trim()
      pagesFetched += 1
    }

    return {
      ok: true,
      status: 200,
      phoneNumberId,
      wabaId,
      data: templates,
    }
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: error instanceof Error ? error.message : "Erro ao carregar templates da Meta",
      data: [] as MetaWhatsappTemplate[],
    }
  }
}

