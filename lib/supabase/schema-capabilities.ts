import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type DatabaseFeature = 'carrier_connections' | 'colaboradores' | 'servicos_linke' | 'user_profiles' | 'shipments.ctt_manifest_pdf'
type Capabilities = Partial<Record<DatabaseFeature, boolean>>
type Entry = { expires: number; value: Capabilities | null; pending?: Promise<Capabilities | null> }
const cache = new Map<string, Entry>()

/** Cache schema metadata only. Never cache sessions, permissions, prices or credentials. */
export async function supportsDatabaseFeature(db: SupabaseClient, feature: DatabaseFeature): Promise<boolean> {
  const key = process.env.NEXT_PUBLIC_SUPABASE_URL || 'default'
  const current = cache.get(key)
  if (current?.pending) return (await current.pending)?.[feature] !== false
  if (current && current.expires > Date.now()) return current.value?.[feature] !== false
  const entry: Entry = { expires: 0, value: null }
  entry.pending = (async () => {
    try {
      const { data, error } = await db.rpc('linke_schema_capabilities')
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null
      const result: Capabilities = {}
      for (const name of ['carrier_connections', 'colaboradores', 'servicos_linke', 'user_profiles', 'shipments.ctt_manifest_pdf'] as const) {
        if (typeof data[name] === 'boolean') result[name] = data[name]
      }
      return result
    } catch {
      // Older deployments without the RPC keep their existing query/fallback behavior.
      return null
    }
  })()
  cache.set(key, entry)
  entry.value = await entry.pending
  entry.pending = undefined
  entry.expires = Date.now() + (entry.value ? 300_000 : 30_000)
  // One entry per project, bounded even if configuration changes during development.
  if (cache.size > 16) cache.delete(cache.keys().next().value!)
  return entry.value?.[feature] !== false
}
