import { createAdminClient } from "@/lib/supabase/server"

export type NotificationSourceMode = "both" | "legacy_tms" | "tms_linke"

export interface CommunicationsConfig {
  // Data source mode: both (Legacy HTML Scraper + Native TMS Linke), legacy_tms only, or tms_linke only
  sourceMode: NotificationSourceMode

  // Meta WhatsApp Cloud API
  whatsappApiVersion: string
  whatsappPhoneNumberId: string
  whatsappBusinessAccountId: string
  whatsappAccessToken: string
  whatsappWebhookVerifyToken: string

  // Optional separate WhatsApp number for Incidências
  incidenciaUseSeparateNumber: boolean
  incWhatsappPhoneNumberId: string
  incWhatsappAccessToken: string

  // ClickSend SMS
  smsSendingEnabled: boolean
  autoSmsFallbackEnabled: boolean
  autoSmsFallbackIncidenciaEnabled: boolean
  clicksendUsername: string
  clicksendApiKey: string
  clicksendFrom: string

  // Legacy TMS HTML Scraper credentials
  legacyTmsEnabled: boolean
  legacyTmsBaseUrl: string
  legacyTmsAdminEmail: string
  legacyTmsAdminPassword: string

  // Auto-notification: Em Distribuição
  autoEnvioEnabled: boolean
  autoEnvioTemplate: string
  autoEnvioLanguage: string
  autoEnvioHour: number
  autoEnvioMinute: number
  autoEnvioMaxSendsPerRun: number

  // Auto-notification: Em Transporte
  autoTransporteEnabled: boolean
  autoTransporteTemplate: string
  autoTransporteFallbackTemplate: string
  autoTransporteLanguage: string
  autoTransporteHour: number
  autoTransporteMinute: number
  autoTransporteIncludeIlhas: boolean
  autoTransporteMaxSendsPerRun: number

  // Auto-notification: Incidência
  autoIncidenciaEnabled: boolean
  autoIncidenciaTemplate: string
  autoIncidenciaLanguage: string
  autoIncidenciaMaxSendsPerRun: number
}

function parseBool(val: unknown, fallback: boolean): boolean {
  if (typeof val === "boolean") return val
  if (val === undefined || val === null || val === "") return fallback
  const s = String(val).trim().toLowerCase()
  if (["1", "true", "yes", "sim", "on"].includes(s)) return true
  if (["0", "false", "no", "nao", "não", "off"].includes(s)) return false
  return fallback
}

