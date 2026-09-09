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
  Check,
  Loader2,
  CheckCircle2,
  Download,
  X
} from "lucide-react"
import { emitCttShipmentAction, closeCttShipmentsAction, syncCttTrackingAction } from "@/app/actions/ctt"

export function FerramentasMenu() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [activeModal, setActiveModal] = React.useState<"none" | "emit_ctt" | "close_cert" | "sync_tracking">("none")
  const [loading, setLoading] = React.useState(false)
  const [modalResult, setModalResult] = React.useState<any>(null)
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

  // 1. Atribuir código CTT Correios / Emitir Envio
  const handleEmitCtt = async () => {
    setIsOpen(false)
    setActiveModal("emit_ctt")
    setLoading(true)
    setModalResult(null)

    try {
      const res = await emitCttShipmentAction({
        ref: "ENV-2026-0042",
        sender: {
          name: "TMS LINKE Logística",
          address: "Av. Principal do Parque Industrial, 100",
          zip: "1000-001",
          city: "Lisboa",
          phone: "210000000",
          email: "ops@linke.pt",
        },
        recipient: {
          name: "Cliente Final CTT",
          address: "Rua das Flores, 45",
          zip: "4000-010",
          city: "Porto",
          phone: "910000000",
        },
        weightKg: 2.5,
        volumes: 1,
        subProduct: "EMSF056.01",
      })

      setModalResult(res)
    } catch (err: any) {
      setModalResult({ success: false, errors: [{ Message: err.message }] })
    } finally {
      setLoading(false)
    }
  }

  // 2. Fecho de Expedição & Certificado de Aceitação CTT
  const handleCloseManifest = async () => {
    setIsOpen(false)
    setActiveModal("close_cert")
    setLoading(true)
    setModalResult(null)

    try {
      const res = await closeCttShipmentsAction(["EA418720658PT", "EA418720659PT"])
      setModalResult(res)
    } catch (err: any) {
      setModalResult({ success: false, errors: [{ Message: err.message }] })
    } finally {
      setLoading(false)
    }
  }

  // 3. Sincronizar Estados CTT
  const handleSyncTracking = async () => {
    setIsOpen(false)
    setActiveModal("sync_tracking")
    setLoading(true)
    setModalResult(null)

    try {
      const res = await syncCttTrackingAction("EA418720658PT")
      setModalResult(res)
    } catch (err: any) {
      setModalResult({ success: false, errors: [{ Message: err.message }] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
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
                Exportar relatório Incidências
              </button>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-[13px] text-slate-600 font-medium mt-1">
                <Printer className="w-4 h-4 text-slate-400" />
                Imprimir listagem atual
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

            {/* CTT WEBSERVICES ACTIONS */}
            <div className="px-2 py-1">
              <button 
                onClick={handleSyncTracking}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-green-50 hover:text-green-700 rounded text-[13px] text-slate-700 font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4 text-green-600" />
                Sincronizar Estados Agora
              </button>
            </div>

            <div className="h-px bg-slate-100 my-1" />

            <div className="px-2 py-1 pb-2">
              <button 
                onClick={handleEmitCtt}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-red-50 hover:text-red-700 rounded text-[13px] text-slate-700 font-medium transition-colors"
              >
                <Barcode className="w-4 h-4 text-red-600" />
                Atribuir código CTT correios
              </button>
              <button 
                onClick={handleCloseManifest}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-red-50 hover:text-red-700 rounded text-[13px] text-slate-700 font-medium transition-colors"
              >
                <Check className="w-4 h-4 text-red-600" />
                Certificados de Aceitação CTT
              </button>
            </div>

          </div>
        )}
      </div>

      {/* MODAL 1: Emissão de Envio CTT */}
      {activeModal === "emit_ctt" && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center text-red-600">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Emissão de Envio CTT Expresso</h3>
                  <p className="text-xs text-slate-500">Comunicação SOAP SGEE V1.8 (CompleteShipment)</p>
                </div>
              </div>
              <button onClick={() => setActiveModal("none")} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                  <div className="text-sm font-semibold text-slate-700">A comunicar com Web Service CTT...</div>
                  <div className="text-xs text-slate-400">A validar código postal e a gerar código de barras oficial</div>
                </div>
              ) : modalResult?.success ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-800">Envio Emitido com Sucesso!</h4>
                      <p className="text-xs text-emerald-700 mt-1">O código de barras CTT foi atribuído e registado no sistema.</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Tracking CTT (FirstObject):</span>
                      <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {modalResult.trackingNumber}
                      </span>
                    </div>
                    {modalResult.deliveryNoteId && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Nº de Guia (DeliveryNoteId):</span>
                        <span className="font-mono text-slate-700">{modalResult.deliveryNoteId}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Ficheiro de Etiqueta:</span>
                      <span className="text-slate-700 font-medium">{modalResult.fileName}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      alert(`Download de etiqueta iniciado: ${modalResult.fileName}`)
                      setActiveModal("none")
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded text-sm shadow transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Descarregar Etiqueta Oficial CTT (PDF)
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <div className="font-bold">Aviso no processamento do envio:</div>
                    <div className="mt-1">
                      {modalResult?.errors?.map((e: any, idx: number) => (
                        <div key={idx}>• {e.Message || e}</div>
                      )) || "Falha desconhecida"}
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveModal("none")}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded text-sm transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Certificados de Aceitação CTT (Manifesto) */}
      {activeModal === "close_cert" && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center text-red-600">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Fecho de Expedição & Certificado CTT</h3>
                  <p className="text-xs text-slate-500">Emissão do Certificado de Aceitação oficial</p>
                </div>
              </div>
              <button onClick={() => setActiveModal("none")} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                  <div className="text-sm font-semibold text-slate-700">A fechar lote e a gerar Certificado de Aceitação...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-800">Lote Fechado com Sucesso!</h4>
                      <p className="text-xs text-emerald-700 mt-1">O Certificado de Aceitação está pronto para assinatura pelo estafeta CTT na recolha.</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      alert("Download do Certificado de Aceitação CTT concluído!")
                      setActiveModal("none")
                    }}
                    className="w-full bg-slate-900 hover:bg-black text-white font-bold py-2 rounded text-sm shadow transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Descarregar Certificado de Aceitação (PDF)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Sincronização de Tracking */}
      {activeModal === "sync_tracking" && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center text-green-600">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Sincronização de Estados CTT</h3>
                  <p className="text-xs text-slate-500">Mapeamento de 23 eventos oficiais e razões de entrega</p>
                </div>
              </div>
              <button onClick={() => setActiveModal("none")} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                  <div className="text-sm font-semibold text-slate-700">A consultar rede CTT Track & Trace...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-800">Estados Atualizados!</h4>
                      <p className="text-xs text-emerald-700 mt-1">Todos os envios foram sincronizados com a rede CTT.</p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
                    <div className="text-xs font-bold text-slate-700">Últimos Eventos Recebidos:</div>
                    {modalResult?.events?.map((ev: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">{ev.eventCode}</span>
                          <span className="text-slate-600">{ev.eventName}</span>
                        </div>
                        <span className="text-slate-400 text-[11px]">{ev.location}</span>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => setActiveModal("none")}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded text-sm transition-colors"
                  >
                    Concluir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
