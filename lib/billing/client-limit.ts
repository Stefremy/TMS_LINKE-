/**
 * Regras puras dos dois modelos de faturação, partilhadas pela ficha do cliente (ops),
 * pela gravação no servidor e pelo portal do cliente. Sem I/O para poderem ser testadas.
 *
 *  - pay_as_you_go  → credit_limit É o dinheiro carregado na wallet (Stripe + injeções admin).
 *  - conta_corrente → credit_limit é o limite de faturação INTERNO (proteção contra calotes).
 *                     Não é crédito dado ao cliente e nunca lhe é mostrado.
 */

export type BillingType = "conta_corrente" | "pay_as_you_go"

export const DEFAULT_CURRENT_ACCOUNT_LIMIT = 5000
export const MAX_WALLET_INJECTION = 100000

const round2 = (n: number) => Math.round(n * 100) / 100

/** Valor inicial de credit_limit quando nada foi indicado. Uma wallet nova começa SEMPRE a zero. */
export function defaultCreditLimit(billingType: string | null | undefined): number {
  return (billingType || "conta_corrente") === "pay_as_you_go" ? 0 : DEFAULT_CURRENT_ACCOUNT_LIMIT
}

type LimitFields = { billing_type?: BillingType; category?: string; credit_limit?: number }

/**
 * Troca de modelo na ficha. Passar a pré-pagamento nunca transforma o limite de conta corrente
 * em dinheiro: a wallet começa a 0 €. Desfazer a troca na mesma edição repõe o limite original.
 */
export function switchBillingModel<T extends LimitFields>(
  current: T,
  target: BillingType,
  initial?: { billing_type?: string | null; credit_limit?: number | null } | null,
): T {
  if ((current.billing_type || "conta_corrente") === target) return current
  if (target === "pay_as_you_go") {
    return { ...current, billing_type: "pay_as_you_go", category: "Cliente Pré-Pagamento", credit_limit: 0 }
  }
  const restore = initial?.billing_type !== "pay_as_you_go"
  return {
    ...current,
    billing_type: "conta_corrente",
    category: "Cliente Conta Corrente",
    ...(restore ? { credit_limit: initial?.credit_limit ?? DEFAULT_CURRENT_ACCOUNT_LIMIT } : {}),
  }
}

/**
 * Valor escrito no campo "Injetar saldo". Aceita "50", "50,00", "-10.5". Recusa zero, mais de
 * 2 casas decimais, notação científica, valores acima do máximo e texto. Devolve null se inválido.
 */
export function parseWalletInjection(raw: string): number | null {
  const text = raw.trim()
  if (!/^-?\d{1,6}([.,]\d{1,2})?$/.test(text)) return null
  const value = Number(text.replace(",", "."))
  if (!Number.isFinite(value) || value === 0 || Math.abs(value) > MAX_WALLET_INJECTION) return null
  return round2(value)
}

/** Aplica uma injeção ao total carregado, em cêntimos exatos. */
export function applyWalletInjection(loaded: number | undefined, injection: number): number {
  return round2((loaded || 0) + injection)
}

/**
 * Pré-visualização do painel da wallet. `currentBalance` vem da wallet real (já descontados os
 * envios); `pending` é o ajuste ainda não gravado; `projected` o saldo depois de gravar.
 */
export function walletPreview(
  initial: { billing_type?: string | null; credit_limit?: number | null; available_credit?: number | null } | null | undefined,
  formCreditLimit: number | undefined,
) {
  const wasPrepaid = initial?.billing_type === "pay_as_you_go"
  const baseLoaded = wasPrepaid ? Number(initial?.credit_limit || 0) : 0
  const currentBalance = wasPrepaid ? Number(initial?.available_credit ?? baseLoaded) : 0
  const pending = round2((formCreditLimit || 0) - baseLoaded)
  const projected = round2(currentBalance + pending)
  return { wasPrepaid, baseLoaded, currentBalance, pending, projected }
}

/**
 * O que pode sair do servidor para o browser. Um cliente nunca recebe o limite interno de conta
 * corrente. Em pré-pagamento o credit_limit é o próprio saldo carregado e mantém-se.
 */
export function redactClientForViewer<T extends { billing_type?: string; credit_limit?: number; credit_limit_enabled?: boolean }>(
  client: T,
  role: string | null | undefined,
): T {
  if (role !== "client" || client.billing_type === "pay_as_you_go") return client
  return { ...client, credit_limit: undefined, credit_limit_enabled: undefined }
}
