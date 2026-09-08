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

import { ActionMenu } from "./components/ActionMenu"

const mockEnvios = [
  {
    trk: { id: "001004266266", date: "2026-09-08 10:07", ref: "EQ418720658PT", tag: "A01" },
    sender: { name: "VILLA MENTHA", flag: "PT", zip: "2350-565", city: "TORRES NOVAS, PT", phone: "937530377" },
    recipient: { name: "Raquel Pereira", flag: "PT", zip: "1750-063", city: "LISBOA, PT", phone: "931018639" },
    service: { code: "PT CTT#", name: "CTT Expresso", bgColor: "bg-red-600", textColor: "text-white" },
    package: { count: "1 Caixa", weight: "1.00 kg" },
    delivery: { date: "2026-09-08", time: "--/--/--" },
    status: { label: "Atribuído Motorista", subCode: "TR: 1 • E: 1", color: "bg-purple-100 text-purple-700" },
    value: { amount: "3,35€", diff: "-0,47€", diffColor: "text-green-600 border-green-200 bg-green-50", ref: "VILLA" }
  },
  {
    trk: { id: "001004266176", date: "2026-09-08 09:24", ref: "6330003357081083", tag: "A01" },
    sender: { name: "HILOS Y CINTAS", flag: "ES", zip: "03206", city: "ELX/ELCHE, ES", phone: "965461526" },
    recipient: { name: "MÁRIO OLIVEIRA", flag: "PT", zip: "3700-502", city: "ARRIFANA VFR, PT", phone: "916574657" },
    service: { code: "ES PAQ24E", name: "CORREOS EXPRESS", bgColor: "bg-blue-600", textColor: "text-white" },
    package: { count: "1 Caixa", weight: "15.14 kg" },
    delivery: { date: "2026-09-08", time: "--/--/--" },
    status: { label: "Entrada em Rede", subCode: "R: 2", color: "bg-slate-700 text-white" },
    value: { amount: "7,60€", diff: "+1,06€", diffColor: "text-green-600 border-green-200 bg-green-50", ref: "SCARPA" }
  },
  {
    trk: { id: "001004266011", date: "2026-09-08 09:16", ref: "DB250719178PT", tag: "A01" },
    sender: { name: "Tiago Godinho Unipessoal Lda", flag: "PT", zip: "8125-139", city: "Quarteira, PT", phone: "969039595" },
    recipient: { name: "PSICO ESPAÇO - CRISTINA CADEIRINHAS", flag: "PT", zip: "3200-125", city: "COIMBRA, PT", phone: "916511429" },
    service: { code: "PT CTT#", name: "CTT Expresso", bgColor: "bg-red-600", textColor: "text-white" },
    package: { count: "1 Caixa", weight: "6.88 kg" },
    delivery: { date: "2026-09-08", time: "--/--/--" },
    status: { label: "Pendente", subCode: "", color: "bg-slate-200 text-slate-700" },
    value: { amount: "4,67€", diff: "-0,66€", diffColor: "text-green-600 border-green-200 bg-green-50", ref: "IMPPRIMR" }
  },
  {
    trk: { id: "001004265924", date: "2026-09-08 09:14", ref: "DB250719164PT", tag: "A01" },
    sender: { name: "Tiago Godinho Unipessoal Lda", flag: "PT", zip: "8125-139", city: "Quarteira, PT", phone: "969039595" },
    recipient: { name: "PSICO ESPAÇO - CRISTINA CADEIRINHAS", flag: "PT", zip: "4600-281", city: "AMARANTE, PT", phone: "916511429" },
    service: { code: "PT CTT#", name: "CTT Expresso", bgColor: "bg-red-600", textColor: "text-white" },
    package: { count: "1 Caixa", weight: "6.88 kg" },
    delivery: { date: "2026-09-08", time: "--/--/--" },
    status: { label: "Pendente", subCode: "", color: "bg-slate-200 text-slate-700" },
    value: { amount: "4,67€", diff: "+0,66€", diffColor: "text-green-600 border-green-200 bg-green-50", ref: "IMPPRIMR" }
  },
  {
    trk: { id: "001004265882", date: "2026-09-07 23:00", ref: "EQ418720644PT", tag: "A01" },
    sender: { name: "O Estranho Pomar da Rua", flag: "PT", zip: "4430-621", city: "VILA NOVA DE GAIA, PT", phone: "936370460" },
    recipient: { name: "ADELINO JORGE HENRIQUES", flag: "PT", zip: "2435-006", city: "CASAL DOS BERNARDOS - OURÉM, PT", phone: "914008926" },
    service: { code: "PT CTT#", name: "CTT Expresso", bgColor: "bg-red-600", textColor: "text-white" },
    package: { count: "1 Vol.", weight: "3.50 kg" },
    delivery: { date: "2026-09-15", time: "--/--/--" },
    status: { label: "Pendente", subCode: "", color: "bg-slate-200 text-slate-700" },
    value: { amount: "2,98€", diff: "+0,41€", diffColor: "text-green-600 border-green-200 bg-green-50", ref: "20260038" }
  },
  {
    trk: { id: "001004265795", date: "2026-09-07 23:00", ref: "EQ418720635PT", tag: "A01" },
    sender: { name: "Cantinho da pequenada", flag: "PT", zip: "4760-822", city: "LOUSADO, PT", phone: "912104438" },
    recipient: { name: "MARISA CERQUEIRA", flag: "PT", zip: "4490-507", city: "PÓVOA DE VARZIM, PT", phone: "933519518" },
    service: { code: "PT CTT#", name: "CTT Expresso", bgColor: "bg-red-600", textColor: "text-white" },
    package: { count: "1 Vol.", weight: "1.00 kg" },
    delivery: { date: "2026-09-08", time: "--/--/--" },
    status: { label: "Pendente", subCode: "", color: "bg-slate-200 text-slate-700" },
    value: { amount: "2,98€", diff: "+0,41€", diffColor: "text-green-600 border-green-200 bg-green-50", ref: "20260037" }
  },
  {
    trk: { id: "001004265654", date: "2026-09-07 22:56", ref: "EQ418720627PT", tag: "A01" },
    sender: { name: "Cantinho da pequenada", flag: "PT", zip: "4760-822", city: "LOUSADO, PT", phone: "912104438" },
    recipient: { name: "SORAIA ESTEVES DIAS", flag: "PT", zip: "2975-314", city: "QUINTA DO CONDE, PT", phone: "964095191" },
    service: { code: "PT CTT#", name: "CTT Expresso", bgColor: "bg-red-600", textColor: "text-white" },
    package: { count: "1 Vol.", weight: "0.30 kg" },
    delivery: { date: "2026-09-08", time: "--/--/--" },
    status: { label: "Pendente", subCode: "", color: "bg-slate-200 text-slate-700" },
    value: { amount: "2,98€", diff: "+0,41€", diffColor: "text-green-600 border-green-200 bg-green-50", ref: "20260037" }
  },
]

