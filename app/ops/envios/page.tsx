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

import { ActionMenu } from "./components/ActionMenu"
import { FerramentasMenu } from "./components/FerramentasMenu"

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

const mockRecolhas = [
  {
    trk: { id: "REC001", date: "2026-09-08 10:00", ref: "R-9921", tag: "R01" },
    sender: { name: "Armazém Central", flag: "PT", zip: "4000-000", city: "PORTO, PT", phone: "910000000" },
    recipient: { name: "Cliente B", flag: "PT", zip: "4700-000", city: "BRAGA, PT", phone: "920000000" },
    service: { code: "REC_STD", name: "Recolha Standard", bgColor: "bg-orange-500", textColor: "text-white" },
    package: { count: "1 Vol.", weight: "15.00 kg" },
    delivery: { date: "2026-09-09", time: "--/--/--" },
    status: { label: "Por Atribuir", subCode: "R: 0", color: "bg-orange-100 text-orange-700" },
    value: { amount: "0,00€", diff: "0,00€", diffColor: "text-slate-600 border-slate-200 bg-slate-50", ref: "REC1" }
  },
  {
    trk: { id: "REC002", date: "2026-09-08 11:30", ref: "R-9922", tag: "R02" },
    sender: { name: "Fábrica Norte", flag: "PT", zip: "4800-000", city: "GUIMARÃES, PT", phone: "930000000" },
    recipient: { name: "Loja Lisboa", flag: "PT", zip: "1000-000", city: "LISBOA, PT", phone: "940000000" },
    service: { code: "REC_URG", name: "Recolha Urgente", bgColor: "bg-blue-600", textColor: "text-white" },
    package: { count: "5 Vol.", weight: "120.00 kg" },
    delivery: { date: "2026-09-08", time: "18:00" },
    status: { label: "Agendado", subCode: "M: 1", color: "bg-blue-100 text-blue-700" },
    value: { amount: "45,00€", diff: "+5,00€", diffColor: "text-green-600 border-green-200 bg-green-50", ref: "REC2" }
  }
]

export default function EnviosPage() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showFilters, setShowFilters] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<"envios" | "recolhas">("envios")

  const dataSource = viewMode === "envios" ? mockEnvios : mockRecolhas

  const filteredEnvios = dataSource.filter((item) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      item.trk.id.toLowerCase().includes(q) ||
      item.trk.ref.toLowerCase().includes(q) ||
      item.sender.name.toLowerCase().includes(q) ||
      item.recipient.name.toLowerCase().includes(q) ||
      item.service.name.toLowerCase().includes(q) ||
      item.status.label.toLowerCase().includes(q) ||
      item.value.amount.toLowerCase().includes(q)
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
          <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors flex items-center gap-1.5">
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
            <div className="flex flex-col gap-1 w-32">
              <div className="flex justify-between items-center"><label className="font-semibold text-slate-600">Motorista Rec.</label><span className="text-[9px] text-blue-500 cursor-pointer hover:underline">Todos</span></div>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <label className="font-semibold text-slate-600">Viatura</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
          </div>

          {/* Row 2 */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">País Origem</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">País Destino</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <label className="font-semibold text-slate-600">Distrito Destino</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <label className="font-semibold text-slate-600">Concelho Destino</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-20">
              <label className="font-semibold text-slate-600">CP Origem</label>
              <input type="text" className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
            </div>
            <div className="flex flex-col gap-1 w-20">
              <label className="font-semibold text-slate-600">CP Destino</label>
              <input type="text" className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">Cobrança</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">Portes</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">Anexos</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">Fatura</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">Nº Fatura</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todas</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">Taxas</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
          </div>

          {/* Row 3 */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1 w-36">
              <label className="font-semibold text-slate-600">Tipo Taxa</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">Fatura Compra</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">Subcontrato</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <label className="font-semibold text-slate-600 flex items-center gap-1"><Plus className="w-3 h-3"/> Outros Filtros</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">Bloqueado</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-slate-600">Impresso</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-64">
              <label className="font-semibold text-slate-600">Cliente</label>
              <div className="flex">
                <span className="bg-slate-100 border border-slate-300 border-r-0 rounded-l px-2 py-1.5 text-slate-500 font-bold">=</span>
                <select className="w-full border border-slate-300 rounded-r px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                  <option>Todos</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <label className="font-semibold text-slate-600">Tipo Cliente</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <label className="font-semibold text-slate-600">Vendedor</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
          </div>

          {/* Row 4 */}
          <div className="flex items-end gap-4 flex-wrap mt-2">
            <div className="flex flex-col gap-1 w-36">
              <label className="font-semibold text-slate-600">Criado Por</label>
              <select className="border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-40">
              <label className="font-semibold text-slate-600">Volumes</label>
              <div className="flex items-center gap-1">
                <input type="text" placeholder="Min" className="w-full border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
                <span className="text-slate-400">até</span>
                <input type="text" placeholder="Max" className="w-full border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
              </div>
            </div>
            <div className="flex flex-col gap-1 w-40">
              <label className="font-semibold text-slate-600">Peso</label>
              <div className="flex items-center gap-1">
                <input type="text" placeholder="Min" className="w-full border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
                <span className="text-slate-400">até</span>
                <input type="text" placeholder="Max" className="w-full border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
              </div>
            </div>

            <div className="flex items-center gap-4 ml-2 mb-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                <span className="text-slate-700 font-semibold">Ocultar Finalizados</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                <span className="text-slate-700 font-semibold">Ocultar Agendados</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                <span className="text-slate-700 font-semibold">Apagados</span>
              </label>

              <button className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-bold ml-4">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21 21-4.3-4.3"/><path d="M11 20A9 9 0 1 0 11 2a9 9 0 0 0 0 18Z"/><path d="m14 14-6-6"/><path d="m8 14 6-6"/></svg>
                Limpar Filtros
              </button>
            </div>
          </div>

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
                  <ActionMenu trackingRef={envio.trk.ref} isCtt={envio.service.code.includes('CTT')} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
    </div>
  )
}