function parseNum(val: unknown, fallback: number, min: number, max: number): number {
  const n = Number(val)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

export function getEnvDefaults(): CommunicationsConfig {
  return {
    sourceMode: (process.env.WHATSAPP_SOURCE_MODE as NotificationSourceMode) || "both",

    whatsappApiVersion: String(process.env.WHATSAPP_API_VERSION || "v23.0").trim(),
    whatsappPhoneNumberId: String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim(),
    whatsappBusinessAccountId: String(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim(),
    whatsappAccessToken: String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim(),
    whatsappWebhookVerifyToken: String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim(),

    incidenciaUseSeparateNumber: parseBool(process.env.AUTO_NOTIFICACAO_INCIDENCIA_USE_SEPARATE_NUMBER, false),
    incWhatsappPhoneNumberId: String(process.env.INC_WHATSAPP_PHONE_NUMBER_ID || "").trim(),
    incWhatsappAccessToken: String(process.env.INC_WHATSAPP_ACCESS_TOKEN || "").trim(),

    smsSendingEnabled: parseBool(process.env.SMS_SENDING_ENABLED, true),
    autoSmsFallbackEnabled: parseBool(process.env.AUTO_SMS_FALLBACK_ENABLED, true),
    autoSmsFallbackIncidenciaEnabled: parseBool(process.env.AUTO_SMS_FALLBACK_INCIDENCIA_ENABLED, true),
    clicksendUsername: String(process.env.CLICKSEND_USERNAME || "").trim(),
    clicksendApiKey: String(process.env.CLICKSEND_API_KEY || "").trim(),
    clicksendFrom: String(process.env.CLICKSEND_FROM || "Linke").trim(),

    legacyTmsEnabled: parseBool(process.env.TMS_ENABLED, true),
    legacyTmsBaseUrl: String(process.env.TMS_BASE_URL || "").trim().replace(/\/$/, ""),
    legacyTmsAdminEmail: String(process.env.TMS_ADMIN_EMAIL || "").trim(),
    legacyTmsAdminPassword: String(process.env.TMS_ADMIN_PASSWORD || ""),

    autoEnvioEnabled: parseBool(process.env.AUTO_NOTIFICACAO_ENVIO_ENABLED, true),
    autoEnvioTemplate: String(process.env.AUTO_NOTIFICACAO_ENVIO_TEMPLATE || "notificacao_de_envio").trim(),
    autoEnvioLanguage: String(process.env.AUTO_NOTIFICACAO_ENVIO_LANGUAGE || "pt_PT").trim(),
    autoEnvioHour: parseNum(process.env.AUTO_NOTIFICACAO_ENVIO_HOUR, 9, 0, 23),
    autoEnvioMinute: parseNum(process.env.AUTO_NOTIFICACAO_ENVIO_MINUTE, 30, 0, 59),
    autoEnvioMaxSendsPerRun: parseNum(process.env.AUTO_NOTIFICACAO_ENVIO_MAX_SENDS_PER_RUN, 50, 1, 500),

    autoTransporteEnabled: parseBool(process.env.AUTO_NOTIFICACAO_ENVIO_TRANSPORTE_ENABLED, true),
    autoTransporteTemplate: String(
      process.env.AUTO_NOTIFICACAO_ENVIO_TRANSPORTE_TEMPLATE || "notificacao_de_envio_em_transporte"
    ).trim(),
    autoTransporteFallbackTemplate: String(
      process.env.AUTO_NOTIFICACAO_ENVIO_TEMPLATE || "notificacao_de_envio"
    ).trim(),
    autoTransporteLanguage: String(
      process.env.AUTO_NOTIFICACAO_ENVIO_TRANSPORTE_LANGUAGE || "pt_PT"
    ).trim(),
    autoTransporteHour: parseNum(process.env.AUTO_NOTIFICACAO_ENVIO_TRANSPORTE_HOUR, 10, 0, 23),
    autoTransporteMinute: parseNum(process.env.AUTO_NOTIFICACAO_ENVIO_TRANSPORTE_MINUTE, 0, 0, 59),
    autoTransporteIncludeIlhas: parseBool(process.env.AUTO_NOTIFICACAO_ENVIO_TRANSPORTE_INCLUDE_ILHAS, false),
    autoTransporteMaxSendsPerRun: parseNum(process.env.AUTO_NOTIFICACAO_ENVIO_TRANSPORTE_MAX_SENDS_PER_RUN, 50, 1, 500),

    autoIncidenciaEnabled: parseBool(process.env.AUTO_NOTIFICACAO_INCIDENCIA_ENABLED, true),
    autoIncidenciaTemplate: String(
      process.env.AUTO_NOTIFICACAO_INCIDENCIA_TEMPLATE || "notificacao_auto_incidencia"
    ).trim(),
    autoIncidenciaLanguage: String(process.env.AUTO_NOTIFICACAO_INCIDENCIA_LANGUAGE || "pt_PT").trim(),
    autoIncidenciaMaxSendsPerRun: parseNum(process.env.AUTO_NOTIFICACAO_INCIDENCIA_MAX_SENDS_PER_RUN, 50, 1, 500),
  }
}

export async function loadCommunicationsConfig(): Promise<CommunicationsConfig> {
  const defaults = getEnvDefaults()
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("whatsapp_communications_config")
      .select("value")
      .eq("key", "default")
      .maybeSingle()

    if (error || !data?.value || typeof data.value !== "object") {
      return defaults
    }

    const stored = data.value as Partial<CommunicationsConfig>
    const pickStr = (storedVal: unknown, envVal: string) => {
      const s = typeof storedVal === "string" ? storedVal.trim() : ""
      return s || envVal
    }

    const validSourceModes: NotificationSourceMode[] = ["both", "legacy_tms", "tms_linke"]
    const sourceMode = validSourceModes.includes(stored.sourceMode as NotificationSourceMode)
      ? (stored.sourceMode as NotificationSourceMode)
      : defaults.sourceMode

    return {
      sourceMode,
      whatsappApiVersion: pickStr(stored.whatsappApiVersion, defaults.whatsappApiVersion),
      whatsappPhoneNumberId: pickStr(stored.whatsappPhoneNumberId, defaults.whatsappPhoneNumberId),
      whatsappBusinessAccountId: pickStr(stored.whatsappBusinessAccountId, defaults.whatsappBusinessAccountId),
      whatsappAccessToken: pickStr(stored.whatsappAccessToken, defaults.whatsappAccessToken),
      whatsappWebhookVerifyToken: pickStr(stored.whatsappWebhookVerifyToken, defaults.whatsappWebhookVerifyToken),

      incidenciaUseSeparateNumber: parseBool(stored.incidenciaUseSeparateNumber, defaults.incidenciaUseSeparateNumber),
      incWhatsappPhoneNumberId: pickStr(stored.incWhatsappPhoneNumberId, defaults.incWhatsappPhoneNumberId),
      incWhatsappAccessToken: pickStr(stored.incWhatsappAccessToken, defaults.incWhatsappAccessToken),

      smsSendingEnabled: parseBool(stored.smsSendingEnabled, defaults.smsSendingEnabled),
      autoSmsFallbackEnabled: parseBool(stored.autoSmsFallbackEnabled, defaults.autoSmsFallbackEnabled),
      autoSmsFallbackIncidenciaEnabled: parseBool(
        stored.autoSmsFallbackIncidenciaEnabled,
        defaults.autoSmsFallbackIncidenciaEnabled
      ),
      clicksendUsername: pickStr(stored.clicksendUsername, defaults.clicksendUsername),
      clicksendApiKey: pickStr(stored.clicksendApiKey, defaults.clicksendApiKey),
      clicksendFrom: pickStr(stored.clicksendFrom, defaults.clicksendFrom),

      legacyTmsEnabled: parseBool(stored.legacyTmsEnabled, defaults.legacyTmsEnabled),
      legacyTmsBaseUrl: pickStr(stored.legacyTmsBaseUrl, defaults.legacyTmsBaseUrl).replace(/\/$/, ""),
      legacyTmsAdminEmail: pickStr(stored.legacyTmsAdminEmail, defaults.legacyTmsAdminEmail),
      legacyTmsAdminPassword:
        typeof stored.legacyTmsAdminPassword === "string" && stored.legacyTmsAdminPassword.length > 0
          ? stored.legacyTmsAdminPassword
          : defaults.legacyTmsAdminPassword,

      autoEnvioEnabled: parseBool(stored.autoEnvioEnabled, defaults.autoEnvioEnabled),
      autoEnvioTemplate: pickStr(stored.autoEnvioTemplate, defaults.autoEnvioTemplate),
      autoEnvioLanguage: pickStr(stored.autoEnvioLanguage, defaults.autoEnvioLanguage),
      autoEnvioHour: parseNum(stored.autoEnvioHour, defaults.autoEnvioHour, 0, 23),
      autoEnvioMinute: parseNum(stored.autoEnvioMinute, defaults.autoEnvioMinute, 0, 59),
      autoEnvioMaxSendsPerRun: parseNum(stored.autoEnvioMaxSendsPerRun, defaults.autoEnvioMaxSendsPerRun, 1, 500),

      autoTransporteEnabled: parseBool(stored.autoTransporteEnabled, defaults.autoTransporteEnabled),
      autoTransporteTemplate: pickStr(stored.autoTransporteTemplate, defaults.autoTransporteTemplate),
      autoTransporteFallbackTemplate: pickStr(
        stored.autoTransporteFallbackTemplate,
        defaults.autoTransporteFallbackTemplate
      ),
      autoTransporteLanguage: pickStr(stored.autoTransporteLanguage, defaults.autoTransporteLanguage),
      autoTransporteHour: parseNum(stored.autoTransporteHour, defaults.autoTransporteHour, 0, 23),
      autoTransporteMinute: parseNum(stored.autoTransporteMinute, defaults.autoTransporteMinute, 0, 59),
      autoTransporteIncludeIlhas: parseBool(stored.autoTransporteIncludeIlhas, defaults.autoTransporteIncludeIlhas),
      autoTransporteMaxSendsPerRun: parseNum(
        stored.autoTransporteMaxSendsPerRun,
        defaults.autoTransporteMaxSendsPerRun,
        1,
        500
      ),

      autoIncidenciaEnabled: parseBool(stored.autoIncidenciaEnabled, defaults.autoIncidenciaEnabled),
      autoIncidenciaTemplate: pickStr(stored.autoIncidenciaTemplate, defaults.autoIncidenciaTemplate),
      autoIncidenciaLanguage: pickStr(stored.autoIncidenciaLanguage, defaults.autoIncidenciaLanguage),
      autoIncidenciaMaxSendsPerRun: parseNum(
        stored.autoIncidenciaMaxSendsPerRun,
        defaults.autoIncidenciaMaxSendsPerRun,
        1,
        500
      ),
    }
  } catch {
    return defaults
  }
}

export async function saveCommunicationsConfig(updates: Partial<CommunicationsConfig>): Promise<CommunicationsConfig> {
  const current = await loadCommunicationsConfig()
  const merged: CommunicationsConfig = {
    ...current,
    ...updates,
  }

  // Keep existing secret tokens if UI sent masked placeholder
  if (updates.whatsappAccessToken === "••••••••") {
    merged.whatsappAccessToken = current.whatsappAccessToken
  }
  if (updates.incWhatsappAccessToken === "••••••••") {
    merged.incWhatsappAccessToken = current.incWhatsappAccessToken
  }
  if (updates.clicksendApiKey === "••••••••") {
    merged.clicksendApiKey = current.clicksendApiKey
  }
  if (updates.legacyTmsAdminPassword === "••••••••") {
    merged.legacyTmsAdminPassword = current.legacyTmsAdminPassword
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("whatsapp_communications_config")
    .upsert(
      [
        {
          key: "default",
          value: merged,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "key" }
    )

  if (error) {
    throw new Error(`Falha ao guardar configuração de comunicações: ${error.message}`)
  }

  return merged
}

export function maskConfigSecrets(config: CommunicationsConfig) {
  return {
    ...config,
    whatsappAccessToken: config.whatsappAccessToken ? "••••••••" : "",
    incWhatsappAccessToken: config.incWhatsappAccessToken ? "••••••••" : "",
    clicksendApiKey: config.clicksendApiKey ? "••••••••" : "",
    legacyTmsAdminPassword: config.legacyTmsAdminPassword ? "••••••••" : "",
    statusSummary: {
      whatsappConfigured: Boolean(config.whatsappAccessToken && config.whatsappPhoneNumberId),
      clicksendConfigured: Boolean(config.clicksendUsername && config.clicksendApiKey),
      legacyTmsConfigured: Boolean(
        config.legacyTmsEnabled &&
          config.legacyTmsBaseUrl &&
          config.legacyTmsAdminEmail &&
          config.legacyTmsAdminPassword
      ),
    },
  }
}

