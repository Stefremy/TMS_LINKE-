import { getClientesAction } from "@/app/actions/clientes"
import { getServicosLinkeAction } from "@/app/actions/servicos-linke"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getBillingStatementsAction } from "@/app/actions/moloni"
import { ClientesClient } from "./components/ClientesClient"

export const dynamic = "force-dynamic"

export default async function EntidadesClientesPage() {
  const [clientes, servicosLinke, shipments, statements] = await Promise.all([
    getClientesAction(),
    getServicosLinkeAction(),
    getShipmentsAction(),
    getBillingStatementsAction()
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
          unpaidStatementsTotal += Number(stmt.total_value || 0)
        }
        // Se for Fatura Completa interna (sem Moloni) também é não pago?
        else if (!stmt.is_pro_forma && !stmt.moloni_document_id) {
           // Assumimos não pago porque não tem sistema de recibo no TMS puro
           unpaidStatementsTotal += Number(stmt.total_value || 0)
        }
      }
    })

    const totalDebt = unbilledShipmentsTotal + unpaidStatementsTotal
    let available_credit = undefined

    if (typeof c.credit_limit === 'number') {
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
    />
  )
}
