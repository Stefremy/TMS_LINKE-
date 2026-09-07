import * as React from "react"
import { 
  Package, 
  ClipboardList, 
  ReceiptEuro, 
  PieChart, 
  TrendingUp,
  MoreVertical,
  MapPin,
  CheckCircle2,
  Clock
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

const stats = [
  { label: "Envios Hoje", value: "1,248", icon: Package, trend: "+12%" },
  { label: "Recolhas Pendentes", value: "34", icon: ClipboardList, trend: null },
  { label: "Faturação Mês", value: "€18,450", icon: ReceiptEuro, trend: "+9%" },
  { label: "Taxa de Entrega", value: "96%", icon: PieChart, trend: null },
]

const enviosRecentes = [
  { guia: "LK25051600124", cliente: "Techstore, Lda.", transportadora: "CTT", estado: "entregue", peso: "2.35 kg" },
  { guia: "LK25051600123", cliente: "Fashion Hub Portugal", transportadora: "Correos Express", estado: "em transito", peso: "1.20 kg" },
  { guia: "LK25051600122", cliente: "Livraria do Bairro", transportadora: "CTT", estado: "pendente", peso: "0.80 kg" },
  { guia: "LK25051600121", cliente: "Green Planet, Lda.", transportadora: "Correos Express", estado: "entregue", peso: "3.10 kg" },
  { guia: "LK25051600120", cliente: "Watt Store", transportadora: "CTT", estado: "em transito", peso: "1.65 kg" },
]

export default function OpsDashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col relative overflow-hidden">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                <stat.icon className="w-6 h-6" strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold text-slate-800">{stat.label}</span>
            </div>
            
            <div className="flex items-end justify-between mt-auto">
              <span className="text-4xl font-extrabold text-slate-800">{stat.value}</span>
              
              <div className="flex flex-col items-end gap-1">
                {stat.trend && (
                  <span className="text-sm font-bold text-green-600">{stat.trend}</span>
                )}
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <TrendingUp className="w-4 h-4" strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table & Widgets Grid */}
      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* Envios Recentes Table */}
        <div className="flex-[2] bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800">Envios Recentes</h2>
            <a href="#" className="text-sm font-semibold text-indigo-600 hover:underline flex items-center gap-1">
              Ver todos <span className="text-lg leading-none">&rsaquo;</span>
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 font-semibold text-slate-500">Guia</th>
                  <th className="pb-4 font-semibold text-slate-500">Cliente</th>
                  <th className="pb-4 font-semibold text-slate-500">Transportadora</th>
                  <th className="pb-4 font-semibold text-slate-500">Estado</th>
                  <th className="pb-4 font-semibold text-slate-500">Peso</th>
                  <th className="pb-4 font-semibold text-slate-500">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {enviosRecentes.map((envio, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 font-semibold text-slate-700">{envio.guia}</td>
                    <td className="py-4 text-slate-600 font-medium">{envio.cliente}</td>
                    <td className="py-4">
                      {/* Placeholder for Transportadora Logos */}
                      {envio.transportadora === "CTT" ? (
                        <div className="flex items-center gap-2">
                           <div className="w-6 h-6 bg-red-600 rounded-sm"></div>
                           <span className="font-bold text-slate-800 tracking-tight">ctt</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                           <span className="font-bold text-blue-800 tracking-tight leading-none text-xs">
                             Correos<br/><span className="text-red-600">Express</span>
                           </span>
                        </div>
                      )}
                    </td>
                    <td className="py-4">
                      <Badge variant={
                        envio.estado === 'entregue' ? 'success' :
                        envio.estado === 'pendente' ? 'warning' : 'info'
                      }>
                        {envio.estado === 'em transito' ? 'Em Trânsito' : 
                         envio.estado.charAt(0).toUpperCase() + envio.estado.slice(1)}
                      </Badge>
                    </td>
                    <td className="py-4 text-slate-600">{envio.peso}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <button className="px-4 py-1.5 border border-green-600 text-green-600 rounded-md text-xs font-bold hover:bg-green-50 transition-colors">
                          Ver Detalhes
                        </button>
                        <button className="text-slate-400 hover:text-slate-600">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right side - Rastreamento Widget */}
        <div className="flex-1 flex flex-col justify-end">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mt-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800">Rastreamento</h3>
                    <span className="text-indigo-600 font-bold text-sm">LK25051600124</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">CTT • 99999999PT</p>
                </div>
              </div>
              <a href="#" className="text-sm font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                Ver detalhes <span className="text-lg leading-none">&rsaquo;</span>
              </a>
            </div>

            {/* Timeline */}
            <div className="relative pt-2">
              <div className="absolute top-5 left-6 right-6 h-1 bg-green-600 -z-10"></div>
              
              <div className="flex justify-between">
                <div className="flex flex-col items-center w-1/4">
                  <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center mb-3 ring-4 ring-white">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Recebido</span>
                  <span className="text-[10px] text-slate-500 mt-1">16 Mai, 09:12</span>
                  <span className="text-[10px] text-slate-500">Lisboa</span>
                </div>
                
                <div className="flex flex-col items-center w-1/4">
                  <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center mb-3 ring-4 ring-white">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Em Trânsito</span>
                  <span className="text-[10px] text-slate-500 mt-1">16 Mai, 14:45</span>
                  <span className="text-[10px] text-slate-500">Lisboa</span>
                </div>

                <div className="flex flex-col items-center w-1/4">
                  <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center mb-3 ring-4 ring-white">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Em Distribuição</span>
                  <span className="text-[10px] text-slate-500 mt-1">17 Mai, 08:32</span>
                  <span className="text-[10px] text-slate-500">Porto</span>
                </div>

                <div className="flex flex-col items-center w-1/4">
                  <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center mb-3 ring-4 ring-white">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Entregue</span>
                  <span className="text-[10px] text-slate-500 mt-1">17 Mai, 14:18</span>
                  <span className="text-[10px] text-slate-500">Porto</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  )
}
