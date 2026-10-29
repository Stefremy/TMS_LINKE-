"use client"

import * as React from "react"
import { 
  X, 
  Copy,
  Check,
} from "lucide-react"
import type { ServicoLinke } from "../types"

interface DuplicateServicoModalProps {
  isOpen: boolean
  onClose: () => void
  servico: ServicoLinke | null
  onConfirmDuplicate: (
    sourceId: string,
    targetProfile: string,
    targetClientName: string
  ) => Promise<boolean | void>
}

export function DuplicateServicoModal({
  isOpen,
  onClose,
  servico,
  onConfirmDuplicate,
}: DuplicateServicoModalProps) {
  const [targetProfile, setTargetProfile] = React.useState<string>("VIP / Alto Volume")
  const [targetClientName, setTargetClientName] = React.useState<string>("Grandes Contas (>300 envios/mês)")
  const [loading, setLoading] = React.useState(false)
  const [created, setCreated] = React.useState(false)
  const [saveError, setSaveError] = React.useState("")
  const inFlight = React.useRef(false)

  React.useEffect(() => {
    if (isOpen && servico) {
      // Reset the dialog when a different source table is opened.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCreated(false)
      setSaveError("")
      setTargetProfile("VIP / Alto Volume")
      setTargetClientName("Grandes Contas (>300 envios/mês)")
    }
  }, [isOpen, servico])

  if (!isOpen || !servico) return null

  const handleProfileChange = (prof: string) => {
    setTargetProfile(prof)
    if (prof === "VIP / Alto Volume") {
      setTargetClientName("Grandes Contas (>300 envios/mês)")
    } else if (prof === "E-Commerce PME") {
      setTargetClientName("Lojas Online & E-commerce")
    } else {
      setTargetClientName("Cliente Específico (ex: Nome da Empresa)")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlight.current || created) return
    inFlight.current = true
    setLoading(true)
    setSaveError("")
    try {
      const saved = await onConfirmDuplicate(servico.id, targetProfile, targetClientName)
      if (saved === false) setSaveError("Não foi possível criar a tabela. Tente novamente.")
      else setCreated(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível criar a tabela.")
    } finally {
      inFlight.current = false
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
                Criar variante de tarifário para um segmento ou cliente específico.
              </p>
            </div>
          </div>

          <button
            onClick={onClose} disabled={loading}
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
              disabled={loading || created}
              value={targetProfile}
              onChange={(e) => handleProfileChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="VIP / Alto Volume">VIP / Alto Volume (&gt;300 envios/mês)</option>
              <option value="E-Commerce PME">E-Commerce PME (Lojas Online)</option>
              <option value="Tabela Negociada Cliente">Tabela Negociada (Cliente Específico)</option>
              <option value={["VIP / Alto Volume", "E-Commerce PME", "Tabela Negociada Cliente"].includes(targetProfile) ? "" : targetProfile}>Outros</option>
            </select>
          </div>

          {!["VIP / Alto Volume", "E-Commerce PME", "Tabela Negociada Cliente"].includes(targetProfile) && (
            <div className="space-y-1.5">
              <label htmlFor="duplicate-custom-profile" className="block text-xs font-medium text-slate-700">Nome do perfil comercial</label>
              <input id="duplicate-custom-profile" type="text" required maxLength={100} disabled={loading || created}
                value={targetProfile} onChange={e => setTargetProfile(e.target.value)}
                placeholder="Ex: Ilhas aéreo · Loja Aldara"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800" />
            </div>
          )}

          {/* Target Client Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 block">
              Nome do Cliente ou Grupo Alvo
            </label>
            <input
              disabled={loading || created}
              type="text"
              required
              value={targetClientName}
              onChange={(e) => setTargetClientName(e.target.value)}
              placeholder="Ex: Nome da Empresa ou Grupo"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <p className="text-[11px] text-slate-500">
            A variante copia exatamente os preços de venda da tabela de origem, em todas as zonas. Os ajustes por cliente fazem-se depois em &quot;Ajustar Preços&quot;.
          </p>

          {saveError && <p role="alert" className="text-xs text-rose-700">{saveError}</p>}
          {created && <p role="status" className="text-xs text-emerald-700">Tabela criada com sucesso. Pode fechar esta janela.</p>}
          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200/80 flex items-center justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={onClose} disabled={loading}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium transition-colors"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={loading || created}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-2xs transition-colors disabled:opacity-50"
            >
              {created ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {loading ? "A Criar..." : created ? "Gravado" : "Criar Tabela"}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
