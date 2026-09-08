"use client"

import * as React from "react"
import { 
  Settings,
  ChevronDown,
  Clock,
  FileEdit,
  Upload,
  FileSpreadsheet,
  Printer,
  Users,
  FileText,
  RefreshCw,
  Barcode,
  Check
} from "lucide-react"

export function FerramentasMenu() {
  const [isOpen, setIsOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Close when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`border px-3 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5 ${
          isOpen 
            ? "bg-slate-200 border-slate-400 text-slate-900" 
            : "bg-white border-slate-300 hover:bg-slate-50 text-slate-700"
        }`}
      >
        <Settings className="w-4 h-4" />
        Ferramentas
        <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 text-left max-h-[80vh] overflow-y-auto">
          
          <div className="px-2 py-1">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <Clock className="w-4 h-4 text-slate-400" />
              Serviços Programados
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          <div className="px-2 py-1">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <FileEdit className="w-4 h-4 text-slate-400" />
              Carregamento Provas Entrega
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          <div className="px-2 py-1">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <Upload className="w-4 h-4 text-slate-400" />
              Importador de Ficheiros Excel
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <Upload className="w-4 h-4 text-slate-400" />
              Importar encargos via excel
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          <div className="px-2 py-1">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <FileSpreadsheet className="w-4 h-4 text-slate-400" />
              Exportar listagem detalhada
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <FileSpreadsheet className="w-4 h-4 text-slate-400" />
              Exportar listagem simples
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <FileSpreadsheet className="w-4 h-4 text-slate-400" />
              Exportar detalhe mercadoria
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <FileSpreadsheet className="w-4 h-4 text-slate-400" />
              Exportar detalhe despesas
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <FileSpreadsheet className="w-4 h-4 text-slate-400" />
              Exportar relatório Incidências
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium mt-1">
              <Printer className="w-4 h-4 text-slate-400" />
              Imprimir listagem atual
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <Printer className="w-4 h-4 text-slate-400" />
              Imprimir listagem (por cliente)
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <Printer className="w-4 h-4 text-slate-400" />
              Imprimir mapa carga atual
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          <div className="px-2 py-1">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <Users className="w-4 h-4 text-slate-400" />
              Manifesto Entrega por Motorista
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <FileText className="w-4 h-4 text-slate-400" />
              Guia Genérica por Viatura
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          <div className="px-2 py-1">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <RefreshCw className="w-4 h-4 text-slate-400" />
              Sincronizar Envios numa data
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <RefreshCw className="w-4 h-4 text-slate-400" />
              Sincronizar Estados Agora
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          <div className="px-2 py-1 pb-2">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <Barcode className="w-4 h-4 text-slate-400" />
              Atribuir código CTT correios
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <Check className="w-4 h-4 text-slate-400" />
              Certificados de Aceitação CTT
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <RefreshCw className="w-4 h-4 text-slate-400" />
              Gerar envios das recolhas
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
