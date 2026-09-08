"use client"

import * as React from "react"
import { X, ChevronRight, ChevronDown, Save, Key, Settings, MapPin, Search } from "lucide-react"

interface WizardProps {
  onClose: () => void
}

const CONNECTORS = [
  { id: "eno", name: "ENOVO TMS" },
  { id: "ctt_expresso", name: "CTT Expresso" },
  { id: "ctt_postal", name: "CTT Postal" },
  { id: "dpd", name: "DPD" },
  { id: "gls", name: "GLS" },
]

const CTT_SCHEMA = [
  { key: "contract_number", label: "Nº Contrato", type: "text" },
  { key: "client_number", label: "Nº Cliente", type: "text" },
  { key: "auth_id", label: "Auth ID", type: "text" },
  { key: "user_id", label: "User ID", type: "text" },
]

const INTERNAL_SERVICES = ["CTT Múltiplo", "CTT 24H", "CTT 48H"]
const INTERNAL_GOODS = ["Caixa", "Palete", "Rolo"]

export function NewConnectionWizard({ onClose }: WizardProps) {
  const [step, setStep] = React.useState(1)
  const [selectedConnector, setSelectedConnector] = React.useState("ctt_expresso")

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Nova Ligação Webservices</h2>
            <p className="text-sm text-slate-500 mt-0.5">Configure os dados e mapeamentos da transportadora.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex border-b border-slate-200 shrink-0">
          {[
            { num: 1, label: "Dados de Ligação", icon: Key },
            { num: 2, label: "Mapeamento Serviços", icon: MapPin },
            { num: 3, label: "Tipos de Mercadoria", icon: Settings },
          ].map((s) => {
            const Icon = s.icon
            const isCompleted = step > s.num
            const isCurrent = step === s.num
            return (
              <div 
                key={s.num} 
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                  isCurrent ? "border-green-600 text-green-700 bg-green-50/50" : 
                  isCompleted ? "border-transparent text-slate-700" : 
                  "border-transparent text-slate-400"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  isCurrent ? "bg-green-600 text-white" :
                  isCompleted ? "bg-slate-800 text-white" :
                  "bg-slate-200 text-slate-500"
                }`}>
                  {s.num}
                </div>
                {s.label}
              </div>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          
          {step === 1 && (
            <div className="flex gap-8">
              {/* Left Column: Base Settings */}
              <div className="w-1/3 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 text-sm mb-3">Definições Gerais</h3>
                  
                  <div className="flex flex-col gap-1.5 mb-4">
                    <label className="text-[13px] font-semibold text-slate-700">Conector</label>
                    <div className="relative">
                      <select 
                        value={selectedConnector}
                        onChange={(e) => setSelectedConnector(e.target.value)}
                        className="w-full appearance-none bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none pr-8"
                      >
                        {CONNECTORS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mb-4">
                    <label className="text-[13px] font-semibold text-slate-700">Fornecedor Associado</label>
                    <select className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none">
                      <option>Selecione um fornecedor...</option>
                      <option>CTT Portugal</option>
                      <option>DPD</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold text-slate-700">Aplicar à Agência</label>
                    <select className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none">
                      <option>Todas as agências globais</option>
                      <option>PT-01</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Column: Dynamic Credentials & Options */}
              <div className="w-2/3 flex flex-col gap-4">
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 text-sm">Dados de Ligação ({CONNECTORS.find(c => c.id === selectedConnector)?.name})</h3>
                    <button className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline">Obter dados de ligação</button>
                  </div>

                  {/* Dynamic Form based on selected connector */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {selectedConnector === "ctt_expresso" ? (
                      CTT_SCHEMA.map(field => (
                        <div key={field.key} className="flex flex-col gap-1">
                          <label className="text-[12px] font-semibold text-slate-600">{field.label}</label>
                          <input type="text" className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-sm text-slate-500 py-4 text-center border border-dashed border-slate-300 rounded bg-slate-50">
                        Os campos dinâmicos para {selectedConnector} serão renderizados aqui.
                      </div>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-800 text-sm mb-3 pt-4 border-t border-slate-100">Comportamentos</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                      <span className="text-[13px] font-medium text-slate-700">Forçar a sair na etiqueta dados do cliente</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                      <span className="text-[13px] font-medium text-slate-700">Ativar para novos clientes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                      <span className="text-[13px] font-medium text-slate-700">Forçar referência = tracking number</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                      <span className="text-[13px] font-medium text-slate-700">Forçar impressão da etiqueta nativa</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">Matriz de Serviços</h3>
                  <p className="text-[13px] text-slate-500 mt-0.5">Associe os serviços internos ao código do serviço da transportadora de acordo com o destino e o escalão de peso.</p>
                </div>
              </div>
              <div className="p-0">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-bold text-slate-700 w-1/4">Serviço Interno</th>
                      <th className="px-4 py-3 font-bold text-slate-700 w-1/4">Zona Destino</th>
                      <th className="px-4 py-3 font-bold text-slate-700 w-1/4">Escalão Peso</th>
                      <th className="px-4 py-3 font-bold text-slate-700 w-1/4">Cód. Serviço (Transportadora)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {INTERNAL_SERVICES.map((srv, i) => (
                      <React.Fragment key={i}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-800 align-top" rowSpan={2}>{srv}</td>
                          <td className="px-4 py-2">Portugal Continental</td>
                          <td className="px-4 py-2 text-slate-500">Base (1 unidade)</td>
                          <td className="px-4 py-2">
                            <input type="text" placeholder="Ex: CTT_24" className="w-full border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-500 focus:outline-none" />
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                          <td className="px-4 py-2 border-l border-slate-100">Espanha</td>
                          <td className="px-4 py-2 text-slate-500">Base (1 unidade)</td>
                          <td className="px-4 py-2">
                            <input type="text" placeholder="Ex: CTT_ES" className="w-full border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-500 focus:outline-none" />
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden max-w-3xl mx-auto">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-800">Mapeamento de Mercadoria</h3>
                <p className="text-[13px] text-slate-500 mt-0.5">Indique o código externo utilizado pela transportadora para cada tipo de mercadoria.</p>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  {INTERNAL_GOODS.map(g => (
                    <div key={g} className="flex items-center gap-4">
                      <label className="font-semibold text-sm text-slate-700 w-24 text-right">{g}</label>
                      <input type="text" placeholder="Cód. Externo" className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
          >
            Cancelar
          </button>
          
          <div className="flex gap-2">
            {step > 1 && (
              <button 
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 hover:bg-slate-50 rounded transition-colors"
              >
                Anterior
              </button>
            )}
            
            {step < 3 ? (
              <button 
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded shadow transition-colors flex items-center gap-1"
              >
                Seguinte
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={onClose}
                className="px-5 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded shadow transition-colors flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                Gravar Configuração
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
