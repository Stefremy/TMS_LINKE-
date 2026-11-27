import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_LOGO_BYTES = 2 * 1024 * 1024

/** Type from the bytes, not the data-URL label (many saved logos claim PNG but are JPEG). */
export function sniffLogoType(bytes: Uint8Array): { ext: string; mime: string } | null {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return { ext: 'png', mime: 'image/png' }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { ext: 'jpg', mime: 'image/jpeg' }
  if (bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56) return { ext: 'gif', mime: 'image/gif' }
  return null
}

/**
 * Client logos used to be saved as base64 inside the client record, which made every client
 * list load megabytes. Upload PNG/JPEG/GIF data URLs to the public `avatars` bucket and return
 * its URL. Anything else (http URLs, SVG, WebP, empty) is returned unchanged.
 */
export async function storeClientLogo(db: SupabaseClient, tenantId: string, clientId: string, logo: string): Promise<string> {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(logo)
  if (!match) return logo
  const bytes = new Uint8Array(Buffer.from(match[1], 'base64'))
  const type = sniffLogoType(bytes)
  if (!type) return logo // shortcut: SVG/WebP stay inline (bucket rejects them; SVG is unsafe to host)
  if (bytes.length > MAX_LOGO_BYTES) throw new Error('O logótipo não deve exceder 2 MB.')
  const path = `${encodeURIComponent(tenantId)}/client-logos/${encodeURIComponent(clientId)}/${crypto.randomUUID()}.${type.ext}`
  const bucket = db.storage.from('avatars')
  const { error } = await bucket.upload(path, bytes, { contentType: type.mime, cacheControl: '31536000', upsert: false })
  if (error) throw new Error('Não foi possível carregar o logótipo. Tente novamente.')
  return bucket.getPublicUrl(path).data.publicUrl
}
