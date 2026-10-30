export interface LegacyServiceHistory {
  count: number
  imported_at: string
  source: string
  period_end?: string
}

export function normalizeLegacyClientName(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** This export contains one snapshot per legacy customer, rather than individual shipments. */
export function parseLegacyServiceCounts(csv: string): { row: number; name: string; count: number }[] {
  const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  if (lines.shift() !== 'Loja;N.º de serviços') throw new Error('Cabeçalho de serviços inválido.')
  return lines.map((line, index) => {
    const separator = line.lastIndexOf(';')
    let name = line.slice(0, separator).trim()
    if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1).replace(/""/g, '"')
    const raw = line.slice(separator + 1).trim()
    const count = Number(raw)
    if (separator < 1 || !name || !/^\d+$/.test(raw) || !Number.isSafeInteger(count)) {
      throw new Error(`Número de serviços inválido na linha ${index + 2}.`)
    }
    return { row: index + 2, name, count }
  })
}

export function readLegacyServiceHistory(details: unknown): LegacyServiceHistory | null {
  if (!details || typeof details !== 'object') return null
  const row = details as Record<string, unknown>
  if (typeof row.count !== 'number' || !Number.isSafeInteger(row.count) || row.count < 0 ||
    typeof row.imported_at !== 'string' || !Number.isFinite(Date.parse(row.imported_at)) || typeof row.source !== 'string') return null
  return { count: row.count, imported_at: row.imported_at, source: row.source,
    ...(typeof row.period_end === 'string' ? { period_end: row.period_end } : {}) }
}
