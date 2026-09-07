import * as React from "react"
import { Calendar, ChevronDown, CheckCircle2, TrendingUp, MapPin, FileText, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const ultimosEnvios = [
  { guia: "LTK1002487", destinatario: "Loja do Norte", estado: "entregue", data: "19/05/2025" },
  { guia: "LTK1002486", destinatario: "Papelaria Central", estado: "pendente", data: "19/05/2025" },
  { guia: "LTK1002485", destinatario: "Design & Cor, Lda.", estado: "em transito", data: "18/05/2025" },
  { guia: "LTK1002484", destinatario: "Armazéns Silva", estado: "entregue", data: "18/05/2025" },
  { guia: "LTK1002483", destinatario: "TechStore Lisboa", estado: "em transito", data: "17/05/2025" },
]

export default function OpsDashboardPage() {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      
      {/* Left Column (Forms) */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Criar Nova Guia Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Criar Nova Guia de Transporte</h2>
          
          {/* Stepper */}
          <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute left-8 right-8 top-1/2 h-0.5 bg-slate-200 -z-10 -translate-y-1/2"></div>
            
            <div className="flex flex-col items-center gap-2 bg-white px-2">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm">1</div>
              <span className="text-[11px] font-semibold text-green-600">Detalhes</span>
            </div>
            <div className="flex flex-col items-center gap-2 bg-white px-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-sm">2</div>
              <span className="text-[11px] font-semibold text-slate-400">Serviço</span>
            </div>
            <div className="flex flex-col items-center gap-2 bg-white px-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-sm">3</div>
              <span className="text-[11px] font-semibold text-slate-400">Resumo</span>
            </div>
          </div>

          <form className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Remetente</label>
                <div className="relative">
                  <select className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-500 appearance-none focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option>Selecionar remetente</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Destinatário</label>
                <div className="relative">
                  <select className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-500 appearance-none focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option>Selecionar destinatário</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Morada</label>
              <div className="relative">
                <input type="text" placeholder="Rua, número, andar, porta, código postal, localidade" className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Peso (kg)</label>
                <input type="text" placeholder="Ex.: 2.50" className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Transportadora</label>
                <div className="relative">
                  <select className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-500 appearance-none focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option>Selecionar transportadora</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Tipo de Serviço</label>
                <div className="relative">
                  <select className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-500 appearance-none focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option>Selecionar tipo de serviço</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              
              <div className="flex items-end justify-end">
                <button type="button" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Gerar Guia
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Pedir Recolha Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Pedir Recolha</h2>
          </div>

          <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Data</label>
              <div className="relative">
                <input type="text" placeholder="Selecionar data" className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <label className="block text-xs font-semibold text-slate-700">Morada de Recolha</label>
              <div className="relative">
                <input type="text" placeholder="Rua, número, código postal, localidade" className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Nº de Volumes</label>
              <input type="text" placeholder="Ex.: 3" className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            
            <div className="flex items-end justify-end">
              <button type="button" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Confirmar Recolha
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Column (Stats & Table) */}
      <div className="w-full lg:w-[380px] flex flex-col gap-6 shrink-0">
        
        {/* Resumo do Mês Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Resumo do mês</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Guias este mês</p>
              <p className="text-4xl font-extrabold text-green-600">84</p>
            </div>
            
            <div className="h-px bg-slate-100 w-full" />
            
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Próxima Fatura</p>
              <p className="text-3xl font-extrabold text-slate-800">€420,50</p>
              <p className="text-xs text-slate-500 mt-1">Vencimento: 30/05/2025</p>
            </div>

            <div className="h-px bg-slate-100 w-full" />

            <div>
              <div className="flex justify-between items-end mb-2">
                <p className="text-sm font-semibold text-slate-700">Utilização do plano</p>
                <p className="text-sm font-bold text-green-600">84%</p>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-600 rounded-full" style={{ width: '84%' }}></div>
              </div>
              <p className="text-xs text-slate-500 mt-2">336 / 400 guias</p>
            </div>
          </div>
        </div>

        {/* Últimos Envios Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Últimos Envios</h2>
            <a href="#" className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
              Ver todos <span className="text-lg leading-none">&rsaquo;</span>
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 font-semibold text-slate-800">Guia</th>
                  <th className="pb-3 font-semibold text-slate-800">Destinatário</th>
                  <th className="pb-3 font-semibold text-slate-800">Estado</th>
                  <th className="pb-3 font-semibold text-slate-800 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ultimosEnvios.map((envio, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 font-medium text-slate-700">{envio.guia}</td>
                    <td className="py-3 text-slate-600">{envio.destinatario}</td>
                    <td className="py-3">
                      <Badge variant={
                        envio.estado === 'entregue' ? 'success' :
                        envio.estado === 'pendente' ? 'warning' : 'info'
                      }>
                        {envio.estado === 'em transito' ? 'Em Trânsito' : 
                         envio.estado.charAt(0).toUpperCase() + envio.estado.slice(1)}
                      </Badge>
                    </td>
                    <td className="py-3 text-right text-slate-600">{envio.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100">
            <a href="#" className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
              Ver todos os envios <span className="text-lg leading-none">&rsaquo;</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
