import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth/context"
import { loadCommunicationsConfig, type NotificationSourceMode } from "@/lib/services/communications/config"
import {
  fetchUnifiedShipmentsByCategory,
  setPudoShipmentNotified,
  type ShipmentListCategory,
} from "@/lib/services/communications/shipment-sources"
import { sendGenericTemplateMessage } from "@/lib/services/communications/whatsapp-cloud"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const VALID_CATEGORIES = new Set<ShipmentListCategory>([
  "em_distribuicao",
  "em_transporte",
  "incidencia",
  "entregue",
  "pudo",
])

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx || !["admin", "employee"].includes(ctx.role || "")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const rawCat = String(searchParams.get("category") || "em_distribuicao").trim() as ShipmentListCategory
    const category: ShipmentListCategory = VALID_CATEGORIES.has(rawCat) ? rawCat : "em_distribuicao"
    const rawSource = String(searchParams.get("sourceMode") || "").trim()
    const sourceMode: NotificationSourceMode | undefined =
      rawSource === "both" || rawSource === "legacy_tms" || rawSource === "tms_linke"
        ? rawSource
        : undefined
    const search = String(searchParams.get("search") || "").trim()
    const dateFrom = String(searchParams.get("dateFrom") || "").trim()
    const dateTo = String(searchParams.get("dateTo") || "").trim()
    const onlyOverdue24h =
      searchParams.get("onlyOverdue24h") === "1" || searchParams.get("onlyOverdue24h") === "true"
    const limit = Math.max(10, Math.min(400, Number(searchParams.get("limit") || 200)))

    const result = await fetchUnifiedShipmentsByCategory(category, {
      sourceMode,
      limit,
      maxPages: 3,
      search,
      dateFrom,
      dateTo,
      onlyOverdue24h,
    })

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao carregar envios por categoria.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx || !["admin", "employee"].includes(ctx.role || "")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(body.action || "").trim()

    if (action === "toggle_pudo_notified") {
      const parcelKey = String(body.parcelKey || "").trim()
      const notified = Boolean(body.notified)
      const map = await setPudoShipmentNotified(parcelKey, notified)
      return NextResponse.json({ ok: true, parcelKey, notified, pudoMapCount: Object.keys(map).length })
    }

    if (action === "send_one_click") {
      const cfg = await loadCommunicationsConfig()
      const rawCat = String(body.category || "em_distribuicao").trim() as ShipmentListCategory
      const category: ShipmentListCategory = VALID_CATEGORIES.has(rawCat) ? rawCat : "em_distribuicao"
      const row = (body.row && typeof body.row === "object" ? body.row : {}) as Record<string, unknown>

      const recipient = String(row.recipient || "Cliente").trim() || "Cliente"
      const sender = String(row.sender || "Linke").trim() || "Linke"
      const parcelId = String(row.parcelId || "").trim()
      const providerTrackingCode = String(row.providerTrackingCode || parcelId || "").trim()
      const phoneRaw = String(row.finalClientPhone || "").trim()
      const overdue24h = Boolean(row.overdue24h)
      const shipmentId = row.shipmentId ? String(row.shipmentId) : null
      const sourceSystem = row.sourceSystem === "legacy_tms" ? "legacy_tms" : "tms_linke"

      if (!phoneRaw) {
        return NextResponse.json(
          { ok: false, error: "Este envio não tem número de telefone válido para envio 1-clique." },
          { status: 400 }
        )
      }

      let templateName = String(body.templateName || "").trim()
      let languageCode = String(body.languageCode || "").trim()
      let bodyVariables: string[] = []
      let useIncidenciaNumber = false

      if (category === "em_distribuicao") {
        templateName = templateName || cfg.autoEnvioTemplate || "notificacao_de_envio"
        languageCode = languageCode || cfg.autoEnvioLanguage || "pt_PT"
        bodyVariables = [recipient, sender, providerTrackingCode || parcelId]
      } else if (category === "em_transporte") {
        templateName = templateName || cfg.autoTransporteTemplate || "notificacao_de_envio_em_transporte"
        languageCode = languageCode || cfg.autoTransporteLanguage || "pt_PT"
        bodyVariables = [recipient, sender, providerTrackingCode || parcelId]
      } else if (category === "incidencia") {
        templateName = templateName || cfg.autoIncidenciaTemplate || "notificaoc_de_incidencia"
        languageCode = languageCode || cfg.autoIncidenciaLanguage || "pt_PT"
        bodyVariables = [recipient, parcelId || providerTrackingCode, sender]
        useIncidenciaNumber = true
      } else if (category === "entregue") {
        templateName = templateName || "feedback_entrega"
        languageCode = languageCode || "pt_PT"
        bodyVariables = [recipient, sender]
      } else if (category === "pudo") {
        if (!templateName) {
          templateName = overdue24h ? "order_pick_no_ctt" : "order_pick_up_1"
        }
        if (!languageCode) {
          languageCode = templateName === "order_pick_no_ctt" ? "en_US" : "pt_PT"
        }
        bodyVariables = [recipient, providerTrackingCode || parcelId]
      }

      const phoneNumberIdOverride =
        useIncidenciaNumber && cfg.incidenciaUseSeparateNumber && cfg.incWhatsappPhoneNumberId
          ? cfg.incWhatsappPhoneNumberId
          : null
      const accessTokenOverride =
        useIncidenciaNumber && cfg.incidenciaUseSeparateNumber && cfg.incWhatsappAccessToken
          ? cfg.incWhatsappAccessToken
          : null

      const waRes = await sendGenericTemplateMessage({
        to: phoneRaw,
        templateName,
        languageCode,
        bodyVariables,
        trackerContext: {
          clientName: recipient,
          parcelId: providerTrackingCode || parcelId,
          messageType: `1-Click ${category}`,
          shipmentId,
          sourceSystem,
        },
        phoneNumberIdOverride,
        accessTokenOverride,
        config: cfg,
      })

      if (waRes.ok) {
        if (category === "pudo") {
          await setPudoShipmentNotified(providerTrackingCode || parcelId, true)
        }
        return NextResponse.json({
          ok: true,
          channel: "whatsapp",
          to: waRes.to,
          templateName,
          languageCode,
          apiMessageId: waRes.messageId,
        })
      }

      const finalRec = (waRes.finalBody && typeof waRes.finalBody === "object"
        ? waRes.finalBody
        : {}) as Record<string, unknown>
      const smsFallback =
        finalRec._smsFallback && typeof finalRec._smsFallback === "object"
          ? (finalRec._smsFallback as Record<string, unknown>)
          : null

      if (smsFallback?.status === "sent") {
        if (category === "pudo") {
          await setPudoShipmentNotified(providerTrackingCode || parcelId, true)
        }
        return NextResponse.json({
          ok: true,
          channel: "sms_fallback",
          to: waRes.to,
          templateName,
          warning: `Template WhatsApp falhou; SMS Fallback enviado automaticamente via ClickSend.`,
        })
      }

      const metaErrObj =
        finalRec.error && typeof finalRec.error === "object"
          ? (finalRec.error as Record<string, unknown>)
          : null
      const errorMsg =
        String(metaErrObj?.message || finalRec.error || "").trim() ||
        "Falha ao enviar template WhatsApp."

      return NextResponse.json(
        {
          ok: false,
          error: errorMsg,
        },
        { status: waRes.status || 400 }
      )
    }

    return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao processar ação de envio.",
      },
      { status: 500 }
    )
  }
}
