"use client"

import * as React from "react"
import Link from "next/link"
import { Search, Package, PlusCircle, Building2, Filter, MoreVertical, Printer, Download, MapPin as MapPinIcon, Undo2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getClientPortalStatsAction, getShipmentLabelAction, createReturnShipmentAction, deleteShipmentAction } from "@/app/actions/shipments"
import { closeCttShipmentsAction, convertZplToPdfAction } from "@/app/actions/ctt"
import { ClientShipmentDetailModal } from "@/app/app/components/ClientShipmentDetailModal"
import { printCttLabel, downloadCttLabel } from "@/lib/label-utils"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { getShipmentStatusConfig } from "@/lib/status-helpers"
import { useClientScope } from "./ClientScope"
import { useTrackingPolling } from "@/lib/hooks/useTrackingPolling"
import { ManifestDocuments } from "@/components/manifest-documents"
import type { CTTDocumentData } from "@/lib/services/ctt/ctt-types"

export function ClientShipmentsHistory() {
  const { client: currentClient, basePath } = useClientScope()
  const [shipments, setShipments] = React.useState<any[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("todos")
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState(false)
  const [closingBatch, setClosingBatch] = React.useState(false)
  const [manifestData, setManifestData] = React.useState<{ fileName: string, base64: string, documents?: CTTDocumentData[] } | null>(null)
  const [openDropdownId, setOpenDropdownId] = React.useState<string | null>(null)
  const [selectedShipment, setSelectedShipment] = React.useState<any | null>(null)

  const resolveLabel = async (rawLabel: string | null | undefined): Promise<string | null> => {
    if (!rawLabel) return null
    if (rawLabel.trimStart().startsWith("^XA")) {
      const res = await convertZplToPdfAction(rawLabel)
      if (res.success && res.base64) return res.base64
      alert(`Falha ao converter etiqueta ZPL para PDF: ${res.error || "Erro desconhecido"}`)
      return null
    }
    return rawLabel
  }

  const fetchLabelForShipment = async (item: any, fallbackRef?: string): Promise<string | null> => {
    let rawLabel = item?.ctt_label_base64 || item?.carrier_label_base64 || item?.labelBase64
    if (!rawLabel) {
      const candidates = [
        item?.rawId,
        item?.id,
        item?.carrier_tracking_number,
        item?.ctt_object_id,
        item?.tracking_number,
        fallbackRef,
        item?.reference
      ].filter(Boolean) as string[]

      for (const idToSearch of Array.from(new Set(candidates))) {
        try {
          rawLabel = await getShipmentLabelAction(idToSearch)
          if (rawLabel) break
        } catch {}
      }
    }
    return resolveLabel(rawLabel)
  }

  const printLabel = async (envioItem: any) => {
    const label = await fetchLabelForShipment(envioItem)
    if (label) {
      printCttLabel(label)
    } else {
      alert("Não foi possível carregar a etiqueta para este envio.")
    }
  }

  const downloadLabel = async (envioItem: any, ref: string) => {
    const label = await fetchLabelForShipment(envioItem, ref)
    if (label) {
      const carrier = (envioItem?.transportadora || envioItem?.servico || "").toLowerCase().includes("correos") ? "Correos" : "CTT"
      downloadCttLabel(label, `${ref || "envio"}_Etiqueta_${carrier}.pdf`)
    } else {
      alert("Não foi possível carregar a etiqueta para este envio.")
    }
  }

  React.useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    getClientPortalStatsAction(currentClient.id, currentClient.short_name).then(res => {
      if (!active) return
      
      const list = res?.allShipments || res?.recentShipments || []
      setShipments(list)
      
      if (!res) setLoadError(true)
      setLoading(false)
    }).catch(() => { if (active) { setLoadError(true); setLoading(false) } })
    return () => { active = false }
  }, [currentClient.id, currentClient.short_name])


  const activeIds = React.useMemo(() => shipments
    .filter(s => !["entregue", "devolvido", "cancelado"].includes(s.status))
    .map(s => s.id).filter(Boolean) as string[], [shipments])
  useTrackingPolling(activeIds, async signal => {
    const fresh = await getClientPortalStatsAction(currentClient.id, currentClient.short_name)
    if (fresh && !signal.aborted) setShipments(fresh.allShipments || fresh.recentShipments || [])
  })

  const filteredShipments = React.useMemo(() => {
    return shipments.filter((item) => {
      const q = searchTerm.toLowerCase().trim()
      const ref = (item.tracking_number || item.id || "").toLowerCase()
      const internalRef = (item.reference || "").toLowerCase()
      const cttRef = (item.carrier_tracking_number || item.ctt_object_id || "").toLowerCase()
      const rec = (item.recipient_name || "").toLowerCase()
      const addr = (item.recipient_address || "").toLowerCase()

      const matchesSearch = !q || ref.includes(q) || internalRef.includes(q) || cttRef.includes(q) || rec.includes(q) || addr.includes(q)
      const matchesStatus = statusFilter === "todos" || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [shipments, searchTerm, statusFilter])

  // Pagination (15 por página)
  const pageSize = 15
  const [currentPage, setCurrentPage] = React.useState(1)

  // Reiniciar página quando os filtros ou pesquisa mudam
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  const totalPages = Math.ceil(filteredShipments.length / pageSize) || 1
  const paginatedShipments = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredShipments.slice(startIndex, startIndex + pageSize)
  }, [filteredShipments, currentPage, pageSize])

  const pendingShipments = React.useMemo(() => {
    return shipments.filter(s => s.status === "pendente" && ["ctt", "ctt_expresso"].includes(s.carrier_code) && !s.ctt_manifest_pdf && !["manifesto_fechado", "expedido"].includes(s.ops_substatus))
  }, [shipments])

  const handleCloseBatch = async () => {
    if (pendingShipments.length === 0) return
    const idsToClose = pendingShipments.map(s => s.id).filter(Boolean)
    if (idsToClose.length === 0) return

    setClosingBatch(true)
    try {
      const res = await closeCttShipmentsAction(idsToClose)
      if (res.success) {
        if (res.manifestPdfBase64) setManifestData({
          fileName: "Manifesto_CTT.pdf",
          base64: res.manifestPdfBase64,
          documents: res.documents
        })
        if (res.warning) alert(res.warning)
        // update local state
        setShipments(prev => prev.map(s => {
          if (idsToClose.includes(s.tracking_number) || idsToClose.includes(s.id)) {
            return { ...s, ops_substatus: "manifesto_fechado" }
          }
          return s
        }))
      } else {
        alert(res.error || "Não foi possível confirmar o fecho do manifesto CTT.")
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
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (loading || loadError) return (
    <div className="p-8 text-sm text-slate-600" role="status">
      <h1 className="text-lg font-semibold text-slate-900">{currentClient.legal_name || currentClient.short_name}</h1>
      <p>{loadError ? "Não foi possível carregar os envios desta conta." : "A carregar os envios desta conta..."}</p>
    </div>
  )

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
            <Link href={basePath} className="hover:text-emerald-700">Painel Principal</Link>
            <span>&gt;</span>
            <span className="text-emerald-600 font-bold">Histórico & Envios</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Histórico de Envios & Rastreamento</h1>
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
            href={`${basePath}/criar-guia`}
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
            <ManifestDocuments documents={manifestData.documents} />
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
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 p-3.5 sm:p-6">
        {filteredShipments.length === 0 ? (
          <div className="py-12 px-4 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">Nenhum envio a apresentar</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Assim que criar novos envios na plataforma, eles ficarão disponíveis aqui com rastreamento detalhado em tempo real.
            </p>
            <Link 
              href={`${basePath}/criar-guia`}
              className="mt-4 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Novo Envio</span>
            </Link>
          </div>
        ) : (
          <div>
            {/* ─── MOBILE CARDS VIEW (md:hidden) ─── */}
            <div className="tms-compact-list divide-y divide-slate-100">
              {paginatedShipments.map((envio) => {
                const linkeRef =
                  (envio.reference?.startsWith("LTK") ? envio.reference : null) ||
                  (envio.tracking_number?.startsWith("LTK") ? envio.tracking_number : null) ||
                  (envio.ctt_label_base64?.match(/Ref:\s*(LTK\d+)/i)?.[1]) ||
                  envio.reference ||
                  null

                const isCorreos = envio.carrier_code === "correos" ||
                  envio.carrier_code === "correos_express" ||
                  (typeof envio.service_type === "string" && envio.service_type.toLowerCase().includes("correos")) ||
                  /^\d{16}$/.test(envio.carrier_tracking_number || "")

                const carrierRef =
                  envio.carrier_tracking_number ||
                  (!isCorreos ? envio.ctt_object_id : null) ||
                  (!envio.tracking_number?.startsWith("LTK") ? envio.tracking_number : null)

                const primaryDisplay = linkeRef || carrierRef || envio.id
                const secondaryDisplay = (linkeRef && carrierRef && carrierRef !== linkeRef) ? carrierRef : null
                const statusCfg = getShipmentStatusConfig(envio.status)
                const carrierLogo = getCarrierLogo(envio.service_type || envio.carrier || "ctt")
                const tracking = envio.tracking_number || envio.id

                return (
                  <div key={envio.id} className="p-3.5 space-y-2.5 hover:bg-slate-50/80 transition-colors">
                    {/* Top Row: Ref/Tracking + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedShipment(envio)}
                          className="font-mono font-bold text-xs text-emerald-700 hover:underline truncate text-left block"
                        >
                          {primaryDisplay}
                        </button>
                        {secondaryDisplay && (
                          <div className="font-mono text-[10px] text-slate-500 truncate">
                            {isCorreos ? "CORREOS: " : "CTT: "}
                            <span className="font-semibold text-slate-800">{secondaryDisplay}</span>
                          </div>
                        )}
                      </div>
                      <Badge variant={statusCfg.badgeVariant} className="shrink-0 text-[10px]">
                        {statusCfg.label}
                      </Badge>
                    </div>

                    {/* Middle Row: Recipient & Carrier */}
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 truncate">
                          {envio.recipient_name || "Sem nome"}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {envio.recipient_city || envio.recipient_postal || envio.recipient_address || "Portugal"}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {carrierLogo ? (
                          <div className="w-5 h-5 rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden shadow-2xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={carrierLogo} alt="Carrier" className="max-w-full max-h-full object-contain" />
                          </div>
                        ) : null}
                        <span className="text-[11px] font-semibold text-slate-700">
                          {envio.service_type || "CTT Expresso"}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Value & Action Buttons */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <div className="font-bold font-mono text-slate-900">
                        {envio.sell_price ? `${Number(envio.sell_price).toFixed(2)}€` : "0.00€"}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedShipment(envio)}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => printLabel(envio)}
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          title="Imprimir Etiqueta"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadLabel(envio, tracking)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          title="Descarregar PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ─── DESKTOP TABLE VIEW (hidden md:block) ─── */}
            <div className="tms-wide-list overflow-x-auto">
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
                {paginatedShipments.map((envio) => (
                  <tr key={envio.id} className="hover:bg-slate-50">
                    <td className="py-3">
                      {(() => {
                        const linkeRef =
                          (envio.reference?.startsWith("LTK") ? envio.reference : null) ||
                          (envio.tracking_number?.startsWith("LTK") ? envio.tracking_number : null) ||
                          (envio.ctt_label_base64?.match(/Ref:\s*(LTK\d+)/i)?.[1]) ||
                          envio.reference ||
                          null

                        const isCorreos = envio.carrier_code === "correos" ||
                          envio.carrier_code === "correos_express" ||
                          (typeof envio.service_type === "string" && envio.service_type.toLowerCase().includes("correos")) ||
                          /^\d{16}$/.test(envio.carrier_tracking_number || "")

                        const carrierRef =
                          envio.carrier_tracking_number ||
                          (!isCorreos ? envio.ctt_object_id : null) ||
                          (!envio.tracking_number?.startsWith("LTK") ? envio.tracking_number : null)

                        const primaryDisplay = linkeRef || carrierRef || envio.id
                        const secondaryDisplay = (linkeRef && carrierRef && carrierRef !== linkeRef) ? carrierRef : null

                        return (
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => setSelectedShipment(envio)}
                              className="font-mono font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer text-left transition-colors text-xs flex items-center gap-1.5"
                              title="Clique para ver os detalhes do envio e rastreio interno"
                            >
                              <span>{primaryDisplay}</span>
                            </button>
                            {secondaryDisplay && (
                              <div className="flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-600 mt-0.5" title={isCorreos ? "Expedición / Rastreio Correos Express" : "Objeto / Guia CTT Expresso"}>
                                <span className="text-slate-400 font-sans text-[10px] uppercase font-bold">{isCorreos ? "CORREOS:" : "CTT:"}</span>
                                <span className="font-bold text-slate-800">{secondaryDisplay}</span>
                              </div>
                            )}
                          </div>
                        )
                      })()}
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
                            {cfg.label}
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

                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer (15 por página) */}
          {filteredShipments.length > 0 && (
            <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--text-secondary)]">
              <div>
                A mostrar <strong className="text-[var(--text-primary)]">{Math.min((currentPage - 1) * pageSize + 1, filteredShipments.length)}</strong> a <strong className="text-[var(--text-primary)]">{Math.min(currentPage * pageSize, filteredShipments.length)}</strong> de <strong className="text-[var(--text-primary)]">{filteredShipments.length}</strong> envios
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-[var(--surface-bg)] border border-[var(--border-strong)] hover:bg-[var(--surface-muted)] disabled:opacity-40 disabled:cursor-not-allowed rounded-md font-bold text-[var(--text-primary)] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                <span className="px-2 font-bold text-[var(--text-primary)] font-mono">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 bg-[var(--surface-bg)] border border-[var(--border-strong)] hover:bg-[var(--surface-muted)] disabled:opacity-40 disabled:cursor-not-allowed rounded-md font-bold text-[var(--text-primary)] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

    </div>
  )
}