export default function EnviosPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Header Area */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-800">Envios e Serviços</h1>
        <div className="text-sm font-medium text-slate-500 flex items-center">
          Painel de Resumo <span className="mx-1 text-lg leading-none mb-1">&rsaquo;</span> <span className="text-slate-800">Envios e Serviços</span>
        </div>
      </div>

      {/* Toolbar Area */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
        
        <div className="flex items-center gap-2">
          <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" strokeWidth={3} />
            Novo
          </button>
          
          <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5">
            <Package className="w-4 h-4" />
            Recolhas
          </button>
          
          <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            Localizar
          </button>

          <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5">
            <Settings className="w-4 h-4" />
            Ferramentas
            <ChevronDown className="w-4 h-4 ml-1" />
          </button>
          
          <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5">
            <Filter className="w-4 h-4" />
            Filtrar
            <ChevronDown className="w-4 h-4 ml-1" />
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
              placeholder="" 
              className="w-48 pl-8 pr-3 py-1 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm h-8"
            />
          </div>
        </div>

      </div>

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
            {mockEnvios.map((envio, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-4 py-4 align-top">
                  <input type="checkbox" className="rounded border-slate-300 text-green-600 focus:ring-green-500 mt-1" />
                </td>
                
                {/* TRK Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <a href="#" className="font-semibold text-blue-600 hover:underline flex items-center gap-1 text-[13px]">
                      {envio.trk.id}
                      <span className="text-[12px] text-slate-400">📋</span>
                    </a>
                    <span className="text-slate-400 text-[11px]">{envio.trk.date}</span>
                    <span className="text-slate-600 font-medium text-[11px] mt-0.5">{envio.trk.ref}</span>
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-sm w-fit leading-none">
                      {envio.trk.tag}
                    </span>
                  </div>
                </td>

                {/* Remetente Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5 max-w-[180px] whitespace-normal">
                    <span className="font-semibold text-slate-800 text-[12px] leading-tight mb-1">{envio.sender.name}</span>
                    <div className="flex text-slate-500 text-[11px] leading-tight">
                      <span className="mr-1 mt-0.5 shrink-0 text-[10px]">
                        {envio.sender.flag === 'PT' ? '🇵🇹' : '🇪🇸'}
                      </span>
                      <span>{envio.sender.zip} {envio.sender.city}{envio.sender.phone ? `, ${envio.sender.phone}` : ''}</span>
                    </div>
                  </div>
                </td>

                {/* Destinatário Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5 max-w-[180px] whitespace-normal">
                    <span className="font-semibold text-slate-800 text-[12px] leading-tight mb-1">{envio.recipient.name}</span>
                    <div className="flex text-slate-500 text-[11px] leading-tight">
                      <span className="mr-1 mt-0.5 shrink-0 text-[10px]">
                        {envio.recipient.flag === 'PT' ? '🇵🇹' : '🇪🇸'}
                      </span>
                      <span>{envio.recipient.zip} {envio.recipient.city}{envio.recipient.phone ? `, ${envio.recipient.phone}` : ''}</span>
                    </div>
                  </div>
                </td>

                {/* Serviço Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="font-medium text-slate-700 text-[12px]">{envio.service.code}</span>
                    <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-tight leading-none ${envio.service.bgColor} ${envio.service.textColor}`}>
                      {envio.service.name}
                    </span>
                  </div>
                </td>

                {/* Remessa Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-slate-800 text-[12px]">{envio.package.count}</span>
                    <span className="text-slate-500 text-[11px]">{envio.package.weight}</span>
                  </div>
                </td>

                {/* Entrega Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-[12px]">
                      <Truck className="w-3.5 h-3.5 text-slate-500" />
                      {envio.delivery.date}
                    </div>
                    <span className="text-slate-400 text-[11px] ml-5 tracking-widest">{envio.delivery.time}</span>
                    <div className="flex gap-1 mt-1.5 ml-4">
                       <span className="bg-blue-600 text-white p-0.5 rounded-sm"><Settings className="w-3 h-3" /></span>
                    </div>
                  </div>
                </td>

                {/* Estado Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-1 items-start">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold leading-none ${envio.status.color}`}>
                      {envio.status.label}
                    </span>
                    {envio.status.subCode && (
                      <span className="text-slate-500 font-medium text-[10px] tracking-wide ml-1">
                        {envio.status.subCode}
                      </span>
                    )}
                  </div>
                </td>

                {/* Valor Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="font-medium text-slate-800 text-[12px]">{envio.value.amount}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border leading-none ${envio.value.diffColor}`}>
                      {envio.value.diff}
                    </span>
                    <span className="text-slate-400 text-[10px] uppercase font-medium">{envio.value.ref}</span>
                  </div>
                </td>

                {/* Ações Column */}
                <td className="px-4 py-3 align-top text-right overflow-visible">
                  <ActionMenu />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
    </div>
  )
}
