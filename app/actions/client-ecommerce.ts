"use server"

import { errorMessage } from "@/lib/errors"
import { createAdminClient } from "@/lib/supabase/server"
import { requireClientAccess, getTenantId } from "@/lib/auth/context"
import { revalidatePath } from "next/cache"

export type PlatformType = "woocommerce" | "shopify" | "linke_store" | "prestashop" | "custom_api"

export interface ClientEcommerceStore {
  id: string
  client_id: string
  tenant_id?: string
  name: string
  platform: PlatformType
  store_url: string
  credentials: {
    consumer_key?: string
    consumer_secret?: string
    access_token?: string
    api_key?: string
  }
  is_active: boolean
  auto_fulfill?: boolean
  last_synced_at?: string
  last_sync_status?: "success" | "error" | "pending"
  last_error_message?: string
  orders_count?: number
  created_at: string
}

export interface SyncedOrder {
  id: string
  store_id: string
  store_name: string
  platform: PlatformType
  order_number: string
  status: string
  created_at: string
  total_price: number
  currency: string
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address: string
  shipping_city: string
  shipping_postal: string
  shipping_country: string
  payment_method: string
  is_cod: boolean
  cod_amount: number
  line_items: Array<{
    id?: string | number
    name: string
    quantity: number
    price: number
    sku?: string
  }>
  tracking_number?: string
  shipment_created?: boolean
}

function cleanUrl(url: string): string {
  let cleaned = (url || "").trim()
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = "https://" + cleaned
  }
  return cleaned.replace(/\/+$/, "")
}

