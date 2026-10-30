/** Lifetime legacy service counts, not a monthly volume or an account access status. */
export const CLIENT_ACTIVITY_COLORS = [
  { min: 0, label: '0', color: '#607D94', name: 'Azul cinza' },
  { min: 1, label: '1–9', color: '#467C99', name: 'Azul aço' },
  { min: 10, label: '10–49', color: '#4E8C8A', name: 'Verde petróleo' },
  { min: 50, label: '50–199', color: '#7F8A55', name: 'Verde oliva' },
  { min: 200, label: '200–999', color: '#AA793D', name: 'Ocre' },
  { min: 1000, label: '1 000+', color: '#B45F40', name: 'Terracota' },
] as const

export function clientActivityColor(count: number | undefined): string | undefined {
  if (count === undefined || !Number.isSafeInteger(count) || count < 0) return undefined
  return [...CLIENT_ACTIVITY_COLORS].reverse().find(band => count >= band.min)?.color
}

export function applyClientActivityColor<T extends { color: string; color_mode?: 'services' | 'manual' }>(client: T, count: number | undefined): T & { legacy_service_count?: number } {
  const color = clientActivityColor(count)
  if (!color) return client
  return { ...client, legacy_service_count: count, color_mode: client.color_mode ?? 'services',
    color: client.color_mode === 'manual' ? client.color : color }
}

export function matchesClientServiceCount(count: number | undefined, filter: string): boolean {
  if (filter === 'all') return true
  const known = clientActivityColor(count) !== undefined
  if (filter === 'missing') return !known
  if (filter === 'known') return known
  if (!known) return false
  const index = CLIENT_ACTIVITY_COLORS.findIndex(band => String(band.min) === filter)
  if (index < 0) return false
  const next = CLIENT_ACTIVITY_COLORS[index + 1]
  return count! >= CLIENT_ACTIVITY_COLORS[index].min && (!next || count! < next.min)
}

/** Unknown history always follows known counts, including a genuine zero, in either direction. */
export function sortClientsByServiceCount<T extends { legacy_service_count?: number; short_name?: string; code?: string }>(clients: readonly T[], direction: 'asc' | 'desc'): T[] {
  return [...clients].sort((a, b) => {
    const aKnown = clientActivityColor(a.legacy_service_count) !== undefined
    const bKnown = clientActivityColor(b.legacy_service_count) !== undefined
    if (aKnown !== bKnown) return aKnown ? -1 : 1
    const difference = aKnown ? (a.legacy_service_count! - b.legacy_service_count!) * (direction === 'asc' ? 1 : -1) : 0
    return difference || (a.short_name || '').localeCompare(b.short_name || '', 'pt') || (a.code || '').localeCompare(b.code || '', 'pt')
  })
}
