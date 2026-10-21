"use client"

import * as React from "react"
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  PlusCircle, 
  ArrowUpRight, 
  ShieldCheck, 
  Wallet, 
  Receipt,
  Calendar,
  AlertCircle
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ClientTopUpModal } from "@/app/app/components/ClientTopUpModal"
import { useClientScope } from "@/app/app/components/ClientScope"

export interface ClientTransactionItem {
  id: string
  client_id: string
  amount: number
  status: "pending" | "paid" | "failed" | string
  stripe_session_id?: string | null
  created_at: string
  updated_at: string
}

interface ClientCarregamentosHistoryProps {
  transactions: ClientTransactionItem[]
  availableCredit?: number
  creditLimit?: number
}

export function ClientCarregamentosHistory({ 
  transactions = [], 
  availableCredit,
  creditLimit 
}: ClientCarregamentosHistoryProps) {
  const { client } = useClientScope()
  const [isTopUpOpen, setIsTopUpOpen] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<string>("todos")

  const paidTransactions = transactions.filter(t => t.status === "paid")
  const totalPaidAmount = paidTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0)
  const pendingTransactions = transactions.filter(t => t.status === "pending")
  const lastTransaction = paidTransactions[0] || transactions[0]

  const filteredTransactions = transactions.filter(t => {
    if (statusFilter === "todos") return true
    return t.status === statusFilter
  })

  return (
    <div className="space-y-6">
      {/* Top Up Modal */}
      {client && (
        <ClientTopUpModal
          isOpen={isTopUpOpen}
          onClose={() => setIsTopUpOpen(false)}
          clientId={client.id}
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Disponível */}
        <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-wider mb-2">
            <span>Saldo Disponível</span>
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-[var(--text-primary)]">
            {(availableCredit !== undefined ? availableCredit : (client?.credit_limit ?? 0)).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
            Utilizado automaticamente nos novos envios
          </p>
        </div>

        {/* Total Carregado */}
        <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-wider mb-2">
            <span>Total Carregado</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600">
            {totalPaidAmount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
            {paidTransactions.length} {paidTransactions.length === 1 ? "carregamento confirmado" : "carregamentos confirmados"}
          </p>
        </div>

        {/* Carregamentos Pendentes */}
        <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-wider mb-2">
            <span>Em Processamento</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-slate-800">
            {pendingTransactions.length}
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
            {pendingTransactions.length > 0 ? "A aguardar confirmação bancária" : "Nenhum pagamento pendente"}
          </p>
        </div>

        {/* Ação Rápida: Carregar */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl p-5 text-white shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-100 mb-1">
              <span>Recarregar Carteira</span>
              <ShieldCheck className="w-4 h-4 text-emerald-200" />
            </div>
            <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
              Carregamento instantâneo via Stripe com Cartão, MB WAY ou Multibanco.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsTopUpOpen(true)}
            className="mt-4 w-full bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Carregamento</span>
          </button>
        </div>
      </div>

      {/* Transactions Table Section */}
      <div className="bg-[var(--surface-bg)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-2xs">
        {/* Header & Filter Bar */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[var(--surface-muted)]/30">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[var(--accent)]" />
              <span>Histórico de Carregamentos</span>
            </h3>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Registo detalhado de todas as tentativas e carregamentos realizados via Stripe
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--surface-bg)] p-1 rounded-lg border border-[var(--border-subtle)] text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("todos")}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                statusFilter === "todos"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Todos ({transactions.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("paid")}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                statusFilter === "paid"
                  ? "bg-emerald-600 text-white"
                  : "text-[var(--text-secondary)] hover:text-emerald-700"
              }`}
            >
              Pagos ({paidTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                statusFilter === "pending"
                  ? "bg-amber-600 text-white"
                  : "text-[var(--text-secondary)] hover:text-amber-700"
              }`}
            >
              Pendentes ({pendingTransactions.length})
            </button>
          </div>
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-3 text-[var(--text-tertiary)]">
              <CreditCard className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">Nenhum carregamento encontrado</h4>
            <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-sm mx-auto">
              {statusFilter !== "todos" 
                ? "Não existem transações com o filtro selecionado." 
                : "Ainda não realizou nenhum carregamento de saldo nesta conta."}
            </p>
            {statusFilter === "todos" && (
              <button
                type="button"
                onClick={() => setIsTopUpOpen(true)}
                className="mt-4 inline-flex items-center gap-2 bg-[var(--accent)] text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Carregar Saldo Agora</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-muted)]/60 border-b border-[var(--border-subtle)] text-[10px] uppercase font-bold text-[var(--text-tertiary)] tracking-wider">
                  <th className="py-3 px-5">Data & Hora</th>
                  <th className="py-3 px-4">Canal / Método</th>
                  <th className="py-3 px-4">ID Transação</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredTransactions.map((tx) => {
                  const isPaid = tx.status === "paid"
                  const isPending = tx.status === "pending"
                  const isFailed = tx.status === "failed"

                  const dateFormatted = new Date(tx.created_at).toLocaleDateString("pt-PT", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })

                  return (
                    <tr 
                      key={tx.id} 
                      className="hover:bg-[var(--surface-muted)]/40 transition-colors"
                    >
                      {/* Data & Hora */}
                      <td className="py-3.5 px-5 font-medium text-[var(--text-primary)] whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                          <span>{dateFormatted}</span>
                        </div>
                      </td>

                      {/* Método */}
                      <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-[var(--accent)]" />
                          <span className="font-semibold text-[var(--text-primary)]">Stripe Checkout</span>
                          <span className="text-[10px] text-[var(--text-tertiary)]">(Cartão / MB WAY)</span>
                        </div>
                      </td>

                      {/* ID / Referência */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--text-tertiary)]">
                        <span title={tx.id}>{tx.id.slice(0, 8)}...{tx.id.slice(-4)}</span>
                      </td>

                      {/* Valor */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sm whitespace-nowrap">
                        <span className={isPaid ? "text-emerald-600" : isPending ? "text-amber-600" : "text-slate-500"}>
                          +{Number(tx.amount || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                        </span>
                      </td>

                      {/* Estado Badge */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Confirmado</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Aguardando Pagamento</span>
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Cancelado</span>
                          </span>
                        )}
                        {!isPaid && !isPending && !isFailed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <span>{tx.status}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
