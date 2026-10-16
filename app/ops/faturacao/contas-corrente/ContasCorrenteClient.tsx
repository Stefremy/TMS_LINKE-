"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building, FolderOpen, FileText, ChevronDown, ChevronRight, Euro, Cloud, AlertCircle, Filter, Download, Calendar, Package, CheckCircle2, X, Sparkles, Mail, Send } from "lucide-react"
import { groupInvoiceArchive, isInvoicePaid } from "@/lib/billing/invoice-archive"
import { InvoiceIssueButton } from "./InvoiceIssueButton"
import { AnimatedDisclosure } from "./AnimatedDisclosure"
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

  // Format Moloni document number: "13" → "FT 2026/13" (or pass through if already formatted)
  const formatFTNumber = (num: string | number | null | undefined): string | null => {
    if (!num) return null
    const s = String(num).trim()
    if (!s) return null
    // Already has prefix (e.g. "FT 2026/13") — return as-is
    if (s.includes('/') || s.toUpperCase().startsWith('FT')) return s
    // Raw sequential number — compose with current year
    return `FT ${new Date().getFullYear()}/${s}`
  }

  const [expandedClient, setExpandedClient] = React.useState<string | null>(null)
  const [showHistory, setShowHistory] = React.useState<boolean>(true)
  const [archiveSearch, setArchiveSearch] = React.useState("")
  const [expandedArchiveStores, setExpandedArchiveStores] = React.useState<Set<string>>(new Set())
  const [openActionMenuId, setOpenActionMenuId] = React.useState<string | null>(null)
  const [isMoloniModalOpen, setIsMoloniModalOpen] = React.useState<boolean>(false)
  const [issuedStatement, setIssuedStatement] = React.useState<{
    statementNumber: string
    url: string
    clientName: string
    totalValue: number
    moloniPdf?: string | null
    warning?: string | null
    moloniDocumentNumber?: string | null
  } | null>(null)
  
  // Filtros
  const [startDate, setStartDate] = React.useState<string>("")
  const [endDate, setEndDate] = React.useState<string>("")
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [isIssuingInvoice, setIsIssuingInvoice] = React.useState(false)
  const invoiceInFlight = React.useRef(false)

  // Modal emissão de recibo
  const [receiptModalStmt, setReceiptModalStmt] = React.useState<any | null>(null)
  const [receiptDate, setReceiptDate] = React.useState<string>(new Date().toISOString().split('T')[0])
  const [receiptPaymentMethod, setReceiptPaymentMethod] = React.useState<number>(3320318)
  const [receiptNotes, setReceiptNotes] = React.useState<string>("")
  const [availablePaymentMethods, setAvailablePaymentMethods] = React.useState<Array<{ payment_method_id: number; name: string }>>([
    { payment_method_id: 3320318, name: "Transferência Bancária" },
    { payment_method_id: 3320323, name: "Multibanco / MB Way" },
    { payment_method_id: 3320308, name: "Numerário" },
    { payment_method_id: 3320313, name: "Cheque" },
  ])
  
  // Envios excluídos manualmente pelo utilizador
  const [excludedShipmentIds, setExcludedShipmentIds] = React.useState<Set<string>>(new Set())

  // Modo de agrupamento da fatura Moloni (Agrupada por serviço e soma total vs Detalhada)
  const [groupInvoicesByService, setGroupInvoicesByService] = React.useState<boolean>(true)

  // Modal de envio de fatura por email
  const [emailModalStmt, setEmailModalStmt] = React.useState<any | null>(null)
  const [emailRecipient, setEmailRecipient] = React.useState<string>("")
  const [emailIncludeMoloni, setEmailIncludeMoloni] = React.useState<boolean>(true)
  const [emailIncludeStatement, setEmailIncludeStatement] = React.useState<boolean>(true)
  const [isSendingEmail, setIsSendingEmail] = React.useState<boolean>(false)
  const [emailFeedback, setEmailFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null)

  const handleOpenEmailModal = (stmt: any) => {
    setOpenActionMenuId(null)
    setEmailModalStmt(stmt)
    const client = clients.find((c: any) => c.id === stmt.client_id || (c.legal_name || c.short_name) === stmt.client_name)
    setEmailRecipient(client?.billing_email || client?.email || "")
    setEmailIncludeMoloni(Boolean(stmt.moloni_document_pdf || stmt.moloni_document_id))
    setEmailIncludeStatement(true)
    setEmailFeedback(null)
  }

  const handleSendInvoiceEmail = async () => {
    if (!emailModalStmt) return
    if (!emailRecipient || !emailRecipient.includes("@")) {
      setEmailFeedback({ type: "error", message: "Por favor introduza um endereço de email válido." })
      return
    }

    setIsSendingEmail(true)
    setEmailFeedback(null)

    try {
      const { sendStatementInvoiceEmailAction } = await import("@/app/actions/moloni")
      const res = await sendStatementInvoiceEmailAction({
        statementIdOrNumber: emailModalStmt.statement_number || emailModalStmt.id,
        recipientEmail: emailRecipient,
        includeMoloniPdf: emailIncludeMoloni,
        includeStatementPdf: emailIncludeStatement,
      })

      if (res.success) {
        setEmailFeedback({ type: "success", message: res.message || `Fatura enviada para ${emailRecipient}!` })
        setTimeout(() => {
          setEmailModalStmt(null)
          setEmailFeedback(null)
        }, 2200)
      } else {
        setEmailFeedback({ type: "error", message: res.error || "Não foi possível enviar o email." })
      }
    } catch (err: any) {
      setEmailFeedback({ type: "error", message: err.message || "Erro inesperado ao enviar email." })
    } finally {
      setIsSendingEmail(false)
    }
  }

  const toggleExclusion = (shipmentId: string) => {
    setExcludedShipmentIds(prev => {
      const next = new Set(prev)
      if (next.has(shipmentId)) next.delete(shipmentId)
      else next.add(shipmentId)
      return next
    })
  }

  // Archive issued invoices by store and keep outstanding invoices available for receipt issuance.
  const archiveGroups = React.useMemo(() => groupInvoiceArchive(clients, statements, archiveSearch), [clients, statements, archiveSearch])
  const archiveDocumentCount = archiveGroups.reduce((count, group) => count + group.statements.length, 0)
  const hasArchiveDocuments = statements.some(stmt => !stmt.is_pro_forma && (stmt.moloni_document_id || stmt.moloni_document_pdf || isInvoicePaid(stmt)))
  const unpaidStatements = React.useMemo(() => statements?.filter((s: any) => s.status !== 'paid' && !s.moloni_receipt_pdf && !s.moloni_receipt_id && !s.is_pro_forma && Boolean(s.moloni_document_id)) || [], [statements])

  const handleEmitReceipt = (stmt: any) => {
    if (!moloniConfig?.isConnected) {
      setIsMoloniModalOpen(true)
      return
    }
    // Open the receipt modal instead of confirm()
    setReceiptDate(new Date().toISOString().split('T')[0])
    const defaultMethod = availablePaymentMethods.find(m => /transfer[eê]ncia/i.test(m.name))
    setReceiptPaymentMethod(defaultMethod?.payment_method_id || 3320318)
    setReceiptNotes("")
    setReceiptModalStmt(stmt)

    // Load actual live payment methods from Moloni
    import("@/app/actions/moloni").then(({ getMoloniPaymentMethodsAction }) => {
      getMoloniPaymentMethodsAction().then(res => {
        if (res.success && res.methods && res.methods.length > 0) {
          setAvailablePaymentMethods(res.methods)
          const m = res.methods.find((x: any) => /transfer[eê]ncia/i.test(x.name))
          if (m) {
            setReceiptPaymentMethod(m.payment_method_id)
          }
        }
      })
    }).catch(() => {})
  }

  const handleConfirmReceipt = async () => {
    if (!receiptModalStmt) return
    const stmt = receiptModalStmt
    setReceiptModalStmt(null)
    setIsLoading(true)
    try {
      const { emitMoloniReceiptForStatementAction } = await import("@/app/actions/moloni")
      const res = await emitMoloniReceiptForStatementAction(
        stmt.statement_number || stmt.id,
        { date: receiptDate, paymentMethodId: receiptPaymentMethod, notes: receiptNotes || undefined }
      )
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
        alert("Recibo emitido com sucesso! A conta foi liquidada e está disponível no arquivo da loja.")
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
    
    const unpaidByStore = new Map(groupInvoiceArchive(clients, unpaidStatements).map(group => [group.key, group.statements]))
    clients.forEach(c => {
      const clientUnpaid = unpaidByStore.get(`store:${c.id}`) || []
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
        
        <div className="flex flex-wrap items-center gap-3">
          {hasArchiveDocuments && (
            <a href="#invoice-archive" onClick={() => setShowHistory(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold text-[var(--accent)] bg-[var(--accent-soft)] border border-[var(--border-subtle)]">
              <FolderOpen className="w-4 h-4" /> Arquivo por loja
            </a>
          )}
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

      {/* Barra de Filtros e Modo de Faturação */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--surface-bg)] p-3 rounded-xl border border-[var(--border-subtle)] shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Filtros</span>
          </div>
          <div className="h-5 w-px bg-[var(--border-subtle)] mx-1" />
          <div className="flex flex-wrap items-center gap-3">
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

        {/* Opção de Agrupamento por Serviço (Fatura Compacta) */}
        <div className="flex items-center gap-2 bg-[var(--surface-muted)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)]">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={groupInvoicesByService}
              onChange={(e) => setGroupInvoicesByService(e.target.checked)}
              className="w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                Agrupar por Serviço (Fatura Compacta)
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(18,138,71,0.2)]">
                  {groupInvoicesByService ? "1 Página" : "Detalhada"}
                </span>
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {groupInvoicesByService 
                  ? "Soma total dos envios com o mesmo serviço (evita faturas com dezenas de páginas)" 
                  : "Lista 1 linha por cada envio individual"}
              </span>
            </div>
          </label>
        </div>
      </div>

      <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-2xs rounded-xl overflow-hidden mb-8">
        <div className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] px-6 py-3.5 tms-wide-grid grid-cols-12 gap-4 items-center">
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
                    className="px-3 sm:px-5 py-4 tms-billing-row grid gap-3 items-center cursor-pointer select-none group"
                    onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                  >
                    <div className="tms-billing-client flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-secondary)] group-hover:text-[var(--accent)] group-hover:border-[rgba(18,138,71,0.2)] transition-colors">
                        <Building className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold break-words text-[var(--text-primary)] text-sm group-hover:text-[var(--accent)] transition-colors">
                          {client.legal_name || client.short_name}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)] font-medium font-mono">NIF: {client.nif || "N/A"}</p>
                      </div>
                    </div>
                    
                    <div className="tms-billing-count text-center flex flex-col items-center justify-center gap-1">
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
                    
                    <div className="tms-billing-total text-right">
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
                    
                    <div className="tms-billing-actions flex items-center justify-end gap-2">
                      {shipments.length > 0 ? (
                        <>
                          <InvoiceIssueButton
                            clientName={client.legal_name || client.short_name}
                            disabled={activeCount === 0 || isIssuingInvoice}
                            onIssue={async () => {
                              const modeStr = groupInvoicesByService ? "Agrupada por Serviço (Fatura Compacta - 1 página)" : "Detalhada (1 linha por envio)"
                              if (!confirm(`Emitir Fatura Oficial Moloni para ${activeCount} envios selecionados?\n\nTotal: ${totalValue.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€\nModo: ${modeStr}`)) return;
                              
                              if (invoiceInFlight.current) return
                              invoiceInFlight.current = true
                              setIsIssuingInvoice(true)
                              try {
                                const activeShipments = shipments.filter(s => !excludedShipmentIds.has(s.id))
                                const { emitInvoiceAction } = await import("@/app/actions/moloni")
                                const res = await emitInvoiceAction(client.id, activeShipments.map(s => s.id), false, groupInvoicesByService)
                                if (!res?.success || !res.statementNumber || !res.moloniDocumentId) {
                                  alert(`Erro ao emitir fatura: ${res?.error || "O Moloni não confirmou a emissão."}`)
                                  return
                                }
                                const stmtNum = res.statementNumber
                                const officialPdfUrl = `/api/statements/${encodeURIComponent(stmtNum)}/moloni-pdf`
                                const fallbackUrl = `/api/statements/${encodeURIComponent(stmtNum)}/pdf`
                                // Download only the official invoice. The statement remains an explicit option.
                                if (res.moloniDocumentPdf) {
                                  const link = document.createElement("a")
                                  link.href = officialPdfUrl
                                  link.download = `Fatura_Oficial_${stmtNum.replace(/[\/\\]/g, "_")}.pdf`
                                  link.target = "_blank"
                                  document.body.appendChild(link)
                                  link.click()
                                  link.remove()
                                }
                                setIssuedStatement({
                                  statementNumber: stmtNum,
                                  url: fallbackUrl,
                                  clientName: client.legal_name || client.short_name,
                                  totalValue,
                                  moloniPdf: officialPdfUrl,
                                  moloniDocumentNumber: res.moloniDocumentNumber || null,
                                  warning: res.moloniError || null,
                                })
                                setExpandedClient(client.id)
                                router.refresh()
                              } catch {
                                alert("Não foi possível confirmar o resultado da emissão. Consulte o Moloni antes de repetir para evitar uma fatura duplicada.")
                              } finally {
                                invoiceInFlight.current = false
                                setIsIssuingInvoice(false)
                              }
                            }}
                          />
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
                    <div className="bg-[var(--surface-muted)]/40 px-3 sm:px-5 pb-4">
                      <div className="bg-[var(--surface-bg)] rounded-lg border border-[rgba(217,119,6,0.25)] overflow-hidden shadow-2xs">
                        <div className="bg-[var(--status-warning-soft)]/50 border-b border-[rgba(217,119,6,0.2)] px-4 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-[var(--status-warning)]" />
                            <span className="text-xs font-bold text-[var(--status-warning)]">Contas a Receber (Faturas Moloni Emitidas - Aguardando Recibo)</span>
                          </div>
                          <span className="text-[10px] text-[var(--status-warning)] font-semibold">
                            Após emitir o recibo, a conta fica marcada como paga no arquivo da loja
                          </span>
                        </div>
                        <div className="divide-y divide-[var(--border-subtle)]">
                          {clientUnpaid.map(stmt => (
                            <div key={stmt.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 hover:bg-[var(--surface-muted)]/50 transition-colors">
                              <div>
                                <p className="text-xs font-bold text-[var(--text-primary)] font-mono">{stmt.statement_number}</p>
                                {formatFTNumber(stmt.moloni_document_number) && (
                                  <p className="text-[10px] font-bold text-[var(--accent)] font-mono mt-0.5 flex items-center gap-1">
                                    <Cloud className="w-3 h-3 shrink-0" />
                                    {formatFTNumber(stmt.moloni_document_number)}
                                  </p>
                                )}
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

        {/* Arquivo dos documentos emitidos, organizado por loja */}
        {hasArchiveDocuments && (
          <div id="invoice-archive" className="scroll-mt-6 bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-2xs rounded-xl mb-32">
            <button
              type="button"
              aria-expanded={showHistory}
              aria-controls="invoice-archive-content"
              className="w-full text-left bg-[var(--surface-muted)] px-4 sm:px-6 py-4 flex items-center justify-between gap-3 cursor-pointer select-none rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              onClick={() => { setShowHistory(!showHistory); setOpenActionMenuId(null) }}
            >
              <span className="flex items-center gap-3">
                <span className="w-10 h-10 shrink-0 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-strong)] flex items-center justify-center text-[var(--text-secondary)]">
                  <FolderOpen className="w-5 h-5" />
                </span>
                <span>
                  <span role="heading" aria-level={2} className="block text-sm font-bold text-[var(--text-primary)]">Arquivo de Faturas por Loja</span>
                  <span className="block text-xs text-[var(--text-secondary)] mt-0.5">{archiveGroups.length} lojas · {archiveDocumentCount} documentos · Abre uma loja para consultar as faturas</span>
                </span>
              </span>
              <span className="text-[var(--text-tertiary)]">
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 motion-reduce:transition-none ${showHistory ? "rotate-0" : "-rotate-90"}`} />
              </span>
            </button>

            <AnimatedDisclosure open={showHistory} id="invoice-archive-content">
              <div className="border-t border-[var(--border-subtle)]">
                <div className="px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)]">
                  <label htmlFor="invoice-archive-search" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Procurar no arquivo</label>
                  <input id="invoice-archive-search" type="search" value={archiveSearch} onChange={event => {
                    const value = event.target.value
                    setArchiveSearch(value)
                    setExpandedArchiveStores(new Set(value.trim() ? groupInvoiceArchive(clients, statements, value).map(group => group.key) : []))
                  }}
                    placeholder="Loja, NIF ou número de fatura"
                    className="w-full max-w-md px-3 py-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] text-sm text-[var(--text-primary)]" />
                </div>
                {archiveGroups.length === 0 && <p className="px-6 py-6 text-sm text-[var(--text-tertiary)]">Nenhum documento encontrado.</p>}
                {archiveGroups.map(group => (
                  <div key={group.key} className={`mx-3 sm:mx-5 my-3 rounded-xl border shadow-2xs transition-colors duration-300 ${expandedArchiveStores.has(group.key) ? "border-[var(--accent)]/30" : "border-[var(--border-subtle)]"}`}>
                    <button type="button" aria-expanded={expandedArchiveStores.has(group.key)}
                      aria-controls={`invoice-store-${encodeURIComponent(group.key)}`}
                      className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left bg-[var(--accent-soft)] hover:brightness-[0.98] rounded-xl cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      onClick={() => { setOpenActionMenuId(null); setExpandedArchiveStores(previous => {
                        const next = new Set(previous)
                        if (next.has(group.key)) next.delete(group.key)
                        else next.add(group.key)
                        return next
                      }) }}>
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 shrink-0 rounded-xl bg-[var(--surface-bg)] border border-[var(--accent)]/20 flex items-center justify-center">
                          <Building className="w-5 h-5 text-[var(--accent)]" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--accent)] mb-0.5">Loja</span>
                          <span className="block text-sm font-bold text-[var(--text-primary)] break-words">{group.name}</span>
                          <span className="block text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                            {group.nif && `NIF: ${group.nif} · `}{group.paidCount} paga(s){group.awaitingReceiptCount > 0 && ` · ${group.awaitingReceiptCount} a aguardar recibo`}
                          </span>
                          {group.associationMissing && <span className="block text-xs text-[var(--status-warning)] mt-1">Loja por associar</span>}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 sm:gap-4 shrink-0 text-[var(--accent)]">
                        <span className="hidden sm:inline text-[11px] font-semibold">{expandedArchiveStores.has(group.key) ? "Ocultar faturas" : "Ver faturas"}</span>
                        <span className="px-2 py-1 rounded-md bg-[var(--surface-bg)] border border-[var(--accent)]/15 text-[11px] font-bold tabular-nums">{group.statements.length}<span className="hidden sm:inline"> faturas</span></span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 motion-reduce:transition-none ${expandedArchiveStores.has(group.key) ? "rotate-0" : "-rotate-90"}`} />
                      </span>
                    </button>
                    <AnimatedDisclosure open={expandedArchiveStores.has(group.key)} id={`invoice-store-${encodeURIComponent(group.key)}`}>
                      <div className="p-3 sm:p-5 bg-[var(--surface-muted)] rounded-b-xl border-t border-[var(--border-subtle)]">
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-3 pl-3 sm:pl-4">
                          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]"><FileText className="w-3.5 h-3.5" />Histórico de faturas</h3>
                          <span className="text-[10px] text-[var(--text-tertiary)]">Mais recentes primeiro</span>
                        </div>
                        <div className="border-l-2 border-[var(--border-strong)] pl-3 sm:pl-4 space-y-2">
                        {group.statements.map((stmt: any) => (
                          <div key={stmt.id || stmt.statement_number} className="px-3 sm:px-4 py-3.5 bg-[var(--surface-bg)] rounded-lg border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[var(--border-strong)] transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-[var(--text-primary)] font-mono">{stmt.statement_number}</p>
                                {formatFTNumber(stmt.moloni_document_number) && (
                                  <p className="text-[10px] font-bold text-[var(--accent)] font-mono mt-0.5 flex items-center gap-1">
                                    <Cloud className="w-3 h-3 shrink-0" />
                                    {formatFTNumber(stmt.moloni_document_number)}
                                  </p>
                                )}
                                <p className="text-[11px] text-[var(--text-tertiary)] flex flex-wrap items-center gap-2 mt-1">
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
                                {isInvoicePaid(stmt) ? (
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
                                              const modeStr = groupInvoicesByService ? "Agrupada por Serviço (Fatura Compacta - 1 página)" : "Detalhada (1 linha por envio)"
                                              const ok = confirm(`Deseja comunicar e emitir a fatura oficial no Moloni para o extrato ${stmt.statement_number}?\n\nModo: ${modeStr}`)
                                              if (!ok) return

                                              const { emitMoloniInvoiceForStatementAction } = await import("@/app/actions/moloni")
                                              const res = await emitMoloniInvoiceForStatementAction(stmt.statement_number || stmt.id, groupInvoicesByService)
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
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleOpenEmailModal(stmt)
                                            }}
                                            className="w-full flex items-center gap-2 px-3.5 py-2 text-left text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                                          >
                                            <Mail className="w-3.5 h-3.5 text-[var(--accent)]" />
                                            Enviar Fatura por Email
                                          </button>
                                        </>
                                      )}

                                      {!(stmt.moloni_document_pdf || stmt.moloni_document_id) && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleOpenEmailModal(stmt)
                                          }}
                                          className="w-full flex items-center gap-2 px-3.5 py-2 text-left text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                                        >
                                          <Mail className="w-3.5 h-3.5 text-[var(--accent)]" />
                                          Enviar Extrato por Email
                                        </button>
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
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setOpenActionMenuId(null)
                                            handleEmitReceipt(stmt)
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
                      </div>
                    </AnimatedDisclosure>
                  </div>
                ))}
              </div>
            </AnimatedDisclosure>
          </div>
        )}


      {/* Modal de Sucesso com Botão Direto de Download */}
      {issuedStatement && (
        <div className="tms-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="tms-modal-scroll relative w-full max-w-lg bg-[var(--surface-bg)] rounded-2xl shadow-[var(--shadow-layer)] border border-[var(--border-subtle)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
              <h3 className="text-lg font-bold">Fatura Moloni emitida!</h3>
              <p className="text-white/80 text-xs font-mono mt-0.5 font-semibold">
                {issuedStatement.statementNumber}
              </p>
              {issuedStatement.moloniDocumentNumber && (
                <p className="text-white/90 text-xs font-mono font-bold mt-1 bg-white/15 rounded-md px-2 py-0.5 inline-block">
                  📄 {issuedStatement.moloniDocumentNumber}
                </p>
              )}
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

                <button
                  type="button"
                  onClick={() => {
                    const stmt = statements.find((s: any) => s.statement_number === issuedStatement.statementNumber || s.id === issuedStatement.statementNumber) || {
                      statement_number: issuedStatement.statementNumber,
                      client_name: issuedStatement.clientName,
                      total_value: issuedStatement.totalValue,
                      moloni_document_number: issuedStatement.moloniDocumentNumber,
                      moloni_document_pdf: issuedStatement.moloniPdf,
                      client_id: clients.find((c: any) => (c.legal_name || c.short_name) === issuedStatement.clientName)?.id
                    }
                    setIssuedStatement(null)
                    handleOpenEmailModal(stmt)
                  }}
                  className="w-full py-2.5 bg-[var(--surface-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] text-[var(--text-primary)] font-semibold text-xs border border-[var(--border-subtle)] rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Mail className="w-4 h-4 text-[var(--accent)]" />
                  ✉️ Enviar Fatura por Email ao Cliente
                </button>

                {issuedStatement.warning && (
                  <div className="p-3 bg-[var(--status-warning-soft)] rounded-lg border border-[rgba(217,119,6,0.2)] text-[11px] text-[var(--text-primary)] flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-[var(--status-warning)] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[var(--status-warning)]">A fatura já foi emitida. Não volte a emitir.</p>
                      <p className="mt-0.5 text-[var(--text-secondary)] leading-relaxed">
                        {issuedStatement.warning} Pode voltar a tentar descarregar o PDF pelo botão acima.
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

      {/* ── Modal Emitir Recibo ── */}
      {receiptModalStmt && (
        <div className="tms-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="tms-modal-scroll w-full max-w-md rounded-2xl" style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-layer)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
                  <FileText className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Emitir Recibo</h3>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{receiptModalStmt.statement_number}</p>
                </div>
              </div>
              <button onClick={() => setReceiptModalStmt(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-70 transition-opacity" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
                <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Valor */}
              <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: 'var(--accent-soft)', border: '1px solid rgba(18,138,71,0.15)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Valor a receber</span>
                <span className="text-base font-bold" style={{ color: 'var(--accent)' }}>
                  {Number(receiptModalStmt.total_value || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                </span>
              </div>

              {/* Data de emissão */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Data de Emissão
                </label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={e => setReceiptDate(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Método de pagamento */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Método de Pagamento
                </label>
                <select
                  value={receiptPaymentMethod}
                  onChange={e => setReceiptPaymentMethod(Number(e.target.value))}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all cursor-pointer"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                >
                  {availablePaymentMethods.map(m => (
                    <option key={m.payment_method_id} value={m.payment_method_id} style={{ background: 'var(--surface-bg)', color: 'var(--text-primary)' }}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Notas <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>(opcional)</span>
                </label>
                <textarea
                  value={receiptNotes}
                  onChange={e => setReceiptNotes(e.target.value)}
                  placeholder="Ex: Pagamento referente à fatura FT 2026/12"
                  rows={2}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all resize-none"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 pb-5" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <button
                onClick={() => setReceiptModalStmt(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
                style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReceipt}
                disabled={isLoading || !receiptDate}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {isLoading ? 'A emitir…' : 'Emitir Recibo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Enviar Fatura por Email ── */}
      {emailModalStmt && (
        <div className="tms-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="tms-modal-scroll w-full max-w-md rounded-2xl animate-in fade-in zoom-in-95 duration-150" style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-layer)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
                  <Mail className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Enviar Fatura por Email</h3>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {formatFTNumber(emailModalStmt.moloni_document_number) || emailModalStmt.statement_number}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setEmailModalStmt(null)
                  setEmailFeedback(null)
                }} 
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-70 transition-opacity cursor-pointer" 
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}
              >
                <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Resumo do Documento */}
              <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: 'var(--accent-soft)', border: '1px solid rgba(18,138,71,0.15)' }}>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>
                    {emailModalStmt.client_name}
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    {emailModalStmt.shipments_count || emailModalStmt.shipments?.length || 0} envios incluídos
                  </span>
                </div>
                <span className="text-base font-bold font-mono" style={{ color: 'var(--accent)' }}>
                  {Number(emailModalStmt.total_value || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                </span>
              </div>

              {/* Email Destinatário */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Email de Destino
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={emailRecipient}
                    onChange={e => setEmailRecipient(e.target.value)}
                    placeholder="exemplo@empresa.pt"
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all pl-10"
                    style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                  />
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-[var(--text-tertiary)] pointer-events-none" />
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                  Pode alterar ou introduzir outro email para o reenvio da fatura.
                </p>
              </div>

              {/* Opções de Anexo */}
              <div className="space-y-2 pt-1">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                  Ficheiros Anexados
                </span>
                
                {(emailModalStmt.moloni_document_pdf || emailModalStmt.moloni_document_id) && (
                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={emailIncludeMoloni}
                      onChange={e => setEmailIncludeMoloni(e.target.checked)}
                      className="w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-[var(--status-success)]" />
                      <span className="text-xs font-medium text-[var(--text-primary)]">
                        Fatura Oficial Certificada AT (PDF)
                      </span>
                    </div>
                  </label>
                )}

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={emailIncludeStatement}
                    onChange={e => setEmailIncludeStatement(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      Extrato Detalhado Linke TMS (PDF)
                    </span>
                  </div>
                </label>
              </div>

              {/* Feedback Alert */}
              {emailFeedback && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                  emailFeedback.type === "success"
                    ? "bg-[var(--status-success-soft)] border-[rgba(18,138,71,0.2)] text-[var(--status-success)]"
                    : "bg-[var(--status-error-soft)] border-[rgba(239,68,68,0.2)] text-[var(--status-error)]"
                }`}>
                  {emailFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--status-success)]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-[var(--status-error)]" />
                  )}
                  <span>{emailFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 pb-5" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <button
                onClick={() => {
                  setEmailModalStmt(null)
                  setEmailFeedback(null)
                }}
                disabled={isSendingEmail}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70 cursor-pointer disabled:opacity-40"
                style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSendInvoiceEmail}
                disabled={isSendingEmail || !emailRecipient}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {isSendingEmail ? (
                  <>
                    <Cloud className="w-4 h-4 animate-spin" />
                    A enviar...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Enviar Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
