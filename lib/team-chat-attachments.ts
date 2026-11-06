import "server-only"
import type { AuthContext } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { ChatError } from "@/lib/team-chat"

export const CHAT_ATTACHMENT_BUCKET = "team-chat-attachments"
export const CHAT_UPLOAD_ACTION = "team_chat_attachment"
const endpoint = "/api/ops/chat/attachments"
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

export function legacyChatStoragePath(reference: string): string | null {
  try {
    const url = new URL(reference)
    if (url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin) return null
    const prefix = `/storage/v1/object/public/${CHAT_ATTACHMENT_BUCKET}/`
    return url.pathname.startsWith(prefix) ? decodeURIComponent(url.pathname.slice(prefix.length)) : null
  } catch { return null }
}

function validPath(path: string, tenant: string) {
  const parts = path.split("/")
  return parts.length === 3 && parts[0] === tenant && uuid.test(parts[1]) && /^[a-f0-9-]{36}\.[a-z0-9]{1,8}$/i.test(parts[2])
}

/** Uploader access covers pending previews. Everyone else needs an existing visible message. */
export async function authorizedChatAttachment(context: AuthContext, reference: string) {
  const db = createAdminClient()
  if (reference.startsWith(`${endpoint}?`)) {
    const params = new URL(reference, "https://local.invalid").searchParams
    const legacyPath = params.get("path")
    if (legacyPath && !params.has("id")) reference = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${CHAT_ATTACHMENT_BUCKET}/${legacyPath}`
  }
  let storagePath = legacyChatStoragePath(reference)
  let name = "anexo"
  let type = "application/octet-stream"
  let uploader: string | undefined
  if (reference.startsWith(`${endpoint}?`)) {
    const id = new URL(reference, "https://local.invalid").searchParams.get("id") || ""
    if (!uuid.test(id)) throw new ChatError("Anexo não encontrado.", 404)
    const { data, error } = await db.from("audit_log").select("details")
      .eq("tenant_id", context.tenant_id).eq("action", CHAT_UPLOAD_ACTION).eq("details->>id", id).maybeSingle()
    if (error) throw new ChatError("Não foi possível verificar o anexo.", 503)
    if (!data) throw new ChatError("Anexo não encontrado.", 404)
    storagePath = data.details.storage_path
    uploader = data.details.uploaded_by
    name = data.details.name
    type = data.details.type
  }
  if (!storagePath || !validPath(storagePath, context.tenant_id)) throw new ChatError("Anexo não encontrado.", 404)
  if (name === "anexo") name = storagePath.split("/").pop()!
  uploader ||= storagePath.split("/")[1]
  if (uploader !== context.user.id) {
    const exact = reference.replace(/[\\%_]/g, "\\$&")
    const { data, error } = await db.from("team_chat_messages").select("id")
      .eq("tenant_id", context.tenant_id).like("body", `%[file:${exact}|%`)
      .or(`recipient_id.is.null,sender_id.eq.${context.user.id},recipient_id.eq.${context.user.id}`).limit(1).maybeSingle()
    if (error) throw new ChatError("Não foi possível verificar a conversa.", 503)
    if (!data) throw new ChatError("Anexo não encontrado.", 404)
  }
  return { storagePath, name, type }
}

/** Prevent a forged message from granting access to someone else's upload. */
export async function validateChatAttachmentReferences(context: AuthContext, body: string) {
  const references = [...body.matchAll(/\[file:([^|\s\]]+)\|/g)].map(match => match[1])
  for (const reference of references) {
    if (reference.startsWith(`${endpoint}?`) || legacyChatStoragePath(reference)) await authorizedChatAttachment(context, reference)
  }
}
