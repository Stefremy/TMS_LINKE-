"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, Loader2, ShoppingCart, Store } from "lucide-react"
import { notify } from "@/lib/notify"
import { useClientScope } from "./ClientScope"
import { WebOrdersPanel } from "./WebOrdersPanel"
import {
  getClientStoresAction,
  getClientSyncedOrdersAction,
  syncStoreOrdersAction,
  type ClientEcommerceStore,
  type SyncedOrder,
} from "@/app/actions/client-ecommerce"

/** Encomendas Web: the imported store orders on their own page, one click from the sidebar. */
export function ClientWebOrders() {
  const { client, basePath } = useClientScope()
  const [stores, setStores] = React.useState<ClientEcommerceStore[]>([])
  const [orders, setOrders] = React.useState<SyncedOrder[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [syncing, setSyncing] = React.useState(false)

  const load = React.useCallback(async () => {
    const [nextStores, nextOrders] = await Promise.all([getClientStoresAction(client.id), getClientSyncedOrdersAction(client.id)])
    setStores(nextStores)
    setOrders(nextOrders)
  }, [client.id])

  React.useEffect(() => {
    let active = true
    Promise.all([getClientStoresAction(client.id), getClientSyncedOrdersAction(client.id)])
      .then(([nextStores, nextOrders]) => { if (active) { setStores(nextStores); setOrders(nextOrders) } })
      .catch(() => { if (active) setLoadError("Não foi possível carregar as encomendas. Atualize a página.") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [client.id])

  const syncAll = async () => {
    if (syncing) return
    setSyncing(true)
    const failed: string[] = []
    let total = 0
    try {
      for (const store of stores.filter(store => store.is_active)) {
        const result = await syncStoreOrdersAction(client.id, store.id)
        if (result.success) total += result.orders?.length || 0
        else failed.push(store.name)
      }
      await load()
      if (failed.length) notify.error(`Não foi possível sincronizar: ${failed.join(", ")}. Verifique a ligação em Lojas & Webservices.`)
      else notify.success(`Lojas sincronizadas: ${total} encomendas importadas.`)
    } catch {
      notify.error("A sincronização falhou. Tente novamente.")
    } finally {
      setSyncing(false)
    }
  }

  const pending = orders.filter(order => !order.tracking_number).length

  return <div className="space-y-5">
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600">
          <ShoppingCart aria-hidden strokeWidth={1.75} className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Encomendas Web</h1>
          <p className="text-sm text-slate-500">Encomendas importadas das suas lojas online, prontas a enviar.</p>
        </div>
      </div>
      {!loading && stores.length > 0 && <p className="text-xs text-slate-500">
        <strong className="text-slate-800 tabular-nums">{pending}</strong> por enviar · {stores.length} {stores.length === 1 ? "loja ligada" : "lojas ligadas"} ·{" "}
        <Link href={`${basePath}/integracoes`} className="font-semibold text-emerald-700 hover:underline">Gerir lojas</Link>
      </p>}
    </header>

    {loading ? <div role="status" className="flex items-center justify-center gap-2 p-12 text-slate-500 text-sm">
      <Loader2 aria-hidden className="w-5 h-5 animate-spin motion-reduce:animate-none text-emerald-600" />A carregar encomendas…
    </div> : loadError ? <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertCircle aria-hidden className="w-4 h-4" />{loadError}
    </div> : stores.length === 0 ? <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
      <Store aria-hidden className="w-10 h-10 text-slate-300 mx-auto mb-2" />
      <h2 className="text-sm font-bold text-slate-800">Ainda não ligou nenhuma loja online</h2>
      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">Ligue a sua loja Shopify, WooCommerce ou Linke Store para importar encomendas e criar guias sem escrever moradas.</p>
      <Link href={`${basePath}/integracoes`} className="inline-flex mt-4 px-3 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold">Ligar loja</Link>
    </div> : <WebOrdersPanel orders={orders} stores={stores} basePath={basePath} syncing={syncing} onSyncAll={syncAll} />}
  </div>
}
