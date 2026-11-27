// One-off: move base64 client logos out of audit_log client_data into the public `avatars` bucket.
// Uploads only; writes a backup and a JSON mapping [{ id, md5, url }]. The database swap is a
// separate SQL step, guarded by md5 so a logo edited in the meantime is left alone.
// Usage: node --env-file=.env.local scripts/migrate-client-logos.mjs <backup.json> <mapping.json>
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const [backupPath, mappingPath] = process.argv.slice(2)
if (!backupPath || !mappingPath) throw new Error('usage: migrate-client-logos.mjs <backup.json> <mapping.json>')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

// Same byte checks as lib/client-logo.ts (the bucket accepts PNG/JPEG/GIF only).
const sniff = b => b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 ? ['png', 'image/png']
  : b[0] === 255 && b[1] === 216 && b[2] === 255 ? ['jpg', 'image/jpeg']
  : b[0] === 71 && b[1] === 73 && b[2] === 70 ? ['gif', 'image/gif'] : null

const { data: rows, error } = await db.from('audit_log')
  .select('id, tenant_id, client_id:details->>id, logo_url:details->>logo_url')
  .eq('action', 'client_data').like('details->>logo_url', 'data:image/%')
if (error) throw error
writeFileSync(backupPath, JSON.stringify(rows))

const bucket = db.storage.from('avatars')
const mapping = [], skipped = []
for (const r of rows) {
  const b64 = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/is.exec(r.logo_url)?.[1]
  const bytes = b64 ? Buffer.from(b64, 'base64') : null
  const type = bytes && sniff(bytes)
  if (!type || bytes.length > 2 * 1024 * 1024) { skipped.push(r.id); continue }
  const path = `${encodeURIComponent(r.tenant_id)}/client-logos/${encodeURIComponent(r.client_id)}/${randomUUID()}.${type[0]}`
  const up = await bucket.upload(path, bytes, { contentType: type[1], cacheControl: '31536000', upsert: false })
  if (up.error) { skipped.push(r.id); console.error('upload failed', r.id, up.error.message); continue }
  mapping.push({ id: r.id, md5: createHash('md5').update(r.logo_url).digest('hex'), url: bucket.getPublicUrl(path).data.publicUrl })
}
writeFileSync(mappingPath, JSON.stringify(mapping))
console.log(JSON.stringify({ found: rows.length, uploaded: mapping.length, skipped: skipped.length }))
