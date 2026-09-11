"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { 
  Package, 
  Search, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  Share2, 
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  MessageCircle,
  Mail,
  RefreshCw,
  Loader2
} from "lucide-react"

import { getPublicShipmentTrackingAction } from "@/app/actions/shipments"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { getShipmentStatusConfig } from "@/lib/status-helpers"

export default function PublicTrackingPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>A carregar portal de rastreio...</span>
        </div>
      </div>
    }>
      <PublicTrackingContent />
    </React.Suspense>
  )
}

function PublicTrackingContent() {
  const searchParams = useSearchParams()
  const initialTrk = searchParams.get("trk") || ""

  const [trackingInput, setTrackingInput] = React.useState(initialTrk)
  const [activeTracking, setActiveTracking] = React.useState(initialTrk)
  const [data, setData] = React.useState<any | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const performSearch = React.useCallback(async (query: string) => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await getPublicShipmentTrackingAction(query.trim())
      if (res.success && res.shipment) {
        setData(res)
        setActiveTracking(res.shipment.trackingNumber)
        // Update URL cleanly without reloading
        const url = new URL(window.location.href)
        url.searchParams.set("trk", res.shipment.trackingNumber)
        window.history.replaceState({}, "", url.toString())
      } else {
        setData(null)
        setError(res.error || "Não foi possível encontrar este envio.")
      }
    } catch (err: any) {
      setError("Erro ao consultar o rastreio. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (initialTrk) {
      performSearch(initialTrk)
    }
  }, [initialTrk, performSearch])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    performSearch(trackingInput)
  }

  const handleCopyLink = () => {
    if (typeof window === "undefined") return
    const url = `${window.location.origin}/tracking?trk=${encodeURIComponent(activeTracking || trackingInput)}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleShareWhatsApp = () => {
    if (typeof window === "undefined" || !data?.shipment) return
    const url = `${window.location.origin}/tracking?trk=${encodeURIComponent(data.shipment.trackingNumber)}`
    const text = `📦 Siga o rastreio da sua encomenda Linke Logistics (${data.shipment.trackingNumber}):\n${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
  }

  const handleShareEmail = () => {
    if (typeof window === "undefined" || !data?.shipment) return
    const url = `${window.location.origin}/tracking?trk=${encodeURIComponent(data.shipment.trackingNumber)}`
    const subject = `Rastreio de Encomenda - ${data.shipment.trackingNumber}`
    const body = `Olá,\n\nPode acompanhar a sua encomenda em tempo real através da ligação:\n${url}\n\nObrigado,\nLinke Logistics`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank")
  }

  const shipment = data?.shipment
  const timeline = data?.timeline || []
  const statusCfg = getShipmentStatusConfig(shipment?.status)

  const steps = [
    { key: "pendente", label: "Aceitação", desc: "Registo Linke & CTT" },
    { key: "em_transito", label: "Em Trânsito", desc: "Rede de Distribuição" },
    { key: "em_distribuicao", label: "Em Distribuição", desc: "Com o Estafeta" },
    { key: "entregue", label: "Entregue", desc: "Entrega Concluída" },
  ]

  const getStepState = (stepKey: string) => {
    const current = shipment?.status || "pendente"
    if (current === "incidencia" && stepKey === "entregue") return "failed"
    if (current === "devolvido" && stepKey === "entregue") return "returned"

    const order = ["pendente", "em_transito", "em_distribuicao", "entregue"]
    const currentIndex = order.indexOf(current === "incidencia" ? "em_distribuicao" : current)
    const stepIndex = order.indexOf(stepKey)

    if (stepIndex < currentIndex) return "completed"
    if (stepIndex === currentIndex) return "current"
    return "upcoming"
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 text-slate-800 font-sans flex flex-col">
      
      {/* Top Navbar */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 leading-none">
                linke <span className="text-emerald-600 font-bold text-sm">tracking</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                Portal Público de Rastreio em Tempo Real
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href="/app" 
              className="text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors hidden sm:inline"
            >
              Área de Cliente
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {/* Search Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center relative overflow-hidden">
          <div className="max-w-xl mx-auto space-y-4">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Onde está a sua encomenda?
            </h1>
            <p className="text-sm text-slate-500">
              Introduza o número da sua guia <strong className="text-slate-800 font-bold">LTK...</strong> ou referência CTT para acompanhar o envio em tempo real.
            </p>

            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2 pt-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input 
                  type="text"
                  placeholder="Ex: LTK1425602"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-mono font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all uppercase"
                />
              </div>
              <button 
                type="submit"
                disabled={loading || !trackingInput.trim()}
                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>A Procurar...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Rastrear</span>
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-semibold flex items-center gap-2 text-left animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Results View */}
        {shipment && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-200">
            
            {/* Live Status Header Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Número de Guia</span>
                    <span className="font-mono text-base font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {shipment.trackingNumber}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span>Destino: <strong>{shipment.destinationCity}</strong></span>
                    <span>•</span>
                    <span>Serviço: <strong>{shipment.serviceType}</strong></span>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-1.5">
                  <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-2xs ${statusCfg.color}`}>
                    <span className={`w-2 h-2 rounded-full ${statusCfg.dotColor} shrink-0`} />
                    <span>{statusCfg.label}</span>
                  </span>
                  
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>Rede: <strong className="text-slate-700">{shipment.carrierName || "CTT Expresso"}</strong></span>
                    {shipment.carrierTrackingNumber && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-slate-600">Ref: <strong>{shipment.carrierTrackingNumber}</strong></span>
                      </>
                    )}
                    {shipment.carrierDirectUrl && (
                      <a
                        href={shipment.carrierDirectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-0.5 ml-1 hover:underline"
                        title="Ver no site da transportadora"
                      >
                        <span>CTT</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Stepper */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {steps.map((step, idx) => {
                    const stepState = getStepState(step.key)
                    const isCompleted = stepState === "completed"
                    const isCurrent = stepState === "current"
                    
                    return (
                      <div 
                        key={step.key}
                        className={`p-4 rounded-2xl border transition-all ${
                          isCurrent
                            ? "bg-emerald-50/80 border-emerald-300 shadow-xs"
                            : isCompleted
                            ? "bg-slate-50/70 border-slate-200"
                            : "bg-white border-slate-200/60 opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${
                            isCurrent ? "text-emerald-700" : isCompleted ? "text-slate-500" : "text-slate-400"
                          }`}>
                            Etapa {idx + 1}
                          </span>
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : isCurrent ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                          )}
                        </div>
                        <h4 className={`text-xs font-bold ${isCurrent ? "text-slate-900" : "text-slate-700"}`}>
                          {step.label}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                          {step.desc}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Share & Action Bar */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500 font-medium">
                  Partilhar este envio com o cliente final:
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Link Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareEmail}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>E-mail</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Detailed Timeline Scans */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>Histórico de Leituras Óticas CTT Expresso</span>
                </h3>
                <span className="text-xs text-slate-400">
                  {timeline.length} leitura(s) registadas
                </span>
              </div>

              {timeline.length === 0 ? (
                <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 mb-1">Aguardar Primeira Leitura / Pickagem CTT</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Ainda não existem leituras óticas registadas na rede de distribuição para esta guia. O histórico será atualizado assim que o estafeta recolher e processar o volume.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 pt-2">
                  {timeline.map((ev: any, idx: number) => {
                    const isLatest = idx === timeline.length - 1
                    const dateStr = ev.timestamp
                      ? new Date(ev.timestamp).toLocaleDateString("pt-PT", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"

                    return (
                      <div key={ev.id || idx} className="relative group">
                        {/* Indicator Dot */}
                        <div className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${
                          isLatest ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-slate-400"
                        }`} />

                        <div className="bg-slate-50 hover:bg-slate-100/80 transition-colors p-4 rounded-2xl border border-slate-200/80">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-black bg-slate-800 text-white px-1.5 py-0.5 rounded">
                                {ev.eventCode}
                              </span>
                              <span className="text-xs font-bold text-slate-900">
                                {ev.eventName}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 font-medium">
                              {dateStr}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 mt-1">
                            {ev.description}
                          </p>

                          {ev.location && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2 font-medium">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{ev.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400 mt-auto">
        <p>© {new Date().getFullYear()} Linke Logistics, Lda. • Powered by CTT Expresso API</p>
      </footer>

    </div>
  )
}
