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

  // Define unpaid and paid statements
  const paidStatements = React.useMemo(() => statements?.filter((s: any) => s.status === 'paid') || [], [statements])
  const unpaidStatements = React.useMemo(() => statements?.filter((s: any) => s.status !== 'paid') || [], [statements])

  const handleEmitReceipt = async (stmt: any) => {
    if (!moloniConfig?.isConnected) {
      setIsMoloniModalOpen(true)
      return
    }
    const ok = confirm(`Deseja emitir o recibo no Moloni para a fatura ${stmt.statement_number}? Ao emitir o recibo, a conta será liquidada e passará para o Histórico de Contas Pagas.`)
    if (!ok) return

    setIsLoading(true)
    try {
      const { emitMoloniReceiptForStatementAction } = await import("@/app/actions/moloni")
      const res = await emitMoloniReceiptForStatementAction(stmt.statement_number || stmt.id)
      if (res.success) {
        if (res.moloniReceiptPdf) {
          try {
            const link = document.createElement("a")
            link.href = res.moloniReceiptPdf
            link.setAttribute("download", `Recibo_${(stmt.statement_number || stmt.id).replace(/[\/\\]/g, "_")}.pdf`)
            link.target = "_blank"
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          } catch (err) {
            console.error("Auto download failed", err)
          }
        }
        alert("Recibo emitido com sucesso! A conta foi liquidada e passou para o Histórico de Contas Pagas.")
        window.location.reload()
      } else {
        alert(`Erro ao emitir recibo: ${res.error}`)
      }
    } catch (err: any) {
      alert(`Erro ao emitir recibo: ${err?.message || err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Filtrar e agrupar
  const clientDataMap = React.useMemo(() => {
    const map = new Map<string, {
      client: any
      shipments: any[]
      activeCount: number
      totalValue: number
      clientUnpaid: any[]
      unpaidTotal: number
    }>()
    
    clients.forEach(c => {
      const clientUnpaid = unpaidStatements.filter((s: any) => 
        (s.client_id && s.client_id === c.id) || 
        (s.client_name === c.legal_name || s.client_name === c.short_name)
      )
      const unpaidTotal = clientUnpaid.reduce((acc: number, s: any) => acc + Number(s.total_value || 0), 0)

      map.set(c.id, { 
        client: c, 
        shipments: [], 
        activeCount: 0, 
        totalValue: 0,
        clientUnpaid,
        unpaidTotal
      })
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
    
    // Mostramos clientes que tenham envios após filtro de data OU contas a aguardar recibo
    return Array.from(map.values())
      .filter(x => x.shipments.length > 0 || x.clientUnpaid.length > 0)
      .sort((a, b) => (b.totalValue + b.unpaidTotal) - (a.totalValue + a.unpaidTotal))
  }, [clients, shipments, startDate, endDate, excludedShipmentIds, unpaidStatements])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[rgba(18,138,71,0.15)] shadow-2xs">
            <Euro className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Contas Corrente / Faturação
            </h1>
            <p className="text-xs text-[var(--text-tertiary)] font-medium mt-0.5">
              Gestão de faturação a clientes e sincronização com software certificado
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMoloniModalOpen(true)}
            className={`flex items-center gap-2 px-3.5 py-2 border rounded-md font-bold text-xs transition-colors cursor-pointer shadow-2xs ${
              moloniConfig?.isConnected 
                ? "border-[rgba(18,138,71,0.25)] text-[var(--status-success)] bg-[var(--status-success-soft)] hover:bg-[var(--accent-soft)]" 
                : "border-[var(--border-subtle)] text-[var(--text-primary)] bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {moloniConfig?.isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                <span>Moloni Ligado ({moloniConfig.companyName || moloniConfig.companyId})</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 text-[var(--accent)]" />
                <span>Ligar Moloni</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navegação por Abas (Tabs) */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)]">
        <div className="px-4 py-2.5 text-xs font-bold text-[var(--accent)] border-b-2 border-[var(--accent)] flex items-center gap-2 bg-[var(--accent-soft)]/50 rounded-t-md">
          <Building className="w-3.5 h-3.5 text-[var(--accent)]" />
          Contas Corrente (Envios de Transporte)
        </div>
        <Link
          href="/ops/faturacao/personalizada"
          className="px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-b-2 border-transparent hover:border-[var(--border-strong)] transition-colors flex items-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          Fatura Personalizada (Serviços & Consultoria)
        </Link>
      </div>

      {/* Aviso de Moloni Desconectado */}
      {!moloniConfig?.isConnected && (
        <div className="p-4 rounded-xl bg-[var(--status-warning-soft)] border border-[rgba(217,119,6,0.25)] text-[var(--text-primary)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--status-warning)] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">Moloni (Fatura Oficial AT) ainda não está ligado</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                Para emitir a <strong>Fatura Oficial Certificada com QR Code da Autoridade Tributária</strong> e não apenas o extrato interno, ligue a sua conta Moloni em 1 clique.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMoloniModalOpen(true)}
            className="px-3.5 py-1.5 bg-[var(--status-warning)] hover:bg-[rgba(217,119,6,0.9)] text-white font-bold text-xs rounded-md shadow-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5" />
            Ligar Moloni Agora
          </button>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="flex items-center gap-4 bg-[var(--surface-bg)] p-3 rounded-xl border border-[var(--border-subtle)] shadow-2xs">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Filtros</span>
        </div>
        <div className="h-5 w-px bg-[var(--border-subtle)] mx-1" />
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-0.5">Data Inicial</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-md px-2.5 py-1 focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none transition-colors"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-0.5">Data Final</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-md px-2.5 py-1 focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-2xs rounded-xl overflow-hidden mb-8">
        <div className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] px-6 py-3.5 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-5 text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Cliente</div>
          <div className="col-span-3 text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider text-center">Envios (Selecionados)</div>
          <div className="col-span-2 text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider text-right">Valor A Faturar</div>
          <div className="col-span-2 text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider text-right">Ação</div>
        </div>
        
        <div className="divide-y divide-[var(--border-subtle)]">
          {clientDataMap.length === 0 ? (
             <div className="px-6 py-12 text-center">
               <AlertCircle className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-2.5 opacity-60" />
               <h3 className="text-sm font-bold text-[var(--text-primary)]">Nenhum envio pendente de faturação</h3>
               <p className="text-xs text-[var(--text-tertiary)] mt-1">Todos os envios para este período já foram faturados ou não existem envios.</p>
             </div>
          ) : (
            clientDataMap.map(({ client, shipments, activeCount, totalValue, clientUnpaid, unpaidTotal }) => {
              const isExpanded = expandedClient === client.id
              return (
                <div key={client.id} className="flex flex-col transition-colors hover:bg-[var(--surface-muted)]/50">
                  <div 
                    className="px-6 py-4 grid grid-cols-12 gap-4 items-center cursor-pointer select-none group"
                    onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                  >
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-secondary)] group-hover:text-[var(--accent)] group-hover:border-[rgba(18,138,71,0.2)] transition-colors">
                        <Building className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-[var(--text-primary)] text-sm group-hover:text-[var(--accent)] transition-colors">
                          {client.legal_name || client.short_name}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)] font-medium font-mono">NIF: {client.nif || "N/A"}</p>
                      </div>
                    </div>
                    
                    <div className="col-span-3 text-center flex flex-col items-center justify-center gap-1">
                      {shipments.length > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(18,138,71,0.15)] text-[11px] font-bold font-mono">
                          {activeCount} / {shipments.length} envios novos
                        </span>
                      )}
                      {clientUnpaid.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--status-warning-soft)] border border-[rgba(217,119,6,0.2)] text-[var(--status-warning)] text-[11px] font-bold font-mono">
                          <AlertCircle className="w-3 h-3 text-[var(--status-warning)] shrink-0" />
                          {clientUnpaid.length} fatura(s) a aguardar recibo
                        </span>
                      )}
                    </div>
                    
                    <div className="col-span-2 text-right">
                      {shipments.length > 0 ? (
                        <>
                          <p className="font-black text-[var(--text-primary)] font-mono text-sm">
                            {totalValue.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                          </p>
                          {clientUnpaid.length > 0 && (
                            <p className="text-[10px] text-[var(--status-warning)] font-bold font-mono mt-0.5">
                              +{unpaidTotal.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ aguarda recibo
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-black text-[var(--status-warning)] font-mono text-sm">
                            {unpaidTotal.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                          </p>
                          <p className="text-[10px] text-[var(--status-warning)] font-bold uppercase tracking-wider mt-0.5">
                            Aguardando Recibo
                          </p>
                        </>
                      )}
                    </div>
                    
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      {shipments.length > 0 ? (
                        <>
                          <button 
                            className="flex items-center justify-center px-2.5 py-1.5 bg-[var(--surface-muted)] text-[var(--text-primary)] font-bold text-xs rounded-md hover:bg-[var(--surface-dim)] border border-[var(--border-subtle)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                            disabled={activeCount === 0 || isLoading}
                            onClick={async (e) => { 
                              e.stopPropagation(); 
                              if (!confirm(`Gerar apenas o extrato interno para ${activeCount} envios no total de ${totalValue.toLocaleString('pt-PT')}€?`)) return;
                              
                              setIsLoading(true);
                              const activeShipments = shipments.filter(s => !excludedShipmentIds.has(s.id))
                              const { emitInvoiceAction } = await import("@/app/actions/moloni")
                              
                              const res = await emitInvoiceAction(client.id, activeShipments.map(s => s.id), true, false, true);
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
                                setExpandedClient(client.id)
                                router.refresh()
                              } else {
                                alert(`Erro ao faturar: ${res?.error || "Desconhecido"}`)
                              }
                            }}
                          >
                            {isLoading ? "..." : "Gerar Fatura Linke"}
                          </button>
                          <button 
                            className="flex items-center justify-center px-2.5 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
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
                                setExpandedClient(client.id)
                                router.refresh()
                              } else {
                                alert(`Erro ao faturar: ${res?.error || "Desconhecido"}`)
                              }
                            }}
                          >
                            {isLoading ? "..." : "Fatura Completa"}
                          </button>
                        </>
                      ) : clientUnpaid.length > 0 ? (
                        <>
                          {clientUnpaid[0].moloni_document_id && !clientUnpaid[0].is_pro_forma && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEmitReceipt(clientUnpaid[0])
                              }}
                              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[var(--status-success-soft)] hover:bg-[var(--accent-soft)] text-[var(--status-success)] border border-[rgba(18,138,71,0.2)] font-bold text-xs rounded-md shadow-2xs transition-colors"
                            >
                              <Cloud className="w-3.5 h-3.5" />
                              Emitir Recibo
                            </button>
                          )}
                          {(clientUnpaid[0].moloni_document_pdf || clientUnpaid[0].moloni_document_id) && (
                            <a 
                              href={`/api/statements/${encodeURIComponent(clientUnpaid[0].statement_number || clientUnpaid[0].id)}/moloni-pdf`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--accent)] rounded-md transition-colors"
                              title="Descarregar Fatura Moloni"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </>
                      ) : null}

                      <div className="text-[var(--text-tertiary)] p-1">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && shipments.length > 0 && (
                    <div className="bg-[var(--surface-muted)]/40 border-t border-[var(--border-subtle)] px-6 py-4 pl-14">
                      <div className="bg-[var(--surface-bg)] rounded-lg border border-[var(--border-subtle)] overflow-hidden shadow-2xs">
                        <div className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] px-4 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                            <span className="text-xs font-bold text-[var(--text-primary)]">Detalhe de Novos Envios</span>
                          </div>
                          <p className="text-[10px] text-[var(--text-tertiary)] font-medium">
                            Desmarca os envios que não pretendes incluir na fatura.
                          </p>
                        </div>
                        <div className="divide-y divide-[var(--border-subtle)] max-h-80 overflow-y-auto">
                          {shipments.map((s: any) => {
                            const isExcluded = excludedShipmentIds.has(s.id)
                            return (
                              <div 
                                key={s.id} 
                                className={`px-4 py-2 flex items-center justify-between hover:bg-[var(--surface-muted)]/50 cursor-pointer transition-colors ${isExcluded ? "opacity-40 bg-[var(--surface-muted)]/20" : ""}`}
                                onClick={() => toggleExclusion(s.id)}
                              >
                                <div className="flex items-center gap-3">
                                  <input 
                                    type="checkbox"
                                    checked={!isExcluded}
                                    onChange={() => {}} 
                                    className="rounded border-[var(--border-strong)] accent-[var(--accent)] text-[var(--accent)] h-3.5 w-3.5 pointer-events-none"
                                  />
                                  <div>
                                    <p className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 font-mono">
                                      <span className={isExcluded ? "line-through text-[var(--text-tertiary)]" : ""}>{s.tracking_number || s.reference || "S/ Ref"}</span>
                                      {s.is_return && (
                                        <span className="px-1.5 py-0.2 rounded bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[rgba(217,119,6,0.2)] text-[9px] font-bold uppercase tracking-wider font-sans">
                                          Retorno
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-[11px] text-[var(--text-tertiary)] font-medium mt-0.5 truncate max-w-[300px]">
                                      Para: {s.recipient_name} ({s.recipient_city})
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-[var(--text-primary)] font-mono">
                                    {Number(s.sell_price || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                                  </p>
                                  <p className="text-[10px] text-[var(--text-tertiary)]">
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
                    
                  {/* Unpaid Statements for this client */}
                  {isExpanded && clientUnpaid.length > 0 && (
                    <div className="bg-[var(--surface-muted)]/40 px-6 pb-4 pl-14">
                      <div className="bg-[var(--surface-bg)] rounded-lg border border-[rgba(217,119,6,0.25)] overflow-hidden shadow-2xs">
                        <div className="bg-[var(--status-warning-soft)]/50 border-b border-[rgba(217,119,6,0.2)] px-4 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-[var(--status-warning)]" />
                            <span className="text-xs font-bold text-[var(--status-warning)]">Contas a Receber (Faturas Moloni Emitidas - Aguardando Recibo)</span>
                          </div>
                          <span className="text-[10px] text-[var(--status-warning)] font-semibold">
                            A conta só passa para o Histórico de Contas Pagas após emitir o Recibo
                          </span>
                        </div>
                        <div className="divide-y divide-[var(--border-subtle)]">
                          {clientUnpaid.map(stmt => (
                            <div key={stmt.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-[var(--surface-muted)]/50 transition-colors">
                              <div>
                                <p className="text-xs font-bold text-[var(--text-primary)] font-mono">{stmt.statement_number}</p>
                                <p className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-2 mt-0.5">
                                  <span>Emitido a {new Date(stmt.created_at).toLocaleDateString("pt-PT")}</span>
                                  <span>•</span>
                                  <span>{stmt.shipments_count || stmt.shipment_ids?.length || 0} envios</span>
                                  <span>•</span>
                                  <span className="text-[var(--status-warning)] font-bold">Aguardando Recibo</span>
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-[var(--text-primary)] font-mono">
                                  {Number(stmt.total_value || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                                </span>
                                {stmt.moloni_document_id && !stmt.is_pro_forma && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleEmitReceipt(stmt)
                                    }}
                                    className="px-2.5 py-1 bg-[var(--status-success-soft)] hover:bg-[var(--accent-soft)] text-[var(--status-success)] font-bold text-[11px] rounded-md border border-[rgba(18,138,71,0.2)] transition-colors flex items-center gap-1.5 shadow-2xs"
                                  >
                                    <Cloud className="w-3 h-3 text-[var(--status-success)]" />
                                    Emitir Recibo
                                  </button>
                                )}
                                {(stmt.moloni_document_pdf || stmt.moloni_document_id) && (
                                  <a 
                                    href={`/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/moloni-pdf`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--accent)] rounded-md transition-colors"
                                    title="Descarregar Fatura Moloni"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <a 
                                  href={`/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/proforma-pdf`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--status-warning)] rounded-md transition-colors"
                                  title="Descarregar Fatura Linke"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          ))}
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

        {/* Histórico de Extratos Emitidos (Pagos) */}
        {paidStatements && paidStatements.length > 0 && (
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-2xs rounded-xl mb-32">
            <div 
              className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] px-6 py-3.5 flex items-center justify-between cursor-pointer select-none rounded-t-xl"
              onClick={() => setShowHistory(!showHistory)}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-[var(--status-success-soft)] border border-[rgba(18,138,71,0.2)] flex items-center justify-center text-[var(--status-success)]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-[var(--text-primary)]">Histórico de Contas Pagas</h2>
                  <p className="text-[11px] text-[var(--text-tertiary)]">{paidStatements.length} extrato(s) pago(s)</p>
                </div>
              </div>
              <div className="text-[var(--text-tertiary)]">
                {showHistory ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>

            {showHistory && (
              <div className="divide-y divide-[var(--border-subtle)]">
                {paidStatements.map((stmt: any, index: number) => (
                <div key={stmt.id} className={`px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--surface-muted)]/50 transition-colors ${index === paidStatements.length - 1 ? 'rounded-b-xl' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)] font-mono">{stmt.statement_number}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-[var(--text-secondary)]">{stmt.client_name}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3 text-[var(--text-tertiary)]" />
                          {stmt.shipments_count || stmt.shipment_ids?.length || 0} envios
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[var(--text-tertiary)]" />
                          {new Date(stmt.created_at).toLocaleDateString("pt-PT")}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    {/* Status Badge */}
                    <div className="flex items-center">
                      {stmt.moloni_receipt_pdf ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[rgba(18,138,71,0.2)] text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" />
                          Paga
                        </span>
                      ) : (stmt.moloni_document_pdf || stmt.moloni_document_id) ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[rgba(217,119,6,0.2)] text-[10px] font-bold uppercase tracking-wider">
                          <AlertCircle className="w-3 h-3" />
                          Pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-wider">
                          Por Emitir
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-black text-[var(--text-primary)] font-mono mr-2">
                      {Number(stmt.total_value || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </span>

                    {/* Actions Dropdown */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenActionMenuId(openActionMenuId === stmt.id ? null : stmt.id)
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--surface-muted)] hover:bg-[var(--surface-dim)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-md text-xs font-bold transition-colors shadow-2xs cursor-pointer"
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
                          <div className="absolute right-0 top-full mt-1.5 w-56 bg-[var(--surface-bg)] rounded-xl shadow-[var(--shadow-layer)] border border-[var(--border-subtle)] py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100">
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
                                  className="w-full flex items-center gap-2 px-3.5 py-2 text-left text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                                >
                                  <Cloud className="w-3.5 h-3.5 text-[var(--accent)]" />
                                  Emitir Fatura no Moloni
                                </button>
                            )}

                            {/* Fatura Moloni (If emitted) */}
                            {(stmt.moloni_document_pdf || stmt.moloni_document_id) && (
                              <>
                                {!stmt.is_pro_forma && (
                                  <a 
                                    href={`/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/moloni-pdf`}
                                    download={`Fatura_Oficial_${(stmt.statement_number || stmt.id).replace(/[\/\\]/g, "_")}.pdf`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[var(--status-success)] hover:bg-[var(--status-success-soft)] transition-colors"
                                  >
                                    <Download className="w-3.5 h-3.5 text-[var(--status-success)]" />
                                    Descarregar Fatura (AT)
                                  </a>
                                )}
                              </>
                            )}

                            <div className="h-px bg-[var(--border-subtle)] my-1 mx-2" />

                            {stmt.moloni_receipt_pdf ? (
                              <a 
                                href={stmt.moloni_receipt_pdf}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                              >
                                <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
                                Descarregar Recibo
                              </a>
                            ) : (stmt.moloni_document_id && !stmt.is_pro_forma) ? (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  setOpenActionMenuId(null)
                                  if (!moloniConfig?.isConnected) {
                                    setIsMoloniModalOpen(true)
                                    return
                                  }
                                  const ok = confirm(`Deseja emitir o recibo no Moloni para o extrato ${stmt.statement_number} marcando-o como pago?`)
                                  if (!ok) return
                                  
                                  const { emitMoloniReceiptForStatementAction } = await import("@/app/actions/moloni")
                                  const res = await emitMoloniReceiptForStatementAction(stmt.statement_number || stmt.id)
                                  if (res.success) {
                                    if (res.moloniReceiptPdf) {
                                      try {
                                        const link = document.createElement("a")
                                        link.href = res.moloniReceiptPdf
                                        link.setAttribute("download", `Recibo_${(stmt.statement_number || stmt.id).replace(/[\\/\\]/g, "_")}.pdf`)
                                        link.target = "_blank"
                                        document.body.appendChild(link)
                                        link.click()
                                        document.body.removeChild(link)
                                      } catch (err) {}
                                    }
                                    alert("Recibo emitido com sucesso!")
                                    window.location.reload()
                                  } else {
                                    alert(`Erro ao emitir recibo: ${res.error}`)
                                  }
                                }}
                                className="w-full flex items-center gap-2 px-3.5 py-2 text-left text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                              >
                                <Cloud className="w-3.5 h-3.5 text-[var(--accent)]" />
                                Emitir Recibo
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[var(--text-tertiary)] cursor-not-allowed opacity-60" title="O recibo estará disponível após a fatura ser emitida">
                                <Download className="w-3.5 h-3.5" />
                                Recibo (Pendente)
                              </div>
                            )}

                            {/* Fatura Linke TMS (Always visible) */}
                            <a 
                              href={`/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/proforma-pdf`}
                              download={`FaturaLinke_${(stmt.statement_number || stmt.id).replace(/[\/\\]/g, "_")}.pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[var(--status-warning)] hover:bg-[var(--status-warning-soft)] transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5 text-[var(--status-warning)]" />
                              Gerar Fatura Linke (PDF)
                            </a>

                            {/* Extrato TMS Interno (Always visible) */}
                            <a 
                              href={`/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/pdf`}
                              download={`Extrato_TMS_${(stmt.statement_number || stmt.id).replace(/[\/\\]/g, "_")}.pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-[var(--surface-bg)] rounded-2xl shadow-[var(--shadow-layer)] border border-[var(--border-subtle)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[var(--accent)] p-6 text-white text-center relative">
              <button 
                onClick={() => setIssuedStatement(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md mx-auto flex items-center justify-center mb-2.5">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold">Fatura / Extrato Emitido!</h3>
              <p className="text-white/80 text-xs font-mono mt-0.5 font-semibold">
                {issuedStatement.statementNumber}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[var(--surface-muted)] rounded-xl p-3.5 border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Cliente</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{issuedStatement.clientName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Valor Total</p>
                  <p className="text-base font-black text-[var(--text-primary)] font-mono">
                    {issuedStatement.totalValue.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                  </p>
                </div>
              </div>

              {/* Botões de Download */}
              <div className="space-y-2.5">
                {issuedStatement.moloniPdf && (
                  <a
                    href={issuedStatement.moloniPdf}
                    download={`Fatura_Oficial_${issuedStatement.statementNumber.replace(/[\/\\]/g, "_")}.pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    📥 Descarregar Fatura Oficial AT (PDF)
                  </a>
                )}

                <a
                  href={issuedStatement.url}
                  download={`Extrato_${issuedStatement.statementNumber.replace(/[\/\\]/g, "_")}.pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full ${issuedStatement.moloniPdf ? "py-2.5 bg-[var(--surface-muted)] hover:bg-[var(--surface-dim)] text-[var(--text-primary)] font-semibold text-xs border border-[var(--border-subtle)]" : "py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs shadow-sm"} rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer`}
                >
                  <Download className="w-4 h-4" />
                  Descarregar Extrato Detalhado TMS (PDF)
                </a>

                {!issuedStatement.moloniPdf && (
                  <div className="p-3 bg-[var(--status-warning-soft)] rounded-lg border border-[rgba(217,119,6,0.2)] text-[11px] text-[var(--text-primary)] flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-[var(--status-warning)] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[var(--status-warning)]">O download do extrato foi iniciado automaticamente.</p>
                      <p className="mt-0.5 text-[var(--text-secondary)] leading-relaxed">
                        Este documento detalha todos os envios faturados. Se desejar emitir também a <strong>Fatura Oficial Certificada</strong> pela Autoridade Tributária, ligue a conta Moloni no topo.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-1">
                <button
                  onClick={() => setIssuedStatement(null)}
                  className="w-full py-2 text-xs font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
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