function cleanShopifyDomain(url: string): string {
  let cleaned = (url || "").trim().toLowerCase()
  cleaned = cleaned.replace(/^https?:\/\//, "").replace(/\/+$/, "")
  if (!cleaned.includes(".")) {
    cleaned = `${cleaned}.myshopify.com`
  }
  return cleaned
}

function sanitizeWooCredentials(ck?: string, cs?: string): { ck: string; cs: string } {
  let cleanedCk = (ck || "").trim()
  let cleanedCs = (cs || "").trim()

  // Se o utilizador colou acidentalmente a chave e o segredo juntos no primeiro campo (ex: ck_...cs_...)
  if (cleanedCk.includes("cs_")) {
    const parts = cleanedCk.split("cs_")
    cleanedCk = parts[0].trim()
    if (!cleanedCs || cleanedCs.includes("••••")) {
      cleanedCs = "cs_" + parts[1].trim()
    }
  }

  // Se o utilizador trocou os campos acidentalmente
  if (cleanedCk.startsWith("cs_") && cleanedCs.startsWith("ck_")) {
    const temp = cleanedCk
    cleanedCk = cleanedCs
    cleanedCs = temp
  }

  return { ck: cleanedCk, cs: cleanedCs }
}

/**
 * Obtém as lojas configuradas para o cliente especificado
 */
export async function getClientStoresAction(clientId: string): Promise<ClientEcommerceStore[]> {
  const ctx = await requireClientAccess(clientId)
  const supabase = createAdminClient()

  try {
    const { data: logs, error } = await supabase
      .from("audit_log")
      .select("id, action, details, created_at")
      .eq("tenant_id", ctx.tenant_id)
      .in("action", ["client_ecommerce_store", "client_ecommerce_store_deleted"])
      .order("created_at", { ascending: false })

    if (error || !logs) {
      return []
    }

    const storesMap = new Map<string, ClientEcommerceStore>()
    const deletedIds = new Set<string>()

    for (const log of logs) {
      const details = log.details as any
      if (!details || details.client_id !== clientId) continue

      if (log.action === "client_ecommerce_store_deleted") {
        deletedIds.add(details.id)
        continue
      }

      if (!deletedIds.has(details.id) && !storesMap.has(details.id)) {
        // Mask credentials before returning to UI
        const creds = details.credentials || {}
        storesMap.set(details.id, {
          ...details,
          credentials: {
            consumer_key: creds.consumer_key ? `${creds.consumer_key.slice(0, 7)}••••••••` : undefined,
            consumer_secret: creds.consumer_secret ? `cs_••••••••` : undefined,
            access_token: creds.access_token ? `••••••••${creds.access_token.slice(-4)}` : undefined,
            api_key: creds.api_key ? `••••••••` : undefined,
          },
        })
      }
    }

    return Array.from(storesMap.values())
  } catch (err) {
    console.error("Erro ao carregar lojas do cliente:", err)
    return []
  }
}

/**
 * Grava ou atualiza a configuração de uma loja
 */
export async function saveClientStoreAction(
  clientId: string,
  storePayload: {
    id?: string
    name: string
    platform: PlatformType
    store_url: string
    credentials: {
      consumer_key?: string
      consumer_secret?: string
      access_token?: string
      api_key?: string
    }
    is_active?: boolean
    auto_fulfill?: boolean
  }
) {
  const ctx = await requireClientAccess(clientId)
  const supabase = createAdminClient()
  const tenantId = ctx.tenant_id

  const storeId = storePayload.id || crypto.randomUUID()
  const now = new Date().toISOString()

  // Se já existir, preservar credenciais existentes caso o utilizador não tenha reintroduzido (campos com ••••)
  let finalCredentials = { ...storePayload.credentials }
  if (storePayload.id) {
    const { data: existing } = await supabase
      .from("audit_log")
      .select("details")
      .eq("tenant_id", tenantId)
      .eq("action", "client_ecommerce_store")
      .eq("details->>id", storeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.details?.credentials) {
      const prev = existing.details.credentials
      if (!finalCredentials.consumer_key || finalCredentials.consumer_key.includes("••••")) {
        finalCredentials.consumer_key = prev.consumer_key
      }
      if (!finalCredentials.consumer_secret || finalCredentials.consumer_secret.includes("••••")) {
        finalCredentials.consumer_secret = prev.consumer_secret
      }
      if (!finalCredentials.access_token || finalCredentials.access_token.includes("••••")) {
        finalCredentials.access_token = prev.access_token
      }
      if (!finalCredentials.api_key || finalCredentials.api_key.includes("••••")) {
        finalCredentials.api_key = prev.api_key
      }
    }
  }

  if (storePayload.platform === "woocommerce" || storePayload.platform === "linke_store") {
    const sanitized = sanitizeWooCredentials(finalCredentials.consumer_key, finalCredentials.consumer_secret)
    finalCredentials.consumer_key = sanitized.ck
    finalCredentials.consumer_secret = sanitized.cs
  }

  const record: ClientEcommerceStore = {
    id: storeId,
    client_id: clientId,
    tenant_id: tenantId,
    name: storePayload.name.trim(),
    platform: storePayload.platform,
    store_url: storePayload.platform === "shopify"
      ? cleanShopifyDomain(storePayload.store_url)
      : cleanUrl(storePayload.store_url),
    credentials: finalCredentials,
    is_active: storePayload.is_active ?? true,
    auto_fulfill: storePayload.auto_fulfill ?? true,
    created_at: now,
  }

  const { error } = await supabase.from("audit_log").insert({
    tenant_id: tenantId,
    action: "client_ecommerce_store",
    details: record,
  })

  if (error) {
    return { success: false, error: "Não foi possível guardar a loja: " + error.message }
  }

  revalidatePath("/app", "layout")
  return { success: true, store: record }
}

/**
 * Elimina a configuração de uma loja
 */
export async function deleteClientStoreAction(clientId: string, storeId: string) {
  const ctx = await requireClientAccess(clientId)
  const supabase = createAdminClient()

  const { error } = await supabase.from("audit_log").insert({
    tenant_id: ctx.tenant_id,
    action: "client_ecommerce_store_deleted",
    details: { id: storeId, client_id: clientId, deleted_at: new Date().toISOString() },
  })

  if (error) {
    return { success: false, error: "Não foi possível remover a loja." }
  }

  revalidatePath("/app", "layout")
  return { success: true }
}

/**
 * Testa a ligação em tempo real com a loja externa
 */
export async function testStoreConnectionAction(
  clientId: string,
  params: {
    platform: PlatformType
    store_url: string
    credentials: {
      consumer_key?: string
      consumer_secret?: string
      access_token?: string
      api_key?: string
    }
    existingStoreId?: string
  }
) {
  const ctx = await requireClientAccess(clientId)
  const supabase = createAdminClient()

  let { platform, store_url, credentials, existingStoreId } = params

  // Se o utilizador não editou o campo e tem máscara, obter chaves originais
  if (existingStoreId) {
    const { data: existing } = await supabase
      .from("audit_log")
      .select("details")
      .eq("tenant_id", ctx.tenant_id)
      .eq("action", "client_ecommerce_store")
      .eq("details->>id", existingStoreId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.details?.credentials) {
      const prev = existing.details.credentials
      if (!credentials.consumer_key || credentials.consumer_key.includes("••••")) {
        credentials.consumer_key = prev.consumer_key
      }
      if (!credentials.consumer_secret || credentials.consumer_secret.includes("••••")) {
        credentials.consumer_secret = prev.consumer_secret
      }
      if (!credentials.access_token || credentials.access_token.includes("••••")) {
        credentials.access_token = prev.access_token
      }
      if (!credentials.api_key || credentials.api_key.includes("••••")) {
        credentials.api_key = prev.api_key
      }
    }
  }

  const startTime = Date.now()

  try {
    if (platform === "woocommerce" || platform === "linke_store") {
      const base = cleanUrl(store_url)
      const sanitized = sanitizeWooCredentials(credentials.consumer_key, credentials.consumer_secret)
      const ck = sanitized.ck
      const cs = sanitized.cs

      if (!ck || !cs) {
        return { success: false, error: "Consumer Key e Consumer Secret são obrigatórios." }
      }

      // Tentar autenticação via Basic Auth
      const basicAuth = Buffer.from(`${ck}:${cs}`).toString("base64")
      let testEndpoint = `${base}/wp-json/wc/v3/system_status`

      let res = await fetch(testEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "User-Agent": "LinkeTMS/2.0",
        },
        cache: "no-store",
      })

      // Fallback para query params se basic auth falhar no host do cliente
      if (res.status === 401 || res.status === 404) {
        testEndpoint = `${base}/wp-json/wc/v3/system_status?consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}`
        res = await fetch(testEndpoint, {
          method: "GET",
          headers: { "User-Agent": "LinkeTMS/2.0" },
          cache: "no-store",
        })
      }

      // Se system_status der 404, tentar listar 1 encomenda para confirmar
      if (res.status === 404) {
        const ordersUrl = `${base}/wp-json/wc/v3/orders?per_page=1&consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}`
        res = await fetch(ordersUrl, {
          method: "GET",
          headers: { "User-Agent": "LinkeTMS/2.0" },
          cache: "no-store",
        })
      }

      const latencyMs = Date.now() - startTime

      if (!res.ok) {
        const errorText = await res.text().catch(() => "")
        let message = `Falha na ligação (HTTP ${res.status})`
        try {
          const parsed = JSON.parse(errorText)
          if (parsed.message) message = parsed.message
        } catch {
          if (errorText.length < 200) message = errorText || message
        }
        return { success: false, error: message, latencyMs }
      }

      const data = await res.json().catch(() => ({}))
      const storeName = data.environment?.site_url || data.name || base

      return {
        success: true,
        message: `Ligação estabelecida com sucesso! (${platform === "linke_store" ? "Linke Store" : "WooCommerce"})`,
        latencyMs,
        details: {
          storeName,
          environment: data.environment?.wp_version ? `WordPress ${data.environment.wp_version}` : "REST API v3",
          currency: data.settings?.currency || "EUR",
        },
      }
    } else if (platform === "shopify") {
      const domain = cleanShopifyDomain(store_url)
      const token = credentials.access_token?.trim() || ""

      if (!token) {
        return { success: false, error: "Admin Access Token da Shopify é obrigatório." }
      }

      const shopUrl = `https://${domain}/admin/api/2024-01/shop.json`
      const res = await fetch(shopUrl, {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      })

      const latencyMs = Date.now() - startTime

      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        return {
          success: false,
          error: `Falha na autenticação Shopify (HTTP ${res.status}): ${errText || "Verifique o Access Token"}`,
          latencyMs,
        }
      }

      const data = await res.json()
      const shop = data.shop || {}

      return {
        success: true,
        message: `Ligação à Shopify estabelecida com sucesso!`,
        latencyMs,
        details: {
          storeName: shop.name || domain,
          email: shop.email,
          currency: shop.currency || "EUR",
          domain: shop.domain || domain,
        },
      }
    } else if (platform === "prestashop") {
      const base = cleanUrl(store_url)
      const apiKey = credentials.api_key?.trim() || ""
      const auth = Buffer.from(`${apiKey}:`).toString("base64")

      const res = await fetch(`${base}/api?output_format=JSON`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
        cache: "no-store",
      })

      const latencyMs = Date.now() - startTime
      if (!res.ok) {
        return { success: false, error: `Falha na API PrestaShop (HTTP ${res.status})`, latencyMs }
      }

      return {
        success: true,
        message: "Ligação ao PrestaShop estabelecida com sucesso!",
        latencyMs,
      }
    }

    return { success: true, message: "Teste de ligação concluído com sucesso.", latencyMs: Date.now() - startTime }
  } catch (err) {
    return {
      success: false,
      error: `Não foi possível alcançar o servidor: ${errorMessage(err)}`,
      latencyMs: Date.now() - startTime,
    }
  }
}

