"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Search, Package, PlusCircle, Building2, Filter, MoreVertical, Printer, Download, MapPin as MapPinIcon, Undo2, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getClientesAction } from "@/app/actions/clientes"
import { getClientPortalStatsAction, createReturnShipmentAction, deleteShipmentAction, regenerateCttLabelAction } from "@/app/actions/shipments"
import { closeCttShipmentsAction } from "@/app/actions/ctt"
import { ClientShipmentDetailModal } from "@/app/app/components/ClientShipmentDetailModal"
import { printCttLabel, downloadCttLabel } from "@/lib/label-utils"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { getShipmentStatusConfig } from "@/lib/status-helpers"
import { Cliente } from "@/app/ops/entidades/clientes/types"

export function ClientShipmentsHistory() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("clientId")
  const clientNameParam = searchParams.get("clientName")

  const [currentClient, setCurrentClient] = React.useState<Cliente | null>(null)
  const [shipments, setShipments] = React.useState<any[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("todos")
  const [loading, setLoading] = React.useState(true)
  const [closingBatch, setClosingBatch] = React.useState(false)
  const [manifestData, setManifestData] = React.useState<{ fileName: string, base64: string } | null>(null)
  const [openDropdownId, setOpenDropdownId] = React.useState<string | null>(null)
  const [selectedShipment, setSelectedShipment] = React.useState<any | null>(null)

  const printLabel = async (envioItem: any) => {
    let rawLabel = envioItem?.ctt_label_base64
    if (!rawLabel && envioItem?.id) {
      try {
        const res = await regenerateCttLabelAction(envioItem.id)
        if (res.success && res.labelBase64) {
          rawLabel = res.labelBase64
          setShipments(prev => prev.map(s => s.id === envioItem.id ? { ...s, ctt_label_base64: rawLabel } : s))
        }
      } catch (err: any) {
        console.warn("Could not generate CTT label:", err?.message)
      }
    }
    if (rawLabel) {
      printCttLabel(rawLabel)
    } else {
      setSelectedShipment(envioItem)
    }
  }

  const downloadLabel = async (envioItem: any, ref: string) => {
    let rawLabel = envioItem?.ctt_label_base64
    if (!rawLabel && envioItem?.id) {
      try {
        const res = await regenerateCttLabelAction(envioItem.id)
        if (res.success && res.labelBase64) {
          rawLabel = res.labelBase64
          setShipments(prev => prev.map(s => s.id === envioItem.id ? { ...s, ctt_label_base64: rawLabel } : s))
        }
      } catch (err: any) {
        console.warn("Could not generate CTT label:", err?.message)
      }
    }
    if (rawLabel) {
      downloadCttLabel(rawLabel, `${ref}_Etiqueta_CTT.pdf`)
    } else {
      setSelectedShipment(envioItem)
    }
  }

  React.useEffect(() => {
    getClientesAction().then((clients) => {
      let target: Cliente | undefined
      if (clientId) {
        target = clients.find((c) => c.id === clientId)
      }
      if (!target && clientNameParam) {
        const decoded = decodeURIComponent(clientNameParam).toLowerCase()
        target = clients.find((c) => c.short_name.toLowerCase() === decoded || c.legal_name.toLowerCase() === decoded)
      }
      if (!target && clients.length > 0) {
        target = clients[0]
      }
      if (target) {
        setCurrentClient(target)
      }

      getClientPortalStatsAction(target?.id, target?.short_name).then((res) => {
        if (res) {
          setShipments(res.allShipments || res.recentShipments || [])
        }
        setLoading(false)
      })
    })
  }, [clientId, clientNameParam])

  const querySuffix = React.useMemo(() => {
    if (!currentClient) return ""
    return `?clientId=${encodeURIComponent(currentClient.id || "")}&clientName=${encodeURIComponent(currentClient.short_name || "")}`
  }, [currentClient])

  const filteredShipments = React.useMemo(() => {
    return shipments.filter((item) => {
      const q = searchTerm.toLowerCase().trim()
      const ref = (item.tracking_number || item.id || "").toLowerCase()
      const cttRef = (item.ctt_object_id || "").toLowerCase()
      const rec = (item.recipient_name || "").toLowerCase()
      const addr = (item.recipient_address || "").toLowerCase()

      const matchesSearch = !q || ref.includes(q) || cttRef.includes(q) || rec.includes(q) || addr.includes(q)
      const matchesStatus = statusFilter === "todos" || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [shipments, searchTerm, statusFilter])

  const pendingShipments = React.useMemo(() => {
    return shipments.filter(s => s.status === "pendente")
  }, [shipments])

  const handleCloseBatch = async () => {
    if (pendingShipments.length === 0) return
    const idsToClose = pendingShipments.map(s => s.tracking_number || s.id).filter(Boolean)
    if (idsToClose.length === 0) return

    setClosingBatch(true)
    try {
      const res = await closeCttShipmentsAction(idsToClose)
      if (res.success && res.documents && res.documents.length > 0) {
        setManifestData({
          fileName: res.documents[0].FileName || "Manifesto_CTT.pdf",
          base64: res.documents[0].File
        })
        // update local state
        setShipments(prev => prev.map(s => {
          if (idsToClose.includes(s.tracking_number) || idsToClose.includes(s.id)) {
            return { ...s, status: "em_transito" }
          }
          return s
        }))
      } else {
        alert("Erro ao fechar lote de envios CTT.")
      }
    } catch (e: any) {
      alert("Erro ao fechar lote: " + e.message)
    } finally {
      setClosingBatch(false)
    }
  }

  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.action-dropdown')) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto font-sans relative">
      
      {/* Detalhes do Envio Modal */}
      <ClientShipmentDetailModal 
        shipment={selectedShipment} 
        onClose={() => setSelectedShipment(null)} 
        onUpdateShipment={(updated) => {
          setShipments(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s))
        }}
      />
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Link href={`/app${querySuffix}`} className="hover:text-emerald-700">Painel Principal</Link>
            <span>&gt;</span>
            <span className="text-emerald-600 font-bold">Histórico & Envios</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Histórico de Envios & Rastreamento</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe o estado de entrega e comprovativos de receção de todas as guias emitidas.
          </p>
        </div>

        <div className="flex gap-2">
          {pendingShipments.length > 0 && (
            <button
              onClick={handleCloseBatch}
              disabled={closingBatch}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-[0.99] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2"
            >
              {closingBatch ? "A Fechar..." : `Fechar ${pendingShipments.length} Envios`}
            </button>
          )}
          <Link
            href={`/app/criar-guia${querySuffix}`}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Envio</span>
          </Link>
        </div>
      </div>

      {manifestData && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 animate-in fade-in shadow-xs">
          <div className="flex items-center gap-3.5">
            <div>
              <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                <span>Lote Fechado com Sucesso!</span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                O manifesto (Certificado de Aceitação) foi gerado.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                const link = document.createElement("a")
                link.href = `data:application/pdf;base64,${manifestData.base64}`
                link.download = manifestData.fileName
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              Descarregar Manifesto
            </button>
            <button
              type="button"
              onClick={() => setManifestData(null)}
              className="text-emerald-700 hover:text-emerald-950 text-xs font-bold px-2.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisar por envio, guia, destinatário ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Estado:</span>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="todos">Todos os Estados</option>
            <option value="entregue">Entregues</option>
            <option value="em transito">Em Trânsito</option>
            <option value="pendente">Pendentes</option>
          </select>
        </div>
      </div>

      {/* Shipments List Table / Clean State */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
        {filteredShipments.length === 0 ? (
          <div className="py-12 px-4 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">Nenhum envio a apresentar</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Assim que criar novos envios na plataforma, eles ficarão disponíveis aqui com rastreamento detalhado em tempo real.
            </p>
            <Link 
              href={`/app/criar-guia${querySuffix}`}
              className="mt-4 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Novo Envio</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-bold">
                  <th className="pb-3">Guia</th>
                  <th className="pb-3">Destinatário</th>
                  <th className="pb-3">Morada</th>
                  <th className="pb-3">Serviço CTT</th>
                  <th className="pb-3">Estado</th>
                  <th className="pb-3 text-right">Valor</th>
                  <th className="pb-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShipments.map((envio) => (
                  <tr key={envio.id} className="hover:bg-slate-50">
                    <td className="py-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => setSelectedShipment(envio)}
                          className="font-mono font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer text-left transition-colors text-xs"
                          title="Clique para ver os detalhes do envio"
                        >
                          {envio.tracking_number || envio.id}
                        </button>
                        {envio.ctt_object_id && (
                          <span className="font-mono text-[11px] font-bold text-slate-700 mt-0.5" title="Objeto CTT Expresso">
                            {envio.ctt_object_id}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 font-semibold text-slate-800">{envio.recipient_name}</td>
                    <td className="py-3 text-slate-500 truncate max-w-[200px]">{envio.recipient_address}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {getCarrierLogo(envio.service_type || envio.carrier || "ctt") ? (
                          <div className="w-5 h-5 rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={getCarrierLogo(envio.service_type || envio.carrier || "ctt")!} 
                              alt={envio.service_type || "Transportadora"} 
                              className="max-w-full max-h-full object-contain" 
                            />
                          </div>
                        ) : null}
                        <span className="text-xs font-semibold text-slate-700">{envio.service_type || "CTT Expresso"}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      {(() => {
                        const cfg = getShipmentStatusConfig(envio.status)
                        return (
                          <Badge variant={cfg.badgeVariant}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.dotColor} shrink-0`} />
                            <span>{cfg.label}</span>
                          </Badge>
                        )
                      })()}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-slate-900">
                      {envio.sell_price ? `${Number(envio.sell_price).toFixed(2)}€` : "0.00€"}
                    </td>
                    <td className="py-3 text-center relative action-dropdown">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === envio.id ? null : envio.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {openDropdownId === envio.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-10 text-left">
                          <button 
                            onClick={() => {
                              setSelectedShipment(envio);
                              setOpenDropdownId(null);
                            }}
                            className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                          >
                            <Package className="w-3.5 h-3.5 text-slate-500" />
                            Ver Detalhes
                          </button>
                          
                          <button 
                            onClick={() => {
                              setOpenDropdownId(null);
                              printLabel(envio);
                            }}
                            className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Imprimir Etiqueta CTT</span>
                          </button>
                          <button 
                            onClick={() => {
                              setOpenDropdownId(null);
                              downloadLabel(envio, envio.tracking_number || envio.id);
                            }}
                            className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Descarregar PDF</span>
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedShipment(envio);
                              setOpenDropdownId(null);
                            }}
                            className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <MapPinIcon className="w-3.5 h-3.5 text-indigo-600" />
                            Rastreio em Tempo Real
                          </button>

                          <div className="h-px bg-slate-100 my-1" />

                          {/* Criar Devolução */}
                          <button
                            onClick={async () => {
                              setOpenDropdownId(null);
                              const confirmed = window.confirm(`Deseja criar uma guia de DEVOLUÇÃO para o envio ${envio.tracking_number || envio.id}?\n\nO Remetente e Destinatário serão invertidos automaticamente.`);
                              if (!confirmed) return;
                              const res = await createReturnShipmentAction(envio.id);
                              if (res.success) {
                                alert(`✅ Devolução criada com sucesso!\n\nNovo Tracking: ${res.newTrackingNumber}`);
                                window.location.reload();
                              } else {
                                alert("Erro ao criar devolução: " + (res.error || "Erro desconhecido"));
                              }
                            }}
                            className="w-full px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Undo2 className="w-3.5 h-3.5 text-amber-600" />
                            <span>Criar Devolução</span>
                          </button>

                          {/* Eliminar Envio */}
                          <button
                            onClick={async () => {
                              setOpenDropdownId(null);
                              const confirmed = window.confirm(`⚠️ Tem a certeza que deseja ELIMINAR permanentemente o envio ${envio.tracking_number || envio.id}?`);
                              if (!confirmed) return;
                              const res = await deleteShipmentAction(envio.id);
                              if (res.success) {
                                alert(`🗑️ Envio ${envio.tracking_number || envio.id} eliminado com sucesso!`);
                                window.location.reload();
                              } else {
                                alert("Erro ao eliminar envio: " + (res.error || "Erro desconhecido"));
                              }
                            }}
                            className="w-full px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Eliminar Envio</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
