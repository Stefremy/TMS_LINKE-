"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ShoppingBag,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Edit,
  Zap,
  Globe,
  Store,
  Layers,
  ArrowRight,
  Package,
  Clock,
  Euro,
  Phone,
  MapPin,
  HelpCircle,
  Search,
  Check,
  Loader2,
  Copy,
  Info
} from "lucide-react"
import { useClientScope } from "@/app/app/components/ClientScope"
import {
  ClientEcommerceStore,
  SyncedOrder,
  EcommerceFulfillmentSyncRecord,
  PlatformType,
  getClientStoresAction,
  saveClientStoreAction,
  deleteClientStoreAction,
  testStoreConnectionAction,
  syncStoreOrdersAction,
  getClientSyncedOrdersAction,
  getClientFulfillmentSyncFailuresAction,
  retryClientFulfillmentSyncAction,
} from "@/app/actions/client-ecommerce"

const PLATFORMS: Array<{
  id: PlatformType
  name: string
  badge: string
  bgColor: string
  textColor: string
  borderColor: string
  iconColor: string
  description: string
  instructions: string
}> = [
  {
    id: "woocommerce",
    name: "WooCommerce",
    badge: "WordPress REST API v3",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
    iconColor: "#7F54B3",
    description: "Integração nativa com lojas WordPress através da WooCommerce REST API.",
    instructions: "No painel WordPress, aceda a: WooCommerce > Definições > Avançado > REST API > Adicionar Chave. Crie uma chave com permissão de 'Leitura/Escrita' e copie a Consumer Key e Consumer Secret."
  },
  {
    id: "shopify",
    name: "Shopify",
    badge: "Admin API",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    iconColor: "#95BF47",
    description: "Sincronização direta com a sua loja Shopify para recolha de encomendas pendentes.",
    instructions: "No painel Shopify, vá a: Definições > Apps e canais de vendas > Desenvolver apps > Criar uma app. Em 'Configuração da API Admin', selecione permissões de 'read_orders', 'write_orders', 'read_fulfillments' e 'write_fulfillments'. Instale a app e copie o Admin API Access Token (começa por shpat_)."
  },
  {
    id: "linke_store",
    name: "Linke Store",
    badge: "Linke Native",
    bgColor: "bg-slate-900",
    textColor: "text-white",
    borderColor: "border-slate-800",
    iconColor: "#10b981",
    description: "Conexão oficial com a plataforma Linke Store via conector WooCommerce compatível.",
    instructions: "No painel da sua Linke Store, aceda a: Conectores > API e gere um novo par de chaves Consumer Key (ck_...) e Consumer Secret (cs_...)."
  },
  {
    id: "prestashop",
    name: "PrestaShop",
    badge: "Webservice API",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    iconColor: "#2563eb",
    description: "Importação automática de pedidos através do webservice oficial PrestaShop.",
    instructions: "No backoffice PrestaShop, aceda a Parâmetros Avançados > Webservice, ative o webservice e crie uma nova chave com permissões em 'orders' e 'addresses'."
  }
]