/**
 * Sincroniza encomendas da loja conectada
 */
export async function syncStoreOrdersAction(
  clientId: string,
  storeId: string
): Promise<{ success: boolean; orders?: SyncedOrder[]; error?: string }> {
  const ctx = await requireClientAccess(clientId)
  const supabase = createAdminClient()
  const tenantId = ctx.tenant_id

  try {
    // 1. Obter dados da loja
    const { data: storeLog } = await supabase
      .from("audit_log")
      .select("details")
      .eq("tenant_id", tenantId)
      .eq("action", "client_ecommerce_store")
      .eq("details->>id", storeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!storeLog?.details) {
      return { success: false, error: "Loja não encontrada." }
    }

    const store = storeLog.details as ClientEcommerceStore
    const { platform, store_url, credentials, name: storeName } = store
    let rawOrders: SyncedOrder[] = []

    if (platform === "woocommerce" || platform === "linke_store") {
      const base = cleanUrl(store_url)
      const sanitized = sanitizeWooCredentials(credentials.consumer_key, credentials.consumer_secret)
      const ck = sanitized.ck
      const cs = sanitized.cs

      const basicAuth = Buffer.from(`${ck}:${cs}`).toString("base64")
      const endpoint = `${base}/wp-json/wc/v3/orders?status=processing,pending&per_page=50`

      let res = await fetch(endpoint, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "User-Agent": "LinkeTMS/2.0",
        },
        cache: "no-store",
      })

      if (res.status === 401 || res.status === 404) {
        const fallbackUrl = `${base}/wp-json/wc/v3/orders?status=processing,pending&per_page=50&consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}`
        res = await fetch(fallbackUrl, {
          headers: { "User-Agent": "LinkeTMS/2.0" },
          cache: "no-store",
        })
      }

      if (!res.ok) {
        const msg = await res.text().catch(() => "")
        return { success: false, error: `Erro ao buscar encomendas (HTTP ${res.status}): ${msg.slice(0, 150)}` }
      }

      const wcData = await res.json()
      if (Array.isArray(wcData)) {
        rawOrders = wcData.map((order: any) => {
          const shipping = order.shipping || {}
          const billing = order.billing || {}
          const name = [shipping.first_name || billing.first_name || "", shipping.last_name || billing.last_name || ""]
            .filter(Boolean)
            .join(" ")
            .trim() || "Cliente"

          const isCod = (order.payment_method || "").toLowerCase().includes("cod") ||
            (order.payment_method_title || "").toLowerCase().includes("entrega") ||
            (order.payment_method_title || "").toLowerCase().includes("cobrança")

          const lineItems = Array.isArray(order.line_items)
            ? order.line_items.map((li: any) => ({
                id: li.id,
                name: li.name || "Artigo",
                quantity: li.quantity || 1,
                price: parseFloat(li.total || li.price || 0),
                sku: li.sku || "",
              }))
            : []

          // Detectar se já tem tracking associado nos metadados
          let trackingCode = ""
          if (Array.isArray(order.meta_data)) {
            const meta = order.meta_data.find((m: any) =>
              m.key === "_linke_tracking_code" || m.key === "tracking_number" || m.key === "_tracking_number"
            )
            if (meta?.value) trackingCode = String(meta.value)
          }

          return {
            id: String(order.id),
            store_id: storeId,
            store_name: storeName,
            platform,
            order_number: `#${order.number || order.id}`,
            status: order.status || "processing",
            created_at: order.date_created || new Date().toISOString(),
            total_price: parseFloat(order.total || 0),
            currency: order.currency || "EUR",
            customer_name: name,
            customer_email: billing.email || order.customer_email || "",
            customer_phone: shipping.phone || billing.phone || "",
            shipping_address: [shipping.address_1, shipping.address_2].filter(Boolean).join(", ") || billing.address_1 || "",
            shipping_city: shipping.city || billing.city || "",
            shipping_postal: shipping.postcode || billing.postcode || "",
            shipping_country: shipping.country || billing.country || "PT",
            payment_method: order.payment_method_title || order.payment_method || "Online",
            is_cod: isCod,
            cod_amount: isCod ? parseFloat(order.total || 0) : 0,
            line_items: lineItems,
            tracking_number: trackingCode,
            shipment_created: !!trackingCode,
          }
        })
      }
    } else if (platform === "shopify") {
      const domain = cleanShopifyDomain(store_url)
      const token = credentials.access_token?.trim() || ""

      const endpoint = `https://${domain}/admin/api/2024-01/orders.json?status=open&fulfillment_status=unfulfilled&limit=50`
      const res = await fetch(endpoint, {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      })

      if (!res.ok) {
        return { success: false, error: `Erro na API da Shopify (HTTP ${res.status})` }
      }

      const shopifyData = await res.json()
      const orders = shopifyData.orders || []

      rawOrders = orders.map((order: any) => {
        const shipping = order.shipping_address || order.billing_address || {}
        const customer = order.customer || {}
        const name = [shipping.first_name || customer.first_name, shipping.last_name || customer.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || "Cliente"

        const isCod = (order.gateway || "").toLowerCase().includes("cod") ||
          (order.payment_gateway_names || []).some((g: string) => g.toLowerCase().includes("cash") || g.toLowerCase().includes("cobrança"))

        const lineItems = Array.isArray(order.line_items)
          ? order.line_items.map((li: any) => ({
              id: li.id,
              name: li.title || li.name || "Artigo",
              quantity: li.quantity || 1,
              price: parseFloat(li.price || 0),
              sku: li.sku || "",
            }))
          : []

        return {
          id: String(order.id),
          store_id: storeId,
          store_name: storeName,
          platform: "shopify",
          order_number: order.name || `#${order.order_number || order.id}`,
          status: order.financial_status || "open",
          created_at: order.created_at || new Date().toISOString(),
          total_price: parseFloat(order.total_price || 0),
          currency: order.currency || "EUR",
          customer_name: name,
          customer_email: order.email || customer.email || "",
          customer_phone: shipping.phone || customer.phone || "",
          shipping_address: [shipping.address1, shipping.address2].filter(Boolean).join(", ") || "",
          shipping_city: shipping.city || "",
          shipping_postal: shipping.zip || "",
          shipping_country: shipping.country_code || "PT",
          payment_method: (order.payment_gateway_names || []).join(", ") || "Shopify Payments",
          is_cod: isCod,
          cod_amount: isCod ? parseFloat(order.total_price || 0) : 0,
          line_items: lineItems,
          tracking_number: order.fulfillments?.[0]?.tracking_number || "",
          shipment_created: !!order.fulfillments?.[0]?.tracking_number,
        }
      })
    }

    // 2. Guardar encomendas em audit_log com action 'client_ecommerce_synced_orders'
    const now = new Date().toISOString()
    await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      action: "client_ecommerce_synced_orders",
      details: {
        store_id: storeId,
        client_id: clientId,
        synced_at: now,
        orders_count: rawOrders.length,
        orders: rawOrders,
      },
    })

    // 3. Atualizar metadata da loja
    const updatedStore: ClientEcommerceStore = {
      ...store,
      last_synced_at: now,
      last_sync_status: "success",
      orders_count: rawOrders.length,
      last_error_message: undefined,
    }

    await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      action: "client_ecommerce_store",
      details: updatedStore,
    })

    revalidatePath("/app", "layout")
    return { success: true, orders: rawOrders }
  } catch (err) {
    return { success: false, error: "Erro ao sincronizar encomendas: " + errorMessage(err) }
  }
}

