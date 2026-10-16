export type ArchiveClient = {
  id: string
  legal_name?: string | null
  short_name?: string | null
  nif?: string | null
  logo_url?: string | null
  color?: string | null
}

export type ArchiveStatement = {
  id?: string
  client_id?: string | null
  client_name?: string | null
  statement_number?: string | null
  moloni_document_number?: string | number | null
  moloni_document_id?: string | number | null
  moloni_document_pdf?: string | null
  moloni_receipt_id?: string | number | null
  moloni_receipt_pdf?: string | null
  is_pro_forma?: boolean
  status?: string
  total_value?: string | number
  created_at?: string | null
}

export type InvoiceArchiveGroup = {
  key: string
  name: string
  nif?: string | null
  logo_url?: string | null
  color?: string | null
  associationMissing: boolean
  statements: ArchiveStatement[]
  paidCount: number
  awaitingReceiptCount: number
}

export function isInvoicePaid(statement: ArchiveStatement): boolean {
  return statement.status === "paid" || Boolean(statement.moloni_receipt_id || statement.moloni_receipt_pdf)
}

function normalize(value?: string | number | null) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-PT")
}

function timestamp(value?: string | null) {
  const result = Date.parse(value || "")
  return Number.isFinite(result) ? result : 0
}

/** Group existing documents for display; never changes ownership or billing status. */
export function groupInvoiceArchive(clients: ArchiveClient[], statements: ArchiveStatement[], search = ""): InvoiceArchiveGroup[] {
  const byId = new Map(clients.map(client => [client.id, client]))
  const groups = new Map<string, InvoiceArchiveGroup>()
  const query = normalize(search)

  for (const statement of statements) {
    // Failed attempts/internal drafts must not appear as issued invoices.
    // Preserve older paid statements even if their original Moloni link is missing.
    if (statement.is_pro_forma || !(statement.moloni_document_id || statement.moloni_document_pdf || isInvoicePaid(statement))) continue
    let client = statement.client_id ? byId.get(statement.client_id) : undefined
    if (!statement.client_id && normalize(statement.client_name)) {
      const matches = clients.filter(item => [item.legal_name, item.short_name].some(name => normalize(name) === normalize(statement.client_name)))
      if (matches.length === 1) client = matches[0]
    }
    const id = statement.client_id || client?.id
    const key = id ? `store:${id}` : `unassigned:${normalize(statement.client_name) || "unknown"}`
    const name = client?.short_name || client?.legal_name || statement.client_name || "Loja não identificada"
    let group = groups.get(key)
    if (!group) {
      group = { key, name, nif: client?.nif, logo_url: client?.logo_url, color: client?.color, associationMissing: !id, statements: [], paidCount: 0, awaitingReceiptCount: 0 }
      groups.set(key, group)
    }
    group.statements.push(statement)
  }

  return [...groups.values()].map(group => {
    const storeMatches = normalize(`${group.name} ${group.nif || ""}`).includes(query)
    group.statements = group.statements.filter(statement => !query || storeMatches ||
      normalize(`${statement.statement_number || ""} ${statement.moloni_document_number || ""} ${statement.client_name || ""}`).includes(query))
      .sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at) || String(a.id || a.statement_number).localeCompare(String(b.id || b.statement_number)))
    group.paidCount = group.statements.filter(isInvoicePaid).length
    group.awaitingReceiptCount = group.statements.filter(statement => !isInvoicePaid(statement)).length
    return group
  }).filter(group => group.statements.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-PT") || a.key.localeCompare(b.key))
}