export function ClientIntegrationsClient() {
  const { client, basePath } = useClientScope()
  const router = useRouter()

  const [activeTab, setActiveTab] = React.useState<"stores" | "orders" | "guide">("stores")
  const [stores, setStores] = React.useState<ClientEcommerceStore[]>([])
  const [orders, setOrders] = React.useState<SyncedOrder[]>([])
  const [syncFailures, setSyncFailures] = React.useState<EcommerceFulfillmentSyncRecord[]>([])
  const [retryingSyncKey, setRetryingSyncKey] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [syncingAll, setSyncingAll] = React.useState(false)
  const [syncingStoreId, setSyncingStoreId] = React.useState<string | null>(null)

  // Search filter for orders
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filterStoreId, setFilterStoreId] = React.useState<string>("all")

  // Modal State
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editingStore, setEditingStore] = React.useState<ClientEcommerceStore | null>(null)
  const [platform, setPlatform] = React.useState<PlatformType>("woocommerce")
  const [storeName, setStoreName] = React.useState("")
  const [storeUrl, setStoreUrl] = React.useState("")
  const [consumerKey, setConsumerKey] = React.useState("")
  const [consumerSecret, setConsumerSecret] = React.useState("")
  const [accessToken, setAccessToken] = React.useState("")
  const [apiKey, setApiKey] = React.useState("")
  const [autoFulfill, setAutoFulfill] = React.useState(true)

  // Testing feedback
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{
    success: boolean
    message: string
    latencyMs?: number
    details?: {
      storeName?: string
      environment?: string
      currency?: string
      email?: string
      domain?: string
      [key: string]: unknown
    }
  } | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [feedbackMsg, setFeedbackMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null)

  const refreshData = React.useCallback(async () => {
    try {
      setLoading(true)
      const [fetchedStores, fetchedOrders, fetchedFailures] = await Promise.all([
        getClientStoresAction(client.id),
        getClientSyncedOrdersAction(client.id),
        getClientFulfillmentSyncFailuresAction(client.id),
      ])
      setStores(fetchedStores)
      setOrders(fetchedOrders)
      setSyncFailures(fetchedFailures)
    } catch (err) {
      console.error("Erro ao carregar dados:", err)
    } finally {
      setLoading(false)
    }
  }, [client.id])

  React.useEffect(() => {
    let active = true
    Promise.all([
      getClientStoresAction(client.id),
      getClientSyncedOrdersAction(client.id),
      getClientFulfillmentSyncFailuresAction(client.id),
    ])
      .then(([fetchedStores, fetchedOrders, fetchedFailures]) => {
        if (!active) return
        setStores(fetchedStores)
        setOrders(fetchedOrders)
        setSyncFailures(fetchedFailures)
      })
      .catch((err) => {
        console.error("Erro ao carregar dados:", err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client.id])

  const handleRetrySyncFailure = async (syncKey: string) => {
    setRetryingSyncKey(syncKey)
    try {
      const res = await retryClientFulfillmentSyncAction(client.id, syncKey)
      if (res.success) {
        setFeedbackMsg({ type: "success", text: "Tracking reenviado para a loja com sucesso!" })
        await refreshData()
        setTimeout(() => setFeedbackMsg(null), 4000)
      } else {
        setFeedbackMsg({ type: "error", text: res.error || "Não foi possível reenviar o tracking." })
        await refreshData()
      }
    } catch (err: unknown) {
      setFeedbackMsg({ type: "error", text: err instanceof Error ? err.message : "Erro ao reenviar tracking." })
    } finally {
      setRetryingSyncKey(null)
    }
  }

  // Open modal for new store
  const handleOpenNewModal = (selectedPlatform: PlatformType = "woocommerce") => {
    setEditingStore(null)
    setPlatform(selectedPlatform)
    setStoreName(
      selectedPlatform === "shopify"
        ? "Loja Shopify"
        : selectedPlatform === "linke_store"
        ? "Linke Store Oficial"
        : selectedPlatform === "woocommerce"
        ? "Loja WooCommerce"
        : "Loja Online"
    )
    setStoreUrl(selectedPlatform === "linke_store" ? "https://linke-store-ten.vercel.app" : "")
    setConsumerKey("")
    setConsumerSecret("")
    setAccessToken("")
    setApiKey("")
    setAutoFulfill(true)
    setTestResult(null)
    setModalOpen(true)
  }

  // Open modal for editing store
  const handleOpenEditModal = (store: ClientEcommerceStore) => {
    setEditingStore(store)
    setPlatform(store.platform)
    setStoreName(store.name)
    setStoreUrl(store.store_url)
    setConsumerKey(store.credentials?.consumer_key || "")
    setConsumerSecret(store.credentials?.consumer_secret || "")
    setAccessToken(store.credentials?.access_token || "")
    setApiKey(store.credentials?.api_key || "")
    setAutoFulfill(store.auto_fulfill ?? true)
    setTestResult(null)
    setModalOpen(true)
  }

  // Test Connection
  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testStoreConnectionAction(client.id, {
        platform,
        store_url: storeUrl,
        credentials: {
          consumer_key: consumerKey,
          consumer_secret: consumerSecret,
          access_token: accessToken,
          api_key: apiKey
        },
        existingStoreId: editingStore?.id
      })
      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || "Ligação bem-sucedida!",
          latencyMs: res.latencyMs,
          details: res.details
        })
      } else {
        setTestResult({
          success: false,
          message: res.error || "Não foi possível conectar à loja.",
          latencyMs: res.latencyMs
        })
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Erro inesperado ao testar conexão."
      })
    } finally {
      setTesting(false)
    }
  }

  // Save Store Connection
  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await saveClientStoreAction(client.id, {
        id: editingStore?.id,
        name: storeName,
        platform,
        store_url: storeUrl,
        credentials: {
          consumer_key: consumerKey,
          consumer_secret: consumerSecret,
          access_token: accessToken,
          api_key: apiKey
        },
        is_active: true,
        auto_fulfill: autoFulfill
      })

      if (res.success) {
        setModalOpen(false)
        setFeedbackMsg({ type: "success", text: "Loja guardada com sucesso!" })
        await refreshData()
        setTimeout(() => setFeedbackMsg(null), 4000)
      } else {
        setFeedbackMsg({ type: "error", text: res.error || "Erro ao guardar loja." })
      }
    } catch (err: unknown) {
      setFeedbackMsg({ type: "error", text: err instanceof Error ? err.message : "Erro inesperado." })
    } finally {
      setSaving(false)
    }
  }

  // Delete Store
  const handleDeleteStore = async (storeId: string) => {
    if (!confirm("Tem a certeza que deseja desligar esta loja?")) return
    try {
      const res = await deleteClientStoreAction(client.id, storeId)
      if (res.success) {
        setFeedbackMsg({ type: "success", text: "Loja desligada com sucesso." })
        await refreshData()
        setTimeout(() => setFeedbackMsg(null), 4000)
      }
    } catch (err: unknown) {
      alert("Erro ao remover: " + (err instanceof Error ? err.message : "Erro inesperado."))
    }
  }

  // Sync Single Store Orders
  const handleSyncStore = async (storeId: string) => {
    setSyncingStoreId(storeId)
    try {
      const res = await syncStoreOrdersAction(client.id, storeId)
      if (res.success) {
        setFeedbackMsg({
          type: "success",
          text: `Sincronização concluída! ${res.orders?.length || 0} encomendas obtidas.`
        })
        await refreshData()
        setTimeout(() => setFeedbackMsg(null), 5000)
      } else {
        setFeedbackMsg({ type: "error", text: res.error || "Erro ao sincronizar." })
      }
    } catch (err: unknown) {
      setFeedbackMsg({ type: "error", text: err instanceof Error ? err.message : "Erro ao sincronizar." })
    } finally {
      setSyncingStoreId(null)
    }
  }

  // Sync All Stores
  const handleSyncAll = async () => {
    if (stores.length === 0) return
    setSyncingAll(true)
    let total = 0
    try {
      for (const st of stores) {
        if (!st.is_active) continue
        const res = await syncStoreOrdersAction(client.id, st.id)
        if (res.success && res.orders) {
          total += res.orders.length
        }
      }
      setFeedbackMsg({
        type: "success",
        text: `Todas as lojas sincronizadas! Total de ${total} encomendas prontas.`
      })
      await refreshData()
      setTimeout(() => setFeedbackMsg(null), 5000)
    } catch (err: unknown) {
      setFeedbackMsg({ type: "error", text: err instanceof Error ? err.message : "Falha na sincronização geral." })
    } finally {
      setSyncingAll(false)
    }
  }

  // Filtered orders list
  const filteredOrders = React.useMemo(() => {
    return orders.filter(o => {
      if (filterStoreId !== "all" && o.store_id !== filterStoreId) return false
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.shipping_city.toLowerCase().includes(q) ||
        o.shipping_postal.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q)
      )
    })
  }, [orders, filterStoreId, searchQuery])

  // Get helper platform config
  const activePlatformConfig = PLATFORMS.find(p => p.id === platform) || PLATFORMS[0]

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto px-4 py-6">
      {/* ─── Top Header & Hero ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Lojas & Webservices
              </h1>
              <p className="text-xs text-slate-500">
                Ligue a sua loja online para importar encomendas automaticamente e emitir guias com 1 clique.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {stores.length > 0 && (
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={syncingAll || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 active:scale-95 transition-all text-slate-700 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? "animate-spin text-emerald-600" : ""}`} />
              <span>{syncingAll ? "A sincronizar..." : "Sincronizar Todas"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenNewModal("woocommerce")}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ligar Nova Loja</span>
          </button>
        </div>
      </div>

      {/* ─── Feedback Banner ─── */}
      {feedbackMsg && (
        <div
          className={`flex items-center gap-3 p-3.5 rounded-xl text-xs font-semibold transition-all ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {feedbackMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* ─── Failed Fulfillment Retries Banner ─── */}
      {syncFailures.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2.5 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Atualizações de tracking pendentes na loja ({syncFailures.length})</span>
          </div>
          <div className="space-y-1.5">
            {syncFailures.map((fail) => (
              <div
                key={fail.sync_key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="font-bold text-slate-800">{fail.store_name}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="font-mono font-semibold text-slate-700">{fail.order_number}</span>
                  <span className="mx-1.5 text-slate-400">→</span>
                  <span className="font-mono text-emerald-700">{fail.tracking_code}</span>
                  {fail.last_error && (
                    <span className="block text-[11px] text-red-700 mt-0.5">{fail.last_error}</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={retryingSyncKey === fail.sync_key}
                  onClick={() => { void handleRetrySyncFailure(fail.sync_key) }}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${retryingSyncKey === fail.sync_key ? "animate-spin" : ""}`} />
                  <span>{retryingSyncKey === fail.sync_key ? "A reenviar..." : "Reenviar tracking"}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Metric Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Lojas Ligadas</span>
            <Store className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stores.length}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {stores.filter(s => s.is_active).length} ativas em tempo real
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Encomendas Prontas a Despachar</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{orders.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Importadas das plataformas conectadas
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Plataformas Compatíveis</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-sm font-bold text-slate-800 flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200">WooCommerce</span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">Shopify</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">Linke Store</span>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">PrestaShop</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">REST API & Webhooks</div>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("stores")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
            activeTab === "stores"
              ? "border-emerald-600 text-emerald-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Lojas Conectadas ({stores.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
            activeTab === "orders"
              ? "border-emerald-600 text-emerald-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Encomendas Importadas ({orders.length})</span>
          {orders.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
              {orders.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("guide")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
            activeTab === "guide"
              ? "border-emerald-600 text-emerald-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Guia de Integração</span>
        </button>
      </div>

      {/* ─── TAB 1: STORES ─── */}
      {activeTab === "stores" && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-xs font-medium">A carregar configurações das suas lojas...</span>
            </div>
          ) : stores.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
                <Store className="w-7 h-7" />
              </div>
              <h2 className="text-base font-bold text-slate-800 mb-1">
                Ainda não tem nenhuma loja conectada
              </h2>
              <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
                Conecte a sua loja Shopify, WooCommerce ou Linke Store para que as encomendas entrem diretamente no sistema e possa imprimir guias sem ter de preencher moradas manualmente.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl mb-6">
                {PLATFORMS.slice(0, 3).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleOpenNewModal(p.id)}
                    className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 active:scale-95 transition-all text-center group cursor-pointer"
                  >
                    <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">{p.badge}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleOpenNewModal("woocommerce")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Conectar Primeira Loja</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stores.map(store => {
                const conf = PLATFORMS.find(p => p.id === store.platform) || PLATFORMS[0]
                const isSyncing = syncingStoreId === store.id

                return (
                  <div
                    key={store.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all overflow-hidden flex flex-col justify-between"
                  >
                    <div className="p-5 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm ${conf.bgColor} ${conf.textColor} border ${conf.borderColor}`}
                          >
                            {store.platform === "woocommerce" && "WC"}
                            {store.platform === "shopify" && "SH"}
                            {store.platform === "linke_store" && "LK"}
                            {store.platform === "prestashop" && "PS"}
                            {store.platform === "custom_api" && "API"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-sm font-bold text-slate-900">{store.name}</h2>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${conf.bgColor} ${conf.textColor}`}
                              >
                                {conf.name}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-[260px]">
                              {store.store_url}
                            </p>
                          </div>
                        </div>

                        <div>
                          {store.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Ativa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">
                              Inativa
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Store Sync stats */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {store.last_synced_at
                              ? `Última sincronização: ${new Date(store.last_synced_at).toLocaleTimeString("pt-PT", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "2-digit",
                                  month: "2-digit"
                                })}`
                              : "Ainda não sincronizada"}
                          </span>
                        </div>
                        {store.orders_count !== undefined && (
                          <span className="font-bold text-emerald-600">
                            {store.orders_count} encomendas
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Store Card Actions */}
                    <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSyncStore(store.id)}
                          disabled={isSyncing}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                          <span>{isSyncing ? "A buscar..." : "Sincronizar"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(store)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteStore(store.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Desligar loja"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: IMPORTED ORDERS ─── */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Filters & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Pesquisar por nº encomenda, cliente, cidade, CP ou telefone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {stores.length > 1 && (
                <select
                  value={filterStoreId}
                  onChange={e => setFilterStoreId(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Todas as Lojas</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={handleSyncAll}
                disabled={syncingAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? "animate-spin" : ""}`} />
                <span>Atualizar</span>
              </button>
            </div>
          </div>

          {/* Orders Table */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">Nenhuma encomenda encontrada</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {orders.length === 0
                  ? "Carregue no botão 'Sincronizar' na sua loja para recolher pedidos pendentes."
                  : "Nenhuma encomenda corresponde ao filtro pesquisado."}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Encomenda & Loja</th>
                      <th className="px-4 py-3">Destinatário & Morada</th>
                      <th className="px-4 py-3">Contacto</th>
                      <th className="px-4 py-3">Artigos</th>
                      <th className="px-4 py-3">Total / Cobrança</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredOrders.map(order => {
                      // Prepare quick link to Criar Guia with prefilled params
                      const guiaParams = new URLSearchParams({
                        name: order.customer_name,
                        address: order.shipping_address,
                        city: order.shipping_city,
                        postal: order.shipping_postal,
                        country: order.shipping_country || "PT",
                        phone: order.customer_phone,
                        email: order.customer_email,
                        cod: order.is_cod ? String(order.cod_amount) : "0",
                        ref: order.order_number.replace(/^#/, "")
                      })

                      const createGuiaUrl = `${basePath}/criar-guia?${guiaParams.toString()}`

                      return (
                        <tr key={`${order.store_id}-${order.id}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 align-top">
                            <div className="font-bold text-slate-900">{order.order_number}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <span className="font-medium">{order.store_name}</span>
                              <span>•</span>
                              <span>{new Date(order.created_at).toLocaleDateString("pt-PT")}</span>
                            </div>
                            <div className="mt-1">
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                {order.status}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3 align-top">
                            <div className="font-semibold text-slate-900">{order.customer_name}</div>
                            <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                              {order.shipping_address}
                            </div>
                            <div className="text-[11px] text-slate-600 font-semibold mt-0.5">
                              {order.shipping_postal} {order.shipping_city} ({order.shipping_country})
                            </div>
                          </td>

                          <td className="px-4 py-3 align-top">
                            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-800">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{order.customer_phone || "Sem telefone"}</span>
                            </div>
                            {order.customer_email && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[160px] mt-0.5">
                                {order.customer_email}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 align-top">
                            <div className="text-slate-800">
                              {order.line_items.map((li, idx) => (
                                <div key={idx} className="text-[11px] truncate max-w-[180px]">
                                  <span className="font-bold text-emerald-700">{li.quantity}x</span> {li.name}
                                </div>
                              ))}
                            </div>
                          </td>

                          <td className="px-4 py-3 align-top">
                            <div className="font-bold text-slate-900">
                              {order.total_price.toFixed(2)} {order.currency}
                            </div>
                            {order.is_cod ? (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold mt-1">
                                Cobrança: {order.cod_amount.toFixed(2)}€
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {order.payment_method}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 align-top text-right">
                            {order.tracking_number ? (
                              <div className="flex flex-col items-end gap-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <Check className="w-3 h-3" />
                                  Guia Emitida
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {order.tracking_number}
                                </span>
                              </div>
                            ) : (
                              <Link
                                href={createGuiaUrl}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-2xs active:scale-95 transition-all cursor-pointer"
                              >
                                <span>Criar Guia</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: INTEGRATION GUIDE ─── */}
      {activeTab === "guide" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Como ligar o seu webservice ao TMS Linke
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Siga os passos simples abaixo dependendo da plataforma onde a sua loja está alojada:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* WooCommerce */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center">
                      WC
                    </span>
                    <h3 className="font-bold text-slate-800 text-sm">WooCommerce (WordPress)</h3>
                  </div>
                  <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                    <li>Entre no WordPress da sua loja.</li>
                    <li>Vá a <strong>WooCommerce &gt; Definições &gt; Avançado &gt; REST API</strong>.</li>
                    <li>Clique em <strong>Adicionar Chave</strong>.</li>
                    <li>Dê o nome &quot;Linke TMS&quot; e permissão de <strong>Leitura / Escrita</strong>.</li>
                    <li>Copie a <strong>Consumer Key</strong> e <strong>Consumer Secret</strong> para aqui.</li>
                  </ol>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenNewModal("woocommerce")}
                  className="mt-4 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Configurar WooCommerce
                </button>
              </div>

              {/* Shopify */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center">
                      SH
                    </span>
                    <h3 className="font-bold text-slate-800 text-sm">Shopify</h3>
                  </div>
                  <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                    <li>Entre no painel da Shopify.</li>
                    <li>Vá a <strong>Definições &gt; Apps e canais de vendas &gt; Desenvolver apps</strong>.</li>
                    <li>Clique em <strong>Criar uma app</strong> (ex: &quot;Linke Logistics&quot;).</li>
                    <li>Ative os scopes de API <code>read_orders</code> e <code>write_orders</code>.</li>
                    <li>Instale a app e copie o <strong>Admin API Access Token</strong>.</li>
                  </ol>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenNewModal("shopify")}
                  className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Configurar Shopify
                </button>
              </div>

              {/* Linke Store */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded bg-slate-900 text-emerald-400 font-black text-xs flex items-center justify-center">
                      LK
                    </span>
                    <h3 className="font-bold text-slate-800 text-sm">Linke Store</h3>
                  </div>
                  <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                    <li>Entre no painel de administração da sua <strong>Linke Store</strong>.</li>
                    <li>Vá a <strong>Conectores &gt; API e Dados</strong>.</li>
                    <li>Copie o URL da sua loja e as chaves <strong>Consumer Key</strong> e <strong>Consumer Secret</strong>.</li>
                    <li>Cole aqui e clique em &quot;Testar Ligação&quot;.</li>
                  </ol>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenNewModal("linke_store")}
                  className="mt-4 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Configurar Linke Store
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD / EDIT STORE ─── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90dvh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${activePlatformConfig.bgColor} ${activePlatformConfig.textColor}`}
                >
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {editingStore ? "Editar Ligação à Loja" : "Conectar Nova Loja"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {activePlatformConfig.name} Webservice REST API
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveStore} className="p-5 overflow-y-auto space-y-4">
              {/* Platform Selector (if new store) */}
              {!editingStore && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Selecione a Plataforma
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLATFORMS.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPlatform(p.id)
                          setStoreName(
                            p.id === "shopify"
                              ? "Loja Shopify"
                              : p.id === "linke_store"
                              ? "Linke Store Oficial"
                              : p.id === "woocommerce"
                              ? "Loja WooCommerce"
                              : "Loja Online"
                          )
                          setTestResult(null)
                        }}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          platform === p.id
                            ? "border-emerald-600 bg-emerald-50/40 text-emerald-950 font-bold shadow-2xs"
                            : "border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span
                          className={`w-3 h-3 rounded-full border ${
                            platform === p.id
                              ? "bg-emerald-600 border-emerald-600"
                              : "border-slate-300"
                          }`}
                        />
                        <span className="text-xs">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-0.5">
                  <Info className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Como obter as credenciais:</span>
                </div>
                {activePlatformConfig.instructions}
              </div>

              {/* Store Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Loja no TMS
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Minha Loja Online"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Store URL / Domain */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {platform === "shopify" ? "Domínio da Loja Shopify" : "URL da Loja Online"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    platform === "shopify"
                      ? "minhaloja.myshopify.com"
                      : "https://minhaloja.com"
                  }
                  value={storeUrl}
                  onChange={e => setStoreUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* WooCommerce & Linke Store Keys */}
              {(platform === "woocommerce" || platform === "linke_store") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Consumer Key
                    </label>
                    <input
                      type="text"
                      required={!editingStore}
                      placeholder="ck_xxxxxxxxxxxxxxxx"
                      value={consumerKey}
                      onChange={e => {
                        const val = e.target.value
                        if (val.includes("cs_")) {
                          const parts = val.split("cs_")
                          setConsumerKey(parts[0].trim())
                          setConsumerSecret("cs_" + parts[1].trim())
                        } else {
                          setConsumerKey(val)
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Consumer Secret
                    </label>
                    <input
                      type="password"
                      required={!editingStore}
                      placeholder="cs_xxxxxxxxxxxxxxxx"
                      value={consumerSecret}
                      onChange={e => setConsumerSecret(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Shopify Access Token */}
              {platform === "shopify" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Admin API Access Token
                  </label>
                  <input
                    type="password"
                    required={!editingStore}
                    placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                    value={accessToken}
                    onChange={e => setAccessToken(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* PrestaShop API Key */}
              {platform === "prestashop" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chave Webservice PrestaShop
                  </label>
                  <input
                    type="text"
                    required={!editingStore}
                    placeholder="Cole a chave webservice"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Options */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoFulfill}
                    onChange={e => setAutoFulfill(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    Atualizar automaticamente a encomenda para &apos;Concluída&apos; na loja e enviar tracking ao emitir guia no TMS
                  </span>
                </label>
              </div>

              {/* Live Test Feedback */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium border flex items-start gap-2.5 ${
                    testResult.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold">{testResult.message}</p>
                    {testResult.latencyMs !== undefined && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Tempo de resposta: {testResult.latencyMs}ms
                        {testResult.details?.environment && ` • ${testResult.details.environment}`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !storeUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Zap className={`w-3.5 h-3.5 ${testing ? "animate-spin text-emerald-600" : ""}`} />
                  <span>{testing ? "A testar..." : "Testar Ligação"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-3 py-2 rounded-lg text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? "A guardar..." : editingStore ? "Guardar Alterações" : "Gravar e Conectar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

