"use client"

import * as React from "react"
import { CreditCard, CheckCircle2, Clock, XCircle, PlusCircle, ArrowUpRight, Wallet, Calendar } from "lucide-react"
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
}: ClientCarregamentosHistoryProps) {
  const { client } = useClientScope()
  const [isTopUpOpen, setIsTopUpOpen] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<string>("todos")

  const paidTransactions = transactions.filter(t => t.status === "paid")
  const totalPaidAmount = paidTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0)
  const pendingTransactions = transactions.filter(t => t.status === "pending")

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

      <section aria-label="Resumo da carteira" className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
        <div className="grid grid-cols-1 gap-px bg-[var(--border-subtle)] sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Saldo disponível", value: `${(availableCredit !== undefined ? availableCredit : (client?.credit_limit ?? 0)).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, icon: Wallet, color: "#155EEF", description: "Utilizado nos novos envios" },
            { label: "Total carregado", value: `${totalPaidAmount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, icon: ArrowUpRight, color: "#187744", description: `${paidTransactions.length} carregamento(s) confirmado(s)` },
            { label: "Em processamento", value: pendingTransactions.length, icon: Clock, color: "#965A28", description: pendingTransactions.length ? "A aguardar confirmação de pagamento" : "Sem pagamentos pendentes" },
          ].map(item => <div key={item.label} className="min-w-0 border-t-[3px] bg-[var(--surface-bg)] p-5" style={{ borderTopColor: item.color }}>
            <div className="flex items-center gap-2.5 text-sm font-medium text-[var(--text-secondary)]"><item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />{item.label}</div>
            <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-[var(--text-primary)] tabular-nums">{item.value}</div>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">{item.description}</p>
          </div>)}
          <div className="flex flex-col justify-between border-t-[3px] border-[var(--accent)] bg-[var(--surface-bg)] p-5">
            <div><h2 className="text-sm font-semibold text-[var(--text-primary)]">Carregar carteira</h2><p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">Cartão, MB WAY ou Multibanco. Saldo disponível após confirmação do pagamento.</p></div>
            <button type="button" onClick={() => setIsTopUpOpen(true)} className="mt-4 inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]">
              <PlusCircle aria-hidden="true" className="h-4 w-4" />Novo carregamento
            </button>
          </div>
        </div>
      </section>

      {/* Transactions Table Section */}
      <div className="bg-[var(--surface-bg)] rounded-lg border border-[var(--border-subtle)] overflow-hidden">
        {/* Header & Filter Bar */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[var(--surface-muted)]/30">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[var(--text-secondary)]" />
              <span>Histórico de Carregamentos</span>
            </h3>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Registo detalhado de todas as tentativas e carregamentos realizados via Stripe
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--surface-bg)] p-1 rounded-lg border border-[var(--border-subtle)] text-xs">
            <button
              type="button"
              aria-pressed={statusFilter === "todos"}
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
              aria-pressed={statusFilter === "paid"}
              onClick={() => setStatusFilter("paid")}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                statusFilter === "paid"
                  ? "bg-[#187744] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Pagos ({paidTransactions.length})
            </button>
            <button
              type="button"
              aria-pressed={statusFilter === "pending"}
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                statusFilter === "pending"
                  ? "bg-[#965A28] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                          <CreditCard className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                          <span className="font-semibold text-[var(--text-primary)]">Stripe Checkout</span>
                          <span className="text-[10px] text-[var(--text-tertiary)]">(Cartão / MB WAY)</span>
                        </div>
                      </td>

                      {/* ID / Referência */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--text-tertiary)]">
                        <span title={tx.id}>{tx.id.slice(0, 8)}...{tx.id.slice(-4)}</span>
                      </td>

                      {/* Valor */}
                      <td className="py-3.5 px-4 text-right font-semibold tabular-nums text-sm whitespace-nowrap">
                        <span className="text-[var(--text-primary)]">
                          +{Number(tx.amount || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                        </span>
                      </td>

                      {/* Estado Badge */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#187744] text-white">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Confirmado</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#965A28] text-white">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>A aguardar pagamento</span>
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#B83B38] text-white">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Cancelado</span>
                          </span>
                        )}
                        {!isPaid && !isPending && !isFailed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
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
