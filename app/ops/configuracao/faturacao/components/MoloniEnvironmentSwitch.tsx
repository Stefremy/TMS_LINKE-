"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Cloud, Loader2 } from "lucide-react"
import { switchMoloniEnvironmentAction } from "@/app/actions/moloni"
import { MoloniConnectModal } from "@/app/ops/faturacao/contas-corrente/MoloniConnectModal"

type Environment = "test" | "live"
type ConnectionSummary = { isConnected: boolean; companyId?: string; companyName?: string; connectedAt?: string; fromEnvironmentVariables?: boolean }

interface MoloniEnvironmentSwitchProps {
  environment: Environment
  connections?: { test: ConnectionSummary; live: ConnectionSummary }
  canSwitch: boolean
  clientId?: string
  redirectUri?: string
}

const LABEL: Record<Environment, string> = { test: "Teste", live: "Produção" }

/** Compact toolbar control: Teste | Produção segmented switch, active company and one "Gerir conta" button. */
export function MoloniEnvironmentSwitch({ environment, connections, canSwitch, clientId, redirectUri }: MoloniEnvironmentSwitchProps) {
  const router = useRouter()
  const [connectFor, setConnectFor] = React.useState<Environment | null>(null)
  const [confirmLive, setConfirmLive] = React.useState(false)
  const [confirmation, setConfirmation] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const active = connections?.[environment]

  const activate = async (target: Environment) => {
    setPending(true)
    setError(null)
    try {
      const res = await switchMoloniEnvironmentAction(target, confirmation)
      if (!res.success) {
        setError(res.error || "Não foi possível mudar o ambiente.")
        return
      }
      setConfirmLive(false)
      setConfirmation("")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  const choose = (target: Environment) => {
    setError(null)
    if (target === environment) return
    if (!connections?.[target]?.isConnected) {
      setConnectFor(target)
      return
    }
    if (!canSwitch) {
      setError("Só um administrador pode mudar o ambiente Moloni.")
      return
    }
    if (target === "live") setConfirmLive(true)
    else activate("test")
  }

  const segment = (env: Environment) => {
    const selected = environment === env
    const tone = env === "live" ? "bg-red-600 text-white" : "bg-amber-500 text-white"
    return (
      <button key={env} type="button" onClick={() => choose(env)} disabled={pending} aria-pressed={selected}
        title={connections?.[env]?.isConnected ? `Ativar ${LABEL[env]}` : `Ligar a conta de ${LABEL[env]}`}
        className={`px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${selected ? tone : "text-slate-600 hover:bg-slate-100"}`}>
        {LABEL[env]}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Ambiente Moloni" className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white shadow-2xs">
          {segment("test")}
          {segment("live")}
        </div>

        <span className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className={`h-2 w-2 rounded-full ${active?.isConnected ? "bg-emerald-600" : "bg-amber-500"}`} />
          {active?.isConnected ? (active.companyName || `Empresa ${active.companyId}`) : "Sem conta ligada"}
        </span>

        <button type="button" onClick={() => setConnectFor(environment)}
          className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded font-medium text-xs shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer">
          <Cloud className="w-3.5 h-3.5 text-slate-500" />
          <span>Gerir conta</span>
        </button>
      </div>

      {confirmLive && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>As faturas passam a ser documentos fiscais reais em <strong>{connections?.live.companyName || "Produção"}</strong>. Escreva <strong>PRODUCAO</strong>:</span>
          <input value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="PRODUCAO" aria-label="Confirmação"
            className="w-28 rounded border border-red-300 bg-white px-2 py-1 font-mono focus:outline-none focus:ring-2 focus:ring-red-300" />
          <button type="button" disabled={pending || confirmation.trim().toUpperCase() !== "PRODUCAO"} onClick={() => activate("live")}
            className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-40 flex items-center gap-1 cursor-pointer">
            {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Ativar
          </button>
          <button type="button" onClick={() => { setConfirmLive(false); setConfirmation("") }}
            className="px-2 py-1 rounded font-semibold hover:bg-white cursor-pointer">Cancelar</button>
        </div>
      )}

      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}

      <MoloniConnectModal
        isOpen={connectFor !== null}
        onClose={() => setConnectFor(null)}
        environment={connectFor || "test"}
        config={connectFor ? {
          isConnected: connections?.[connectFor].isConnected,
          companyName: connections?.[connectFor].companyName,
          companyId: connections?.[connectFor].companyId,
          clientId, redirectUri,
        } : undefined}
      />
    </div>
  )
}
