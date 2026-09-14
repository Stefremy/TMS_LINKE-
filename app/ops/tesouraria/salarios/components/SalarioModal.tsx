"use client"

import * as React from "react"
import {
  X,
  Save,
  User,
  Calculator,
  Calendar,
  CreditCard,
  Building2,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Info
} from "lucide-react"
import { SalarioRecord, MONTH_NAMES, calculateSalarioTotals } from "../types"
import { saveSalarioAction } from "@/app/actions/salarios"
import { getColaboradoresAction } from "@/app/actions/colaboradores"
import { Colaborador } from "@/app/ops/entidades/colaboradores/types"

interface SalarioModalProps {
  isOpen: boolean
  onClose: () => void
  salario: SalarioRecord | null
  currentMonth: number
  currentYear: number
  onSaved: (saved: SalarioRecord) => void
}

export function SalarioModal({
  isOpen,
  onClose,
  salario,
  currentMonth,
  currentYear,
  onSaved,
}: SalarioModalProps) {
  const [colaboradores, setColaboradores] = React.useState<Colaborador[]>([])
  const [isLoadingColabs, setIsLoadingColabs] = React.useState(false)

  // Form State
  const [formData, setFormData] = React.useState<Partial<SalarioRecord>>({
    month: currentMonth,
    year: currentYear,
    base_salary: 1800,
    meal_allowance_daily: 9.60,
    meal_days: 22,
    bonuses: 0,
    overtime_amount: 0,
    holiday_allowance: 0,
    christmas_allowance: 0,
    other_allowances: 0,
    irs_rate: 14.5,
    ss_worker_rate: 11.0,
    ss_company_rate: 23.75,
    other_deductions: 0,
    payment_status: "Agendado",
    payment_method: "Transferência Bancária (SEPA)",
    payment_date: `${currentYear}-${String(currentMonth).padStart(2, "0")}-28`,
    notes: "",
  })

  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState("")

  // Fetch colaboradores on mount
  React.useEffect(() => {
    async function loadColabs() {
      setIsLoadingColabs(true)
      try {
        const data = await getColaboradoresAction()
        setColaboradores(data || [])
      } catch (err) {
        console.error("Error loading colaboradores:", err)
      } finally {
        setIsLoadingColabs(false)
      }
    }
    if (isOpen) {
      loadColabs()
    }
  }, [isOpen])

  // Populate formData on open or when salario prop changes
  React.useEffect(() => {
    if (salario) {
      setFormData(salario)
    } else {
      setFormData({
        month: currentMonth,
        year: currentYear,
        base_salary: 1800,
        meal_allowance_daily: 9.60,
        meal_days: 22,
        bonuses: 0,
        overtime_amount: 0,
        holiday_allowance: 0,
        christmas_allowance: 0,
        other_allowances: 0,
        irs_rate: 14.5,
        ss_worker_rate: 11.0,
        ss_company_rate: 23.75,
        other_deductions: 0,
        payment_status: "Agendado",
        payment_method: "Transferência Bancária (SEPA)",
        payment_date: `${currentYear}-${String(currentMonth).padStart(2, "0")}-28`,
        notes: "",
      })
    }
    setError("")
  }, [salario, isOpen, currentMonth, currentYear])

  // Select employee helper
  const handleSelectColaborador = (colId: string) => {
    const col = colaboradores.find((c) => c.id === colId)
    if (!col) return

    let base = 1800
    let irs = 14.5
    let bonus = 0

    if (col.name.toLowerCase().includes("gilberto")) {
      base = 3500
      irs = 22.5
      bonus = 500
    } else if (col.name.toLowerCase().includes("stefano")) {
      base = 2400
      irs = 16.5
      bonus = 250
    } else if (col.name.toLowerCase().includes("nathalia")) {
      base = 1900
      irs = 13.0
      bonus = 150
    }

    setFormData((prev) => ({
      ...prev,
      colaborador_id: col.id,
      colaborador_name: col.name,
      colaborador_role: col.role,
      colaborador_department: col.department,
      colaborador_nif: col.nif || "",
      colaborador_iban: `PT50 0033 0000 ${col.nif || "123456789"} 01`,
      colaborador_avatar_color: col.avatar_color || "#16a34a",
      base_salary: base,
      irs_rate: irs,
      bonuses: bonus,
    }))
  }

  // Real-time live calculations
  const liveTotals = React.useMemo(() => {
    return calculateSalarioTotals(formData)
  }, [formData])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.colaborador_name || !formData.colaborador_id) {
      setError("Por favor selecione o colaborador.")
      return
    }

    setIsSaving(true)
    setError("")

    try {
      const res = await saveSalarioAction({
        ...formData,
        ...liveTotals,
      })

      if (res.success && res.salario) {
        onSaved(res.salario)
        onClose()
      } else {
        setError(res.message || "Erro ao gravar vencimento.")
      }
    } catch (err: any) {
      setError(err?.message || "Ocorreu um erro ao gravar.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/75">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {salario ? "Editar Vencimento & Folha Salarial" : "Novo Registo de Vencimento"}
              </h2>
              <p className="text-xs text-slate-500">
                {MONTH_NAMES[(formData.month || 1) - 1]} de {formData.year} &bull; Linke Logistics TMS
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Top Selection: Colaborador & Período */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Colaborador */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Colaborador *
                </label>
                <select
                  value={formData.colaborador_id || ""}
                  onChange={(e) => handleSelectColaborador(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  <option value="">Selecione um colaborador da equipa...</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.role} ({c.department})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mês e Ano */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mês</label>
                  <select
                    value={formData.month || currentMonth}
                    onChange={(e) => setFormData({ ...formData, month: Number(e.target.value) })}
                    className="w-full px-2.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ano</label>
                  <input
                    type="number"
                    value={formData.year || currentYear}
                    onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                    className="w-full px-2.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Employee Quick Info Badge */}
            {formData.colaborador_name && (
              <div className="pt-3 border-t border-slate-200/60 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-green-600" />
                  {formData.colaborador_name} ({formData.colaborador_role})
                </span>
                {formData.colaborador_nif && <span>NIF: <strong>{formData.colaborador_nif}</strong></span>}
                {formData.colaborador_iban && <span>IBAN: <strong className="font-mono">{formData.colaborador_iban}</strong></span>}
              </div>
            )}
          </div>

          {/* Two-Column Grid: Remunerações vs Deduções */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Coluna 1: Vencimentos & Remunerações (Ganhos) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Remunerações & Vencimento
                </span>
                <span className="text-xs font-bold text-slate-500 font-mono">
                  Ilíquido: {liveTotals.gross_total.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
                </span>
              </div>

              {/* Vencimento Base */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vencimento Base (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.base_salary ?? ""}
                  onChange={(e) => setFormData({ ...formData, base_salary: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-green-500 font-mono"
                  placeholder="0.00"
                />
              </div>

              {/* Subsídio de Alimentação */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sub. Alimentação / Dia (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.meal_allowance_daily ?? ""}
                    onChange={(e) => setFormData({ ...formData, meal_allowance_daily: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dias Úteis
                  </label>
                  <input
                    type="number"
                    value={formData.meal_days ?? ""}
                    onChange={(e) => setFormData({ ...formData, meal_days: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium font-mono"
                  />
                </div>
              </div>
              <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg">
                Total Alimentação: <strong className="text-slate-800">{liveTotals.meal_allowance_total.toFixed(2)} €</strong> (Não tributável)
              </div>

              {/* Bónus & Prémios */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prémios / Bónus (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.bonuses ?? ""}
                    onChange={(e) => setFormData({ ...formData, bonuses: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium font-mono"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Horas Extra (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.overtime_amount ?? ""}
                    onChange={(e) => setFormData({ ...formData, overtime_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Subsídios Férias / Natal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sub. Férias (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.holiday_allowance ?? ""}
                    onChange={(e) => setFormData({ ...formData, holiday_allowance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium font-mono"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sub. Natal (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.christmas_allowance ?? ""}
                    onChange={(e) => setFormData({ ...formData, christmas_allowance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Coluna 2: Descontos, Impostos & Retenções */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-rose-600" />
                  Impostos & Deduções
                </span>
                <span className="text-xs font-bold text-slate-500 font-mono">
                  Deduções: {(liveTotals.irs_amount + liveTotals.ss_worker_amount + (formData.other_deductions || 0)).toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
                </span>
              </div>

              {/* Retenção IRS */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Taxa IRS (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.irs_rate ?? ""}
                    onChange={(e) => setFormData({ ...formData, irs_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Retenção IRS na Fonte (€)
                  </label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono">
                    {liveTotals.irs_amount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
                  </div>
                </div>
              </div>

              {/* Segurança Social Trabalhador (11%) */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SS Trab. (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.ss_worker_rate ?? 11.0}
                    onChange={(e) => setFormData({ ...formData, ss_worker_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Desconto Seg. Social (11%)
                  </label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 font-mono">
                    {liveTotals.ss_worker_amount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
                  </div>
                </div>
              </div>

              {/* TSU Empresa (23.75%) */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-900">TSU Empresa (23.75%):</span>
                  <span className="font-bold text-amber-900 font-mono">
                    {liveTotals.ss_company_amount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
                  </span>
                </div>
                <p className="text-[11px] text-amber-700">
                  Encargo suportado diretamente pela Linke Logistics (não deduzido ao trabalhador).
                </p>
              </div>

              {/* Outras Deduções */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Outras Deduções / Adiantamentos (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.other_deductions ?? ""}
                  onChange={(e) => setFormData({ ...formData, other_deductions: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium font-mono"
                  placeholder="0.00"
                />
              </div>
            </div>

          </div>

          {/* Consolidation KPI Summary Bar */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 text-white grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-md">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Bruto / Ilíquido
              </span>
              <span className="text-2xl font-black text-white font-mono mt-0.5 block">
                {liveTotals.gross_total.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
              </span>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l sm:border-r border-slate-700 sm:px-4">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                Líquido a Pagar ao Colaborador
              </span>
              <span className="text-3xl font-black text-emerald-400 font-mono mt-0.5 block">
                {liveTotals.net_total.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
              </span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider block">
                Custo Total Empresa (Linke)
              </span>
              <span className="text-2xl font-black text-blue-300 font-mono mt-0.5 block">
                {liveTotals.total_company_cost.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
              </span>
            </div>
          </div>

          {/* Payment Details & Status */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Estado do Pagamento
              </label>
              <select
                value={formData.payment_status || "Agendado"}
                onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="Agendado">Agendado</option>
                <option value="Pago">Pago</option>
                <option value="Em Processamento">Em Processamento</option>
                <option value="Pendente">Pendente</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Método de Pagamento
              </label>
              <select
                value={formData.payment_method || "Transferência Bancária (SEPA)"}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="Transferência Bancária (SEPA)">Transferência Bancária (SEPA)</option>
                <option value="MB Way">MB Way</option>
                <option value="Cheque">Cheque</option>
                <option value="Dinheiro">Dinheiro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Data Prevista / Pagamento
              </label>
              <input
                type="date"
                value={formData.payment_date || ""}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações & Notas Internas
            </label>
            <textarea
              rows={2}
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionais sobre horas, ajustamentos ou bónus..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-60 transition-colors"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {salario ? "Gravar Alterações" : "Emitir Folha Salarial"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
