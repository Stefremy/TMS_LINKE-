"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building, FileText, ChevronDown, ChevronRight, Euro, Cloud, AlertCircle, Filter, Download, Calendar, Package, CheckCircle2, X, Sparkles } from "lucide-react"
import { MoloniConnectModal } from "./MoloniConnectModal"

export default function ContasCorrenteClient({ 
  clients, 
  shipments, 
  statements = [],
  moloniConfig
}: { 
  clients: any[]
  shipments: any[]
  statements?: any[]
  moloniConfig?: any
}) {
  const router = useRouter()
  const [expandedClient, setExpandedClient] = React.useState<string | null>(null)
  const [showHistory, setShowHistory] = React.useState<boolean>(true)
  const [openActionMenuId, setOpenActionMenuId] = React.useState<string | null>(null)
  const [isMoloniModalOpen, setIsMoloniModalOpen] = React.useState<boolean>(false)
  const [issuedStatement, setIssuedStatement] = React.useState<{
    statementNumber: string
    url: string
    clientName: string
    totalValue: number
    moloniPdf?: string | null
  } | null>(null)
  
  // Filtros
  const [startDate, setStartDate] = React.useState<string>("")
  const [endDate, setEndDate] = React.useState<string>("")
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  
  // Envios excluídos manualmente pelo utilizador
  const [excludedShipmentIds, setExcludedShipmentIds] = React.useState<Set<string>>(new Set())

  const toggleExclusion = (shipmentId: string) => {
    setExcludedShipmentIds(prev => {
      const next = new Set(prev)
      if (next.has(shipmentId)) next.delete(shipmentId)
      else next.add(shipmentId)
      return next
    })
  }

  // Filtrar e agrupar
  const clientDataMap = React.useMemo(() => {
    const map = new Map<string, {
      client: any
      shipments: any[]
      activeCount: number
      totalValue: number
    }>()
    
    clients.forEach(c => {
      map.set(c.id, { client: c, shipments: [], activeCount: 0, totalValue: 0 })
    })
    
    // Convertemos as datas de filtro para timestamp para ser mais rápido
    const startTs = startDate ? new Date(startDate).getTime() : 0
    // O endDate inclui todo o dia
    const endTs = endDate ? new Date(endDate).getTime() + 86399999 : Infinity

    shipments.forEach(s => {
      if (!s.client_id || !map.has(s.client_id)) return
      
      const sTs = new Date(s.created_at).getTime()
      if (sTs < startTs || sTs > endTs) return // Filtrado por data
      
      const entry = map.get(s.client_id)!
      entry.shipments.push(s)
      
      if (!excludedShipmentIds.has(s.id)) {
        entry.activeCount++
        entry.totalValue += Number(s.sell_price || 0)
      }
    })
    
    // Só mostramos clientes que tenham pelo menos 1 envio após filtro de data
    return Array.from(map.values())
      .filter(x => x.shipments.length > 0)
      .sort((a, b) => b.totalValue - a.totalValue)
  }, [clients, shipments, startDate, endDate, excludedShipmentIds])

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Euro className="w-6 h-6 text-indigo-600" />
            Contas Corrente / Faturação
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Gere a faturação dos clientes e sincroniza com o software de faturação
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          <button 
            onClick={() => setIsMoloniModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-2.5 bg-white border ${moloniConfig?.isConnected ? "border-emerald-300 text-emerald-700 bg-emerald-50/40" : "border-slate-200 text-slate-700"} font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors shadow-2xs`}
          >
            {moloniConfig?.isConnected ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Moloni Ligado ({moloniConfig.companyName || moloniConfig.companyId})</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 text-indigo-600" />
                <span>Ligar Moloni</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navegação por Abas (Tabs) */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
        <div className="px-5 py-3 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 flex items-center gap-2 bg-indigo-50/50 rounded-t-lg">
          <Building className="w-4 h-4 text-indigo-600" />
          Contas Corrente (Envios de Transporte)
        </div>
        <Link
          href="/ops/faturacao/personalizada"
          className="px-5 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300 transition-colors flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-slate-400" />
          Fatura Personalizada (Serviços & Consultoria)
        </Link>
      </div>

      {/* Aviso de Moloni Desconectado */}
      {!moloniConfig?.isConnected && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-300 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-950">Moloni (Fatura Oficial AT) ainda não está ligado</p>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Para emitir a <strong>Fatura Oficial Certificada com QR Code da Autoridade Tributária</strong> e não apenas o extrato interno, ligue a sua conta Moloni em 1 clique.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMoloniModalOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex-shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Cloud className="w-4 h-4" />
            Ligar Moloni Agora
          </button>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="mb-6 flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wide">Filtros</span>
        </div>
        <div className="h-6 w-px bg-slate-200 mx-2" />
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 mb-0.5">Data Inicial</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 mb-0.5">Data Final</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-2xs rounded-2xl overflow-hidden mb-8">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</div>
          <div className="col-span-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Envios (Selecionados)</div>
          <div className="col-span-2 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Valor A Faturar</div>
          <div className="col-span-2 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ação</div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {clientDataMap.length === 0 ? (
             <div className="px-6 py-12 text-center">
               <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
               <h3 className="text-sm font-bold text-slate-600">Nenhum envio pendente de faturação</h3>
               <p className="text-xs text-slate-400 mt-1">Todos os envios para este período já foram faturados ou não existem envios.</p>
             </div>
          ) : (
            clientDataMap.map(({ client, shipments, activeCount, totalValue }) => {
              const isExpanded = expandedClient === client.id
              return (
                <div key={client.id} className="flex flex-col transition-colors hover:bg-slate-50/50">
                  <div 
                    className="px-6 py-4 grid grid-cols-12 gap-4 items-center cursor-pointer select-none group"
                    onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                  >
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600">
                        <Building className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">
                          {client.legal_name || client.short_name}
                        </p>
                        <p className="text-xs text-slate-500 font-medium">NIF: {client.nif || "N/A"}</p>
                      </div>
                    </div>
                    
                    <div className="col-span-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold font-mono">
                        {activeCount} / {shipments.length} envios
                      </span>
                    </div>
                    
                    <div className="col-span-2 text-right">
                      <p className="font-black text-slate-900 font-mono">
                        {totalValue.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                      </p>
                    </div>
                    
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <button 
                        className="flex items-center justify-center px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 border border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        disabled={activeCount === 0 || isLoading}
                        onClick={async (e) => { 
                          e.stopPropagation(); 
                          if (!confirm(`Gerar apenas o extrato interno para ${activeCount} envios no total de ${totalValue.toLocaleString('pt-PT')}€?`)) return;
                          
                          setIsLoading(true);
                          const activeShipments = shipments.filter(s => !excludedShipmentIds.has(s.id))
                          const { emitInvoiceAction } = await import("@/app/actions/moloni")
                          
                          const res = await emitInvoiceAction(client.id, activeShipments.map(s => s.id), true);
                          setIsLoading(false);
                          if (res?.success && res.statementNumber) {
                            const stmtNum = res.statementNumber
                            const officialPdfUrl = `/api/statements/${encodeURIComponent(stmtNum)}/moloni-pdf`
                            const fallbackUrl = `/api/statements/${encodeURIComponent(stmtNum)}/pdf`
                            const hasOfficialMoloni = !!res.moloniDocumentPdf

                            const downloadTarget = hasOfficialMoloni ? officialPdfUrl : fallbackUrl
                            const downloadFilename = hasOfficialMoloni 
                              ? `Fatura_Oficial_${stmtNum.replace(/[\/\\]/g, "_")}.pdf`
                              : `Extrato_${stmtNum.replace(/[\/\\]/g, "_")}.pdf`

                            try {
                              const link = document.createElement("a")
                              link.href = downloadTarget
                              link.setAttribute("download", downloadFilename)
                              link.target = "_blank"
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                            } catch (err) {
                              console.error("Auto download failed", err)
                            }

                            setIssuedStatement({
                              statementNumber: stmtNum,
                              url: fallbackUrl,
                              clientName: client.legal_name || client.short_name,
                              totalValue: totalValue,
                              moloniPdf: hasOfficialMoloni ? officialPdfUrl : null
                            })
                            router.refresh()
                          } else {
                            alert(`Erro ao faturar: ${res?.error || "Desconhecido"}`)
                          }
                        }}
                      >
                        {isLoading ? "..." : "Gerar Pró-Forma"}
                      </button>
                      <button 
                        className="flex items-center justify-center px-3 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        disabled={activeCount === 0 || isLoading}
                        onClick={async (e) => { 
                          e.stopPropagation(); 
                          if (!confirm(`Emitir Fatura Oficial Moloni e Extrato para ${activeCount} envios no total de ${totalValue.toLocaleString('pt-PT')}€ (Listados um a um)?`)) return;
                          
                          setIsLoading(true);
                          const activeShipments = shipments.filter(s => !excludedShipmentIds.has(s.id))
                          const { emitInvoiceAction } = await import("@/app/actions/moloni")
                          
                          const res = await emitInvoiceAction(client.id, activeShipments.map(s => s.id), false, false);
                          setIsLoading(false);
                          if (res?.success && res.statementNumber) {
                            const stmtNum = res.statementNumber
                            const officialPdfUrl = `/api/statements/${encodeURIComponent(stmtNum)}/moloni-pdf`
                            const fallbackUrl = `/api/statements/${encodeURIComponent(stmtNum)}/pdf`
                            const hasOfficialMoloni = !!res.moloniDocumentPdf

                            const downloadTarget = hasOfficialMoloni ? officialPdfUrl : fallbackUrl
                            const downloadFilename = hasOfficialMoloni 
                              ? `Fatura_Oficial_${stmtNum.replace(/[\/\\]/g, "_")}.pdf`
                              : `Extrato_${stmtNum.replace(/[\/\\]/g, "_")}.pdf`

                            try {
                              const link = document.createElement("a")
                              link.href = downloadTarget
                              link.setAttribute("download", downloadFilename)
                              link.target = "_blank"
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                            } catch (err) {
                              console.error("Auto download failed", err)
                            }

                            setIssuedStatement({
                              statementNumber: stmtNum,
                              url: fallbackUrl,
                              clientName: client.legal_name || client.short_name,
                              totalValue: totalValue,
                              moloniPdf: hasOfficialMoloni ? officialPdfUrl : null
                            })
                            router.refresh()
                          } else {
                            alert(`Erro ao faturar: ${res?.error || "Desconhecido"}`)
                          }
                        }}
                      >
                        {isLoading ? "..." : "Fatura Completa"}
                      </button>
                      <button 
                        className="flex items-center justify-center px-3 py-1.5 bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg hover:bg-indigo-200 border border-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        disabled={activeCount === 0 || isLoading}
                        onClick={async (e) => { 
                          e.stopPropagation(); 
                          if (!confirm(`Emitir Fatura Oficial Moloni e Extrato para ${activeCount} envios no total de ${totalValue.toLocaleString('pt-PT')}€ (Agrupados por serviço)?`)) return;
                          
                          setIsLoading(true);
                          const activeShipments = shipments.filter(s => !excludedShipmentIds.has(s.id))
                          const { emitInvoiceAction } = await import("@/app/actions/moloni")
                          
                          const res = await emitInvoiceAction(client.id, activeShipments.map(s => s.id), false, true);
                          setIsLoading(false);
                          if (res?.success && res.statementNumber) {
                            const stmtNum = res.statementNumber
                            const officialPdfUrl = `/api/statements/${encodeURIComponent(stmtNum)}/moloni-pdf`
                            const fallbackUrl = `/api/statements/${encodeURIComponent(stmtNum)}/pdf`
                            const hasOfficialMoloni = !!res.moloniDocumentPdf

                            const downloadTarget = hasOfficialMoloni ? officialPdfUrl : fallbackUrl
                            const downloadFilename = hasOfficialMoloni 
                              ? `Fatura_Oficial_${stmtNum.replace(/[\/\\]/g, "_")}.pdf`
                              : `Extrato_${stmtNum.replace(/[\/\\]/g, "_")}.pdf`

                            try {
                              const link = document.createElement("a")
                              link.href = downloadTarget
                              link.setAttribute("download", downloadFilename)
                              link.target = "_blank"
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                            } catch (err) {
                              console.error("Auto download failed", err)
                            }

                            setIssuedStatement({
                              statementNumber: stmtNum,
                              url: fallbackUrl,
                              clientName: client.legal_name || client.short_name,
                              totalValue: totalValue,
                              moloniPdf: hasOfficialMoloni ? officialPdfUrl : null
                            })
                            router.refresh()
                          } else {
                            alert(`Erro ao faturar: ${res?.error || "Desconhecido"}`)
                          }
                        }}
                      >
                        {isLoading ? "..." : "Fatura Simplificada"}
                      </button>
                      <div className="text-slate-400 p-1">
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && shipments.length > 0 && (
                    <div className="bg-slate-50 border-t border-slate-100 px-6 py-6 pb-8 pl-16">
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                        <div className="bg-slate-50/50 border-b border-slate-100 px-4 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-bold text-slate-600">Detalhe de Envios</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Desmarca os envios que não pretendes incluir na fatura.
                          </p>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                          {shipments.map((s: any) => {
                            const isExcluded = excludedShipmentIds.has(s.id)
                            return (
                              <div 
                                key={s.id} 
                                className={`px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/50 cursor-pointer transition-colors ${isExcluded ? "opacity-40 bg-slate-50/30" : ""}`}
                                onClick={() => toggleExclusion(s.id)}
                              >
                                <div className="flex items-center gap-3">
                                  <input 
                                    type="checkbox"
                                    checked={!isExcluded}
                                    onChange={() => {}} 
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 pointer-events-none"
                                  />
                                  <div>
                                    <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                      <span className={isExcluded ? "line-through" : ""}>{s.tracking_number || s.reference || "S/ Ref"}</span>
                                      {s.is_return && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                                          Retorno
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate max-w-[300px]">
                                      Para: {s.recipient_name} ({s.recipient_city})
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-slate-800 font-mono">
                                    {Number(s.sell_price || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {new Date(s.created_at).toLocaleDateString("pt-PT")}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Histórico de Extratos Emitidos */}
      {statements && statements.length > 0 && (
        <div className="bg-white border border-slate-200 shadow-2xs rounded-2xl mb-48">
          <div 
            className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
            onClick={() => setShowHistory(!showHistory)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Extratos / Faturas Emitidas Recentemente</h2>
                <p className="text-xs text-slate-500">{statements.length} extrato(s) emitido(s)</p>
              </div>
            </div>
            <div className="text-slate-400">
              {showHistory ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </div>
          </div>

          {showHistory && (
            <div className="divide-y divide-slate-100">
              {statements.map((stmt: any, index: number) => (
                <div key={stmt.id} className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors ${index === statements.length - 1 ? 'rounded-b-2xl' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 font-mono">{stmt.statement_number}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-slate-700">{stmt.client_name}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3 text-slate-400" />
                          {stmt.shipments_count || stmt.shipment_ids?.length || 0} envios
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(stmt.created_at).toLocaleDateString("pt-PT")}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    {/* Status Badge */}
                    <div className="flex items-center">
                      {stmt.moloni_receipt_pdf ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Paga
                        </span>
                      ) : (stmt.moloni_document_pdf || stmt.moloni_document_id) ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                          Por Emitir
                        </span>
                      )}
                    </div>

                    <span className="text-sm font-black text-slate-900 font-mono mr-2">
                      {Number(stmt.total_value || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </span>

                    {/* Actions Dropdown */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenActionMenuId(openActionMenuId === stmt.id ? null : stmt.id)
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                      >
                        Opções <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {openActionMenuId === stmt.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenActionMenuId(null)
                            }}
                          />
                          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-20 animate-in fade-in zoom-in-95 duration-100">
                            {/* Emitir no Moloni */}
                            {!(stmt.moloni_document_pdf || stmt.moloni_document_id) && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    setOpenActionMenuId(null)
                                    if (!moloniConfig?.isConnected) {
                                      setIsMoloniModalOpen(true)
                                      return
                                    }
                                    const ok = confirm(`Deseja comunicar e emitir a fatura oficial no Moloni para o extrato ${stmt.statement_number}?`)
                                    if (!ok) return
                                    
                                    const { emitMoloniInvoiceForStatementAction } = await import("@/app/actions/moloni")
                                    const res = await emitMoloniInvoiceForStatementAction(stmt.statement_number || stmt.id)
                                    if (res.success) {
                                      const dlUrl = `/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/moloni-pdf`
                                      try {
                                        const link = document.createElement("a")
                                        link.href = dlUrl
                                        link.setAttribute("download", `Fatura_Oficial_${stmt.statement_number.replace(/[\/\\]/g, "_")}.pdf`)
                                        document.body.appendChild(link)
                                        link.click()
                                        document.body.removeChild(link)
                                      } catch {}

                                      setIssuedStatement({
                                        statementNumber: stmt.statement_number,
                                        url: `/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/pdf`,
                                        clientName: stmt.client_name,
                                        totalValue: Number(stmt.total_value || 0),
                                        moloniPdf: dlUrl
                                      })
                                      router.refresh()
                                    } else {
                                      alert(`Erro: ${res.error || "Não foi possível emitir no Moloni"}`)
                                    }
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-left text-xs font-bold text-blue-700 hover:bg-blue-50 transition-colors"
                                >
                                  <Cloud className="w-4 h-4 text-blue-500" />
                                  Emitir Fatura no Moloni
                                </button>
                            )}

                            {/* Fatura / Pró-Forma Moloni (If emitted) */}
                            {(stmt.moloni_document_pdf || stmt.moloni_document_id) && (
                              <>
                                {!stmt.is_pro_forma && (
                                  <a 
                                    href={`/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/moloni-pdf`}
                                    download={`Fatura_Oficial_${(stmt.statement_number || stmt.id).replace(/[\/\\]/g, "_")}.pdf`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors"
                                  >
                                    <Download className="w-4 h-4 text-emerald-500" />
                                    Descarregar Fatura (AT)
                                  </a>
                                )}
                              </>
                            )}

                            {/* Recibo */}
                            {stmt.moloni_receipt_pdf ? (
                              <a 
                                href={stmt.moloni_receipt_pdf}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition-colors"
                              >
                                <Download className="w-4 h-4 text-indigo-500" />
                                Descarregar Recibo
                              </a>
                            ) : (
                              <div className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-400 cursor-not-allowed" title="O recibo estará disponível após a fatura ser paga">
                                <Download className="w-4 h-4" />
                                Recibo (Pendente)
                              </div>
                            )}

                            <div className="h-px bg-slate-100 my-1 mx-2" />

                            {/* Pró-Forma TMS (Always visible) */}
                            <a 
                              href={`/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/proforma-pdf`}
                              download={`ProForma_${(stmt.statement_number || stmt.id).replace(/[\/\\]/g, "_")}.pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
                            >
                              <FileText className="w-4 h-4 text-amber-500" />
                              Gerar Pró-Forma (PDF)
                            </a>

                            {/* Extrato TMS Interno (Always visible) */}
                            <a 
                              href={`/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/pdf`}
                              download={`Extrato_TMS_${(stmt.statement_number || stmt.id).replace(/[\/\\]/g, "_")}.pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <FileText className="w-4 h-4 text-slate-400" />
                              Ver Extrato TMS Interno
                            </a>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Sucesso com Botão Direto de Download */}
      {issuedStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 p-6 text-white text-center relative">
              <button 
                onClick={() => setIssuedStatement(null)}
                className="absolute top-4 right-4 text-emerald-100 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-black">Fatura / Extrato Emitido!</h3>
              <p className="text-emerald-100 text-xs font-mono mt-1 font-semibold">
                {issuedStatement.statementNumber}
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Cliente</p>
                  <p className="text-sm font-bold text-slate-800">{issuedStatement.clientName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 font-medium">Valor Total</p>
                  <p className="text-base font-black text-slate-900 font-mono">
                    {issuedStatement.totalValue.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                  </p>
                </div>
              </div>

              {/* Botões de Download */}
              <div className="space-y-3">
                {issuedStatement.moloniPdf && (
                  <a
                    href={issuedStatement.moloniPdf}
                    download={`Fatura_Oficial_${issuedStatement.statementNumber.replace(/[\/\\]/g, "_")}.pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    📥 Descarregar Fatura Oficial AT (PDF)
                  </a>
                )}

                <a
                  href={issuedStatement.url}
                  download={`Extrato_${issuedStatement.statementNumber.replace(/[\/\\]/g, "_")}.pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full ${issuedStatement.moloniPdf ? "py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200" : "py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg"} rounded-xl transition-all flex items-center justify-center gap-2`}
                >
                  <Download className="w-4 h-4" />
                  Descarregar Extrato Detalhado TMS (PDF)
                </a>

                {!issuedStatement.moloniPdf && (
                  <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/60 text-[11px] text-amber-800 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">O download do extrato foi iniciado automaticamente.</p>
                      <p className="mt-0.5 text-amber-700 leading-relaxed">
                        Este documento detalha todos os envios faturados. Se desejar emitir também a <strong>Fatura Oficial Certificada</strong> pela Autoridade Tributária, ligue a conta Moloni no topo.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-1">
                <button
                  onClick={() => setIssuedStatement(null)}
                  className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <MoloniConnectModal 
        isOpen={isMoloniModalOpen}
        onClose={() => setIsMoloniModalOpen(false)}
        config={moloniConfig}
      />
    </div>
  )
}
