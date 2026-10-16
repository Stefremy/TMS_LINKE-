import { loadFinancialDocument, financialPdfResponse } from '@/lib/services/billing/document-access'
import { generateStatementPdfBuffer } from '@/lib/services/billing/statement-pdf'
import { lisbonDate, periodLabel } from '@/lib/billing/recurring-periods'
import type { PeriodStatement } from '@/lib/billing/recurring-statements'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const access = await loadFinancialDocument(id, 'period_statement')
    if (!access) return financialPdfResponse('Documento não encontrado', { status: 404 })
    const statement = access.document.details as PeriodStatement
    const client = statement.client_snapshot
    const buffer = await generateStatementPdfBuffer({
      statementNumber: statement.statement_number, clientName: client.name, clientNif: client.nif,
      clientAddress: client.address, clientCity: client.city,
      dateStr: lisbonDate(statement.created_at).split('-').reverse().join('/'),
      periodLabel: periodLabel(statement.period_start, statement.period_end),
      totalValue: statement.total_value,
      shipments: statement.shipments.map(s => ({ ...s, sell_price: Number(s.sell_price) })),
    })
    const filename = statement.statement_number.replace(/[^a-zA-Z0-9_-]/g, '_')
    return financialPdfResponse(new Uint8Array(buffer), { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Extrato_${filename}.pdf"`,
    } })
  } catch { return financialPdfResponse('Não foi possível gerar o extrato.', { status: 500 }) }
}
