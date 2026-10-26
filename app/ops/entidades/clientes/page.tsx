import { getClientesAction } from "@/app/actions/clientes"
import { getServicosLinkeAction } from "@/app/actions/servicos-linke"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getBillingStatementsAction } from "@/app/actions/moloni"
import { ClientesClient } from "./components/ClientesClient"
import { createAdminClient } from "@/lib/supabase/server"
import { defaultClientPaymentDays } from "@/lib/billing/payment-settings"
import { requireEmployee } from "@/lib/auth/context"
import { currentAccountOutstanding } from "@/lib/billing/client-balance"

export const dynamic = "force-dynamic"

export default async function EntidadesClientesPage() {
  const ctx = await requireEmployee()
  const [clientes, servicosLinke, shipments, statements, defaultPaymentDays] = await Promise.all([
    getClientesAction(),
    getServicosLinkeAction(),
    getShipmentsAction({ includeLabels: false }),
    getBillingStatementsAction(),
    defaultClientPaymentDays(createAdminClient(), ctx.tenant_id)
  ])

  // Calcular o crédito disponível para cada cliente
  const clientesComCredito = clientes.map(c => {
    let unbilledShipmentsTotal = 0
    let unpaidStatementsTotal = 0

    // 1. Envios pendentes de faturação (billing_statement_id === null)
    shipments.forEach((s: any) => {
      if (s.client_id === c.id && !s.billing_statement_id) {
        unbilledShipmentsTotal += (Number(s.sell_price || 0) + Number(s.fuel_tax_amount || 0))
      }
    })

    // 2. Extratos faturados mas não pagos (sem recibo)
    statements.forEach((stmt: any) => {
      if (stmt.client_id === c.id) {
        // Se tem fatura Moloni mas não tem recibo
        if (stmt.moloni_document_id && !stmt.moloni_receipt_pdf) {
          unpaidStatementsTotal += Number(stmt.outstanding_value ?? stmt.total_value ?? 0)
        }
        // Se for Fatura Completa interna (sem Moloni) também é não pago?
        else if (!stmt.is_pro_forma && !stmt.moloni_document_id) {
           // Assumimos não pago porque não tem sistema de recibo no TMS puro
           unpaidStatementsTotal += Number(stmt.outstanding_value ?? stmt.total_value ?? 0)
        }
      }
    })

    const totalDebt = c.billing_type === 'pay_as_you_go' ? unbilledShipmentsTotal + unpaidStatementsTotal
      : currentAccountOutstanding(shipments.filter(s => s.client_id === c.id), statements.filter((s: { client_id?: string }) => s.client_id === c.id))
    let available_credit = undefined

    if (typeof c.credit_limit === 'number' && (c.billing_type === 'pay_as_you_go' || c.credit_limit_enabled === true)) {
      available_credit = Math.max(0, c.credit_limit - totalDebt)
    }

    return {
      ...c,
      available_credit
    }
  })

  return (
    <ClientesClient 
      initialClientes={clientesComCredito} 
      initialServicosLinke={servicosLinke} 
      canManageAccess={ctx.role === "admin"}
      defaultPaymentDays={defaultPaymentDays}
    />
  )
}
