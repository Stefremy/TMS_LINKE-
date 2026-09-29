"use client"

import * as React from "react"
import Link from "next/link"
import {
  Euro,
  Users,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Download,
  Filter,
  FileText,
  FileCheck,
  Edit,
  Trash2,
  CreditCard,
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  AlertCircle,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Shield,
  Lock,
} from "lucide-react"
import { SalarioRecord, MONTH_NAMES } from "../types"
import { SalarioModal } from "./SalarioModal"
import { SalarioReceiptModal } from "./SalarioReceiptModal"
import {
  getSalariosAction,
  deleteSalarioAction,
  markSalarioStatusAction,
  batchMarkSalariosPaidAction,
  batchGenerateMonthPayrollAction,
} from "@/app/actions/salarios"

interface SalariosClientProps {
  initialSalarios: SalarioRecord[]
  isSuperAdmin?: boolean
}

export function SalariosClient({ initialSalarios, isSuperAdmin = false }: SalariosClientProps) {
  const [salarios, setSalarios] = React.useState<SalarioRecord[]>(initialSalarios || [])
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  // Selected Month & Year (Default to Current: Setembro 2026)
  const [selectedMonth, setSelectedMonth] = React.useState<number>(9)
  const [selectedYear, setSelectedYear] = React.useState<number>(2026)

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("todos")
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("todos")

  // Selected IDs for batch operations
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])

  // Modals
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = React.useState(false)
  const [editingSalario, setEditingSalario] = React.useState<SalarioRecord | null>(null)
  const [selectedReceipt, setSelectedReceipt] = React.useState<SalarioRecord | null>(null)

  // Feedback notifications
  const [feedbackMsg, setFeedbackMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null)

  // Sync prop updates
  React.useEffect(() => {
    setSalarios(initialSalarios || [])
  }, [initialSalarios])

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedbackMsg({ type, text })
    setTimeout(() => setFeedbackMsg(null), 3500)
  }

  // Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const data = await getSalariosAction(selectedMonth, selectedYear)
      setSalarios(data || [])
    } catch (err) {
      console.error("Error refreshing salarios:", err)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Filtered Salarios for currently selected month & year
  const filteredSalarios = React.useMemo(() => {
    return salarios.filter((s) => {
      // Month / Year
      if (s.month !== selectedMonth || s.year !== selectedYear) {
        return false
      }

      // Status
      if (statusFilter !== "todos" && s.payment_status !== statusFilter) {
        return false
      }

      // Department
      if (departmentFilter !== "todos" && s.colaborador_department !== departmentFilter) {
        return false
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = s.colaborador_name.toLowerCase().includes(q)
        const matchRole = s.colaborador_role.toLowerCase().includes(q)
        const matchDept = s.colaborador_department.toLowerCase().includes(q)
        const matchNif = s.colaborador_nif?.toLowerCase().includes(q)
        const matchRef = s.reference_code.toLowerCase().includes(q)

        if (!matchName && !matchRole && !matchDept && !matchNif && !matchRef) {
          return false
        }
      }

      return true
    })
  }, [salarios, selectedMonth, selectedYear, statusFilter, departmentFilter, searchQuery])

  // Monthly KPIs
  const stats = React.useMemo(() => {
    let totalLiquido = 0
    let totalBruto = 0
    let totalCustoEmpresa = 0
    let totalIrs = 0
    let totalSsTrabalhador = 0
    let totalTsuEmpresa = 0
    let totalAlimentacao = 0
    let pagos = 0
    let agendados = 0
    let pendentes = 0

    filteredSalarios.forEach((s) => {
      totalLiquido += s.net_total
      totalBruto += s.gross_total
      totalCustoEmpresa += s.total_company_cost
      totalIrs += s.irs_amount
      totalSsTrabalhador += s.ss_worker_amount
      totalTsuEmpresa += s.ss_company_amount
      totalAlimentacao += s.meal_allowance_total

      if (s.payment_status === "Pago") pagos++
      else if (s.payment_status === "Agendado") agendados++
      else pendentes++
    })

    const totalRetencoes = totalIrs + totalSsTrabalhador + totalTsuEmpresa

    return {
      totalLiquido,
      totalBruto,
      totalCustoEmpresa,
      totalRetencoes,
      totalIrs,
      totalSsTrabalhador,
      totalTsuEmpresa,
      totalAlimentacao,
      count: filteredSalarios.length,
      pagos,
      agendados,
      pendentes,
    }
  }, [filteredSalarios])

  // Unique departments for filter
  const departments = React.useMemo(() => {
    const set = new Set<string>()
    salarios.forEach((s) => {
      if (s.colaborador_department) set.add(s.colaborador_department)
    })
    return Array.from(set)
  }, [salarios])

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear((y) => y - 1)
    } else {
      setSelectedMonth((m) => m - 1)
    }
    setSelectedIds([])
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear((y) => y + 1)
    } else {
      setSelectedMonth((m) => m + 1)
    }
    setSelectedIds([])
  }

  // Actions
  const handleOpenNew = () => {
    setEditingSalario(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (salario: SalarioRecord) => {
    setEditingSalario(salario)
    setIsModalOpen(true)
  }

  const handleOpenReceipt = (salario: SalarioRecord) => {
    setSelectedReceipt(salario)
    setIsReceiptModalOpen(true)
  }

  const handleSaved = (saved: SalarioRecord) => {
    setSalarios((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = saved
        return updated
      }
      return [saved, ...prev]
    })
    showFeedback("success", `Vencimento de ${saved.colaborador_name} gravado com sucesso.`)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem a certeza que deseja eliminar o registo salarial de ${name}?`)) return
    try {
      await deleteSalarioAction(id)
      setSalarios((prev) => prev.filter((s) => s.id !== id))
      setSelectedIds((prev) => prev.filter((item) => item !== id))
      showFeedback("success", "Registo salarial eliminado.")
    } catch (err) {
      showFeedback("error", "Erro ao eliminar registo.")
    }
  }

  const handleTogglePaid = async (salario: SalarioRecord) => {
    const nextStatus = salario.payment_status === "Pago" ? "Agendado" : "Pago"
    try {
      const res = await markSalarioStatusAction(salario.id, nextStatus)
      if (res.success && res.salario) {
        setSalarios((prev) =>
          prev.map((s) => (s.id === salario.id ? res.salario! : s))
        )
        showFeedback("success", `Estado de pagamento alterado para ${nextStatus}.`)
      }
    } catch (err) {
      showFeedback("error", "Erro ao alterar estado de pagamento.")
    }
  }

  // Batch mark selected as Paid
  const handleBatchMarkPaid = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Marcar os ${selectedIds.length} registos selecionados como PAGOS?`)) return

    try {
      await batchMarkSalariosPaidAction(selectedIds)
      setSalarios((prev) =>
        prev.map((s) =>
          selectedIds.includes(s.id)
            ? { ...s, payment_status: "Pago", payment_date: new Date().toISOString().slice(0, 10) }
            : s
        )
      )
      showFeedback("success", `${selectedIds.length} vencimentos marcados como Pagos.`)
      setSelectedIds([])
    } catch (err) {
      showFeedback("error", "Erro ao liquidar pagamentos em lote.")
    }
  }

  // Batch generate payroll for current month
  const handleBatchGenerate = async () => {
    const monthName = MONTH_NAMES[selectedMonth - 1]
    if (!confirm(`Gerar automaticamente a folha salarial de ${monthName} de ${selectedYear} para todos os colaboradores ativos?`)) {
      return
    }

    try {
      const res = await batchGenerateMonthPayrollAction(selectedMonth, selectedYear)
      if (res.success) {
        const refreshed = await getSalariosAction(selectedMonth, selectedYear)
        setSalarios(refreshed)
        showFeedback("success", res.message)
      } else {
        showFeedback("error", res.message)
      }
    } catch (err: any) {
      showFeedback("error", err?.message || "Erro ao gerar folha salarial.")
    }
  }

  // Export SEPA / CSV
  const handleExportSEPA = () => {
    const headers = [
      "Referência",
      "Colaborador",
      "NIF",
      "IBAN",
      "Cargo",
      "Vencimento Base",
      "Sub. Alimentação",
      "Prémios",
      "Total Bruto",
      "Retenção IRS",
      "Seg. Social 11%",
      "Total Líquido (€)",
      "Estado",
      "Data Pagamento",
      "Método",
    ]

    const rows = filteredSalarios.map((s) => [
      `"${s.reference_code}"`,
      `"${s.colaborador_name}"`,
      `"${s.colaborador_nif || ""}"`,
      `"${s.colaborador_iban || ""}"`,
      `"${s.colaborador_role}"`,
      `"${s.base_salary.toFixed(2)}"`,
      `"${s.meal_allowance_total.toFixed(2)}"`,
      `"${s.bonuses.toFixed(2)}"`,
      `"${s.gross_total.toFixed(2)}"`,
      `"${s.irs_amount.toFixed(2)}"`,
      `"${s.ss_worker_amount.toFixed(2)}"`,
      `"${s.net_total.toFixed(2)}"`,
      `"${s.payment_status}"`,
      `"${s.payment_date || ""}"`,
      `"${s.payment_method}"`,
    ])

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `folha_salarios_linke_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Select all checkbox
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredSalarios.map((s) => s.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-top-4 duration-200 ${
            feedbackMsg.type === "success"
              ? "bg-[var(--status-success-soft)] text-[var(--status-success)] border-[rgba(18,138,71,0.25)]"
              : "bg-[var(--status-error-soft)] text-[var(--status-error)] border-[rgba(220,38,38,0.2)]"
          }`}
        >
          {feedbackMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Top Header & Month Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Salários & Vencimentos</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(18,138,71,0.2)]">
              <Euro className="w-3.5 h-3.5" />
              Tesouraria Linke
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[rgba(217,119,6,0.2)]">
              <Lock className="w-3 h-3" />
              Área Restrita
            </span>
            {isSuperAdmin && (
              <Link
                href="/ops/entidades/colaboradores"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors shadow-2xs cursor-pointer"
                title="Super-Admin: gerir quem tem acesso a esta secção"
              >
                <Shield className="w-3.5 h-3.5 text-[var(--accent)]" />
                Gerir Acessos
              </Link>
            )}
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Processamento salarial, recibos de vencimento, retenções fiscais e transferências SEPA.
          </p>
        </div>

        {/* Month Selector Bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-1 shadow-2xs">
            <button
              onClick={handlePrevMonth}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-xl transition-colors"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-4 py-1 flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <Calendar className="w-4 h-4 text-[var(--accent)]" />
              <span>{MONTH_NAMES[selectedMonth - 1]}</span>
              <span className="font-mono text-[var(--text-tertiary)]">{selectedYear}</span>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-xl transition-colors"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] shadow-2xs transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Líquido a Pagar */}
        <div className="bg-[var(--surface-bg)] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Total Líquido a Pagar
            </span>
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)]">
              <Euro className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)] font-mono">
              {stats.totalLiquido.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
            </span>
          </div>
          <span className="text-xs font-medium text-[var(--accent)] mt-1 block">
            {stats.count} colaboradores processados
          </span>
        </div>

        {/* Custo Total Empresa */}
        <div className="bg-[var(--surface-bg)] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Custo Total Linke
            </span>
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text-secondary)]">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)] font-mono">
              {stats.totalCustoEmpresa.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
            </span>
          </div>
          <span className="text-xs font-medium text-[var(--text-tertiary)] mt-1 block">
            Inclui TSU 23.75% + Alimentação
          </span>
        </div>

        {/* Retenções Fiscais (IRS + SS) */}
        <div className="bg-[var(--surface-bg)] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Impostos & Encargos
            </span>
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text-secondary)]">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--status-error)] font-mono">
              {stats.totalRetencoes.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
            </span>
          </div>
          <span className="text-xs font-medium text-[var(--text-tertiary)] mt-1 block">
            IRS ({stats.totalIrs.toFixed(0)}€) + SS ({stats.totalSsTrabalhador.toFixed(0)}€) + TSU ({stats.totalTsuEmpresa.toFixed(0)}€)
          </span>
        </div>

        {/* Estado dos Pagamentos */}
        <div className="bg-[var(--surface-bg)] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Liquidação de Salários
            </span>
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="text-xs">
              <span className="font-bold text-[var(--accent)] text-lg block">{stats.pagos}</span>
              <span className="text-[var(--text-tertiary)]">Pagos</span>
            </div>
            <div className="text-xs border-l border-[var(--border-subtle)] pl-3">
              <span className="font-bold text-[var(--text-primary)] text-lg block">{stats.agendados}</span>
              <span className="text-[var(--text-tertiary)]">Agendados</span>
            </div>
            <div className="text-xs border-l border-[var(--border-subtle)] pl-3">
              <span className="font-bold text-[var(--status-warning)] text-lg block">{stats.pendentes}</span>
              <span className="text-[var(--text-tertiary)]">Pendentes</span>
            </div>
          </div>
        </div>

      </div>

      {/* Toolbar & Filters */}
      <div className="bg-[var(--surface-bg)] rounded-2xl p-4 border border-[var(--border-subtle)] shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por colaborador, cargo, NIF, ref..."
              className="w-full pl-10 pr-4 py-2 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:bg-[var(--surface-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-colors"
            />
          </div>

          {/* Quick Actions Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.length > 0 && (
              <button
                onClick={handleBatchMarkPaid}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/80 text-[var(--accent)] border border-[rgba(18,138,71,0.2)] rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                Marcar ({selectedIds.length}) como Pagos
              </button>
            )}

            <button
              onClick={handleBatchGenerate}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-muted)] hover:bg-[var(--surface-dim)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Gerar Folha do Mês para todos os colaboradores ativos"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
              Gerar Folha do Mês
            </button>

            <button
              onClick={handleExportSEPA}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-muted)] hover:bg-[var(--surface-dim)] border border-[var(--border-subtle)] text-[var(--text-secondary)] rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              Exportar SEPA / CSV
            </button>

            <button
              onClick={handleOpenNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Vencimento
            </button>
          </div>

        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-tertiary)] font-medium">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-[var(--text-primary)] font-medium focus:outline-none"
            >
              <option value="todos">Todos os Estados</option>
              <option value="Pago">Pago</option>
              <option value="Agendado">Agendado</option>
              <option value="Em Processamento">Em Processamento</option>
              <option value="Pendente">Pendente</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[var(--text-tertiary)] font-medium">Departamento:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-[var(--text-primary)] font-medium focus:outline-none"
            >
              <option value="todos">Todos os Departamentos</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {(searchQuery || statusFilter !== "todos" || departmentFilter !== "todos") && (
            <button
              onClick={() => {
                setSearchQuery("")
                setStatusFilter("todos")
                setDepartmentFilter("todos")
              }}
              className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-semibold underline ml-auto text-xs"
            >
              Repor filtros
            </button>
          )}
        </div>
      </div>

      {/* Salary Table */}
      <div className="bg-[var(--surface-bg)] rounded-2xl border border-[var(--border-subtle)] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] font-bold text-[var(--text-tertiary)] uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredSalarios.length > 0 && selectedIds.length === filteredSalarios.length}
                    onChange={handleSelectAll}
                    className="rounded cursor-pointer accent-[var(--accent)]"
                  />
                </th>
                <th className="py-3.5 px-3">Colaborador</th>
                <th className="py-3.5 px-3">Cargo & Departamento</th>
                <th className="py-3.5 px-3 text-right">Venc. Base</th>
                <th className="py-3.5 px-3 text-right">Alimentação</th>
                <th className="py-3.5 px-3 text-right">Total Bruto</th>
                <th className="py-3.5 px-3 text-right">Deduções (IRS+SS)</th>
                <th className="py-3.5 px-3 text-right">Total Líquido</th>
                <th className="py-3.5 px-3 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredSalarios.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[var(--text-tertiary)]">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--surface-muted)] text-[var(--text-tertiary)] flex items-center justify-center mx-auto">
                        <Euro className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Nenhum vencimento processado para {MONTH_NAMES[selectedMonth - 1]} de {selectedYear}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Pode gerar automaticamente a folha salarial da equipa com 1 clique.
                      </p>
                      <button
                        onClick={handleBatchGenerate}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Gerar Folha Salarial de {MONTH_NAMES[selectedMonth - 1]}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSalarios.map((s) => {
                  const isSelected = selectedIds.includes(s.id)
                  const totalDeductions = s.irs_amount + s.ss_worker_amount + (s.other_deductions || 0)

                  return (
                    <tr
                      key={s.id}
                      onClick={() => handleOpenReceipt(s)}
                      className={`hover:bg-[var(--surface-muted)]/60 cursor-pointer transition-colors group ${
                        isSelected ? "bg-[var(--accent-soft)]/30" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center" onClick={(e) => handleToggleSelectRow(s.id, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded cursor-pointer accent-[var(--accent)]"
                        />
                      </td>

                      {/* Colaborador */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0"
                            style={{ backgroundColor: s.colaborador_avatar_color || "#16a34a" }}
                          >
                            {s.colaborador_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors block">
                              {s.colaborador_name}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
                              NIF: {s.colaborador_nif || "---"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Cargo & Departamento */}
                      <td className="py-3.5 px-3">
                        <div>
                          <span className="font-semibold text-[var(--text-primary)] block text-xs">{s.colaborador_role}</span>
                          <span className="text-[11px] text-[var(--text-tertiary)]">{s.colaborador_department}</span>
                        </div>
                      </td>

                      {/* Vencimento Base */}
                      <td className="py-3.5 px-3 text-right font-mono font-medium text-[var(--text-secondary)]">
                        {s.base_salary.toFixed(2)} €
                      </td>

                      {/* Subsídio Alimentação */}
                      <td className="py-3.5 px-3 text-right font-mono text-[var(--text-secondary)]">
                        {s.meal_allowance_total.toFixed(2)} €
                      </td>

                      {/* Total Bruto */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-[var(--text-primary)]">
                        {s.gross_total.toFixed(2)} €
                      </td>

                      {/* Deduções */}
                      <td className="py-3.5 px-3 text-right font-mono text-[var(--status-error)]">
                        -{totalDeductions.toFixed(2)} €
                      </td>

                      {/* Total Líquido */}
                      <td className="py-3.5 px-3 text-right">
                        <span className="font-mono font-black text-[var(--accent)] text-sm bg-[var(--accent-soft)] px-2 py-0.5 rounded-lg border border-[rgba(18,138,71,0.2)]">
                          {s.net_total.toFixed(2)} €
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleTogglePaid(s)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-transform hover:scale-105 ${
                            s.payment_status === "Pago"
                              ? "bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[rgba(18,138,71,0.2)]"
                              : s.payment_status === "Agendado"
                              ? "bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                              : "bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[rgba(217,119,6,0.2)]"
                          }`}
                          title="Clique para alternar estado de pagamento"
                        >
                          {s.payment_status === "Pago" && <Check className="w-3 h-3 text-[var(--accent)]" />}
                          <span>{s.payment_status}</span>
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenReceipt(s)}
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-lg transition-colors"
                            title="Ver Recibo de Vencimento"
                          >
                            <FileCheck className="w-4 h-4 text-[var(--accent)]" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-lg transition-colors"
                            title="Editar Valores"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(s.id, s.colaborador_name)}
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-soft)] rounded-lg transition-colors"
                            title="Eliminar Registo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <SalarioModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        salario={editingSalario}
        currentMonth={selectedMonth}
        currentYear={selectedYear}
        onSaved={handleSaved}
      />

      <SalarioReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        salario={selectedReceipt}
      />

    </div>
  )
}
