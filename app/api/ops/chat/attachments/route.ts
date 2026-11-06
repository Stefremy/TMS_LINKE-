import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { ChatError } from "@/lib/team-chat"
import { chatContext } from "@/lib/team-chat-server"
import { createAdminClient } from "@/lib/supabase/server"
import { authorizedChatAttachment, CHAT_ATTACHMENT_BUCKET as BUCKET, CHAT_UPLOAD_ACTION } from "@/lib/team-chat-attachments"
import { chatFileType } from "@/lib/chat-file-validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie, Authorization", "X-Content-Type-Options": "nosniff" }
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof ChatError ? error.message : "Não foi possível aceder ao anexo." },
    { status: error instanceof ChatError ? error.status : 500, headers })
}

export async function GET(request: Request) {
  try {
    const context = await chatContext()
    const params = new URL(request.url).searchParams
    const path = params.get("path")
    const reference = path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
      : `/api/ops/chat/attachments?id=${encodeURIComponent(params.get("id") || "")}`
    const file = await authorizedChatAttachment(context, reference)
    const admin = createAdminClient()
    const image = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(file.storagePath, 60,
      image ? undefined : { download: file.name })
    if (error || !data?.signedUrl) throw new ChatError("Não foi possível abrir o anexo.", 503)
    const response = NextResponse.redirect(data.signedUrl)
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
    return response
  } catch (error) { return failure(error) }
}

export async function POST(request: Request) {
  try {
    const context = await chatContext()
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) throw new ChatError("Origem do pedido inválida.", 403)
    let form: FormData
    try { form = await request.formData() } catch { throw new ChatError("Pedido de anexo inválido.", 400) }
    const file = form.get("file")
    if (!(file instanceof File)) throw new ChatError("Selecione um ficheiro para anexar.", 400)
    if (!file.size || file.size > MAX_ATTACHMENT_BYTES) throw new ChatError("O ficheiro deve ter até 10 MB.", 400)
    const name = (file.name || "anexo").replace(/[\\/\0|\][\r\n]+/g, "_").trim().slice(0, 140)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = chatFileType(name, file.type || "application/octet-stream", bytes)
    if (!type) throw new ChatError("O conteúdo, formato e extensão do ficheiro não correspondem ou não são suportados.", 415)
    const admin = createAdminClient()
    const { data: bucket, error: bucketError } = await admin.storage.getBucket(BUCKET)
    if (bucketError && String(bucketError.statusCode) !== "404") throw new ChatError("Não foi possível verificar o armazenamento.", 503)
    const { error: setupError } = bucket && !bucket.public ? { error: null } : bucket
      ? await admin.storage.updateBucket(BUCKET, { public: false, fileSizeLimit: MAX_ATTACHMENT_BYTES })
      : await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_ATTACHMENT_BYTES })
    if (setupError) throw new ChatError("Não foi possível proteger o armazenamento.", 503)
    const id = randomUUID()
    const storagePath = `${context.tenant_id}/${context.user.id}/${id}.${name.split(".").pop()!.toLowerCase()}`
    const { error } = await admin.storage.from(BUCKET).upload(storagePath, bytes, { contentType: type, cacheControl: "0", upsert: false })
    if (error) throw new ChatError("Não foi possível carregar o anexo.", 503)
    const { error: metadataError } = await admin.from("audit_log").insert({ tenant_id: context.tenant_id, user_id: context.user.id,
      action: CHAT_UPLOAD_ACTION, details: { id, storage_path: storagePath, uploaded_by: context.user.id, name, type, size: file.size } })
    if (metadataError) {
      await admin.storage.from(BUCKET).remove([storagePath])
      throw new ChatError("Não foi possível registar o anexo.", 503)
    }
    return NextResponse.json({ attachment: { id, name, size: file.size, type, url: `/api/ops/chat/attachments?id=${id}` } }, { status: 201, headers })
  } catch (error) { return failure(error) }
}
