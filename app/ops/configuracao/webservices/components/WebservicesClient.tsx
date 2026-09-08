"use client"

import * as React from "react"
import { Plus, Settings, Power, Check, X, Search, ChevronDown, Edit2, Trash2, Package, Map, MessageSquare, CreditCard, ShoppingCart, Key, Brain, Shield } from "lucide-react"
import { NewConnectionWizard } from "./NewConnectionWizard"

const tabs = [
  { id: "transportadoras", label: "Transportadoras", icon: Package },
]

interface WebservicesClientProps {
  connections: any[]
}

export function WebservicesClient({ connections }: WebservicesClientProps) {
  const [activeTab, setActiveTab] = React.useState("transportadoras")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isWizardOpen, setIsWizardOpen] = React.useState(false)

  const filteredConnections = connections.filter((conn) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      conn.description?.toLowerCase().includes(q) ||
      conn.carrier_code?.toLowerCase().includes(q) ||
      conn.client_id?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Header Area */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-800">Webservices Globais</h1>
        <div className="text-sm font-medium text-slate-500 flex items-center">
          Configuração <span className="mx-1 text-lg leading-none mb-1">&rsaquo;</span> <span className="text-slate-800">Webservices Globais</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 border-b border-slate-200 bg-slate-50 shrink-0 overflow-x-auto hide-scrollbar">
        <div className="flex items-center gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-[13px] transition-colors whitespace-nowrap ${
                  isActive 
                    ? "border-green-600 text-green-700" 
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Toolbar Area */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsWizardOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            Nova Ligação
          </button>
          
          <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5">
            <Power className="w-4 h-4" />
            Ativar/Desativar em Massa
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisar ligações..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-8 pr-3 py-1 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm h-8"
            />
          </div>
        </div>

      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-slate-50">
        <table className="w-full text-left text-[13px] whitespace-nowrap pb-32">
          <thead className="bg-white sticky top-0 z-10 shadow-sm">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
              </th>
              <th className="px-3 py-3 font-bold text-slate-700">Descrição</th>
              <th className="px-3 py-3 font-bold text-slate-700">Fornecedor</th>
              <th className="px-3 py-3 font-bold text-slate-700">Client ID</th>
              <th className="px-3 py-3 font-bold text-slate-700">Contrato</th>
              <th className="px-3 py-3 font-bold text-slate-700 text-center">Ambiente</th>
              <th className="px-3 py-3 font-bold text-slate-700 text-center">Ativo</th>
              <th className="px-3 py-3 font-bold text-slate-700">Criado em</th>
              <th className="px-4 py-3 font-bold text-slate-700 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredConnections.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma ligação configurada.
                </td>
              </tr>
            ) : filteredConnections.map((conn) => (
              <tr key={conn.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-4 py-4 align-top">
                  <input type="checkbox" className="rounded border-slate-300 text-green-600 focus:ring-green-500 mt-1" />
                </td>
                <td className="px-3 py-3">
                  <div className="font-bold text-slate-800">{conn.description}</div>
                  <div className="text-[11px] text-slate-500 font-medium bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-1">
                    {conn.carrier_code}
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-600 uppercase">{conn.carrier_code}</td>
                <td className="px-3 py-3 text-slate-700">{conn.client_id}</td>
                <td className="px-3 py-3 font-mono text-slate-600">{conn.contract_number}</td>
                <td className="px-3 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    conn.environment === 'production' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {conn.environment || 'QA'}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  <div className={`inline-flex items-center justify-center w-8 h-5 rounded-full ${conn.is_active ? 'bg-green-500' : 'bg-slate-300'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${conn.is_active ? 'translate-x-1.5' : '-translate-x-1.5'}`} />
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-500">
                  {new Date(conn.created_at).toLocaleDateString('pt-PT')}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isWizardOpen && (
        <NewConnectionWizard onClose={() => setIsWizardOpen(false)} />
      )}
    </div>
  )
}