/**
 * Obtém as encomendas sincronizadas em cache
 */
export async function getClientSyncedOrdersAction(
  clientId: string,
  storeId?: string
): Promise<SyncedOrder[]> {
  const ctx = await requireClientAccess(clientId)
  const supabase = createAdminClient()

  try {
    let query = supabase
      .from("audit_log")
      .select("details")
      .eq("tenant_id", ctx.tenant_id)
      .eq("action", "client_ecommerce_synced_orders")
      .eq("details->>client_id", clientId)
      .order("created_at", { ascending: false })

    if (storeId) {
      query = query.eq("details->>store_id", storeId)
    }

    const { data: logs, error } = await query.limit(10)
    if (error || !logs) return []

    // Coletar as encomendas mais recentes por store_id
    const seenStores = new Set<string>()
    const allOrders: SyncedOrder[] = []

    for (const log of logs) {
      const details = log.details as any
      const sId = details?.store_id
      if (sId && !seenStores.has(sId) && Array.isArray(details.orders)) {
        seenStores.add(sId)
        allOrders.push(...details.orders)
      }
    }

    return allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } catch (err) {
    console.error("Erro ao carregar encomendas sincronizadas:", err)
    return []
  }
}

/**
 * Atualiza o estado da encomenda e envia o código de rastreio de volta para a loja (WooCommerce, Shopify, Linke Store)
 */
