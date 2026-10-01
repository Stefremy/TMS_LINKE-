"use client"

import * as React from "react"
import { 
  X, 
  Copy, 
  Percent, 
  UserCheck, 
  TrendingDown, 
  ShieldCheck, 
  Sparkles,
  ArrowRight
} from "lucide-react"
import type { ServicoLinke } from "../types"

interface DuplicateServicoModalProps {
  isOpen: boolean
  onClose: () => void
  servico: ServicoLinke | null
  onConfirmDuplicate: (
    sourceId: string,
    targetProfile: "VIP / Alto Volume" | "E-Commerce PME" | "Tabela Negociada Cliente",
    targetClientName: string,
    discountPct: number
  ) => Promise<void>
}

export function DuplicateServicoModal({
  isOpen,
  onClose,
  servico,
  onConfirmDuplicate,
}: DuplicateServicoModalProps) {
  const [targetProfile, setTargetProfile] = React.useState<"VIP / Alto Volume" | "E-Commerce PME" | "Tabela Negociada Cliente">("VIP / Alto Volume")
  const [targetClientName, setTargetClientName] = React.useState<string>("Grandes Contas (>300 envios/mês)")
  const [discountPct, setDiscountPct] = React.useState<number>(12)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (isOpen && servico) {
      setTargetProfile("VIP / Alto Volume")
      setTargetClientName("Grandes Contas (>300 envios/mês)")
      setDiscountPct(12)
    }
  }, [isOpen, servico])

  if (!isOpen || !servico) return null

  const handleProfileChange = (prof: "VIP / Alto Volume" | "E-Commerce PME" | "Tabela Negociada Cliente") => {
    setTargetProfile(prof)
    if (prof === "VIP / Alto Volume") {
      setTargetClientName("Grandes Contas (>300 envios/mês)")
      setDiscountPct(12)
    } else if (prof === "E-Commerce PME") {
      setTargetClientName("Lojas Online & E-commerce")
      setDiscountPct(8)
    } else {
      setTargetClientName("Cliente Específico (ex: Nome da Empresa)")
      setDiscountPct(15)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onConfirmDuplicate(servico.id, targetProfile, targetClientName, discountPct)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200/80">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-slate-900">
                Duplicar Tabela para Cliente
              </h2>
              <p className="text-xs text-slate-500">
                Criar variante de tarifário com desconto de volume ou cliente específico.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Base Service Reference */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Tabela de Origem</span>
            <div className="flex items-center justify-between mt-1">
              <span className="font-medium text-slate-800">{servico.name}</span>
              <span className="font-mono text-xs text-slate-500">{servico.code}</span>
            </div>
          </div>

          {/* Target Profile */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 block">
              Perfil / Segmento
            </label>
            <select
              value={targetProfile}
              onChange={(e) => handleProfileChange(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="VIP / Alto Volume">VIP / Alto Volume (&gt;300 envios/mês)</option>
              <option value="E-Commerce PME">E-Commerce PME (Lojas Online)</option>
              <option value="Tabela Negociada Cliente">Tabela Negociada (Cliente Específico)</option>
            </select>
          </div>

          {/* Target Client Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 block">
              Nome do Cliente ou Grupo Alvo
            </label>
            <input
              type="text"
              required
              value={targetClientName}
              onChange={(e) => setTargetClientName(e.target.value)}
              placeholder="Ex: Nome da Empresa ou Grupo"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Discount Percentage */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 flex justify-between">
              <span>Desconto de Volume sobre o PVP Base</span>
              <span className="font-mono font-medium text-emerald-700">-{discountPct}%</span>
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={discountPct}
              onChange={(e) => setDiscountPct(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            <span className="text-[11px] text-slate-400 block">
              Os preços de venda dos escalões serão reduzidos em {discountPct}%, preservando margem positiva.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200/80 flex items-center justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-2xs transition-colors disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" />
              {loading ? "A Criar..." : "Criar Tabela"}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
