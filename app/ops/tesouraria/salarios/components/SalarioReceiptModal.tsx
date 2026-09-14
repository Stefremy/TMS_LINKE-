"use client"

import * as React from "react"
import {
  X,
  Printer,
  Download,
  Building2,
  CheckCircle2,
  Calendar,
  CreditCard,
  User,
  Shield,
  FileCheck
} from "lucide-react"
import { SalarioRecord, MONTH_NAMES } from "../types"

interface SalarioReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  salario: SalarioRecord | null
}

export function SalarioReceiptModal({
  isOpen,
  onClose,
  salario,
}: SalarioReceiptModalProps) {
  if (!isOpen || !salario) return null

  const handlePrint = () => {
    window.print()
  }

  const monthLabel = MONTH_NAMES[(salario.month || 1) - 1]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Toolbar */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <FileCheck className="w-4 h-4 text-green-600" />
            <span>Recibo de Vencimento Oficial</span>
            <span className="text-slate-400 font-normal">&bull;</span>
            <span className="font-mono text-slate-500">{salario.reference_code}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Recibo</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Payslip Body */}
        <div className="p-8 overflow-y-auto space-y-6 text-slate-800 font-sans" id="printable-payslip">
          
          {/* Header Linke Logistics */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-slate-900">LINKE LOGISTICS</span>
                <span className="text-xs font-bold px-2 py-0.5 bg-green-100 text-green-800 rounded">TMS Core</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Linke Logistics, Lda. &bull; NIF: 517 890 123
              </p>
              <p className="text-xs text-slate-500">
                Avenida da Liberdade, 100 &bull; 4610-100 Felgueiras / Guimarães, Portugal
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 block">
                Recibo de Vencimento
              </span>
              <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                {monthLabel} de {salario.year}
              </span>
              <span className="text-xs font-mono text-slate-500 block mt-0.5">
                Ref: {salario.reference_code}
              </span>
            </div>
          </div>

          {/* Employee & Company Box */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">Colaborador</span>
              <p className="text-sm font-bold text-slate-900">{salario.colaborador_name}</p>
              <p className="text-slate-600">Cargo: <strong className="text-slate-800">{salario.colaborador_role}</strong></p>
              <p className="text-slate-600">Departamento: <strong className="text-slate-800">{salario.colaborador_department}</strong></p>
              <p className="text-slate-600">NIF: <strong className="font-mono text-slate-800">{salario.colaborador_nif || "---"}</strong></p>
            </div>

            <div className="space-y-1 text-right">
              <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">Dados de Liquidação</span>
              <p className="text-slate-600">Estado: <span className="font-bold text-emerald-700">{salario.payment_status}</span></p>
              <p className="text-slate-600">Método: <strong className="text-slate-800">{salario.payment_method}</strong></p>
              <p className="text-slate-600">IBAN: <strong className="font-mono text-slate-800">{salario.colaborador_iban || "---"}</strong></p>
              {salario.payment_date && (
                <p className="text-slate-600">Data de Liquidação: <strong className="text-slate-800">{salario.payment_date}</strong></p>
              )}
            </div>
          </div>

          {/* Table of Earnings & Deductions */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Código / Descrição</th>
                  <th className="py-2.5 px-3 text-center">Ref. / Dias / %</th>
                  <th className="py-2.5 px-4 text-right">Remunerações (€)</th>
                  <th className="py-2.5 px-4 text-right">Deduções (€)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Vencimento Base */}
                <tr>
                  <td className="py-2 px-4 font-semibold text-slate-800">101 - Vencimento Base Mensal</td>
                  <td className="py-2 px-3 text-center text-slate-500 font-mono">1.00 Mês</td>
                  <td className="py-2 px-4 text-right font-mono font-semibold text-slate-800">
                    {salario.base_salary.toFixed(2)}
                  </td>
                  <td className="py-2 px-4 text-right text-slate-400">---</td>
                </tr>

                {/* Subsídio de Alimentação */}
                {salario.meal_allowance_total > 0 && (
                  <tr>
                    <td className="py-2 px-4 font-semibold text-slate-800">201 - Subsídio de Alimentação</td>
                    <td className="py-2 px-3 text-center text-slate-500 font-mono">
                      {salario.meal_days} dias x {salario.meal_allowance_daily.toFixed(2)}€
                    </td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-800">
                      {salario.meal_allowance_total.toFixed(2)}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-400">---</td>
                  </tr>
                )}

                {/* Prémios / Bónus */}
                {salario.bonuses > 0 && (
                  <tr>
                    <td className="py-2 px-4 font-semibold text-slate-800">105 - Prémios de Desempenho / Bónus</td>
                    <td className="py-2 px-3 text-center text-slate-500">Global</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-800">
                      {salario.bonuses.toFixed(2)}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-400">---</td>
                  </tr>
                )}

                {/* Horas Extra */}
                {salario.overtime_amount > 0 && (
                  <tr>
                    <td className="py-2 px-4 font-semibold text-slate-800">110 - Trabalho Suplementar / Horas Extra</td>
                    <td className="py-2 px-3 text-center text-slate-500">Horas</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-800">
                      {salario.overtime_amount.toFixed(2)}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-400">---</td>
                  </tr>
                )}

                {/* Outras Ajudas */}
                {salario.other_allowances > 0 && (
                  <tr>
                    <td className="py-2 px-4 font-semibold text-slate-800">120 - Isenção de Horário / Outros Subsídios</td>
                    <td className="py-2 px-3 text-center text-slate-500">Global</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-800">
                      {salario.other_allowances.toFixed(2)}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-400">---</td>
                  </tr>
                )}

                {/* Retenção IRS */}
                <tr>
                  <td className="py-2 px-4 font-semibold text-rose-900">501 - Retenção de IRS na Fonte</td>
                  <td className="py-2 px-3 text-center text-slate-500 font-mono">{salario.irs_rate.toFixed(1)} %</td>
                  <td className="py-2 px-4 text-right text-slate-400">---</td>
                  <td className="py-2 px-4 text-right font-mono font-semibold text-rose-700">
                    {salario.irs_amount.toFixed(2)}
                  </td>
                </tr>

                {/* Segurança Social */}
                <tr>
                  <td className="py-2 px-4 font-semibold text-rose-900">510 - Segurança Social (Trabalhador)</td>
                  <td className="py-2 px-3 text-center text-slate-500 font-mono">{salario.ss_worker_rate.toFixed(1)} %</td>
                  <td className="py-2 px-4 text-right text-slate-400">---</td>
                  <td className="py-2 px-4 text-right font-mono font-semibold text-rose-700">
                    {salario.ss_worker_amount.toFixed(2)}
                  </td>
                </tr>

                {/* Outras Deduções */}
                {salario.other_deductions > 0 && (
                  <tr>
                    <td className="py-2 px-4 font-semibold text-rose-900">590 - Outras Deduções / Adiantamentos</td>
                    <td className="py-2 px-3 text-center text-slate-500">---</td>
                    <td className="py-2 px-4 text-right text-slate-400">---</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-rose-700">
                      {salario.other_deductions.toFixed(2)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Box */}
          <div className="grid grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-500 font-medium block">Total Ilíquido</span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                {salario.gross_total.toFixed(2)} €
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Total Descontos</span>
              <span className="text-sm font-bold text-rose-700 font-mono">
                {(salario.irs_amount + salario.ss_worker_amount + (salario.other_deductions || 0)).toFixed(2)} €
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Não Sujeito (Alimentação)</span>
              <span className="text-sm font-bold text-emerald-700 font-mono">
                {salario.meal_allowance_total.toFixed(2)} €
              </span>
            </div>
            <div className="bg-emerald-600 text-white p-2.5 rounded-lg -m-1 shadow-sm text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-90">Líquido a Receber</span>
              <span className="text-base font-black font-mono">
                {salario.net_total.toFixed(2)} €
              </span>
            </div>
          </div>

          {/* Social Security & Company Cost Info Footer */}
          <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between">
            <span>Encargo TSU Empresa (23.75%): <strong className="font-mono text-slate-700">{salario.ss_company_amount.toFixed(2)} €</strong></span>
            <span>Custo Total Empresa: <strong className="font-mono text-slate-700">{salario.total_company_cost.toFixed(2)} €</strong></span>
          </div>

          {/* Signatures */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
            <div className="border-t border-slate-300 pt-2">
              <span>A Entidade Empregadora (Linke Logistics)</span>
            </div>
            <div className="border-t border-slate-300 pt-2">
              <span>O Colaborador ({salario.colaborador_name})</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between print:hidden">
          <span className="text-xs text-slate-500">
            Documento emitido para efeitos de registo e recibo de vencimento.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
