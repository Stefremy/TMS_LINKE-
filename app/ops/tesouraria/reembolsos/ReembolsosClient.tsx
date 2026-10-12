"use client"

import * as React from "react"
import { 
  Upload, 
  FileText, 
  Check, 
  Copy, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Euro, 
  Building, 
  Package, 
  Download, 
  Trash2, 
  Filter, 
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight
} from "lucide-react"
import type { ReembolsoBatch, ClientReembolsoSummary, ReembolsoMatchedItem } from "@/lib/services/reembolsos/types"
import { 
  processReembolsoUploadAction, 
  loadSampleCttFileAction, 
  markClientReembolsoPaidAction,
  deleteReembolsoBatchAction
} from "@/app/actions/reembolsos"

interface ReembolsosClientProps {
  initialBatches: ReembolsoBatch[]
}

export default function ReembolsosClient({ initialBatches }: ReembolsosClientProps) {
  const [batches, setBatches] = React.useState<ReembolsoBatch[]>(initialBatches)
  const [selectedBatch, setSelectedBatch] = React.useState<ReembolsoBatch | null>(initialBatches[0] || null)
  const [activeTab, setActiveTab] = React.useState<"clientes" | "guias" | "historico">("clientes")
  
  // Upload state
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Client expansion state
  const [expandedClients, setExpandedClients] = React.useState<Record<string, boolean>>({})
  const [copiedIban, setCopiedIban] = React.useState<string | null>(null)

  // Guias table search & filter
  const [guiasSearch, setGuiasSearch] = React.useState("")
  const [guiasFilter, setGuiasFilter] = React.useState<"all" | "matched" | "value_mismatch" | "unmatched">("all")

  // Payment marking state
  const [updatingClientId, setUpdatingClientId] = React.useState<string | null>(null)

  const toggleClientExpand = (clientId: string) => {
    setExpandedClients(prev => ({ ...prev, [clientId]: !prev[clientId] }))
  }

  const handleCopyIban = (iban: string) => {
    navigator.clipboard.writeText(iban.replace(/\s+/g, ""))
    setCopiedIban(iban)
    setTimeout(() => setCopiedIban(null), 2000)
  }

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const text = await file.text()
      const carrier = file.name.toLowerCase().includes("correos") ? "correos" : "ctt"
      const res = await processReembolsoUploadAction(text, file.name, carrier)

      if (res.success && res.batch) {
        setBatches(prev => [res.batch!, ...prev])
        setSelectedBatch(res.batch)
        setActiveTab("clientes")
        if (fileInputRef.current) fileInputRef.current.value = ""
      } else {
        setUploadError(res.error || "Erro ao processar ficheiro de extrato.")
      }
    } catch (err: any) {
      setUploadError(err.message || "Erro ao ler ficheiro.")
    } finally {
      setIsUploading(false)
    }
  }

  // Load sample file
  const handleLoadSample = async () => {
    setIsUploading(true)
    setUploadError(null)
    try {
      const res = await loadSampleCttFileAction()
      if (res.success && res.batch) {
        setBatches(prev => [res.batch!, ...prev])
        setSelectedBatch(res.batch)
        setActiveTab("clientes")
      } else {
        setUploadError(res.error || "Erro ao carregar ficheiro de exemplo.")
      }
    } catch (err: any) {
      setUploadError(err.message || "Erro desconhecido.")
    } finally {
      setIsUploading(false)
    }
  }

  // Toggle paid status
  const handleTogglePaid = async (clientId: string, currentPaid: boolean) => {
    if (!selectedBatch) return
    setUpdatingClientId(clientId)

    try {
      const newPaid = !currentPaid
      const res = await markClientReembolsoPaidAction(
        selectedBatch.id,
        clientId,
        newPaid,
        newPaid ? `TRF-REEMB-${new Date().toISOString().slice(0, 10)}` : undefined
      )

      if (res.success) {
        const updatedSummaries = selectedBatch.clientSummaries.map(s => {
          if (s.clientId === clientId) {
            return {
              ...s,
              isPaid: newPaid,
              paidAt: newPaid ? new Date().toISOString() : undefined,
              paymentRef: newPaid ? `TRF-REEMB-${new Date().toISOString().slice(0, 10)}` : undefined
            }
          }
          return s
        })

        const updatedBatch = { ...selectedBatch, clientSummaries: updatedSummaries }
        setSelectedBatch(updatedBatch)
        setBatches(prev => prev.map(b => b.id === updatedBatch.id ? updatedBatch : b))
      } else {
        alert(res.error || "Erro ao atualizar estado de liquidação.")
      }
    } finally {
      setUpdatingClientId(null)
    }
  }

  // Delete batch
  const handleDeleteBatch = async (batchId: string) => {
    if (!window.confirm("Confirmar a remoção deste lote de reconciliação?")) return
    const res = await deleteReembolsoBatchAction(batchId)
    if (res.success) {
      const remaining = batches.filter(b => b.id !== batchId)
      setBatches(remaining)
      if (selectedBatch?.id === batchId) {
        setSelectedBatch(remaining[0] || null)
      }
    } else {
      alert(res.error || "Erro ao apagar lote.")
    }
  }

  // Export CSV
  const handleExportCsv = () => {
    if (!selectedBatch) return
    const rows = [
      ["Cliente", "IBAN", "Total_Guias", "Total_EUR", "Estado", "Referencia_Pagamento"],
      ...selectedBatch.clientSummaries.map(c => [
        `"${c.clientName.replace(/"/g, '""')}"`,
        `"${c.clientIban}"`,
        c.itemsCount,
        c.totalAmount.toFixed(2),
        c.isPaid ? "Liquidado" : "Pendente",
        `"${c.paymentRef || ""}"`
      ])
    ]
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(";")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Reembolsos_${selectedBatch.filename.replace(/\.[^/.]+$/, "")}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtered guias
  const filteredGuias = React.useMemo(() => {
    if (!selectedBatch) return []
    return selectedBatch.items.filter(item => {
      if (guiasFilter === "matched" && item.reconcileStatus !== "matched") return false
      if (guiasFilter === "value_mismatch" && item.reconcileStatus !== "value_mismatch") return false
      if (guiasFilter === "unmatched" && item.reconcileStatus !== "unmatched") return false

      if (guiasSearch) {
        const term = guiasSearch.toLowerCase()
        const matchTrk = item.carrierTracking.toLowerCase().includes(term)
        const matchRef = item.clientReference.toLowerCase().includes(term)
        const matchName = item.recipientName.toLowerCase().includes(term)
        const matchClient = (item.clientName || "").toLowerCase().includes(term)
        if (!matchTrk && !matchRef && !matchName && !matchClient) return false
      }

      return true
    })
  }, [selectedBatch, guiasSearch, guiasFilter])

  const totalPaidToClients = selectedBatch?.clientSummaries
    .filter(c => c.isPaid && c.clientId !== "unmatched_group")
    .reduce((sum, c) => sum + c.totalAmount, 0) || 0

  const totalPendingToClients = (selectedBatch?.totalAmount || 0) - totalPaidToClients

  return (
    <div className="space-y-5 font-sans">
      
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-2xs">
            <Euro className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Reembolsos de Transporte (COD)
            </h1>
            <p className="text-xs text-[var(--text-tertiary)] font-medium mt-0.5">
              Reconciliação de extratos de cobrança de transportadoras e liquidação a clientes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xls,.xlsx,.csv,.xml" 
            className="hidden" 
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs rounded-md transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? "A processar..." : "Importar Extrato"}</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            disabled={isUploading}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-semibold text-xs rounded-md transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Importar ficheiro local public/CTTE99001554332026.XLS"
          >
            <FileText className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <span>Exemplo CTT</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-3.5 rounded-lg bg-[var(--status-critical-soft)] border border-[rgba(239,68,68,0.2)] text-[var(--status-critical)] text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* 2. Sem extrato carregado: Dropzone corporativa limpa */}
      {!selectedBatch ? (
        <div className="bg-[var(--surface-bg)] border border-dashed border-[var(--border-subtle)] rounded-xl p-10 text-center max-w-lg mx-auto shadow-2xs">
          <div className="w-12 h-12 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto text-[var(--text-secondary)] mb-3">
            <Upload className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Nenhum extrato de reembolso selecionado</h3>
          <p className="text-xs text-[var(--text-tertiary)] mb-5 max-w-xs mx-auto">
            Importe o ficheiro .XLS ou .CSV fornecido pelo CTT Expresso ou Correos Express para conciliar com os envios do TMS.
          </p>

          <div className="flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-md text-xs font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-2xs"
            >
              Selecionar Ficheiro...
            </button>
            <button
              type="button"
              onClick={handleLoadSample}
              className="px-4 py-2 rounded-md text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] border border-[var(--border-subtle)] transition-colors cursor-pointer shadow-2xs"
            >
              Carregar Exemplo CTT
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 3. Métricas Corporativas (KPIs) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[var(--surface-bg)] p-3.5 rounded-xl border border-[var(--border-subtle)] shadow-2xs">
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">Total do Extrato</span>
              <div className="text-lg font-black text-[var(--text-primary)] font-mono">
                {selectedBatch.totalAmount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
              </div>
              <span className="text-[11px] text-[var(--text-tertiary)] font-medium mt-0.5 block">
                {selectedBatch.totalItems} guias faturadas ({selectedBatch.carrier.toUpperCase()})
              </span>
            </div>

            <div className="bg-[var(--surface-bg)] p-3.5 rounded-xl border border-[var(--border-subtle)] shadow-2xs">
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">Clientes a Liquidar</span>
              <div className="text-lg font-black text-[var(--text-primary)] font-mono">
                {selectedBatch.clientSummaries.filter(c => c.clientId !== "unmatched_group").length}
              </div>
              <span className="text-[11px] text-[var(--text-tertiary)] font-medium mt-0.5 block">
                Agrupados por IBAN
              </span>
            </div>

            <div className="bg-[var(--surface-bg)] p-3.5 rounded-xl border border-[var(--border-subtle)] shadow-2xs">
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">Pendente a Clientes</span>
              <div className="text-lg font-black text-[var(--status-warning)] font-mono">
                {totalPendingToClients.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
              </div>
              <span className="text-[11px] text-[var(--text-tertiary)] font-medium mt-0.5 block">
                {totalPaidToClients > 0 ? `${totalPaidToClients.toFixed(2)}€ já liquidado` : "Aguardando transferência"}
              </span>
            </div>

            <div className="bg-[var(--surface-bg)] p-3.5 rounded-xl border border-[var(--border-subtle)] shadow-2xs">
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">Cruzamento no TMS</span>
              <div className="text-lg font-black text-[var(--text-primary)] font-mono">
                {selectedBatch.matchedCount} / {selectedBatch.totalItems}
              </div>
              <span className="text-[11px] font-medium mt-0.5 block text-[var(--status-success)]">
                {Math.round((selectedBatch.matchedCount / (selectedBatch.totalItems || 1)) * 100)}% correspondido
              </span>
            </div>
          </div>

          {/* 4. Sub-barra de Informação do Ficheiro */}
          <div className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3.5 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                {selectedBatch.filename}
              </span>
              {selectedBatch.carrierAccount && (
                <span className="font-mono text-[11px] bg-[var(--surface-bg)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                  Conta: {selectedBatch.carrierAccount}
                </span>
              )}
              {selectedBatch.destinationIban && (
                <span className="font-mono text-[11px] bg-[var(--surface-bg)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                  Destino: {selectedBatch.destinationIban}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] font-semibold text-xs border border-[var(--border-subtle)] rounded-md transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-3 h-3 text-[var(--text-tertiary)]" />
                <span>Exportar CSV</span>
              </button>

              {batches.length > 1 && (
                <select
                  value={selectedBatch.id}
                  onChange={(e) => {
                    const found = batches.find(b => b.id === e.target.value)
                    if (found) setSelectedBatch(found)
                  }}
                  className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-md px-2 py-1 text-xs font-semibold focus:outline-none"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.filename} ({new Date(b.created_at).toLocaleDateString('pt-PT')})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 5. Abas de Navegação (Tabs Enterprise) */}
          <div className="flex items-center gap-1 border-b border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setActiveTab("clientes")}
              className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer rounded-t-md ${
                activeTab === "clientes"
                  ? "text-[var(--accent)] border-[var(--accent)] bg-[var(--accent-soft)]/40"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-transparent"
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Liquidação por Cliente</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                {selectedBatch.clientSummaries.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("guias")}
              className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer rounded-t-md ${
                activeTab === "guias"
                  ? "text-[var(--accent)] border-[var(--accent)] bg-[var(--accent-soft)]/40"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-transparent"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Todas as Guias do Extrato</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                {selectedBatch.items.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("historico")}
              className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer rounded-t-md ${
                activeTab === "historico"
                  ? "text-[var(--accent)] border-[var(--accent)] bg-[var(--accent-soft)]/40"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-transparent"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Histórico de Lotes</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                {batches.length}
              </span>
            </button>
          </div>

          {/* 6. TAB 1: LIQUIDAÇÃO POR CLIENTE */}
          {activeTab === "clientes" && (
            <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl shadow-2xs overflow-hidden">
              <div className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] px-4 py-2.5 grid grid-cols-12 gap-3 text-[10px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider items-center">
                <div className="col-span-4">Cliente</div>
                <div className="col-span-4">IBAN para Liquidação</div>
                <div className="col-span-1 text-center">Guias</div>
                <div className="col-span-1 text-right">Valor</div>
                <div className="col-span-2 text-right">Ação / Estado</div>
              </div>

              <div className="divide-y divide-[var(--border-subtle)]">
                {selectedBatch.clientSummaries.map((client) => {
                  const isExpanded = Boolean(expandedClients[client.clientId])
                  const isUnmatched = client.clientId === "unmatched_group"

                  return (
                    <div key={client.clientId} className="flex flex-col transition-colors hover:bg-[var(--surface-muted)]/30">
                      <div className="px-4 py-3 grid grid-cols-12 gap-3 items-center text-xs">
                        
                        {/* Cliente */}
                        <div className="col-span-4 flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => toggleClientExpand(client.clientId)}
                            className="p-1 rounded hover:bg-[var(--surface-muted)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          <div>
                            <div className="font-bold text-[var(--text-primary)]">
                              {client.clientName}
                            </div>
                            {isUnmatched && (
                              <span className="text-[10px] font-semibold text-[var(--status-warning)]">
                                Guias não encontradas na base de dados
                              </span>
                            )}
                          </div>
                        </div>

                        {/* IBAN */}
                        <div className="col-span-4">
                          {client.clientIban && client.clientIban !== "N/A" ? (
                            <div className="inline-flex items-center gap-1.5 bg-[var(--surface-muted)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                              <span className="font-mono text-[11px] text-[var(--text-primary)]">
                                {client.clientIban}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyIban(client.clientIban)}
                                className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                                title="Copiar IBAN"
                              >
                                {copiedIban === client.clientIban ? (
                                  <Check className="w-3 h-3 text-[var(--status-success)]" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[var(--text-tertiary)] italic">
                              {isUnmatched ? "—" : "Sem IBAN configurado"}
                            </span>
                          )}
                        </div>

                        {/* Guias */}
                        <div className="col-span-1 text-center font-mono font-bold text-[var(--text-secondary)]">
                          {client.itemsCount}
                        </div>

                        {/* Valor Total */}
                        <div className="col-span-1 text-right font-mono font-bold text-[var(--text-primary)]">
                          {client.totalAmount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                        </div>

                        {/* Ação */}
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          {!isUnmatched ? (
                            <button
                              type="button"
                              onClick={() => handleTogglePaid(client.clientId, client.isPaid)}
                              disabled={updatingClientId === client.clientId}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs ${
                                client.isPaid
                                  ? "bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[rgba(18,138,71,0.2)] hover:bg-[var(--surface-muted)]"
                                  : "bg-[var(--surface-muted)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                              }`}
                            >
                              {client.isPaid ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Liquidado</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-[var(--status-warning)]" />
                                  <span>Marcar Pago</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-[10px] text-[var(--status-warning)] font-bold px-2 py-0.5 rounded bg-[var(--status-warning-soft)] border border-[rgba(217,119,6,0.2)]">
                              Pendente TMS
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tabela de Guias Detalhadas Expansível */}
                      {isExpanded && (
                        <div className="bg-[var(--surface-muted)]/40 border-t border-[var(--border-subtle)] px-6 py-3">
                          <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead>
                              <tr className="border-b border-[var(--border-subtle)] text-[10px] text-[var(--text-tertiary)] font-semibold uppercase">
                                <th className="pb-1">Guia</th>
                                <th className="pb-1">Destinatário</th>
                                <th className="pb-1">Localidade</th>
                                <th className="pb-1">Data Entrega</th>
                                <th className="pb-1">Pagamento</th>
                                <th className="pb-1">Ref. Encomenda</th>
                                <th className="pb-1 text-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-subtle)] font-mono text-[11px]">
                              {client.items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-[var(--surface-bg)] transition-colors">
                                  <td className="py-1.5 font-bold text-[var(--text-primary)]">{it.carrierTracking}</td>
                                  <td className="py-1.5 font-sans text-[var(--text-secondary)]">{it.recipientName}</td>
                                  <td className="py-1.5 font-sans text-[var(--text-tertiary)]">{it.recipientCity} ({it.recipientPostalCode})</td>
                                  <td className="py-1.5 text-[var(--text-secondary)]">{it.deliveryDate}</td>
                                  <td className="py-1.5 font-sans">
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                                      {it.paymentMethod}
                                    </span>
                                  </td>
                                  <td className="py-1.5 text-[var(--text-tertiary)]">{it.clientReference || it.clientNotes || "—"}</td>
                                  <td className="py-1.5 text-right font-bold text-[var(--text-primary)]">
                                    {it.amount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 7. TAB 2: TODAS AS GUIAS DO EXTRATO */}
          {activeTab === "guias" && (
            <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl shadow-2xs overflow-hidden">
              {/* Barra de Filtro e Pesquisa */}
              <div className="p-3 border-b border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={guiasSearch}
                    onChange={(e) => setGuiasSearch(e.target.value)}
                    placeholder="Pesquisar por guia, destinatário..."
                    className="w-full pl-8 pr-2.5 py-1 bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-md text-xs focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setGuiasFilter("all")}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                      guiasFilter === "all"
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]"
                    }`}
                  >
                    Todas ({selectedBatch.items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuiasFilter("matched")}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                      guiasFilter === "matched"
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]"
                    }`}
                  >
                    Correspondidas ({selectedBatch.matchedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuiasFilter("unmatched")}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                      guiasFilter === "unmatched"
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]"
                    }`}
                  >
                    Não Associadas ({selectedBatch.unmatchedCount})
                  </button>
                </div>
              </div>

              {/* Tabela de Guias */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">#</th>
                      <th className="px-3.5 py-2.5">Guia (Objeto)</th>
                      <th className="px-3.5 py-2.5">Destinatário</th>
                      <th className="px-3.5 py-2.5">Localidade</th>
                      <th className="px-3.5 py-2.5">Data Entrega</th>
                      <th className="px-3.5 py-2.5">Pagamento</th>
                      <th className="px-3.5 py-2.5">Cliente TMS</th>
                      <th className="px-3.5 py-2.5">Estado</th>
                      <th className="px-3.5 py-2.5 text-right">Valor Cobrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {filteredGuias.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[var(--surface-muted)]/40 transition-colors">
                        <td className="px-3.5 py-2 font-mono text-[11px] text-[var(--text-tertiary)]">{item.lineNumber}</td>
                        <td className="px-3.5 py-2">
                          <div className="font-mono font-bold text-[var(--text-primary)]">{item.carrierTracking}</div>
                          {item.clientReference && (
                            <div className="font-mono text-[10px] text-[var(--text-tertiary)]">Ref: {item.clientReference}</div>
                          )}
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="font-semibold text-[var(--text-primary)]">{item.recipientName}</div>
                          <div className="text-[10px] text-[var(--text-tertiary)] truncate max-w-xs">{item.recipientAddress}</div>
                        </td>
                        <td className="px-3.5 py-2 text-[var(--text-secondary)]">
                          <div>{item.recipientCity}</div>
                          <div className="text-[10px] text-[var(--text-tertiary)]">{item.recipientPostalCode}</div>
                        </td>
                        <td className="px-3.5 py-2 font-mono text-[11px] text-[var(--text-secondary)]">
                          {item.deliveryDate}
                        </td>
                        <td className="px-3.5 py-2">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                            {item.paymentMethod}
                          </span>
                        </td>
                        <td className="px-3.5 py-2">
                          {item.clientId ? (
                            <span className="font-bold text-[var(--text-primary)]">{item.clientName}</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-[var(--status-warning)]">
                              Não encontrado
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2">
                          {item.reconcileStatus === "matched" ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[rgba(18,138,71,0.2)]">
                              Correspondido
                            </span>
                          ) : item.reconcileStatus === "value_mismatch" ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[rgba(217,119,6,0.2)]">
                              Divergência
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--surface-muted)] text-[var(--text-tertiary)]">
                              Pendente TMS
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-[var(--text-primary)]">
                          {item.amount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. TAB 3: HISTÓRICO DE LOTES */}
          {activeTab === "historico" && (
            <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl shadow-2xs overflow-hidden">
              <div className="p-3 border-b border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]">
                Lotes de Reembolso Anteriores ({batches.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Ficheiro</th>
                      <th className="px-3.5 py-2.5">Transportadora</th>
                      <th className="px-3.5 py-2.5">Data Importação</th>
                      <th className="px-3.5 py-2.5 text-center">Guias</th>
                      <th className="px-3.5 py-2.5 text-center">Correspondência</th>
                      <th className="px-3.5 py-2.5 text-right">Montante</th>
                      <th className="px-3.5 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {batches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-[var(--surface-muted)]/40 transition-colors">
                        <td className="px-3.5 py-2 font-semibold text-[var(--text-primary)] flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                          <span>{batch.filename}</span>
                        </td>
                        <td className="px-3.5 py-2 font-mono text-[11px] uppercase text-[var(--text-secondary)] font-bold">
                          {batch.carrier}
                        </td>
                        <td className="px-3.5 py-2 text-[var(--text-secondary)]">
                          {new Date(batch.created_at).toLocaleString("pt-PT")}
                        </td>
                        <td className="px-3.5 py-2 text-center font-mono font-bold text-[var(--text-primary)]">
                          {batch.totalItems}
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <span className="font-bold text-[var(--status-success)]">{batch.matchedCount}</span>
                          <span className="text-[var(--text-tertiary)] text-[11px]"> / {batch.totalItems}</span>
                        </td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-[var(--text-primary)]">
                          {batch.totalAmount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                        </td>
                        <td className="px-3.5 py-2 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBatch(batch)
                              setActiveTab("clientes")
                            }}
                            className="px-2.5 py-1 rounded bg-[var(--surface-muted)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-xs transition-colors cursor-pointer"
                          >
                            Abrir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBatch(batch.id)}
                            className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--status-critical)] transition-colors cursor-pointer"
                            title="Apagar este lote"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}
