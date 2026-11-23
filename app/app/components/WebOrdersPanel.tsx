"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Building2, Check, MessageSquareText, Package, Phone, RefreshCw, Scale, Search } from "lucide-react"
import type { SyncedOrder } from "@/app/actions/client-ecommerce"
import { orderToShipmentParams } from "@/lib/ecommerce/order-shipment-prefill"

type Status = "pending" | "shipped" | "all"

const fold = (value: unknown) => String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
const money = (value: number, currency = "EUR") => {
  try { return value.toLocaleString("pt-PT", { style: "currency", currency }) } catch { return `${value.toFixed(2)} ${currency}` }
}

/** Imported web-store orders, ready to become shipments. Used in Integrações and in Encomendas Web. */
export function WebOrdersPanel({ orders, stores, basePath, syncing, onSyncAll }: {
  orders: SyncedOrder[]
  stores: { id: string; name: string }[]
  basePath: string
  syncing: boolean
  onSyncAll: () => void
}) {
  const [query, setQuery] = React.useState("")
  const [storeId, setStoreId] = React.useState("all")
  const [status, setStatus] = React.useState<Status>("pending")

  const shipped = (order: SyncedOrder) => Boolean(order.tracking_number)
  const counts = { pending: orders.filter(o => !shipped(o)).length, shipped: orders.filter(shipped).length, all: orders.length }
  const visible = React.useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean)
    return orders.filter(order => {
      if (storeId !== "all" && order.store_id !== storeId) return false
      if (status === "pending" && shipped(order)) return false
      if (status === "shipped" && !shipped(order)) return false
      if (!words.length) return true
      const haystack = fold([order.order_number, order.customer_name, order.customer_company, order.customer_email, order.shipping_address,
        order.shipping_city, order.shipping_postal, order.customer_phone, order.tracking_number, ...order.line_items.map(li => li.name)].join(" "))
      return words.every(word => haystack.includes(word))
    })
  }, [orders, query, storeId, status])

  const tabs: { key: Status; label: string }[] = [
    { key: "pending", label: "Por enviar" },
    { key: "shipped", label: "Com guia" },
    { key: "all", label: "Todas" },
  ]

  return <div className="space-y-4">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
      <div className="flex flex-wrap items-center gap-2 flex-1">
        <div role="group" aria-label="Estado das encomendas" className="flex gap-1">
          {tabs.map(tab => <button key={tab.key} type="button" aria-pressed={status === tab.key} onClick={() => setStatus(tab.key)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${status === tab.key
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {tab.label} <span className="tabular-nums opacity-70">{counts[tab.key]}</span>
          </button>)}
        </div>
        <label className="relative flex-1 min-w-[200px] max-w-md">
          <span className="sr-only">Pesquisar encomendas</span>
          <Search aria-hidden className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Nº encomenda, cliente, empresa, cidade, CP, telefone, artigo…"
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
      </div>
      <div className="flex items-center gap-2">
        {stores.length > 1 && <select value={storeId} onChange={event => setStoreId(event.target.value)} aria-label="Filtrar por loja"
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="all">Todas as lojas</option>
          {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>}
        <button type="button" onClick={onSyncAll} disabled={syncing || stores.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 disabled:opacity-50 transition-colors">
          <RefreshCw aria-hidden className={`w-3.5 h-3.5 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`} />
          {syncing ? "A sincronizar…" : "Sincronizar lojas"}
        </button>
      </div>
    </div>

    {visible.length === 0 ? <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
      <Package aria-hidden className="w-10 h-10 text-slate-300 mx-auto mb-2" />
      <h3 className="text-sm font-bold text-slate-800">Nenhuma encomenda encontrada</h3>
      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
        {orders.length === 0 ? "Carregue em “Sincronizar lojas” para importar as encomendas pendentes."
          : status === "pending" && !query && storeId === "all" ? "Todas as encomendas importadas já têm guia."
          : "Nenhuma encomenda corresponde ao filtro."}
      </p>
    </div> : <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
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
            {visible.map(order => {
              const createUrl = `${basePath}/criar-guia?${orderToShipmentParams(order).toString()}`
              return <tr key={`${order.store_id}-${order.id}`} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 align-top">
                  <div className="font-bold text-slate-900">{order.order_number}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{order.store_name} · {new Date(order.created_at).toLocaleDateString("pt-PT")}</div>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">{order.status}</span>
                </td>
                <td className="px-4 py-3 align-top max-w-[260px]">
                  <div className="font-semibold text-slate-900">{order.customer_name}</div>
                  {order.customer_company && <div className="flex items-center gap-1 text-[11px] text-slate-600"><Building2 aria-hidden className="w-3 h-3 text-slate-400" />{order.customer_company}</div>}
                  <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{order.shipping_address}</div>
                  <div className="text-[11px] text-slate-600 font-semibold mt-0.5">
                    {order.shipping_postal} {order.shipping_city}{order.shipping_province ? `, ${order.shipping_province}` : ""} ({order.shipping_country})
                  </div>
                  {order.customer_note && <div className="mt-1 flex items-start gap-1 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-1">
                    <MessageSquareText aria-hidden className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" /><span className="line-clamp-2" title={order.customer_note}>{order.customer_note}</span>
                  </div>}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-800">
                    <Phone aria-hidden className="w-3 h-3 text-slate-400" />
                    {order.customer_phone || <span className="font-sans text-amber-700">Sem telefone</span>}
                  </div>
                  {order.customer_email && <div className="text-[10px] text-slate-500 truncate max-w-[180px] mt-0.5">{order.customer_email}</div>}
                </td>
                <td className="px-4 py-3 align-top">
                  {order.line_items.map((li, idx) => <div key={idx} className="text-[11px] truncate max-w-[200px]" title={li.sku ? `SKU ${li.sku}` : undefined}>
                    <span className="font-bold text-emerald-700">{li.quantity}x</span> {li.name}
                  </div>)}
                  {Number(order.total_weight_kg) > 0 && <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                    <Scale aria-hidden className="w-3 h-3" />{Number(order.total_weight_kg).toLocaleString("pt-PT")} kg
                  </div>}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-bold text-slate-900">{money(order.total_price, order.currency)}</div>
                  {order.is_cod
                    ? <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold mt-1">Cobrança: {money(order.cod_amount)}</span>
                    : <span className="text-[10px] text-slate-400 block mt-0.5">{order.payment_method}</span>}
                </td>
                <td className="px-4 py-3 align-top text-right">
                  {order.tracking_number ? <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Check aria-hidden className="w-3 h-3" />Guia emitida
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{order.tracking_number}</span>
                  </div> : <Link href={createUrl}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-2xs transition-colors whitespace-nowrap">
                    Criar guia<ArrowRight aria-hidden className="w-3.5 h-3.5" />
                  </Link>}
                </td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </div>}
  </div>
}
