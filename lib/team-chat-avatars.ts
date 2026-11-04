import "server-only"
import { createAdminClient } from "@/lib/supabase/server"
import { listStaffAuthUsers, loadStaffDirectory, staffEmail } from "@/lib/auth/staff-directory"
import type { ChatMember } from "@/lib/team-chat"

// Chat polling shares this small, tenant-scoped projection rather than loading
// the full staff directory on every poll. No staff permissions/contact data leaves it.
const cache = new Map<string, { expires: number; value: Promise<Map<string, ChatMember>> }>()
export function invalidateChatAvatars(tenantId: string) { cache.delete(tenantId) }

export function getChatStaffMembers(tenantId: string): Promise<Map<string, ChatMember>> {
  const existing = cache.get(tenantId)
  if (existing && existing.expires > Date.now()) return existing.value
  const value = (async () => {
    const db = createAdminClient()
    const users = await listStaffAuthUsers(db)
    const directory = await loadStaffDirectory(db, tenantId, users)
    const result = new Map<string, ChatMember>()
    for (const user of users) {
      if (user.app_metadata?.role === "client" || (user.app_metadata?.tenant_id && user.app_metadata.tenant_id !== tenantId)) continue
      const profile = directory.find(person => person.id === user.app_metadata?.colaborador_id || staffEmail(person.email) === staffEmail(user.email))
      if (!profile || profile.status === "Inativo") continue
      const avatar = profile.avatar
      // Older collaborator photos can be embedded raster images or local assets.
      const valid = typeof avatar === "string" && (
        (avatar.length <= 500 && (/^https:\/\//i.test(avatar) || /^\/(?!\/)/.test(avatar))) ||
        (avatar.length <= 3_000_000 && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(avatar))
      )
      result.set(user.id, { user_id: user.id, name: profile.name, avatar_url: valid ? avatar : null })
    }
    return result
  })()
  if (cache.size >= 100) cache.delete(cache.keys().next().value!)
  cache.set(tenantId, { expires: Date.now() + 30_000, value })
  void value.catch(() => { if (cache.get(tenantId)?.value === value) cache.delete(tenantId) })
  return value
}

export async function getChatStaffAvatars(tenantId: string): Promise<Map<string, string | null>> {
  return new Map([...await getChatStaffMembers(tenantId)].map(([id, member]) => [id, member.avatar_url]))
}
