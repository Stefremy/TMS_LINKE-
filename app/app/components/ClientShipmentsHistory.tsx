"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Search, Package, PlusCircle, Building2, Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getClientesAction } from "@/app/actions/clientes"
import { getClientPortalStatsAction } from "@/app/actions/shipments"
import { Cliente } from "@/app/ops/entidades/clientes/types"

export function ClientShipmentsHistory() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("clientId")
  const clientNameParam = searchParams.get("clientName")

  const [currentClient, setCurrentClient] = React.useState<Cliente | null>(null)
  const [shipments, setShipments] = React.useState<any[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("todos")
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    getClientesAction().then((clients) => {
      let target: Cliente | undefined
      if (clientId) {
        target = clients.find((c) => c.id === clientId)
      }
      if (!target && clientNameParam) {
        const decoded = decodeURIComponent(clientNameParam).toLowerCase()
        target = clients.find((c) => c.short_name.toLowerCase() === decoded || c.legal_name.toLowerCase() === decoded)
      }
      if (!target && clients.length > 0) {
        target = clients[0]
      }
      if (target) {
        setCurrentClient(target)
      }

      getClientPortalStatsAction(target?.id, target?.short_name).then((res) => {
        if (res) {
          setShipments(res.allShipments || res.recentShipments || [])
        }
        setLoading(false)
      })
    })
  }, [clientId, clientNameParam])

  const querySuffix = React.useMemo(() => {
    if (!currentClient) return ""
    return `?clientId=${encodeURIComponent(currentClient.id || "")}&clientName=${encodeURIComponent(currentClient.short_name || "")}`
  }, [currentClient])

  const filteredShipments = React.useMemo(() => {
    return shipments.filter((item) => {
      const q = searchTerm.toLowerCase().trim()
      const ref = (item.tracking_number || item.id || "").toLowerCase()
      const rec = (item.recipient_name || "").toLowerCase()
      const addr = (item.recipient_address || "").toLowerCase()

      const matchesSearch = !q || ref.includes(q) || rec.includes(q) || addr.includes(q)
      const matchesStatus = statusFilter === "todos" || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [shipments, searchTerm, statusFilter])

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto font-sans">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Link href={`/app${querySuffix}`} className="hover:text-emerald-700">Painel Principal</Link>
            <span>&gt;</span>
            <span className="text-emerald-600 font-bold">Histórico & Envios</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Histórico de Envios & Rastreamento</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe o estado de entrega e comprovativos de receção de todas as guias emitidas.
          </p>
        </div>

        <Link
          href={`/app/criar-guia${querySuffix}`}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Novo Envio</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisar por envio, guia, destinatário ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Estado:</span>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="todos">Todos os Estados</option>
            <option value="entregue">Entregues</option>
            <option value="em transito">Em Trânsito</option>
            <option value="pendente">Pendentes</option>
          </select>
        </div>
      </div>

      {/* Shipments List Table / Clean State */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
        {filteredShipments.length === 0 ? (
          <div className="py-12 px-4 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">Nenhum envio a apresentar</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Assim que criar novos envios na plataforma, eles ficarão disponíveis aqui com rastreamento detalhado em tempo real.
            </p>
            <Link 
              href={`/app/criar-guia${querySuffix}`}
              className="mt-4 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Novo Envio</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-bold">
                  <th className="pb-3">Guia</th>
                  <th className="pb-3">Destinatário</th>
                  <th className="pb-3">Morada</th>
                  <th className="pb-3">Serviço CTT</th>
                  <th className="pb-3">Estado</th>
                  <th className="pb-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShipments.map((envio) => (
                  <tr key={envio.id} className="hover:bg-slate-50">
                    <td className="py-3 font-mono font-bold text-slate-900">
                      {envio.tracking_number || envio.id?.substring(0, 8).toUpperCase()}
                    </td>
                    <td className="py-3 font-semibold text-slate-800">{envio.recipient_name}</td>
                    <td className="py-3 text-slate-500 truncate max-w-[200px]">{envio.recipient_address}</td>
                    <td className="py-3 text-slate-600">{envio.service_type || "CTT Expresso"}</td>
                    <td className="py-3">
                      <Badge variant={
                        envio.status === "entregue" ? "success" :
                        envio.status === "pendente" ? "warning" : "info"
                      }>
                        {envio.status === "em transito" ? "Em Trânsito" : 
                         envio.status.charAt(0).toUpperCase() + envio.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-slate-900">
                      {envio.sell_price ? `${Number(envio.sell_price).toFixed(2)}€` : "0.00€"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
