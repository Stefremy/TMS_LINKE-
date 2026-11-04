import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export const MAX_STAFF_AVATAR_BYTES = 2 * 1024 * 1024

export async function uploadStaffAvatar(db: SupabaseClient, file: File, tenantId: string, staffId: string) {
  if (!file.size || file.size > MAX_STAFF_AVATAR_BYTES) throw new Error('Escolha uma fotografia até 2 MB.')
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Escolha uma imagem JPEG ou PNG.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (!(file.type === 'image/png' ? png : jpeg)) throw new Error('O ficheiro não corresponde a uma imagem JPEG ou PNG válida.')
  const path = `${encodeURIComponent(tenantId)}/staff/${encodeURIComponent(staffId)}/${crypto.randomUUID()}.${png ? 'png' : 'jpg'}`
  const bucket = db.storage.from('avatars')
  const { error } = await bucket.upload(path, bytes, { contentType: file.type, cacheControl: '3600', upsert: false })
  if (error) throw new Error('Não foi possível carregar a fotografia. Tente novamente.')
  const { data } = bucket.getPublicUrl(path)
  return { url: data.publicUrl, path }
}
