"use client"

import * as React from "react"
import {
  MessageSquare,
  Send,
  Smartphone,
  History,
  Settings2,
  RefreshCw,
  Play,
  Eye,
  Search,
  CheckCircle2,
  AlertTriangle,
  Database,
  Globe,
  Layers,
  Package,
  Truck,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  Lock,
  ShieldCheck,
} from "lucide-react"
import type { AutoNotificationType, InteractiveShipmentRow, ShipmentListCategory } from "@/lib/services/communications/shipment-sources"
import type { NotificationSourceMode } from "@/lib/services/communications/config"
import type { MetaWhatsappTemplate } from "@/lib/services/communications/whatsapp-cloud"

const PAGE_SIZE = 75

type TabId = "auto" | "shipments" | "templates" | "sms" | "history" | "settings"

interface AutoRunResult {
  ok: boolean
  type: AutoNotificationType
  dryRun: boolean
  sourceMode: NotificationSourceMode
  sourcesUsed: string[]
  countsBySource: {
    tms_linke: number
    legacy_tms: number
    combinedDeduped: number
  }
  warnings: string[]
  templateName: string
  languageCode: string
  fetchedRows: number
  eligibleToSend: number
  processed: number
  sent: number
  failed: number
  skippedAlreadySent: number
  skippedMissingPhone: number
  skippedIlhas: number
  previewItems: Array<{
    parcelId: string
    providerTrackingCode: string
    recipient: string
    sender: string
    phone: string
    service: string
    incidentReason?: string
    sourceSystem: "legacy_tms" | "tms_linke"
    bodyVariables: string[]
  }>
  errors: string[]
  at: string
}

interface LogRow {
  id: number | string
  created_at: string
  direction: string
  channel: string
  to_number: string
  contact_name: string | null
  message_text: string | null
  template_name: string | null
  status: string | null
  api_message_id: string | null
  tracking_number: string | null
  source_system: string | null
}

interface ConfigState {
  sourceMode: NotificationSourceMode
  whatsappApiVersion: string
  whatsappPhoneNumberId: string
  whatsappBusinessAccountId: string
  whatsappAccessToken: string
  whatsappWebhookVerifyToken: string
  incidenciaUseSeparateNumber: boolean
  incWhatsappPhoneNumberId: string
  incWhatsappAccessToken: string
  smsSendingEnabled: boolean
  autoSmsFallbackEnabled: boolean
  autoSmsFallbackIncidenciaEnabled: boolean
  clicksendUsername: string
  clicksendApiKey: string
  clicksendFrom: string
  legacyTmsEnabled: boolean
  legacyTmsBaseUrl: string
  legacyTmsAdminEmail: string
  legacyTmsAdminPassword: string
  autoEnvioEnabled: boolean
  autoEnvioTemplate: string
  autoEnvioLanguage: string
  autoEnvioHour: number
  autoEnvioMinute: number
  autoEnvioMaxSendsPerRun: number
  autoTransporteEnabled: boolean
  autoTransporteTemplate: string
  autoTransporteFallbackTemplate: string
  autoTransporteLanguage: string
  autoTransporteHour: number
  autoTransporteMinute: number
  autoTransporteIncludeIlhas: boolean
  autoTransporteMaxSendsPerRun: number
  autoIncidenciaEnabled: boolean
  autoIncidenciaTemplate: string
  autoIncidenciaLanguage: string
  autoIncidenciaMaxSendsPerRun: number
  statusSummary?: {
    whatsappConfigured: boolean
    clicksendConfigured: boolean
    legacyTmsConfigured: boolean
  }
}

function extractTemplateBodyText(tpl: MetaWhatsappTemplate | undefined): string {
  if (!tpl || !Array.isArray(tpl.components)) return ""
  const bodyComp = tpl.components.find((c) => String(c.type || "").toUpperCase() === "BODY")
  return String(bodyComp?.text || "").trim()
}

function countTemplateVariables(bodyText: string): number {
  const matches = bodyText.match(/{{\s*(\d+)\s*}}/g) || []
  let maxIdx = 0
  for (const m of matches) {
    const n = Number(m.replace(/\D/g, ""))
    if (Number.isFinite(n) && n > maxIdx) maxIdx = n
  }
  return maxIdx
}

function hasUrlButtonComponent(tpl: MetaWhatsappTemplate | undefined): boolean {
  if (!tpl || !Array.isArray(tpl.components)) return false
  return tpl.components.some(
    (c) =>
      String(c.type || "").toUpperCase() === "BUTTONS" &&
      Array.isArray(c.buttons) &&
      c.buttons.some((b) => String(b.type || "").toUpperCase() === "URL" && String(b.url || "").includes("{{"))
  )
}