export async function updateStoreOrderTrackingAction(
  clientId: string,
  storeId: string,
  orderId: string,
  trackingCode: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireClientAccess(clientId)
  const supabase = createAdminClient()

  try {
    const { data: storeLog } = await supabase
      .from("audit_log")
      .select("details")
      .eq("tenant_id", ctx.tenant_id)
      .eq("action", "client_ecommerce_store")
      .eq("details->>id", storeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!storeLog?.details) {
      return { success: false, error: "Loja não encontrada." }
    }

    const store = storeLog.details as ClientEcommerceStore
    const { platform, store_url, credentials } = store

    if (platform === "woocommerce" || platform === "linke_store") {
      const base = cleanUrl(store_url)
      const sanitized = sanitizeWooCredentials(credentials.consumer_key, credentials.consumer_secret)
      const ck = sanitized.ck
      const cs = sanitized.cs
      const basicAuth = Buffer.from(`${ck}:${cs}`).toString("base64")

      const updatePayload = {
        status: "completed",
        meta_data: [
          { key: "_linke_tracking_code", value: trackingCode },
          { key: "tracking_number", value: trackingCode },
          {
            key: "_wc_shipment_tracking_items",
            value: [
              {
                tracking_number: trackingCode,
                custom_tracking_provider: "Linke Logistics",
                carrier: "Linke",
                date_shipped: new Date().toISOString().split("T")[0],
              },
            ],
          },
        ],
      }

      const res = await fetch(`${base}/wp-json/wc/v3/orders/${orderId}`, {
        method: "PUT",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
          "User-Agent": "LinkeTMS/2.0",
        },
        body: JSON.stringify(updatePayload),
      })

      if (!res.ok) {
        return { success: false, error: `Erro ao atualizar tracking na loja (HTTP ${res.status})` }
      }

      return { success: true }
    } else if (platform === "shopify") {
      const domain = cleanShopifyDomain(store_url)
      const token = credentials.access_token?.trim() || ""

      // 1. Obter fulfillment orders da encomenda
      const foRes = await fetch(`https://${domain}/admin/api/2024-01/orders/${orderId}/fulfillment_orders.json`, {
        headers: { "X-Shopify-Access-Token": token },
      })

      if (!foRes.ok) {
        return { success: false, error: "Não foi possível obter ordens de fulfillment da Shopify." }
      }

      const foData = await foRes.json()
      const fulfillmentOrderId = foData.fulfillment_orders?.[0]?.id

      if (!fulfillmentOrderId) {
        return { success: false, error: "Nenhuma ordem de fulfillment pendente encontrada." }
      }

      // 2. Criar fulfillment com tracking
      const createFulfillmentRes = await fetch(`https://${domain}/admin/api/2024-01/fulfillments.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fulfillment: {
            line_items_by_fulfillment_order: [
              {
                fulfillment_order_id: fulfillmentOrderId,
              },
            ],
            tracking_info: {
              number: trackingCode,
              company: "Linke Express",
              url: `https://linke.pt/tracking?q=${trackingCode}`,
            },
            notify_customer: true,
          },
        }),
      })

      if (!createFulfillmentRes.ok) {
        return { success: false, error: "Falha ao registar envio na Shopify." }
      }

      return { success: true }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: errorMessage(err) }
  }
}

