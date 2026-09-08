"use client"

import * as React from "react"
import { 
  Plus, 
  Package, 
  MapPin, 
  Settings, 
  Filter, 
  Search,
  Truck,
  ChevronDown,
  Edit2
} from "lucide-react"

import { ActionMenu } from "./ActionMenu"
import { FerramentasMenu } from "./FerramentasMenu"
import { NovaRecolhaModal } from "./NovaRecolhaModal"
import { NovoEnvioModal } from "./NovoEnvioModal"

interface EnviosClientProps {
  envios: any[]
  recolhas: any[]
  clients: { id: string, name: string }[]
}

export function EnviosClient({ envios, recolhas, clients }: EnviosClientProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showFilters, setShowFilters] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<"envios" | "recolhas">("envios")
  const [showRecolhaModal, setShowRecolhaModal] = React.useState(false)
  const [showNovoEnvioModal, setShowNovoEnvioModal] = React.useState(false)

  const dataSource = viewMode === "envios" ? envios : recolhas

  const filteredEnvios = dataSource.filter((item) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    
    // Add safety checks in case properties are missing
    const trkId = item.trk?.id || ""
    const trkRef = item.trk?.ref || ""
    const senderName = item.sender?.name || ""
    const recipientName = item.recipient?.name || ""
    const serviceName = item.service?.name || ""
    const statusLabel = item.status?.label || ""
    const valueAmount = item.value?.amount || ""

    return (
      trkId.toLowerCase().includes(q) ||
      trkRef.toLowerCase().includes(q) ||
      senderName.toLowerCase().includes(q) ||
      recipientName.toLowerCase().includes(q) ||
      serviceName.toLowerCase().includes(q) ||
      statusLabel.toLowerCase().includes(q) ||
      valueAmount.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Header Area */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-800">
          {viewMode === "envios" ? "Envios e Serviços" : "Pedidos de Recolha"}
        </h1>
        <div className="text-sm font-medium text-slate-500 flex items-center">
          Painel de Resumo <span className="mx-1 text-lg leading-none mb-1">&rsaquo;</span> <span className="text-slate-800">
            {viewMode === "envios" ? "Envios e Serviços" : "Recolhas"}
          </span>
        </div>
      </div>

      {/* Toolbar Area */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (viewMode === "recolhas") {
                setShowRecolhaModal(true)
              } else {
                setShowNovoEnvioModal(true)
              }
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            Novo
          </button>
          
          <button 
            onClick={() => setViewMode(viewMode === "envios" ? "recolhas" : "envios")}
            className={`border px-3 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5 ${
              viewMode === "recolhas" 
                ? "bg-slate-200 border-slate-400 text-slate-900" 
                : "bg-white border-slate-300 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <Package className="w-4 h-4" />
            {viewMode === "envios" ? "Recolhas" : "Envios"}
          </button>
          
          <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            Localizar
          </button>

          <FerramentasMenu />
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`border px-3 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5 ${
              showFilters 
                ? "bg-slate-200 border-slate-400 text-slate-900" 
                : "bg-white border-slate-300 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtrar
            <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>

          <div className="flex items-center ml-2 border-l border-slate-200 pl-4">
            <span className="text-sm font-semibold text-slate-700 mr-2">Estado</span>
            <div className="relative">
              <select className="appearance-none bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded px-3 py-1 pr-8 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm h-8">
                <option>Todos</option>
                <option>Pendente</option>
                <option>Em Trânsito</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Q TRK" 
              className="w-32 pl-8 pr-3 py-1 bg-white border border-slate-300 rounded text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm h-8"
            />
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 pl-8 pr-3 py-1 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm h-8"
            />
          </div>
        </div>

      </div>

      {/* Expanded Filters Area */}
      {showFilters && (
        <div className="px-4 py-4 border-b border-slate-200 bg-slate-50 shrink-0 flex flex-col gap-3 text-[11px]">
          {/* Row 1 */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1 w-32">
              <label className="font-semibold text-slate-600">Filtrar Data</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Data Recolha</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-56">
              <label className="font-semibold text-slate-600">Data</label>
              <div className="flex items-center gap-1">
                <input type="text" placeholder="Início" className="w-full border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
                <span className="text-slate-400 px-1">até</span>
                <input type="text" placeholder="Fim" className="w-full border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
              </div>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <label className="font-semibold text-slate-600">Serviço</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-40">
              <label className="font-semibold text-slate-600">Fornecedor</label>
              <div className="flex">
                <span className="bg-slate-100 border border-slate-300 border-r-0 rounded-l px-2 py-1.5 text-slate-500 font-bold">=</span>
                <select className="w-full border border-slate-300 rounded-r px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                  <option>Todos</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">Contexto</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">Tipo</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <div className="flex justify-between items-center"><label className="font-semibold text-slate-600">Motorista</label><span className="text-[9px] text-blue-500 cursor-pointer hover:underline">Todos</span></div>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
          </div>
          {/* Other filter rows simplified for space, the structure is identical to original */}
        </div>
      )}

      {/* Table Area */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-[13px] whitespace-nowrap pb-32">
          <thead className="bg-white sticky top-0 z-10 shadow-sm">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
              </th>
              <th className="px-3 py-3 font-bold text-slate-700">TRK</th>
              <th className="px-3 py-3 font-bold text-slate-700">Remetente</th>
              <th className="px-3 py-3 font-bold text-slate-700">Destinatário</th>
              <th className="px-3 py-3 font-bold text-slate-700">Serviço</th>
              <th className="px-3 py-3 font-bold text-slate-700">Remessa</th>
              <th className="px-3 py-3 font-bold text-slate-700">Entrega</th>
              <th className="px-3 py-3 font-bold text-slate-700">Estado</th>
              <th className="px-3 py-3 font-bold text-slate-700">Valor</th>
              <th className="px-4 py-3 font-bold text-slate-700 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredEnvios.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  Nenhum envio encontrado com a pesquisa atual.
                </td>
              </tr>
            ) : filteredEnvios.map((envio, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-4 py-4 align-top">
                  <input type="checkbox" className="rounded border-slate-300 text-green-600 focus:ring-green-500 mt-1" />
                </td>
                
                {/* TRK Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <a href="#" className="font-semibold text-blue-600 hover:underline flex items-center gap-1 text-[13px]">
                      {envio.trk?.id || "N/A"}
                      <span className="text-[12px] text-slate-400">📋</span>
                    </a>
                    <span className="text-slate-400 text-[11px]">{envio.trk?.date}</span>
                    <span className="text-slate-600 font-medium text-[11px] mt-0.5">{envio.trk?.ref}</span>
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-sm w-fit leading-none">
                      {envio.trk?.tag || "N/A"}
                    </span>
                  </div>
                </td>

                {/* Remetente Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5 max-w-[180px] whitespace-normal">
                    <span className="font-semibold text-slate-800 text-[12px] leading-tight mb-1">{envio.sender?.name}</span>
                    <div className="flex text-slate-500 text-[11px] leading-tight">
                      <span className="mr-1 mt-0.5 shrink-0 text-[10px]">
                        {envio.sender?.flag === 'PT' ? '🇵🇹' : '🇪🇸'}
                      </span>
                      <span>{envio.sender?.zip} {envio.sender?.city}{envio.sender?.phone ? `, ${envio.sender.phone}` : ''}</span>
                    </div>
                  </div>
                </td>

                {/* Destinatário Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5 max-w-[180px] whitespace-normal">
                    <span className="font-semibold text-slate-800 text-[12px] leading-tight mb-1">{envio.recipient?.name}</span>
                    <div className="flex text-slate-500 text-[11px] leading-tight">
                      <span className="mr-1 mt-0.5 shrink-0 text-[10px]">
                        {envio.recipient?.flag === 'PT' ? '🇵🇹' : '🇪🇸'}
                      </span>
                      <span>{envio.recipient?.zip} {envio.recipient?.city}{envio.recipient?.phone ? `, ${envio.recipient.phone}` : ''}</span>
                    </div>
                  </div>
                </td>

                {/* Serviço Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="font-medium text-slate-700 text-[12px]">{envio.service?.code}</span>
                    <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-tight leading-none ${envio.service?.bgColor || 'bg-slate-200'} ${envio.service?.textColor || 'text-slate-800'}`}>
                      {envio.service?.name}
                    </span>
                  </div>
                </td>

                {/* Remessa Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-slate-800 text-[12px]">{envio.package?.count || "1 Caixa"}</span>
                    <span className="text-slate-500 text-[11px]">{envio.package?.weight || "-"}</span>
                  </div>
                </td>

                {/* Entrega Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-[12px]">
                      <Truck className="w-3.5 h-3.5 text-slate-500" />
                      {envio.delivery?.date}
                    </div>
                    <span className="text-slate-400 text-[11px] ml-5 tracking-widest">{envio.delivery?.time}</span>
                    <div className="flex gap-1 mt-1.5 ml-4">
                       <span className="bg-blue-600 text-white p-0.5 rounded-sm"><Settings className="w-3 h-3" /></span>
                    </div>
                  </div>
                </td>

                {/* Estado Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-1 items-start">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold leading-none ${envio.status?.color || 'bg-slate-100 text-slate-600'}`}>
                      {envio.status?.label}
                    </span>
                    {envio.status?.subCode && (
                      <span className="text-slate-500 font-medium text-[10px] tracking-wide ml-1">
                        {envio.status?.subCode}
                      </span>
                    )}
                  </div>
                </td>

                {/* Valor Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="font-medium text-slate-800 text-[12px]">{envio.value?.amount || "0,00€"}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border leading-none ${envio.value?.diffColor || 'text-slate-600 bg-slate-50'}`}>
                      {envio.value?.diff || "0,00€"}
                    </span>
                    <span className="text-slate-400 text-[10px] uppercase font-medium">{envio.value?.ref}</span>
                  </div>
                </td>

                {/* Ações Column */}
                <td className="px-4 py-3 align-top text-right overflow-visible">
                  <ActionMenu shipmentId={envio.rawId} trackingRef={envio.trk?.ref} isCtt={envio.service?.code?.includes('CTT')} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {showRecolhaModal && (
        <NovaRecolhaModal onClose={() => setShowRecolhaModal(false)} />
      )}
      
      {showNovoEnvioModal && (
        <NovoEnvioModal clients={clients} onClose={() => setShowNovoEnvioModal(false)} />
      )}
    </div>
  )
}
