import { getStandardSpecialFeesAction } from "@/app/actions/special-fees"
import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getClientesAction } from "@/app/actions/clientes"
import { getServicosLinkeAction } from "@/app/actions/servicos-linke"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getBillingStatementsAction } from "@/app/actions/moloni"
import { ClientesClient } from "./components/ClientesClient"
import { createAdminClient } from "@/lib/supabase/server"
import { defaultClientPaymentDays } from "@/lib/billing/payment-settings"
import { requireEmployee } from "@/lib/auth/context"
import { canSendClientAccessEmail } from "@/lib/auth/client-access-email"
import { currentAccountOutstanding, payAsYouGoBalance } from "@/lib/billing/client-balance"
import { walletSnapshot } from "@/lib/billing/wallet"

import { readPortalAccessStatuses } from "@/lib/client-portal/suspension"

export const dynamic = "force-dynamic"

export default async function EntidadesClientesPage() {
  await requireOpsPageAccess("/ops/entidades/clientes")

  const ctx = await requireEmployee()
  const [clientes, servicosLinke, shipments, statements, defaultPaymentDays, accessStatuses, standardFees] = await Promise.all([
    getClientesAction(),
    getServicosLinkeAction(),
    getShipmentsAction({ includeLabels: false }),
    getBillingStatementsAction(),
    defaultClientPaymentDays(createAdminClient(), ctx.tenant_id),
    readPortalAccessStatuses(ctx.tenant_id),
    getStandardSpecialFeesAction()
  ])

  // Pré-pagamento: o saldo vem da mesma wallet que autoriza os envios (inclui valores reservados),
  // para a ficha do cliente mostrar exatamente o que o cliente vê e o que o sistema aplica.
  const admin = createAdminClient()
  const prepaidBalances = new Map(await Promise.all(
    clientes.filter(c => c.billing_type === 'pay_as_you_go').map(async (c) => {
      let balance: number
      try {
        const wallet = await walletSnapshot(admin, ctx.tenant_id, c.id)
        balance = wallet ? wallet.balance
          : payAsYouGoBalance(c.credit_limit, shipments.filter(s => s.client_id === c.id), [], c.pay_as_you_go_since)
      } catch {
        balance = payAsYouGoBalance(c.credit_limit, shipments.filter(s => s.client_id === c.id), [], c.pay_as_you_go_since)
      }
      return [c.id, balance] as const
    })
  ))

  // Conta corrente: crédito disponível = limite − dívida (só quando o limite está ativo).
  const clientesComCredito = clientes.map(c => {
    let available_credit: number | undefined = undefined
    if (c.billing_type === 'pay_as_you_go') {
      available_credit = prepaidBalances.get(c.id)
    } else if (typeof c.credit_limit === 'number' && c.credit_limit_enabled === true) {
      const debt = currentAccountOutstanding(shipments.filter(s => s.client_id === c.id), statements.filter((s: { client_id?: string }) => s.client_id === c.id))
      available_credit = Math.max(0, c.credit_limit - debt)
    }

    return {
      ...c,
      available_credit,
      portal_access_status: accessStatuses.get(c.id) ?? "active",
    }
  })

  return (
    <ClientesClient 
      initialClientes={clientesComCredito} 
      initialServicosLinke={servicosLinke} 
      canManageAccess={ctx.role === "admin"}
      canSendAccessEmail={canSendClientAccessEmail(ctx)}
      defaultPaymentDays={defaultPaymentDays}
      standardSpecialFees={standardFees.fees}
      standardFuelSurchargePct={standardFees.fuelSurchargePct}
    />
  )
}
