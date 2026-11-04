import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { ChatError } from "@/lib/team-chat"
import { chatContext } from "@/lib/team-chat-server"
import { createAdminClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BUCKET = "team-chat-attachments"
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
])

const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "pdf", "txt", "csv", "doc", "docx", "xls", "xlsx", "zip",
])

const headers = { "Cache-Control": "private, no-store" }

export async function POST(request: Request) {
  try {
    const context = await chatContext()
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) {
      throw new ChatError("Origem do pedido inválida.", 403)
    }

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      throw new ChatError("Pedido de anexo inválido.", 400)
    }

    const file = form.get("file")
    if (!(file instanceof File)) {
      throw new ChatError("Selecione um ficheiro para anexar.", 400)
    }
    if (!file.size || file.size > MAX_ATTACHMENT_BYTES) {
      throw new ChatError("O ficheiro deve ter até 10 MB.", 400)
    }

    const rawName = (file.name || "anexo").replace(/[\\/\0|\][\r\n]+/g, "_").trim().slice(0, 140) || "anexo"
    const ext = (rawName.split(".").pop() || "").toLowerCase()
    const mime = (file.type || "application/octet-stream").toLowerCase()

    if (!ALLOWED_MIME_TYPES.has(mime) && !ALLOWED_EXTENSIONS.has(ext)) {
      throw new ChatError("Formato não suportado. Use imagens, PDF, Word, Excel, CSV, TXT ou ZIP.", 415)
    }

    const admin = createAdminClient()
    const { data: bucketInfo } = await admin.storage.getBucket(BUCKET)
    if (!bucketInfo) {
      await admin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_ATTACHMENT_BYTES,
      })
    }

    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : (mime.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "bin")
    const fileId = randomUUID()
    const storagePath = `${encodeURIComponent(context.tenant_id)}/${encodeURIComponent(context.user.id)}/${fileId}.${safeExt}`
    const bytes = new Uint8Array(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    })

    if (uploadError) {
      throw new ChatError("Não foi possível carregar o anexo. Tente novamente.", 500)
    }

    const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath)

    return NextResponse.json(
      {
        attachment: {
          id: fileId,
          name: rawName,
          size: file.size,
          type: mime,
          url: publicUrlData.publicUrl,
        },
      },
      { status: 201, headers }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof ChatError ? error.message : "Não foi possível carregar o anexo." },
      { status: error instanceof ChatError ? error.status : 500, headers }
    )
  }
}

