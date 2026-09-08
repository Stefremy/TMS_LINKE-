"use client"

import * as React from "react"
import { 
  Info, 
  History, 
  Settings, 
  Printer, 
  Mail, 
  FileText, 
  Plus, 
  ChevronRight,
  ChevronDown
} from "lucide-react"

export function ActionMenu() {
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
    <div className="relative inline-flex items-center justify-end" ref={menuRef}>
      <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1 rounded-l text-[12px] font-semibold shadow-sm transition-colors h-7 flex items-center">
        Editar
      </button>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-slate-100 border border-l-0 border-slate-300 hover:bg-slate-200 text-slate-700 px-1.5 py-1 rounded-r shadow-sm transition-colors h-7 flex items-center"
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 text-left">
          
          <div className="px-2 py-1">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <Info className="w-4 h-4 text-slate-400" />
              Detalhes do Serviço
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium">
              <History className="w-4 h-4 text-slate-400" />
              Histórico de Edições
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          <div className="px-2 py-1">
            <button className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-blue-600 font-medium">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Executar Ação...
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          <div className="px-2 py-1">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-purple-700 font-medium">
              <Printer className="w-4 h-4" />
              Guia Transporte
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-purple-700 font-medium">
              <Printer className="w-4 h-4" />
              Etiquetas
            </button>
            <button className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-purple-700 font-medium">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4" />
                Imprimir outros...
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          <div className="px-2 py-1">
            <button className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-green-600 font-medium">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Enviar por e-mail...
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          <div className="px-2 pt-2 pb-1">
            <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Vendas</div>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-blue-600 font-medium">
              <FileText className="w-4 h-4" />
              Emitir fatura
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-blue-600 font-medium">
              <FileText className="w-4 h-4" />
              Emitir Guia AT
            </button>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          <div className="px-2 pt-1 pb-2">
            <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Compras</div>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-blue-600 font-medium">
              <Plus className="w-4 h-4" strokeWidth={3} />
              Lançar fatura compra
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