export function WhatsappCommunicationsClient({ initialConfig }: { initialConfig?: ConfigState | null }) {
  const [activeTab, setActiveTab] = React.useState<TabId>("auto")
  const [config] = React.useState<ConfigState | null>(initialConfig || null)

  // Auto-notification state
  const [sourceMode, setSourceMode] = React.useState<NotificationSourceMode>(
    initialConfig?.sourceMode || "both"
  )
  const [runningAutoType, setRunningAutoType] = React.useState<string | null>(null)
  const [autoResult, setAutoResult] = React.useState<AutoRunResult | null>(null)
  const [autoError, setAutoError] = React.useState<string | null>(null)
  const [autoPreviewPage, setAutoPreviewPage] = React.useState<number>(1)

  // Templates state
  const [templates, setTemplates] = React.useState<MetaWhatsappTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = React.useState(false)
  const [templatesError, setTemplatesError] = React.useState<string | null>(null)
  const [selectedTemplateKey, setSelectedTemplateKey] = React.useState<string>("")
  const [customTemplateName, setCustomTemplateName] = React.useState<string>("order_pick_no_ctt")
  const [customTemplateLang, setCustomTemplateLang] = React.useState<string>("en_US")
  const selectedTemplateKeyRef = React.useRef(selectedTemplateKey)
  selectedTemplateKeyRef.current = selectedTemplateKey
  const customTemplateNameRef = React.useRef(customTemplateName)
  customTemplateNameRef.current = customTemplateName
  const [templateToPhone, setTemplateToPhone] = React.useState<string>("")
  const [templateContactName, setTemplateContactName] = React.useState<string>("")
  const [templateVars, setTemplateVars] = React.useState<string[]>(["", "", ""])
  const [templateButtonUrlVar, setTemplateButtonUrlVar] = React.useState<string>("")
  const [lookupTrackingQuery, setLookupTrackingQuery] = React.useState<string>("")
  const [lookingUpShipment, setLookingUpShipment] = React.useState(false)
  const [sendingTemplate, setSendingTemplate] = React.useState(false)
  const [templateSendFeedback, setTemplateSendFeedback] = React.useState<{
    ok: boolean
    text: string
  } | null>(null)

  // SMS state
  const [smsPhone, setSmsPhone] = React.useState<string>("")
  const [smsContactName, setSmsContactName] = React.useState<string>("")
  const [smsTracking, setSmsTracking] = React.useState<string>("")
  const [smsMessage, setSmsMessage] = React.useState<string>("")
  const [sendingSms, setSendingSms] = React.useState(false)
  const [smsFeedback, setSmsFeedback] = React.useState<{ ok: boolean; text: string } | null>(null)

  // History logs state (75 per page)
  const [logs, setLogs] = React.useState<LogRow[]>([])
  const [loadingLogs, setLoadingLogs] = React.useState(false)
  const [logsSearch, setLogsSearch] = React.useState<string>("")
  const [logsChannel, setLogsChannel] = React.useState<string>("all")
  const [logsWarning, setLogsWarning] = React.useState<string | null>(null)
  const [logsPage, setLogsPage] = React.useState<number>(1)
  const [logsTotal, setLogsTotal] = React.useState<number>(0)
  const [logsTotalPages, setLogsTotalPages] = React.useState<number>(1)
  const [logsHasMore, setLogsHasMore] = React.useState<boolean>(false)

  // Live recent messages state (75 per page, shown below WhatsApp & SMS workspaces to prevent duplicates)
  const [recentWaLogs, setRecentWaLogs] = React.useState<LogRow[]>([])
  const [recentWaPage, setRecentWaPage] = React.useState<number>(1)
  const [recentWaTotal, setRecentWaTotal] = React.useState<number>(0)
  const [recentWaTotalPages, setRecentWaTotalPages] = React.useState<number>(1)
  const [recentWaHasMore, setRecentWaHasMore] = React.useState<boolean>(false)

  const [recentSmsLogs, setRecentSmsLogs] = React.useState<LogRow[]>([])
  const [recentSmsPage, setRecentSmsPage] = React.useState<number>(1)
  const [recentSmsTotal, setRecentSmsTotal] = React.useState<number>(0)
  const [recentSmsTotalPages, setRecentSmsTotalPages] = React.useState<number>(1)
  const [recentSmsHasMore, setRecentSmsHasMore] = React.useState<boolean>(false)

  const [loadingRecentLogs, setLoadingRecentLogs] = React.useState(false)
  const [recentWaSearch, setRecentWaSearch] = React.useState<string>("")
  const [recentSmsSearch, setRecentSmsSearch] = React.useState<string>("")

  const fetchRecentWaLogs = React.useCallback(
    async (targetPage = 1, searchOverride?: string) => {
      setLoadingRecentLogs(true)
      try {
        const params = new URLSearchParams()
        params.set("channel", "whatsapp")
        params.set("limit", String(PAGE_SIZE))
        params.set("page", String(targetPage))
        const q = (searchOverride !== undefined ? searchOverride : recentWaSearch).trim()
        if (q) params.set("q", q)
        const res = await fetch(`/api/ops/communications/logs?${params.toString()}`)
        const data = await res.json().catch(() => ({}))
        if (Array.isArray(data?.data)) {
          setRecentWaLogs(data.data)
          setRecentWaPage(data.page || targetPage)
          setRecentWaTotal(typeof data.total === "number" ? data.total : data.data.length)
          setRecentWaTotalPages(data.totalPages || 1)
          setRecentWaHasMore(Boolean(data.hasMore))
        }
      } catch {
        // ignore network error
      } finally {
        setLoadingRecentLogs(false)
      }
    },
    [recentWaSearch]
  )

  const fetchRecentSmsLogs = React.useCallback(
    async (targetPage = 1, searchOverride?: string) => {
      setLoadingRecentLogs(true)
      try {
        const params = new URLSearchParams()
        params.set("channel", "sms")
        params.set("limit", String(PAGE_SIZE))
        params.set("page", String(targetPage))
        const q = (searchOverride !== undefined ? searchOverride : recentSmsSearch).trim()
        if (q) params.set("q", q)
        const res = await fetch(`/api/ops/communications/logs?${params.toString()}`)
        const data = await res.json().catch(() => ({}))
        if (Array.isArray(data?.data)) {
          setRecentSmsLogs(data.data)
          setRecentSmsPage(data.page || targetPage)
          setRecentSmsTotal(typeof data.total === "number" ? data.total : data.data.length)
          setRecentSmsTotalPages(data.totalPages || 1)
          setRecentSmsHasMore(Boolean(data.hasMore))
        }
      } catch {
        // ignore network error
      } finally {
        setLoadingRecentLogs(false)
      }
    },
    [recentSmsSearch]
  )

  const refreshRecentActivityLogs = React.useCallback(async () => {
    setLoadingRecentLogs(true)
    try {
      const waParams = new URLSearchParams({
        channel: "whatsapp",
        limit: String(PAGE_SIZE),
        page: String(recentWaPage),
      })
      if (recentWaSearch.trim()) waParams.set("q", recentWaSearch.trim())

      const smsParams = new URLSearchParams({
        channel: "sms",
        limit: String(PAGE_SIZE),
        page: String(recentSmsPage),
      })
      if (recentSmsSearch.trim()) smsParams.set("q", recentSmsSearch.trim())

      const [waRes, smsRes] = await Promise.all([
        fetch(`/api/ops/communications/logs?${waParams.toString()}`),
        fetch(`/api/ops/communications/logs?${smsParams.toString()}`),
      ])
      const [waData, smsData] = await Promise.all([
        waRes.json().catch(() => ({})),
        smsRes.json().catch(() => ({})),
      ])
      if (Array.isArray(waData?.data)) {
        setRecentWaLogs(waData.data)
        setRecentWaPage(waData.page || recentWaPage)
        setRecentWaTotal(typeof waData.total === "number" ? waData.total : waData.data.length)
        setRecentWaTotalPages(waData.totalPages || 1)
        setRecentWaHasMore(Boolean(waData.hasMore))
      }
      if (Array.isArray(smsData?.data)) {
        setRecentSmsLogs(smsData.data)
        setRecentSmsPage(smsData.page || recentSmsPage)
        setRecentSmsTotal(typeof smsData.total === "number" ? smsData.total : smsData.data.length)
        setRecentSmsTotalPages(smsData.totalPages || 1)
        setRecentSmsHasMore(Boolean(smsData.hasMore))
      }
    } catch {
      // ignore network error
    } finally {
      setLoadingRecentLogs(false)
    }
  }, [recentWaPage, recentWaSearch, recentSmsPage, recentSmsSearch])

  // Interactive 1-Click Shipments & PUDO state
  const [shipmentCategory, setShipmentCategory] = React.useState<ShipmentListCategory>("em_distribuicao")
  const [shipmentRows, setShipmentRows] = React.useState<InteractiveShipmentRow[]>([])
  const [shipmentsPage, setShipmentsPage] = React.useState<number>(1)
  const [loadingShipments, setLoadingShipments] = React.useState(false)
  const [shipmentsSearch, setShipmentsSearch] = React.useState<string>("")
  const [shipmentsDateFrom, setShipmentsDateFrom] = React.useState<string>("")
  const [shipmentsDateTo, setShipmentsDateTo] = React.useState<string>("")
  const [onlyOverdue24h, setOnlyOverdue24h] = React.useState(false)
  const [hideAlreadyNotified, setHideAlreadyNotified] = React.useState(false)
  const [shipmentsCounts, setShipmentsCounts] = React.useState<{
    tms_linke: number
    legacy_tms: number
    combinedDeduped: number
  }>({ tms_linke: 0, legacy_tms: 0, combinedDeduped: 0 })
  const [shipmentsWarnings, setShipmentsWarnings] = React.useState<string[]>([])
  const [shipmentsBanner, setShipmentsBanner] = React.useState<{ ok: boolean; text: string } | null>(null)

  const fetchShipmentsByCategory = React.useCallback(
    async (overrideCategory?: ShipmentListCategory) => {
      const targetCat = overrideCategory || shipmentCategory
      setLoadingShipments(true)
      setShipmentsBanner(null)
      setShipmentsPage(1)
      try {
        const params = new URLSearchParams()
        params.set("category", targetCat)
        params.set("sourceMode", sourceMode)
        if (shipmentsSearch.trim()) params.set("search", shipmentsSearch.trim())
        if (shipmentsDateFrom) params.set("dateFrom", shipmentsDateFrom)
        if (shipmentsDateTo) params.set("dateTo", shipmentsDateTo)
        if (onlyOverdue24h) params.set("onlyOverdue24h", "1")
        params.set("limit", "450")

        const res = await fetch(`/api/ops/communications/shipments?${params.toString()}`)
        const data = await res.json()
        if (!res.ok || !data?.ok) {
          setShipmentsBanner({
            ok: false,
            text: data?.error || "Não foi possível carregar a lista de envios.",
          })
          setShipmentRows([])
        } else {
          setShipmentRows(Array.isArray(data.rows) ? data.rows : [])
          setShipmentsCounts(
            data.countsBySource || { tms_linke: 0, legacy_tms: 0, combinedDeduped: 0 }
          )
          setShipmentsWarnings(Array.isArray(data.warnings) ? data.warnings : [])
        }
      } catch (err) {
        setShipmentsBanner({
          ok: false,
          text: err instanceof Error ? err.message : "Erro ao carregar envios.",
        })
      } finally {
        setLoadingShipments(false)
      }
    },
    [shipmentCategory, sourceMode, shipmentsSearch, shipmentsDateFrom, shipmentsDateTo, onlyOverdue24h]
  )

  async function handleTogglePudoNotified(row: InteractiveShipmentRow) {
    const rowKey = row.providerTrackingCode || row.parcelId
    const nextNotified = !row.alreadyNotified
    try {
      const res = await fetch("/api/ops/communications/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_pudo_notified",
          parcelKey: rowKey,
          notified: nextNotified,
        }),
      })
      if (res.ok) {
        setShipmentRows((prev) =>
          prev.map((r) =>
            (r.providerTrackingCode || r.parcelId) === rowKey
              ? {
                  ...r,
                  alreadyNotified: nextNotified,
                  notifiedAt: nextNotified ? new Date().toISOString() : null,
                }
              : r
          )
        )
      }
    } catch {
      // ignore
    }
  }

  function handlePrefillTemplateFromRow(row: InteractiveShipmentRow) {
    const trk = row.providerTrackingCode || row.parcelId || ""
    const recipient = row.recipient || "Cliente"
    const sender = row.sender || "Linke"
    setTemplateToPhone(row.finalClientPhone || "")
    setTemplateContactName(recipient)
    setLookupTrackingQuery(trk)

    let tpl = "notificacao_de_envio"
    let lang = "pt_PT"

    if (shipmentCategory === "em_distribuicao") {
      tpl = config?.autoEnvioTemplate || "notificacao_de_envio"
      lang = config?.autoEnvioLanguage || "pt_PT"
      setTemplateVars([recipient, sender, trk])
    } else if (shipmentCategory === "em_transporte") {
      tpl = config?.autoTransporteTemplate || "notificacao_de_envio_em_transporte"
      lang = config?.autoTransporteLanguage || "pt_PT"
      setTemplateVars([recipient, sender, trk])
    } else if (shipmentCategory === "incidencia") {
      tpl = config?.autoIncidenciaTemplate || "notificaoc_de_incidencia"
      lang = config?.autoIncidenciaLanguage || "pt_PT"
      setTemplateVars([recipient, row.parcelId || trk, sender])
    } else if (shipmentCategory === "entregue") {
      const feedbackMatch = templates.find((t) =>
        /feedback|survey|satisfa|inquerito|avalia/i.test(t.name)
      )
      tpl = feedbackMatch?.name || "feedback_entrega"
      lang = feedbackMatch?.language || "pt_PT"
      setTemplateVars([recipient, sender, trk])
    } else if (shipmentCategory === "pudo") {
      tpl = "order_pick_no_ctt"
      const pudoMatch = templates.find((t) => t.name === "order_pick_no_ctt")
      lang = pudoMatch?.language || "en_US"
      // PUDO: Variável 1 = destinatário, Variável 2 = tracking, Variável 3 = input manual, Variável 4 = "."
      setTemplateVars([recipient, trk, "", "."])
    }

    setCustomTemplateName(tpl)
    setCustomTemplateLang(lang)
    setSelectedTemplateKey(`${tpl}::${lang}`)
    customTemplateNameRef.current = tpl
    selectedTemplateKeyRef.current = `${tpl}::${lang}`

    setTemplateSendFeedback({
      ok: true,
      text:
        shipmentCategory === "pudo"
          ? `Guia ${trk} preenchida para PUDO (order_pick_no_ctt). Introduza o local de levantamento na Variável {{3}} e clique em Enviar.`
          : `Guia ${trk} preenchida a partir da tabela "${shipmentCategory}". Verifique os campos e clique em Enviar.`,
    })
    setActiveTab("templates")
    if (templates.length === 0 && !loadingTemplates) {
      void fetchTemplates()
    }
  }

  function handlePrefillSmsFromRow(row: InteractiveShipmentRow) {
    const trk = row.providerTrackingCode || row.parcelId || ""
    const recipient = row.recipient || "Cliente"
    const sender = row.sender || "Linke"
    setSmsPhone(row.finalClientPhone || "")
    setSmsContactName(recipient)
    setSmsTracking(trk)

    if (shipmentCategory === "pudo") {
      setSmsMessage(
        `Olá ${recipient}, a sua encomenda ${trk} (${sender}) encontra-se disponível para levantamento no Ponto Pickup CTT. Por favor proceda ao levantamento.`
      )
    } else if (shipmentCategory === "incidencia") {
      setSmsMessage(
        `Olá ${recipient}, registámos uma incidência na entrega da sua encomenda ${trk} (${sender}). Por favor contacte-nos para reagendar.`
      )
    } else if (shipmentCategory === "entregue") {
      setSmsMessage(
        `Olá ${recipient}, a sua encomenda ${trk} (${sender}) foi entregue! Gostaríamos de saber a sua opinião sobre o nosso serviço.`
      )
    } else {
      setSmsMessage(
        `Olá ${recipient}, a sua encomenda ${trk} (${sender}) encontra-se ${
          shipmentCategory === "em_distribuicao" ? "em distribuição para entrega hoje" : "em transporte na nossa rede"
        }.`
      )
    }

    setSmsFeedback(null)
    setActiveTab("sms")
  }

  const displayedShipmentRows = React.useMemo(() => {
    if (!hideAlreadyNotified) return shipmentRows
    return shipmentRows.filter((r) => !r.alreadyNotified)
  }, [shipmentRows, hideAlreadyNotified])

  const shipmentsTotalPages = Math.max(1, Math.ceil(displayedShipmentRows.length / PAGE_SIZE))
  const paginatedShipmentRows = React.useMemo(() => {
    const safePage = Math.min(shipmentsPage, shipmentsTotalPages)
    const start = (safePage - 1) * PAGE_SIZE
    return displayedShipmentRows.slice(start, start + PAGE_SIZE)
  }, [displayedShipmentRows, shipmentsPage, shipmentsTotalPages])

  const autoPreviewTotalPages = Math.max(
    1,
    Math.ceil((autoResult?.previewItems?.length || 0) / PAGE_SIZE)
  )
  const paginatedAutoPreviewItems = React.useMemo(() => {
    const list = autoResult?.previewItems || []
    const safePage = Math.min(autoPreviewPage, autoPreviewTotalPages)
    const start = (safePage - 1) * PAGE_SIZE
    return list.slice(start, start + PAGE_SIZE)
  }, [autoResult, autoPreviewPage, autoPreviewTotalPages])

  const shipmentsSummaryStats = React.useMemo(() => {
    let notified = 0
    let pending = 0
    let overdue = 0
    for (const r of shipmentRows) {
      if (r.alreadyNotified) notified += 1
      else pending += 1
      if (r.overdue24h) overdue += 1
    }
    return { total: shipmentRows.length, notified, pending, overdue }
  }, [shipmentRows])

  const fetchTemplates = React.useCallback(async () => {
    setLoadingTemplates(true)
    setTemplatesError(null)
    try {
      const res = await fetch("/api/ops/communications/templates")
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        setTemplatesError(data?.error || "Não foi possível carregar os templates da Meta.")
        setTemplates([])
      } else {
        const rawList = Array.isArray(data.data) ? (data.data as MetaWhatsappTemplate[]) : []
        // Priorizar templates de envios operacionais (order_pick_no_ctt, notificacao_de_envio) e colocar autogo no fim
        const list = [...rawList].sort((a, b) => {
          const priority = (name: string) => {
            if (name === "order_pick_no_ctt") return 1
            if (name === "notificacao_de_envio") return 2
            if (name === "order_pick_up_1") return 3
            if (name === "notificacao_auto_incidencia" || name === "order_incidencia_1") return 4
            if (name === "feedback_survey_1" || name.includes("feedback")) return 5
            if (name.includes("autogo")) return 99
            return 10
          }
          return priority(a.name) - priority(b.name)
        })
        setTemplates(list)

        if (list.length > 0) {
          const currentKey = selectedTemplateKeyRef.current
          const currentName = customTemplateNameRef.current

          // 1. Se já está selecionado um template válido (ex: order_pick_no_ctt::en_US)
          if (currentKey && list.some((t) => `${t.name}::${t.language}` === currentKey)) {
            return
          }

          // 2. Se temos customTemplateName definido
          if (currentName) {
            const match = list.find((t) => t.name === currentName)
            if (match) {
              const key = `${match.name}::${match.language}`
              setSelectedTemplateKey(key)
              selectedTemplateKeyRef.current = key
              setCustomTemplateName(match.name)
              customTemplateNameRef.current = match.name
              setCustomTemplateLang(match.language || "pt_PT")
              return
            }
          }

          // 3. Fallback: NUNCA autogo! Escolher order_pick_no_ctt ou notificacao_de_envio
          const preferred =
            list.find((t) => t.name === "order_pick_no_ctt") ||
            list.find((t) => t.name === "notificacao_de_envio") ||
            list.find((t) => !t.name.toLowerCase().includes("autogo")) ||
            list[0]

          const prefKey = `${preferred.name}::${preferred.language}`
          setSelectedTemplateKey(prefKey)
          selectedTemplateKeyRef.current = prefKey
          setCustomTemplateName(preferred.name)
          customTemplateNameRef.current = preferred.name
          setCustomTemplateLang(preferred.language || "pt_PT")
        }
      }
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : "Erro ao carregar templates.")
    } finally {
      setLoadingTemplates(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchTemplates()
  }, [fetchTemplates])

  const fetchLogs = React.useCallback(
    async (targetPage = 1) => {
      setLoadingLogs(true)
      setLogsWarning(null)
      try {
        const params = new URLSearchParams()
        if (logsSearch.trim()) params.set("q", logsSearch.trim())
        if (logsChannel !== "all") params.set("channel", logsChannel)
        params.set("limit", String(PAGE_SIZE))
        params.set("page", String(targetPage))
        const res = await fetch(`/api/ops/communications/logs?${params.toString()}`)
        const data = await res.json()
        if (data?.warning) {
          setLogsWarning(data.warning)
        }
        const rows = Array.isArray(data?.data) ? data.data : []
        setLogs(rows)
        setLogsPage(data?.page || targetPage)
        setLogsTotal(typeof data?.total === "number" ? data.total : rows.length)
        setLogsTotalPages(data?.totalPages || 1)
        setLogsHasMore(Boolean(data?.hasMore))
      } catch {
        setLogs([])
      } finally {
        setLoadingLogs(false)
      }
    },
    [logsSearch, logsChannel]
  )

  const selectedTemplateObj = React.useMemo(() => {
    if (!selectedTemplateKey) return undefined
    const [name, lang] = selectedTemplateKey.split("::")
    return templates.find((t) => t.name === name && t.language === lang)
  }, [templates, selectedTemplateKey])

  const selectedBodyText = extractTemplateBodyText(selectedTemplateObj)
  const detectedVarCount = Math.max(3, countTemplateVariables(selectedBodyText))
  const showButtonUrlInput = hasUrlButtonComponent(selectedTemplateObj) || !selectedTemplateObj

  async function handleRunAutoNotification(type: AutoNotificationType, dryRun: boolean) {
    setRunningAutoType(`${type}:${dryRun ? "dry" : "live"}`)
    setAutoError(null)
    setAutoPreviewPage(1)
    try {
      const res = await fetch("/api/ops/communications/auto-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          dryRun,
          sourceMode,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        setAutoError(data?.error || "Falha ao executar auto-notificação.")
      } else {
        setAutoResult(data as AutoRunResult)
        if (!dryRun) {
          void refreshRecentActivityLogs()
        }
      }
    } catch (err) {
      setAutoError(err instanceof Error ? err.message : "Erro de rede.")
    } finally {
      setRunningAutoType(null)
    }
  }

  async function handleLookupShipmentForTemplate() {
    if (!lookupTrackingQuery.trim()) return
    setLookingUpShipment(true)
    setTemplateSendFeedback(null)
    try {
      const res = await fetch(
        `/api/ops/communications/templates?lookupTracking=${encodeURIComponent(lookupTrackingQuery.trim())}`
      )
      const data = await res.json()
      if (!res.ok || !data?.shipment) {
        setTemplateSendFeedback({
          ok: false,
          text: data?.error || "Guia não encontrada no TMS Linke.",
        })
        return
      }
      const s = data.shipment
      setTemplateToPhone(s.finalClientPhone || "")
      setTemplateContactName(s.recipient || "")
      const trk = s.providerTrackingCode || s.parcelId || ""
      const isIncTemplate = customTemplateName.toLowerCase().includes("incid")
      if (isIncTemplate) {
        setTemplateVars([s.recipient || "", s.parcelId || trk, s.sender || "Linke"])
      } else {
        setTemplateVars([s.recipient || "", s.sender || "Linke", trk])
      }
      setTemplateSendFeedback({
        ok: true,
        text: `Guia ${trk} carregada: destinatário "${s.recipient}" (${s.finalClientPhone || "sem telefone"}).`,
      })
    } catch {
      setTemplateSendFeedback({ ok: false, text: "Erro ao pesquisar guia." })
    } finally {
      setLookingUpShipment(false)
    }
  }

  async function handleSendTemplate(e: React.FormEvent) {
    e.preventDefault()
    setSendingTemplate(true)
    setTemplateSendFeedback(null)
    try {
      const varsToSend = [...templateVars]
      if (customTemplateName === "order_pick_no_ctt") {
        if (!varsToSend[2]?.trim()) {
          setTemplateSendFeedback({
            ok: false,
            text: "A Variável {{3}} (Local de Levantamento) é obrigatória. Por favor preencha o local antes de enviar.",
          })
          setSendingTemplate(false)
          return
        }
        if (!varsToSend[3]?.trim()) {
          varsToSend[3] = "."
        }
      }

      const cleanVars = varsToSend.slice(0, detectedVarCount).map((v) => (v || "").trim())
      if (cleanVars.some((v) => !v)) {
        setTemplateSendFeedback({
          ok: false,
          text: "Por favor preencha todas as variáveis do template antes de enviar.",
        })
        setSendingTemplate(false)
        return
      }
      const res = await fetch("/api/ops/communications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: templateToPhone,
          templateName: customTemplateName,
          languageCode: customTemplateLang,
          bodyVariables: cleanVars,
          buttonUrlVariable: templateButtonUrlVar.trim() || undefined,
          trackerContext: {
            clientName: templateContactName || cleanVars[0] || "",
            parcelId: lookupTrackingQuery.trim() || cleanVars[2] || cleanVars[1] || "",
            messageType: "Manual Template",
          },
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTemplateSendFeedback({
          ok: true,
          text: `Template "${customTemplateName}" enviado com sucesso para ${templateToPhone}!`,
        })
        void refreshRecentActivityLogs()
      } else {
        const fallbackInfo = data?._smsFallback?.status === "sent"
          ? " (Fallback SMS ClickSend enviado automaticamente!)"
          : ""
        setTemplateSendFeedback({
          ok: false,
          text: `${data?.error?.message || data?.error || "Falha ao enviar template WhatsApp."}${fallbackInfo}`,
        })
        if (data?._smsFallback?.status === "sent") {
          void refreshRecentActivityLogs()
        }
      }
    } catch (err) {
      setTemplateSendFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao enviar template.",
      })
    } finally {
      setSendingTemplate(false)
    }
  }

  async function handleSendSms(e: React.FormEvent) {
    e.preventDefault()
    setSendingSms(true)
    setSmsFeedback(null)
    try {
      const res = await fetch("/api/ops/communications/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: smsPhone,
          message: smsMessage,
          contactName: smsContactName,
          trackingNumber: smsTracking,
        }),
      })
      const data = await res.json()
      if (res.ok && data?.ok) {
        setSmsFeedback({
          ok: true,
          text: `SMS enviado via ClickSend para ${data.to}!`,
        })
        setSmsMessage("")
        void refreshRecentActivityLogs()
      } else {
        setSmsFeedback({
          ok: false,
          text: data?.details || data?.error || "Falha ao enviar SMS via ClickSend.",
        })
      }
    } catch (err) {
      setSmsFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao enviar SMS.",
      })
    } finally {
      setSendingSms(false)
    }
  }

  const filteredRecentWaLogs = React.useMemo(() => {
    const q = recentWaSearch.trim().toLowerCase()
    if (!q) return recentWaLogs.slice(0, PAGE_SIZE)
    return recentWaLogs
      .filter((r) =>
        [r.to_number, r.contact_name, r.tracking_number, r.template_name, r.message_text]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, PAGE_SIZE)
  }, [recentWaLogs, recentWaSearch])

  const filteredRecentSmsLogs = React.useMemo(() => {
    const q = recentSmsSearch.trim().toLowerCase()
    if (!q) return recentSmsLogs.slice(0, PAGE_SIZE)
    return recentSmsLogs
      .filter((r) =>
        [r.to_number, r.contact_name, r.tracking_number, r.message_text]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, PAGE_SIZE)
  }, [recentSmsLogs, recentSmsSearch])

  const duplicateWaMatch = React.useMemo(() => {
    const phoneDigits = templateToPhone.replace(/\D/g, "").slice(-9)
    const trkCandidate = (
      lookupTrackingQuery.trim() ||
      templateVars[2]?.trim() ||
      templateVars[1]?.trim() ||
      ""
    ).toUpperCase()
    if (phoneDigits.length < 9 && trkCandidate.length < 5) return null

    return (
      recentWaLogs.find((r) => {
        const logDigits = String(r.to_number || "").replace(/\D/g, "").slice(-9)
        const logTrk = String(r.tracking_number || "").trim().toUpperCase()
        const matchPhone = phoneDigits.length === 9 && logDigits === phoneDigits
        const matchTrk =
          trkCandidate.length >= 5 &&
          (logTrk === trkCandidate ||
            String(r.message_text || "").toUpperCase().includes(trkCandidate))
        return matchPhone || matchTrk
      }) || null
    )
  }, [recentWaLogs, templateToPhone, lookupTrackingQuery, templateVars])

  const duplicateSmsMatch = React.useMemo(() => {
    const phoneDigits = smsPhone.replace(/\D/g, "").slice(-9)
    const trkCandidate = smsTracking.trim().toUpperCase()
    if (phoneDigits.length < 9 && trkCandidate.length < 5) return null

    return (
      recentSmsLogs.find((r) => {
        const logDigits = String(r.to_number || "").replace(/\D/g, "").slice(-9)
        const logTrk = String(r.tracking_number || "").trim().toUpperCase()
        const matchPhone = phoneDigits.length === 9 && logDigits === phoneDigits
        const matchTrk =
          trkCandidate.length >= 5 &&
          (logTrk === trkCandidate ||
            String(r.message_text || "").toUpperCase().includes(trkCandidate))
        return matchPhone || matchTrk
      }) || null
    )
  }, [recentSmsLogs, smsPhone, smsTracking])

  const previewRenderedText = React.useMemo(() => {
    if (!selectedBodyText) return ""
    return selectedBodyText.replace(/{{\s*(\d+)\s*}}/g, (_m, idxStr) => {
      const idx = Number(idxStr) - 1
      return templateVars[idx]?.trim() ? `[${templateVars[idx].trim()}]` : `{{${idxStr}}}`
    })
  }, [selectedBodyText, templateVars])

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Comunicações — WhatsApp &amp; SMS
              </h1>
              <p className="text-sm text-slate-500">
                Auto-notificações de envios (Scraping HTML Legacy TMS + TMS Linke Nativo), preenchimento de templates Meta, SMS ClickSend e histórico.
              </p>
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
              config?.statusSummary?.whatsappConfigured
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                : "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                config?.statusSummary?.whatsappConfigured ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            WhatsApp Cloud API
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
              config?.statusSummary?.clicksendConfigured
                ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20"
                : "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                config?.statusSummary?.clicksendConfigured ? "bg-blue-500" : "bg-amber-500"
              }`}
            />
            ClickSend SMS
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
              config?.statusSummary?.legacyTmsConfigured
                ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-300"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                config?.statusSummary?.legacyTmsConfigured ? "bg-indigo-500" : "bg-slate-400"
              }`}
            />
            Scraping Legacy TMS
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: "auto", label: "Auto-Notificações", icon: Play },
          { id: "shipments", label: "Envios & PUDO", icon: Package },
          { id: "templates", label: "Preencher Templates", icon: Send },
          { id: "sms", label: "SMS (ClickSend)", icon: Smartphone },
          { id: "history", label: "Histórico de Mensagens", icon: History },
          { id: "settings", label: "Fontes & Credenciais", icon: Settings2 },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                const nextTab = tab.id as TabId
                setActiveTab(nextTab)
                if (nextTab === "shipments" && shipmentRows.length === 0 && !loadingShipments) {
                  void fetchShipmentsByCategory()
                }
                if (nextTab === "templates") {
                  if (templates.length === 0 && !loadingTemplates) {
                    void fetchTemplates()
                  }
                  if (recentWaLogs.length === 0 && !loadingRecentLogs) {
                    void refreshRecentActivityLogs()
                  }
                }
                if (nextTab === "sms") {
                  if (recentSmsLogs.length === 0 && !loadingRecentLogs) {
                    void refreshRecentActivityLogs()
                  }
                }
                if (nextTab === "history" && logs.length === 0 && !loadingLogs) {
                  void fetchLogs()
                }
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* TAB 1B: INTERACTIVE SHIPMENTS & PUDO 1-CLICK TABLES */}
      {activeTab === "shipments" && (
        <div className="space-y-5">
          {/* Category Sub-Tabs */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                {
                  id: "em_distribuicao" as ShipmentListCategory,
                  label: "Em Distribuição",
                  icon: Truck,
                  badge: "notificacao_de_envio",
                },
                {
                  id: "em_transporte" as ShipmentListCategory,
                  label: "Em Transporte",
                  icon: Package,
                  badge: "em_transporte",
                },
                {
                  id: "incidencia" as ShipmentListCategory,
                  label: "Incidências",
                  icon: AlertTriangle,
                  badge: "incidencia",
                },
                {
                  id: "entregue" as ShipmentListCategory,
                  label: "Entregues (Feedback)",
                  icon: CheckCircle2,
                  badge: "feedback",
                },
                {
                  id: "pudo" as ShipmentListCategory,
                  label: "Ponto Pickup (PUDO)",
                  icon: MapPin,
                  badge: "order_pick_up_1",
                },
              ].map((cat) => {
                const Icon = cat.icon
                const isSelected = shipmentCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setShipmentCategory(cat.id)
                      void fetchShipmentsByCategory(cat.id)
                    }}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{cat.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Source Mode Switcher */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "both", label: "Ambos", icon: Layers },
                { id: "legacy_tms", label: "Scraping Legacy", icon: Globe },
                { id: "tms_linke", label: "TMS Linke Nativo", icon: Database },
              ].map((opt) => {
                const Icon = opt.icon
                const active = sourceMode === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSourceMode(opt.id as NotificationSourceMode)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Filters & KPI Bar */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-12">
              <div className="relative md:col-span-4">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={shipmentsSearch}
                  onChange={(e) => setShipmentsSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void fetchShipmentsByCategory()}
                  placeholder="Filtrar por guia, destinatário, telefone, loja ou motivo..."
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 md:col-span-4">
                <div className="flex-1">
                  <input
                    type="date"
                    aria-label="Data inicial"
                    value={shipmentsDateFrom}
                    onChange={(e) => setShipmentsDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <span className="text-xs text-slate-400">até</span>
                <div className="flex-1">
                  <input
                    type="date"
                    aria-label="Data final"
                    value={shipmentsDateTo}
                    onChange={(e) => setShipmentsDateTo(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 md:col-span-4">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={onlyOverdue24h}
                    onChange={(e) => setOnlyOverdue24h(e.target.checked)}
                  />
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  Apenas &gt; 24h
                </label>

                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={hideAlreadyNotified}
                    onChange={(e) => setHideAlreadyNotified(e.target.checked)}
                  />
                  Ocultar já notificados
                </label>

                <button
                  type="button"
                  onClick={() => void fetchShipmentsByCategory()}
                  disabled={loadingShipments}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingShipments ? "animate-spin" : ""}`} />
                  {loadingShipments ? "A carregar..." : "Atualizar Lista"}
                </button>
              </div>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-5">
              <div className="rounded-lg bg-slate-50 p-2.5">
                <div className="text-[11px] text-slate-500">Total Carregados</div>
                <div className="text-base font-bold text-slate-900">{shipmentsSummaryStats.total}</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-2.5">
                <div className="text-[11px] text-amber-800">Por Notificar (Pendentes)</div>
                <div className="text-base font-bold text-amber-900">{shipmentsSummaryStats.pending}</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2.5">
                <div className="text-[11px] text-emerald-700">Já Notificados ✓</div>
                <div className="text-base font-bold text-emerald-900">{shipmentsSummaryStats.notified}</div>
              </div>
              <div className="rounded-lg bg-rose-50 p-2.5">
                <div className="text-[11px] text-rose-700">Em Espera &gt; 24h</div>
                <div className="text-base font-bold text-rose-900">{shipmentsSummaryStats.overdue}</div>
              </div>
              <div className="rounded-lg bg-indigo-50 p-2.5">
                <div className="text-[11px] text-indigo-700">Fontes (Linke / Legacy)</div>
                <div className="text-sm font-bold text-indigo-900">
                  {shipmentsCounts.tms_linke} Nativo · {shipmentsCounts.legacy_tms} Legacy
                </div>
              </div>
            </div>

            {shipmentsWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 space-y-1">
                {shipmentsWarnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {shipmentsBanner && (
              <div
                className={`rounded-lg p-3 text-xs font-medium ${
                  shipmentsBanner.ok
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {shipmentsBanner.text}
              </div>
            )}

            {/* Responsive Sticky Data Table */}
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="shipments-oneclick-caption"
              className="max-h-[560px] max-w-full overflow-auto rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
                <caption id="shipments-oneclick-caption" className="sr-only">
                  Lista interativa de envios por estado para verificação e notificação WhatsApp e SMS
                </caption>
                <thead className="sticky top-0 z-10 bg-slate-100 font-semibold text-slate-700 shadow-xs">
                  <tr>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                      Guia / Tracking
                    </th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                      Origem
                    </th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                      Destinatário &amp; Telefone
                    </th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                      Remetente / Loja
                    </th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                      Datas
                    </th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                      Detalhe / Motivo
                    </th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2.5">
                      Estado Notificação
                    </th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2.5 text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedShipmentRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                        {loadingShipments
                          ? "A sincronizar envios do TMS Linke e Legacy TMS..."
                          : "Nenhum envio encontrado para este estado/filtro."}
                      </td>
                    </tr>
                  ) : (
                    paginatedShipmentRows.map((row, idx) => {
                      const rowKey = row.providerTrackingCode || row.parcelId || `row-${idx}`
                      return (
                        <tr key={`${rowKey}-${idx}`} className="hover:bg-slate-50/80">
                          <th
                            scope="row"
                            className="sticky left-0 z-1 border-b border-slate-100 bg-white px-3 py-2.5 font-mono font-semibold text-slate-900"
                          >
                            <div>{row.providerTrackingCode || row.parcelId}</div>
                            {row.parcelId && row.providerTrackingCode && row.parcelId !== row.providerTrackingCode && (
                              <div className="text-[10px] font-normal text-slate-400">
                                ID: {row.parcelId}
                              </div>
                            )}
                          </th>
                          <td className="border-b border-slate-100 px-3 py-2.5">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                                row.sourceSystem === "tms_linke"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-indigo-100 text-indigo-800"
                              }`}
                            >
                              {row.sourceSystem === "tms_linke" ? "TMS Linke" : "Legacy TMS"}
                            </span>
                            {row.service ? (
                              <div className="mt-0.5 text-[10px] text-slate-500">{row.service}</div>
                            ) : null}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2.5">
                            <div className="font-medium text-slate-900">{row.recipient || "—"}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {row.finalClientPhone || "Sem telefone"}
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2.5 text-slate-700">
                            {row.sender || "Linke"}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2.5 whitespace-nowrap text-slate-600">
                            <div>Rec: {row.pickupDate || "—"}</div>
                            <div className="text-[11px] text-slate-400">Atu: {row.deliveryDate || "—"}</div>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2.5 max-w-xs">
                            <div className="truncate text-slate-700" title={row.incidentReason || row.incidence || row.status}>
                              {row.incidentReason || row.incidence || row.status || "—"}
                            </div>
                            {row.overdue24h && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                                <Clock className="h-2.5 w-2.5" />
                                &gt; 24h
                              </span>
                            )}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2.5">
                            {row.alreadyNotified ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Notificado ✓
                                </span>
                                {row.notifiedTemplate && (
                                  <div className="font-mono text-[10px] text-slate-400">
                                    {row.notifiedTemplate}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-600/20">
                                Pendente
                              </span>
                            )}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={!row.finalClientPhone}
                                onClick={() => handlePrefillTemplateFromRow(row)}
                                title="Abrir no editor para verificar os dados e enviar por WhatsApp"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 shadow-2xs cursor-pointer"
                              >
                                <Send className="h-3 w-3" />
                                Verificar &amp; Enviar
                              </button>

                              <button
                                type="button"
                                disabled={!row.finalClientPhone}
                                onClick={() => handlePrefillSmsFromRow(row)}
                                title="Abrir no editor para verificar e enviar SMS"
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 cursor-pointer"
                              >
                                <Smartphone className="h-3 w-3" />
                                SMS
                              </button>

                              {shipmentCategory === "pudo" && (
                                <button
                                  type="button"
                                  onClick={() => void handleTogglePudoNotified(row)}
                                  title="Marcar / desmarcar manualmente como avisado no Ponto Pickup"
                                  className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                  {row.alreadyNotified ? "Desmarcar" : "Marcar ✓"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Shipments Pagination Footer (75 per page) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-600">
              <div>
                Página <strong>{Math.min(shipmentsPage, shipmentsTotalPages)}</strong> de{" "}
                <strong>{shipmentsTotalPages}</strong> · A mostrar{" "}
                <strong>{paginatedShipmentRows.length}</strong> de{" "}
                <strong>{displayedShipmentRows.length}</strong> envios (máx. {PAGE_SIZE} por página)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={shipmentsPage <= 1}
                  onClick={() => setShipmentsPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Página Anterior
                </button>
                <button
                  type="button"
                  disabled={shipmentsPage >= shipmentsTotalPages}
                  onClick={() => setShipmentsPage((p) => Math.min(shipmentsTotalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Página Seguinte
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: AUTO-NOTIFICATIONS */}
      {activeTab === "auto" && (
        <div className="space-y-6">
          {/* Dual-Source Selector Bar */}
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Fonte de Dados das Auto-Notificações (Modo Híbrido)
              </h2>
              <p className="text-xs text-slate-500">
                Lê em simultâneo o scraping HTML do TMS antigo e a tabela nativa <code>shipments</code> do TMS Linke, com desduplicação automática por guia/dia.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "both", label: "Ambos (Scraping HTML + TMS Linke)", icon: Layers },
                { id: "legacy_tms", label: "Apenas Scraping HTML (TMS Antigo)", icon: Globe },
                { id: "tms_linke", label: "Apenas TMS Linke Nativo", icon: Database },
              ].map((opt) => {
                const Icon = opt.icon
                const active = sourceMode === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSourceMode(opt.id as NotificationSourceMode)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3 Auto-Notification Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                type: "em_distribuicao" as AutoNotificationType,
                title: "1. Envios em Distribuição",
                subtitle: "Status 4 (Legacy TMS) + em_distribuicao (TMS Linke)",
                template: config?.autoEnvioTemplate || "notificacao_de_envio",
                varsDesc: "{{1}} Destinatário · {{2}} Remetente · {{3}} Tracking",
                schedule: `Seg–Sex às ${String(config?.autoEnvioHour ?? 9).padStart(2, "0")}:${String(
                  config?.autoEnvioMinute ?? 30
                ).padStart(2, "0")}`,
              },
              {
                type: "em_transporte" as AutoNotificationType,
                title: "2. Envios em Transporte",
                subtitle: "Status 3 (Legacy TMS) + entrada_rede (TMS Linke)",
                template: config?.autoTransporteTemplate || "notificacao_de_envio_em_transporte",
                varsDesc: "{{1}} Destinatário · {{2}} Remetente · {{3}} Tracking (ignora Ilhas por defeito)",
                schedule: `Seg–Sex às ${String(config?.autoTransporteHour ?? 10).padStart(2, "0")}:${String(
                  config?.autoTransporteMinute ?? 0
                ).padStart(2, "0")}`,
              },
              {
                type: "incidencia" as AutoNotificationType,
                title: "3. Envios em Incidência",
                subtitle: "Status 9 (Legacy TMS) + incidencia (TMS Linke)",
                template: config?.autoIncidenciaTemplate || "notificacao_auto_incidencia",
                varsDesc: "{{1}} Destinatário · {{2}} Nº Guia · {{3}} Loja/Remetente + Fallback SMS",
                schedule: "Seg–Sex (14:30 – 19:00)",
              },
            ].map((card) => {
              const isSimulating = runningAutoType === `${card.type}:dry`
              const isExecuting = runningAutoType === `${card.type}:live`
              return (
                <div
                  key={card.type}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {card.schedule}
                      </span>
                      <span className="font-mono text-xs text-emerald-700">{card.template}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{card.title}</h3>
                    <p className="text-xs text-slate-500">{card.subtitle}</p>
                    <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{card.varsDesc}</p>
                  </div>

                  <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={Boolean(runningAutoType)}
                      onClick={() => handleRunAutoNotification(card.type, true)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {isSimulating ? "A simular..." : "Simular (Dry-Run)"}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(runningAutoType)}
                      onClick={() => handleRunAutoNotification(card.type, false)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {isExecuting ? "A enviar..." : "Disparar Agora"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {autoError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {autoError}
            </div>
          )}

          {/* Simulation / Execution Result Panel */}
          {autoResult && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                      autoResult.dryRun
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {autoResult.dryRun ? "SIMULAÇÃO (DRY-RUN — NADA ENVIADO)" : "EXECUÇÃO REAL CONCLUÍDA"}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Resultado: {autoResult.type} ({autoResult.templateName})
                  </h3>
                </div>
                <div className="text-xs text-slate-500">
                  TMS Linke Nativo: <strong>{autoResult.countsBySource.tms_linke}</strong> · Legacy TMS Scraping:{" "}
                  <strong>{autoResult.countsBySource.legacy_tms}</strong> · Total Desduplicado:{" "}
                  <strong>{autoResult.countsBySource.combinedDeduped}</strong>
                </div>
              </div>

              {autoResult.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                  {autoResult.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Guias Lidas</div>
                  <div className="text-lg font-bold text-slate-900">{autoResult.fetchedRows}</div>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-700">
                    {autoResult.dryRun ? "Elegíveis p/ Enviar" : "Enviadas (OK)"}
                  </div>
                  <div className="text-lg font-bold text-emerald-900">
                    {autoResult.dryRun ? autoResult.eligibleToSend : autoResult.sent}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Já Enviadas Hoje</div>
                  <div className="text-lg font-bold text-slate-900">{autoResult.skippedAlreadySent}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Sem Telefone</div>
                  <div className="text-lg font-bold text-slate-900">{autoResult.skippedMissingPhone}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Ignoradas Ilhas</div>
                  <div className="text-lg font-bold text-slate-900">{autoResult.skippedIlhas}</div>
                </div>
                <div className="rounded-lg bg-red-50 p-3">
                  <div className="text-xs text-red-700">Falhas</div>
                  <div className="text-lg font-bold text-red-900">{autoResult.failed}</div>
                </div>
              </div>

              {autoResult.previewItems.length > 0 && (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-50 font-semibold text-slate-700">
                        <tr>
                          <th className="px-3 py-2">Origem</th>
                          <th className="px-3 py-2">Guia / Tracking</th>
                          <th className="px-3 py-2">Destinatário</th>
                          <th className="px-3 py-2">Telefone (E.164)</th>
                          <th className="px-3 py-2">Remetente</th>
                          <th className="px-3 py-2">Variáveis do Template</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedAutoPreviewItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                                  item.sourceSystem === "tms_linke"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-indigo-100 text-indigo-800"
                                }`}
                              >
                                {item.sourceSystem === "tms_linke" ? "TMS Linke" : "Legacy TMS"}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono font-medium text-slate-900">
                              {item.providerTrackingCode || item.parcelId}
                            </td>
                            <td className="px-3 py-2 text-slate-700">{item.recipient}</td>
                            <td className="px-3 py-2 font-mono text-slate-700">{item.phone}</td>
                            <td className="px-3 py-2 text-slate-600">{item.sender}</td>
                            <td className="px-3 py-2 text-slate-600">
                              {item.bodyVariables.map((v, i) => `{{${i + 1}}}=${v}`).join(" | ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Auto-Notification Preview Pagination Footer (75 per page) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-600">
                    <div>
                      Página <strong>{Math.min(autoPreviewPage, autoPreviewTotalPages)}</strong> de{" "}
                      <strong>{autoPreviewTotalPages}</strong> · A mostrar{" "}
                      <strong>{paginatedAutoPreviewItems.length}</strong> de{" "}
                      <strong>{autoResult.previewItems.length}</strong> envios pré-visualizados (máx.{" "}
                      {PAGE_SIZE} por página)
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={autoPreviewPage <= 1}
                        onClick={() => setAutoPreviewPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Página Anterior
                      </button>
                      <button
                        type="button"
                        disabled={autoPreviewPage >= autoPreviewTotalPages}
                        onClick={() =>
                          setAutoPreviewPage((p) => Math.min(autoPreviewTotalPages, p + 1))
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Página Seguinte
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FILL & SEND TEMPLATES */}
      {activeTab === "templates" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Preencher &amp; Enviar Template WhatsApp
                </h2>
                <p className="text-xs text-slate-500">
                  Pesquise uma guia para preencher automaticamente ou selecione qualquer template aprovado na Meta.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchTemplates}
                disabled={loadingTemplates}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingTemplates ? "animate-spin" : ""}`} />
                Recarregar da Meta ({templates.length})
              </button>
            </div>

            {/* Auto-fill from Shipment Tracking */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Auto-Preencher a partir de Nº de Guia / Tracking (TMS Linke)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={lookupTrackingQuery}
                  onChange={(e) => setLookupTrackingQuery(e.target.value)}
                  placeholder="Ex.: LTK1044182 ou DA123456789PT..."
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleLookupShipmentForTemplate}
                  disabled={lookingUpShipment || !lookupTrackingQuery.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Search className="h-3.5 w-3.5" />
                  {lookingUpShipment ? "A procurar..." : "Preencher Dados"}
                </button>
              </div>
            </div>

            {templatesError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {templatesError} — Pode ainda escrever o nome do template manualmente abaixo.
              </div>
            )}

            {duplicateWaMatch && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 shadow-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-900">
                    Aviso de Prevenção de Duplicados (WhatsApp):
                  </div>
                  <div>
                    Já foi enviada uma mensagem para este telemóvel/guia em{" "}
                    <strong>{new Date(duplicateWaMatch.created_at).toLocaleString("pt-PT")}</strong>
                    {duplicateWaMatch.template_name ? ` (Template: ${duplicateWaMatch.template_name})` : ""}
                    {duplicateWaMatch.status ? ` — Estado: ${duplicateWaMatch.status}` : ""}.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSendTemplate} className="space-y-4">
              {templates.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selecionar Template Aprovado na Meta ({templates.length})
                  </label>
                  <select
                    value={
                      templates.some((t) => `${t.name}::${t.language}` === selectedTemplateKey)
                        ? selectedTemplateKey
                        : templates.some((t) => t.name === customTemplateName)
                        ? `${customTemplateName}::${templates.find((t) => t.name === customTemplateName)?.language}`
                        : selectedTemplateKey
                    }
                    onChange={(e) => {
                      const val = e.target.value
                      setSelectedTemplateKey(val)
                      selectedTemplateKeyRef.current = val
                      const [name, lang] = val.split("::")
                      if (name) {
                        setCustomTemplateName(name)
                        customTemplateNameRef.current = name
                      }
                      if (lang) setCustomTemplateLang(lang)
                      if (name === "order_pick_no_ctt") {
                        setTemplateVars((prev) => {
                          const v1 = prev[0] || templateContactName || ""
                          const trkVal = lookupTrackingQuery || (prev[1] && !prev[1].toLowerCase().includes("linke") ? prev[1] : prev[2]) || ""
                          const manualInput = prev[2] && prev[2] !== trkVal ? prev[2] : ""
                          return [v1, trkVal, manualInput, "."]
                        })
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {templates.map((tpl) => (
                      <option key={`${tpl.name}::${tpl.language}`} value={`${tpl.name}::${tpl.language}`}>
                        {tpl.name} ({tpl.language}) — {tpl.status}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Nome do Template (Meta)
                    </label>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      <Lock className="h-2.5 w-2.5 text-slate-400" /> Não editável (Aprovado na Meta)
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={customTemplateName}
                    placeholder="notificacao_de_envio"
                    className="w-full rounded-lg border border-slate-200 bg-slate-100/90 px-3 py-2 font-mono text-sm text-slate-700 cursor-not-allowed select-none"
                    title="O nome do template é fixo e definido pela aprovação na Meta. Selecione o template acima."
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Idioma</label>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      <Lock className="h-2.5 w-2.5 text-slate-400" /> Fixo
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={customTemplateLang}
                    placeholder="pt_PT"
                    className="w-full rounded-lg border border-slate-200 bg-slate-100/90 px-3 py-2 font-mono text-sm text-slate-700 cursor-not-allowed select-none"
                    title="O idioma do template é fixo e gerido pela Meta."
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone do Destinatário *
                  </label>
                  <input
                    type="text"
                    required
                    value={templateToPhone}
                    onChange={(e) => setTemplateToPhone(e.target.value)}
                    placeholder="Ex.: 912345678 ou 351912345678"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do Contacto (Registo Histórico)
                  </label>
                  <input
                    type="text"
                    value={templateContactName}
                    onChange={(e) => setTemplateContactName(e.target.value)}
                    placeholder="Nome do cliente / destinatário"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Variáveis do Corpo da Mensagem (Body Parameters)
                </label>
                <div className={`grid gap-3 ${detectedVarCount >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
                  {Array.from({ length: detectedVarCount }).map((_, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-slate-600">
                          Variável {`{{${idx + 1}}}`}
                        </label>
                        {customTemplateName === "order_pick_no_ctt" && (
                          <span className="text-[10px] font-semibold text-emerald-700">
                            {idx === 0
                              ? "Nome"
                              : idx === 1
                              ? "Tracking"
                              : idx === 2
                              ? "Local (Manual)"
                              : "Ponto Final"}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={templateVars[idx] ?? (customTemplateName === "order_pick_no_ctt" && idx === 3 ? "." : "")}
                        onChange={(e) => {
                          const next = [...templateVars]
                          next[idx] = e.target.value
                          setTemplateVars(next)
                        }}
                        placeholder={
                          customTemplateName === "order_pick_no_ctt"
                            ? idx === 0
                              ? "Nome Destinatário"
                              : idx === 1
                              ? "Ex.: Tracking"
                              : idx === 2
                              ? "Ex.: Ponto CTT / Morada..."
                              : "."
                            : idx === 0
                            ? "Ex.: Nome Destinatário"
                            : idx === 1
                            ? "Ex.: Loja / Guia"
                            : "Ex.: Tracking"
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm ${
                          customTemplateName === "order_pick_no_ctt" && idx === 2 && !templateVars[2]
                            ? "border-amber-400 bg-amber-50/40 focus:border-emerald-500 focus:bg-white"
                            : "border-slate-300"
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {showButtonUrlInput && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Variável de Botão URL (Opcional)
                  </label>
                  <input
                    type="text"
                    value={templateButtonUrlVar}
                    onChange={(e) => setTemplateButtonUrlVar(e.target.value)}
                    placeholder="Sufixo dinâmico do botão URL (se o template tiver botão dinâmico)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              {templateSendFeedback && (
                <div
                  className={`rounded-lg p-3 text-xs font-medium ${
                    templateSendFeedback.ok
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {templateSendFeedback.text}
                </div>
              )}

              <button
                type="submit"
                disabled={sendingTemplate}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sendingTemplate ? "A enviar WhatsApp..." : "Enviar Template WhatsApp"}
              </button>
            </form>
          </div>

          {/* Live Preview Card */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Pré-visualização da Mensagem</h3>
            <div className="rounded-xl bg-[#e5ddd5] p-4 shadow-inner">
              <div className="rounded-lg bg-white p-3.5 text-xs leading-relaxed text-slate-800 shadow-sm whitespace-pre-wrap">
                {previewRenderedText ||
                  `Template: ${customTemplateName}\n` +
                    templateVars
                      .map((v, i) => (v.trim() ? `{{${i + 1}}}: ${v.trim()}` : null))
                      .filter(Boolean)
                      .join("\n")}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">Atalhos de Templates Usados:</div>
              <div>
                • <code>notificacao_de_envio</code> (Em Distribuição)
              </div>
              <div>
                • <code>notificacao_de_envio_em_transporte</code> (Em Transporte)
              </div>
              <div>
                • <code>notificacao_auto_incidencia</code> (Incidência)
              </div>
              <div>
                • <code>order_pick_up_1</code> (Ponto Pickup)
              </div>
            </div>
          </div>

          {/* Recent WhatsApp Messages Table (Duplication Prevention) */}
          <div className="lg:col-span-3 space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  Últimas Mensagens WhatsApp Enviadas (Controlo de Duplicados)
                </h3>
                <p className="text-xs text-slate-500">
                  Consulta rápida em tempo real para verificar se um cliente ou guia já foi contactado antes de disparar.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={recentWaSearch}
                    onChange={(e) => setRecentWaSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void fetchRecentWaLogs(1)}
                    placeholder="Filtrar telefone, guia..."
                    className="w-48 rounded-lg border border-slate-300 pl-8 pr-2.5 py-1 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void fetchRecentWaLogs(1)}
                  disabled={loadingRecentLogs}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingRecentLogs ? "animate-spin" : ""}`} />
                  Atualizar
                </button>
              </div>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby="recent-wa-logs-caption"
              className="max-h-96 overflow-auto rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
                <caption id="recent-wa-logs-caption" className="sr-only">
                  Últimas mensagens WhatsApp enviadas para controlo de duplicação
                </caption>
                <thead className="sticky top-0 z-1 bg-slate-100 font-semibold text-slate-700 shadow-xs">
                  <tr>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2">Data / Hora</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2">Telefone</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2">Destinatário</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2">Nº Guia</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2">Template / Mensagem</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2">Estado</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRecentWaLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                        {loadingRecentLogs ? "A carregar registos..." : "Nenhuma mensagem WhatsApp encontrada."}
                      </td>
                    </tr>
                  ) : (
                    filteredRecentWaLogs.map((row) => {
                      const st = String(row.status || "").toLowerCase()
                      const isOk = ["accepted", "sent", "delivered", "read"].includes(st)
                      return (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                            {new Date(row.created_at).toLocaleString("pt-PT")}
                          </td>
                          <td className="px-3 py-2 font-mono font-medium text-slate-900">{row.to_number}</td>
                          <td className="px-3 py-2 text-slate-700">{row.contact_name || "—"}</td>
                          <td className="px-3 py-2 font-mono text-slate-700">{row.tracking_number || "—"}</td>
                          <td className="max-w-xs truncate px-3 py-2 text-slate-600" title={row.message_text || ""}>
                            {row.template_name ? (
                              <span className="font-mono font-semibold text-slate-800">{row.template_name}: </span>
                            ) : null}
                            {row.message_text || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                isOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                              }`}
                            >
                              {isOk ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                              {row.status || "desconhecido"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setTemplateToPhone(row.to_number || "")
                                if (row.contact_name) setTemplateContactName(row.contact_name)
                                if (row.tracking_number) setLookupTrackingQuery(row.tracking_number)
                              }}
                              className="rounded px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            >
                              Carregar
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Recent WhatsApp Pagination Footer (75 per page) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-600">
              <div>
                Página <strong>{recentWaPage}</strong> de <strong>{recentWaTotalPages}</strong> · A mostrar{" "}
                <strong>{filteredRecentWaLogs.length}</strong> de <strong>{recentWaTotal}</strong> mensagens WhatsApp
                (máx. {PAGE_SIZE} por página)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingRecentLogs || recentWaPage <= 1}
                  onClick={() => void fetchRecentWaLogs(recentWaPage - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Página Anterior
                </button>
                <button
                  type="button"
                  disabled={loadingRecentLogs || (!recentWaHasMore && recentWaPage >= recentWaTotalPages)}
                  onClick={() => void fetchRecentWaLogs(recentWaPage + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Página Seguinte
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SMS CLICKSEND */}
      {activeTab === "sms" && (
        <div className="space-y-6">
          <div className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Enviar SMS via ClickSend</h2>
              <p className="text-xs text-slate-500">
                Envio direto de SMS e serviço de fallback automático quando um template WhatsApp falha.
              </p>
            </div>

            {duplicateSmsMatch && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 shadow-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-900">
                    Aviso de Prevenção de Duplicados (SMS):
                  </div>
                  <div>
                    Já foi enviado um SMS para este contacto/guia em{" "}
                    <strong>{new Date(duplicateSmsMatch.created_at).toLocaleString("pt-PT")}</strong>
                    {duplicateSmsMatch.status ? ` — Estado: ${duplicateSmsMatch.status}` : ""}.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSendSms} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telemóvel Destinatário *
                  </label>
                  <input
                    type="text"
                    required
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    placeholder="912345678 ou 351912345678"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do Destinatário
                  </label>
                  <input
                    type="text"
                    value={smsContactName}
                    onChange={(e) => setSmsContactName(e.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nº de Guia / Tracking
                  </label>
                  <input
                    type="text"
                    value={smsTracking}
                    onChange={(e) => setSmsTracking(e.target.value)}
                    placeholder="Opcional"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Mensagem SMS *</label>
                  <span className="text-[11px] text-slate-400">{smsMessage.length} caracteres</span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="Escreva a mensagem SMS a enviar ao destinatário..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {smsFeedback && (
                <div
                  className={`rounded-lg p-3 text-xs font-medium ${
                    smsFeedback.ok
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {smsFeedback.text}
                </div>
              )}

              <button
                type="submit"
                disabled={sendingSms}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Smartphone className="h-4 w-4" />
                {sendingSms ? "A enviar SMS..." : "Enviar SMS ClickSend"}
              </button>
            </form>
          </div>

          {/* Recent SMS Messages Table (Duplication Prevention) */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-blue-600" />
                  Últimos SMS Enviados via ClickSend (Controlo de Duplicados)
                </h3>
                <p className="text-xs text-slate-500">
                  Histórico recente de SMS enviados diretamente ou por fallback automático.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={recentSmsSearch}
                    onChange={(e) => setRecentSmsSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void fetchRecentSmsLogs(1)}
                    placeholder="Filtrar telemóvel, guia..."
                    className="w-48 rounded-lg border border-slate-300 pl-8 pr-2.5 py-1 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void fetchRecentSmsLogs(1)}
                  disabled={loadingRecentLogs}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingRecentLogs ? "animate-spin" : ""}`} />
                  Atualizar
                </button>
              </div>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby="recent-sms-logs-caption"
              className="max-h-96 overflow-auto rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
                <caption id="recent-sms-logs-caption" className="sr-only">
                  Últimos SMS enviados para controlo de duplicação
                </caption>
                <thead className="sticky top-0 z-1 bg-slate-100 font-semibold text-slate-700 shadow-xs">
                  <tr>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2">Data / Hora</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2">Telemóvel</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2">Destinatário</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2">Nº Guia</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2">Mensagem SMS</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2">Estado</th>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRecentSmsLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                        {loadingRecentLogs ? "A carregar registos..." : "Nenhum SMS recente encontrado."}
                      </td>
                    </tr>
                  ) : (
                    filteredRecentSmsLogs.map((row) => {
                      const st = String(row.status || "").toLowerCase()
                      const isOk = ["accepted", "sent", "delivered", "read"].includes(st)
                      return (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                            {new Date(row.created_at).toLocaleString("pt-PT")}
                          </td>
                          <td className="px-3 py-2 font-mono font-medium text-slate-900">{row.to_number}</td>
                          <td className="px-3 py-2 text-slate-700">{row.contact_name || "—"}</td>
                          <td className="px-3 py-2 font-mono text-slate-700">{row.tracking_number || "—"}</td>
                          <td className="max-w-md truncate px-3 py-2 text-slate-600" title={row.message_text || ""}>
                            {row.message_text || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                isOk ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
                              }`}
                            >
                              {isOk ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                              {row.status || "desconhecido"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSmsPhone(row.to_number || "")
                                if (row.contact_name) setSmsContactName(row.contact_name)
                                if (row.tracking_number) setSmsTracking(row.tracking_number)
                              }}
                              className="rounded px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            >
                              Carregar
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Recent SMS Pagination Footer (75 per page) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-600">
              <div>
                Página <strong>{recentSmsPage}</strong> de <strong>{recentSmsTotalPages}</strong> · A mostrar{" "}
                <strong>{filteredRecentSmsLogs.length}</strong> de <strong>{recentSmsTotal}</strong> SMS (máx.{" "}
                {PAGE_SIZE} por página)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingRecentLogs || recentSmsPage <= 1}
                  onClick={() => void fetchRecentSmsLogs(recentSmsPage - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Página Anterior
                </button>
                <button
                  type="button"
                  disabled={loadingRecentLogs || (!recentSmsHasMore && recentSmsPage >= recentSmsTotalPages)}
                  onClick={() => void fetchRecentSmsLogs(recentSmsPage + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Página Seguinte
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORY OF MESSAGES SENT */}
      {activeTab === "history" && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void fetchLogs(1)}
                  placeholder="Pesquisar por telemóvel, destinatário, template ou guia..."
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <select
                value={logsChannel}
                onChange={(e) => setLogsChannel(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Todos os Canais</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS (ClickSend)</option>
              </select>
              <button
                type="button"
                onClick={() => void fetchLogs(1)}
                disabled={loadingLogs}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
                Pesquisar
              </button>
            </div>
            <div className="text-xs text-slate-500">
              Página <strong>{logsPage}</strong> de <strong>{logsTotalPages}</strong> ·{" "}
              <strong>{logs.length}</strong> de <strong>{logsTotal}</strong> registos (máx. {PAGE_SIZE} por página)
            </div>
          </div>

          {logsWarning && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {logsWarning}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Data / Hora</th>
                  <th className="px-3 py-2.5">Canal</th>
                  <th className="px-3 py-2.5">Origem</th>
                  <th className="px-3 py-2.5">Telefone</th>
                  <th className="px-3 py-2.5">Destinatário</th>
                  <th className="px-3 py-2.5">Guia</th>
                  <th className="px-3 py-2.5">Template / Mensagem</th>
                  <th className="px-3 py-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      {loadingLogs ? "A carregar histórico..." : "Nenhuma mensagem registada para este filtro."}
                    </td>
                  </tr>
                ) : (
                  logs.map((row) => {
                    const isSms = row.channel === "sms"
                    const st = String(row.status || "").toLowerCase()
                    const isOk = ["accepted", "sent", "delivered", "read"].includes(st)
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                          {new Date(row.created_at).toLocaleString("pt-PT")}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              isSms ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isSms ? "SMS" : "WhatsApp"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{row.source_system || "manual"}</td>
                        <td className="px-3 py-2 font-mono font-medium text-slate-900">{row.to_number}</td>
                        <td className="px-3 py-2 text-slate-700">{row.contact_name || "—"}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{row.tracking_number || "—"}</td>
                        <td className="max-w-md truncate px-3 py-2 text-slate-600" title={row.message_text || ""}>
                          {row.template_name ? (
                            <span className="font-mono font-semibold text-slate-800">{row.template_name}: </span>
                          ) : null}
                          {row.message_text || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              isOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                            }`}
                          >
                            {isOk ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            {row.status || "unknown"}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* History Pagination Footer (75 per page) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-600">
            <div>
              Página <strong>{logsPage}</strong> de <strong>{logsTotalPages}</strong> · A mostrar{" "}
              <strong>{logs.length}</strong> de <strong>{logsTotal}</strong> registos (máx. {PAGE_SIZE} por página)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loadingLogs || logsPage <= 1}
                onClick={() => void fetchLogs(logsPage - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Página Anterior
              </button>
              <button
                type="button"
                disabled={loadingLogs || (!logsHasMore && logsPage >= logsTotalPages)}
                onClick={() => void fetchLogs(logsPage + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Página Seguinte
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS & CREDENTIALS */}
      {activeTab === "settings" && config && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  Fontes, Meta WhatsApp &amp; ClickSend (Apenas Leitura)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Credenciais protegidas contra edição direta. São carregadas de forma segura através do ambiente do servidor (<code>.env.local</code> / Vercel).
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                <Lock className="h-3.5 w-3.5 text-slate-500" />
                Bloqueado para Edição
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <Lock className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800">Campos protegidos contra alteração</p>
              <p className="mt-0.5 leading-relaxed text-slate-500">
                Por motivos de segurança e estabilidade operacional, os identificadores de WABA, tokens de acesso permanente da Meta, acessos do Legacy TMS e chaves ClickSend não podem ser alterados nesta interface.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Meta WhatsApp Cloud API */}
            <div className="space-y-3 rounded-lg border border-slate-200 p-4 bg-slate-50/40">
              <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>1. Meta WhatsApp Cloud API</span>
                <Lock className="h-3.5 w-3.5 text-slate-400" />
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number ID (WHATSAPP_PHONE_NUMBER_ID)
                </label>
                <input
                  type="text"
                  readOnly
                  value={config.whatsappPhoneNumberId}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-mono text-slate-700 cursor-not-allowed select-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  WABA Business Account ID (WHATSAPP_BUSINESS_ACCOUNT_ID)
                </label>
                <input
                  type="text"
                  readOnly
                  value={config.whatsappBusinessAccountId}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-mono text-slate-700 cursor-not-allowed select-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Permanent Access Token (WHATSAPP_ACCESS_TOKEN)
                </label>
                <input
                  type="password"
                  readOnly
                  value={config.whatsappAccessToken}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-mono text-slate-700 cursor-not-allowed select-none"
                />
              </div>
            </div>

            {/* Legacy TMS Scraping */}
            <div className="space-y-3 rounded-lg border border-slate-200 p-4 bg-slate-50/40">
              <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>2. Scraping HTML Legacy TMS</span>
                <Lock className="h-3.5 w-3.5 text-slate-400" />
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  URL Base do TMS Antigo (TMS_BASE_URL)
                </label>
                <input
                  type="text"
                  readOnly
                  value={config.legacyTmsBaseUrl}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 cursor-not-allowed select-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Admin TMS Antigo (TMS_ADMIN_EMAIL)
                </label>
                <input
                  type="text"
                  readOnly
                  value={config.legacyTmsAdminEmail}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 cursor-not-allowed select-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Password Admin TMS Antigo (TMS_ADMIN_PASSWORD)
                </label>
                <input
                  type="password"
                  readOnly
                  value={config.legacyTmsAdminPassword}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 cursor-not-allowed select-none"
                />
              </div>
            </div>

            {/* ClickSend SMS */}
            <div className="space-y-3 rounded-lg border border-slate-200 p-4 bg-slate-50/40">
              <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>3. ClickSend SMS &amp; Fallback</span>
                <Lock className="h-3.5 w-3.5 text-slate-400" />
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ClickSend Username (CLICKSEND_USERNAME)
                </label>
                <input
                  type="text"
                  readOnly
                  value={config.clicksendUsername}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 cursor-not-allowed select-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ClickSend API Key (CLICKSEND_API_KEY)
                </label>
                <input
                  type="password"
                  readOnly
                  value={config.clicksendApiKey}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-mono text-slate-700 cursor-not-allowed select-none"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 pt-1 cursor-not-allowed">
                <input
                  type="checkbox"
                  disabled
                  checked={config.autoSmsFallbackEnabled}
                  className="cursor-not-allowed opacity-75"
                />
                Fallback Automático de SMS quando o template WhatsApp falhar
              </label>
            </div>

            {/* Default Template Names */}
            <div className="space-y-3 rounded-lg border border-slate-200 p-4 bg-slate-50/40">
              <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>4. Templates das Auto-Notificações</span>
                <Lock className="h-3.5 w-3.5 text-slate-400" />
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Template Em Distribuição
                </label>
                <input
                  type="text"
                  readOnly
                  value={config.autoEnvioTemplate}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-mono text-slate-700 cursor-not-allowed select-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Template Em Transporte
                </label>
                <input
                  type="text"
                  readOnly
                  value={config.autoTransporteTemplate}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-mono text-slate-700 cursor-not-allowed select-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Template Incidência
                </label>
                <input
                  type="text"
                  readOnly
                  value={config.autoIncidenciaTemplate}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-mono text-slate-700 cursor-not-allowed select-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            <span>Configurações protegidas em modo apenas leitura. Gestão realizada através do servidor.</span>
          </div>
        </div>
      )}
    </div>
  )
}

