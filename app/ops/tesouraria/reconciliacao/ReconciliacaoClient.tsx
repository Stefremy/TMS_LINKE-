"use client"

import * as React from "react"
import Link from "next/link"
import * as XLSX from "xlsx"
import { 
  Upload, 
  FileText, 
  FileSpreadsheet,
  Check, 
  Copy, 
  Search, 
  Euro, 
  Building, 
  Package, 
  Download, 
  Filter, 
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  TrendingDown,
  ArrowRight,
  ExternalLink,
  History,
  Calendar
} from "lucide-react"
import type { 
  ReconcileItem, 
  ReconcileRunResult, 
  AuditHistoryEntry 
} from "./types"
import { 
  reconcileCttInvoiceAction,
  reconcileCttParsedItemsAction, 
  reconcileCttSampleAction 
} from "@/app/actions/reconciliacao-ctt"
import { parseCttItemsFromWorkbook } from "./parser"

interface ReconciliacaoClientProps {
  initialHistory: AuditHistoryEntry[]
}

export default function ReconciliacaoClient({ initialHistory }: ReconciliacaoClientProps) {
  const [activeSubTab, setActiveSubTab] = React.useState<"reconciliar" | "historico">("reconciliar")
  const [comparisonMode, setComparisonMode] = React.useState<"buy_price" | "sell_price">("buy_price")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  
  // Upload and results state
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [currentResult, setCurrentResult] = React.useState<ReconcileRunResult | null>(null)
  const [history, setHistory] = React.useState<AuditHistoryEntry[]>(initialHistory)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  // Table filters
  const [statusFilter, setStatusFilter] = React.useState<"all" | "mismatch" | "undercharged" | "unknown" | "ok">("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [sortBy, setSortBy] = React.useState<"diff" | "cttPrice" | "lnkPrice" | "date" | "id">("diff")
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc")

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Upload handler com parsing local para evitar timeouts de ficheiros grandes
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    setErrorMsg(null)

    try {
      // 1. Ler e analisar localmente no browser com SheetJS (resolve erros de streaming/Unexpected end of form)
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: "array" })
      const parsedItems = parseCttItemsFromWorkbook(wb)

      if (!parsedItems.length) {
        setErrorMsg("Não foi possível encontrar registos de objetos válidos ou colunas de preço no ficheiro CTT fornecido.")
        setIsProcessing(false)
        return
      }

      // 2. Enviar itens para reconciliação com o TMS via Server Action
      const res = await reconcileCttParsedItemsAction({
        items: parsedItems,
        filename: file.name,
        comparisonMode,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      })

      if (res.success && res.result) {
        setCurrentResult(res.result)
        setActiveSubTab("reconciliar")
      } else {
        setErrorMsg(res.error || "Erro ao processar ficheiro CTT.")
      }
    } catch (err: any) {
      console.error("Erro na leitura/reconciliação do ficheiro CTT:", err)
      setErrorMsg(err.message || "Erro inesperado ao processar o ficheiro CTT.")
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Carregar ficheiro de exemplo oficial diretamente do servidor
  const handleLoadSample = async () => {
    setIsProcessing(true)
    setErrorMsg(null)

    try {
      const res = await reconcileCttSampleAction({
        comparisonMode,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      })

      if (res.success && res.result) {
        setCurrentResult(res.result)
        setActiveSubTab("reconciliar")
      } else {
        setErrorMsg(res.error || "Erro ao processar ficheiro de exemplo.")
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao carregar ficheiro de exemplo.")
    } finally {
      setIsProcessing(false)
    }
  }

  // Filtered and sorted items
  const filteredItems = React.useMemo(() => {
    if (!currentResult) return []

    return currentResult.items
      .filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) return false

        if (searchQuery) {
          const q = searchQuery.toLowerCase().trim()
          const matchId = item.id.toLowerCase().includes(q)
          const matchClient = (item.clientName || "").toLowerCase().includes(q)
          const matchRecipient = (item.recipientName || "").toLowerCase().includes(q)
          const matchSender = (item.senderName || "").toLowerCase().includes(q)
          if (!matchId && !matchClient && !matchRecipient && !matchSender) return false
        }

        return true
      })
      .sort((a, b) => {
        let valA: any = a.diff
        let valB: any = b.diff

        if (sortBy === "diff") {
          valA = a.diff
          valB = b.diff
        } else if (sortBy === "cttPrice") {
          valA = a.cttPrice
          valB = b.cttPrice
        } else if (sortBy === "lnkPrice") {
          valA = a.lnkPrice
          valB = b.lnkPrice
        } else if (sortBy === "id") {
          valA = a.id
          valB = b.id
        }

        if (valA < valB) return sortOrder === "asc" ? -1 : 1
        if (valA > valB) return sortOrder === "asc" ? 1 : -1
        return 0
      })
  }, [currentResult, statusFilter, searchQuery, sortBy, sortOrder])

  // Discrepancy items to claim against CTT (mismatch and unknown)
  const claimItems = React.useMemo(() => {
    if (!currentResult) return []
    return currentResult.items.filter((i) => i.status === "mismatch" || i.status === "unknown")
  }, [currentResult])

  // Helper to format structured rows for Excel and CSV export
  const buildExportData = (itemsToExport: ReconcileItem[]) => {
    const headers = [
      "Código Objeto CTT",
      "Data CTT",
      "Cliente Linke",
      "Remetente",
      "Destinatário",
      "Serviço",
      "Preço CTT (€)",
      "Preço TMS Linke (€)",
      "Diferença (€)",
      "Estado da Auditoria",
      "Ação Recomendada"
    ]

    const rows = itemsToExport.map((i) => {
      let statusLabel = "Conforme"
      let actionLabel = "Sem discrepância detetada"

      if (i.status === "mismatch") {
        statusLabel = "Cobrado a Mais (Sobre-faturado)"
        actionLabel = "Solicitar Nota de Crédito CTT"
      } else if (i.status === "undercharged") {
        statusLabel = "Cobrado a Menos (Tarifa Reduzida)"
        actionLabel = "Tarifa CTT mais favorável que previsto"
      } else if (i.status === "unknown") {
        statusLabel = "Objeto Não Registado no TMS"
        actionLabel = "Averiguar Envio / Guia Não Identificada"
      }

      return [
        i.id,
        i.cttDate || "—",
        i.clientName || "—",
        i.senderName || "—",
        i.recipientName || "—",
        i.serviceType || "Expresso",
        Number(i.cttPrice.toFixed(2)),
        Number(i.lnkPrice.toFixed(2)),
        Number(i.diff.toFixed(2)),
        statusLabel,
        actionLabel
      ]
    })

    return { headers, rows }
  }

  // Export as Native Excel (.xlsx) with styled auto-fit columns
  const handleExportExcel = (itemsToExport: ReconcileItem[], filenameSuffix = "Reclamacao_CTT") => {
    if (!currentResult || itemsToExport.length === 0) return

    const { headers, rows } = buildExportData(itemsToExport)
    const wsData = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Set clear column widths so all columns are visible and separated cleanly
    ws["!cols"] = [
      { wch: 18 }, // Código Objeto CTT
      { wch: 12 }, // Data CTT
      { wch: 25 }, // Cliente Linke
      { wch: 22 }, // Remetente
      { wch: 25 }, // Destinatário
      { wch: 14 }, // Serviço
      { wch: 16 }, // Preço CTT (€)
      { wch: 18 }, // Preço TMS Linke (€)
      { wch: 16 }, // Diferença (€)
      { wch: 30 }, // Estado da Auditoria
      { wch: 36 }  // Ação Recomendada
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Reconciliação CTT")

    const safeFilename = currentResult.filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")
    const dateStr = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `${filenameSuffix}_${safeFilename}_${dateStr}.xlsx`)
  }

  // Export as CSV with UTF-8 BOM, semicolon delimiter, and CRLF for Excel column splitting
  const handleExportCsv = (itemsToExport: ReconcileItem[], filenameSuffix = "Reclamacao_CTT") => {
    if (!currentResult || itemsToExport.length === 0) return

    const { headers, rows } = buildExportData(itemsToExport)

    const formatCell = (val: any) => {
      if (val === null || val === undefined) return '""'
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }

    const csvLines = [
      headers.map(formatCell).join(";"),
      ...rows.map((row) => row.map(formatCell).join(";"))
    ]

    // Prepend UTF-8 BOM (\uFEFF) and join with standard Windows/Excel CRLF (\r\n)
    const csvContent = "\uFEFF" + csvLines.join("\r\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const safeFilename = currentResult.filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")
    const dateStr = new Date().toISOString().slice(0, 10)
    link.download = `${filenameSuffix}_${safeFilename}_${dateStr}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 font-sans">
      {/* 1. Sub-navigation tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] pb-2 text-xs">
        <Link
          href="/ops/tesouraria/reembolsos"
          className="px-3 py-1.5 rounded-md font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
        >
          Reembolsos de Transporte (COD)
        </Link>
        <span className="px-3 py-1.5 rounded-md font-bold text-[var(--accent)] bg-[var(--accent-soft)] border border-[var(--accent-subtle)]">
          Reconciliação CTT
        </span>
        <Link
          href="/ops/tesouraria/salarios"
          className="px-3 py-1.5 rounded-md font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
        >
          Salários & Folha
        </Link>
      </div>

      {/* 2. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-2xs">
            <Euro className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Reconciliação CTT
            </h1>
            <p className="text-xs text-[var(--text-tertiary)] font-medium mt-0.5">
              Conferência direta entre o discriminativo da transportadora e os custos de envios registados no TMS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xls,.xlsx"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs rounded-md transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isProcessing ? "A cruzar dados..." : "Importar Fatura CTT"}</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            disabled={isProcessing}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-semibold text-xs rounded-md transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Importar ficheiro local public/Discriminativo 6.xls"
          >
            <FileText className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <span>Exemplo Discriminativo</span>
          </button>
        </div>
      </div>

      {/* 3. Parameter / Filter Strip */}
      <div className="p-3 bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-lg text-xs flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">
              Comparar com:
            </span>
            <select
              value={comparisonMode}
              onChange={(e) => setComparisonMode(e.target.value as any)}
              className="px-2.5 py-1 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              <option value="buy_price">Custo de Compra Previsto (buy_price)</option>
              <option value="sell_price">Preço de Venda ao Cliente (sell_price)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">
              Período (Opcional):
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-0.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded text-[11px] text-[var(--text-primary)] font-mono"
            />
            <span className="text-[var(--text-tertiary)]">até</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-0.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded text-[11px] text-[var(--text-primary)] font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("reconciliar")}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              activeSubTab === "reconciliar"
                ? "bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Auditoria Atual
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("historico")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              activeSubTab === "historico"
                ? "bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <History className="w-3 h-3" />
            <span>Histórico ({history.length})</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-medium flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-600 hover:text-red-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4. Active view */}
      {activeSubTab === "reconciliar" ? (
        currentResult ? (
          <div className="space-y-4">
            {/* KPI Cards Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] block mb-1">
                  Objetos Faturados
                </span>
                <div className="text-lg font-black font-mono text-[var(--text-primary)]">
                  {currentResult.stats.totalItems.toLocaleString()}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-medium mt-0.5">
                  Total CTT: {currentResult.stats.totalCttBilled.toFixed(2)} €
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)] shrink-0" />
                  Cobrado a Mais
                </span>
                <div className="text-lg font-black font-mono text-[var(--status-warning)]">
                  {currentResult.stats.mismatchCount}
                </div>
                <div className="text-[11px] text-[var(--status-warning)] font-medium mt-0.5">
                  +{currentResult.stats.totalOverchargedRisk.toFixed(2)} € a reclamar
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-info)] shrink-0" />
                  Cobrado a Menos
                </span>
                <div className="text-lg font-black font-mono text-[var(--status-info)]">
                  {currentResult.stats.underchargedCount}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-medium mt-0.5">
                  -{currentResult.stats.totalUnderchargedGain.toFixed(2)} € poupança
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-critical)] shrink-0" />
                  Não Registados
                </span>
                <div className="text-lg font-black font-mono text-[var(--text-primary)]">
                  {currentResult.stats.unknownCount}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-medium mt-0.5">
                  Sem guia no TMS
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] shrink-0" />
                  Conformes
                </span>
                <div className="text-lg font-black font-mono text-[var(--status-success)]">
                  {currentResult.stats.okCount}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-medium mt-0.5">
                  {(100 - currentResult.stats.flaggedRate).toFixed(1)}% taxa conformidade
                </div>
              </div>
            </div>

            {/* Claim Action Banner if discrepancies exist */}
            {claimItems.length > 0 && (
              <div className="p-3.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--status-warning-soft)] border border-[rgba(180,83,9,0.2)] flex items-center justify-center text-[var(--status-warning)] shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[var(--text-primary)]">
                        Discrepâncias de Faturação Detetadas
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[rgba(180,83,9,0.2)]">
                        +{currentResult.stats.totalOverchargedRisk.toFixed(2)} € a reclamar
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                      {claimItems.length} objetos com cobrança em excesso ou sem correspondência no TMS prontos para exportação.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleExportExcel(claimItems, "Reclamacao_CTT")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs rounded-md transition-colors shadow-2xs cursor-pointer"
                    title="Exportar ficheiro Excel (.xlsx) formatado para envio direto aos CTT"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Exportar Reclamação (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportCsv(claimItems, "Reclamacao_CTT")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-semibold text-xs rounded-md transition-colors shadow-2xs cursor-pointer"
                    title="Exportar ficheiro CSV com separador ponto e vírgula"
                  >
                    <Download className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>
            )}

            {/* Filter Bar, Search & Table Exports */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1 p-1 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    statusFilter === "all"
                      ? "bg-[var(--surface-bg)] text-[var(--text-primary)] font-bold shadow-2xs border border-[var(--border-subtle)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span>Todos</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    statusFilter === "all" ? "bg-[var(--surface-dim)] text-[var(--text-primary)] font-bold" : "text-[var(--text-tertiary)]"
                  }`}>
                    {currentResult.items.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("mismatch")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    statusFilter === "mismatch"
                      ? "bg-[var(--surface-bg)] text-[var(--text-primary)] font-bold shadow-2xs border border-[var(--border-subtle)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)] shrink-0" />
                  <span>Cobrado a Mais</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    statusFilter === "mismatch" ? "bg-[var(--status-warning-soft)] text-[var(--status-warning)] font-bold" : "text-[var(--text-tertiary)]"
                  }`}>
                    {currentResult.stats.mismatchCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("undercharged")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    statusFilter === "undercharged"
                      ? "bg-[var(--surface-bg)] text-[var(--text-primary)] font-bold shadow-2xs border border-[var(--border-subtle)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-info)] shrink-0" />
                  <span>Cobrado a Menos</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    statusFilter === "undercharged" ? "bg-[var(--status-info-soft)] text-[var(--status-info)] font-bold" : "text-[var(--text-tertiary)]"
                  }`}>
                    {currentResult.stats.underchargedCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("unknown")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    statusFilter === "unknown"
                      ? "bg-[var(--surface-bg)] text-[var(--text-primary)] font-bold shadow-2xs border border-[var(--border-subtle)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-critical)] shrink-0" />
                  <span>Não Registados</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    statusFilter === "unknown" ? "bg-[var(--status-critical-soft)] text-[var(--status-critical)] font-bold" : "text-[var(--text-tertiary)]"
                  }`}>
                    {currentResult.stats.unknownCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("ok")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    statusFilter === "ok"
                      ? "bg-[var(--surface-bg)] text-[var(--text-primary)] font-bold shadow-2xs border border-[var(--border-subtle)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] shrink-0" />
                  <span>Conformes</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    statusFilter === "ok" ? "bg-[var(--status-success-soft)] text-[var(--status-success)] font-bold" : "text-[var(--text-tertiary)]"
                  }`}>
                    {currentResult.stats.okCount}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--text-tertiary)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar objeto, cliente..."
                    className="pl-8 pr-3 py-1 bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-md text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] w-52"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleExportExcel(filteredItems, `Auditoria_CTT_${statusFilter}`)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-md text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                  title="Exportar itens visíveis para Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span className="hidden sm:inline">Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportCsv(filteredItems, `Auditoria_CTT_${statusFilter}`)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-md text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                  title="Exportar itens visíveis para CSV (.csv)"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--surface-bg)] shadow-2xs">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[var(--surface-muted)] text-[var(--text-tertiary)] font-bold uppercase tracking-wider text-[10px] border-b border-[var(--border-subtle)] sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Objeto / Tracking</th>
                      <th className="py-2.5 px-3">Cliente / Remetente</th>
                      <th className="py-2.5 px-3">Destinatário</th>
                      <th className="py-2.5 px-3">Data CTT</th>
                      <th className="py-2.5 px-3 text-right">Faturado CTT</th>
                      <th className="py-2.5 px-3 text-right">TMS Linke</th>
                      <th className="py-2.5 px-3 text-right">Diferença</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-[var(--text-tertiary)] text-xs">
                          Nenhum registo corresponde aos filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => {
                        const isMismatch = item.status === "mismatch"
                        const isUndercharged = item.status === "undercharged"
                        const isUnknown = item.status === "unknown"
                        const isOk = item.status === "ok"

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-[var(--surface-muted)] transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-[var(--text-primary)]">{item.id}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(item.id, item.id)}
                                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                                  title="Copiar código"
                                >
                                  {copiedId === item.id ? (
                                    <Check className="w-3 h-3 text-[var(--accent)]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-[var(--text-primary)] truncate max-w-[180px]">
                                {item.clientName || "—"}
                              </div>
                              {item.senderName && item.senderName !== item.clientName && (
                                <div className="text-[10px] text-[var(--text-tertiary)] truncate max-w-[180px]">
                                  Rem: {item.senderName}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="text-[var(--text-secondary)] truncate max-w-[180px]">
                                {item.recipientName || "—"}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-[var(--text-tertiary)] font-mono text-[11px]">
                              {item.cttDate || "—"}
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-[var(--text-primary)]">
                              {item.cttPrice.toFixed(2)} €
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono text-[var(--text-secondary)]">
                              {isUnknown ? "—" : `${item.lnkPrice.toFixed(2)} €`}
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono">
                              {isUnknown ? (
                                <span className="text-[var(--text-primary)] font-medium">+{item.cttPrice.toFixed(2)} €</span>
                              ) : item.diff > 0.005 ? (
                                <span className="text-[var(--status-warning)] font-bold">+{item.diff.toFixed(2)} €</span>
                              ) : item.diff < -0.005 ? (
                                <span className="text-[var(--status-info)] font-medium">{item.diff.toFixed(2)} €</span>
                              ) : (
                                <span className="text-[var(--text-tertiary)]">0.00 €</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              {isMismatch && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[rgba(180,83,9,0.2)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
                                  Cobrado a Mais
                                </span>
                              )}
                              {isUndercharged && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--status-info-soft)] text-[var(--status-info)] border border-[rgba(29,78,216,0.2)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-info)]" />
                                  Cobrado a Menos
                                </span>
                              )}
                              {isUnknown && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--surface-dim)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" />
                                  Não Registado
                                </span>
                              )}
                              {isOk && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[rgba(18,138,71,0.2)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)]" />
                                  Conforme
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-2.5 bg-[var(--surface-muted)] border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-tertiary)] flex items-center justify-between">
                <div>
                  A apresentar {filteredItems.length} de {currentResult.items.length} objetos faturados
                </div>
                <div className="font-mono">
                  Ficheiro: <span className="font-semibold text-[var(--text-secondary)]">{currentResult.filename}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty / Upload Callout State */
          <div className="border border-dashed border-[var(--border-subtle)] rounded-xl p-10 text-center bg-[var(--surface-bg)] flex flex-col items-center justify-center space-y-3 shadow-2xs">
            <div className="w-12 h-12 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] mb-1">
              <Upload className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Carregue o Ficheiro Discriminativo dos CTT (.XLS / .XLSX)
            </h3>
            <p className="text-xs text-[var(--text-tertiary)] max-w-md">
              O TMS Linke cruza automaticamente cada objeto com os envios registados na base de dados interna, detetando cobranças em excesso ou guias fantasma.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs rounded-md transition-colors shadow-2xs cursor-pointer"
              >
                Selecionar Ficheiro CTT
              </button>
              <button
                type="button"
                onClick={handleLoadSample}
                disabled={isProcessing}
                className="px-4 py-2 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] font-semibold text-xs rounded-md transition-colors border border-[var(--border-subtle)] cursor-pointer shadow-2xs"
              >
                Testar com Exemplo Discriminativo
              </button>
            </div>
          </div>
        )
      ) : (
        /* History View */
        <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--surface-bg)] shadow-2xs">
          <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Auditorias Anteriores
            </h2>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {history.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-tertiary)]">
                Nenhuma auditoria registada no histórico até ao momento.
              </div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="p-3.5 hover:bg-[var(--surface-muted)] transition-colors flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-xs text-[var(--text-primary)]">
                      {h.filename}
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)] font-mono mt-0.5">
                      Executada em: {new Date(h.created_at).toLocaleString("pt-PT")} • Modo: {h.comparisonMode === "buy_price" ? "Custo de Compra" : "Venda"}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div>
                      <span className="text-[var(--text-tertiary)] text-[10px] block uppercase">Objetos</span>
                      <span className="font-semibold text-[var(--text-primary)]">{h.totalRows}</span>
                    </div>

                    <div>
                      <span className="text-[var(--text-tertiary)] text-[10px] block uppercase">Cobrado a Mais</span>
                      <span className="font-bold text-[var(--status-warning)]">
                        +{h.stats.totalOverchargedRisk?.toFixed(2) || "0.00"} €
                      </span>
                    </div>

                    <div>
                      <span className="text-[var(--text-tertiary)] text-[10px] block uppercase">Cobrado a Menos</span>
                      <span className="font-bold text-[var(--status-info)]">
                        -{h.stats.totalUnderchargedGain?.toFixed(2) || "0.00"} €
                      </span>
                    </div>

                    <div>
                      <span className="text-[var(--text-tertiary)] text-[10px] block uppercase">Não Registados</span>
                      <span className="font-semibold text-[var(--text-secondary)]">{h.stats.unknownCount}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
