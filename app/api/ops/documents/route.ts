import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth/context"
import { canAccessStaffDocuments } from "@/lib/auth/staff-documents"
import { createAdminClient } from "@/lib/supabase/server"
import { DEFAULT_COLABORADORES } from "@/app/ops/entidades/colaboradores/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BUCKET = "staff-documents"
const MAX_FILE_SIZE = 4 * 1024 * 1024
const FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
}

async function authorizedContext() {
  const context = await getAuthContext()
  return canAccessStaffDocuments(context) ? context : null
}

export async function GET(request: Request) {
  const context = await authorizedContext()
  if (!context) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 })

  const admin = createAdminClient()
  const downloadId = new URL(request.url).searchParams.get("download")
  if (downloadId) {
    const { data: document, error } = await admin
      .from("staff_documents")
      .select("id, storage_path, original_name")
      .eq("tenant_id", context.tenant_id)
      .eq("id", downloadId)
      .maybeSingle()
    if (error || !document) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 })

    const { data, error: signedUrlError } = await admin.storage.from(BUCKET).createSignedUrl(document.storage_path, 60, {
      download: document.original_name,
    })
    if (signedUrlError || !data?.signedUrl) return NextResponse.json({ error: "Não foi possível abrir o documento." }, { status: 500 })
    return NextResponse.json({ url: data.signedUrl })
  }

  const { data, error } = await admin
    .from("staff_documents")
    .select("id, owner_type, collaborator_id, collaborator_name, category, title, description, original_name, mime_type, size_bytes, uploaded_by, created_at")
    .eq("tenant_id", context.tenant_id)
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: "Não foi possível carregar os documentos." }, { status: 500 })
  return NextResponse.json({ documents: data || [] })
}

export async function POST(request: Request) {
  const context = await authorizedContext()
  if (!context) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Pedido de carregamento inválido." }, { status: 400 })
  }

  const file = form.get("file")
  const ownerType = form.get("owner_type")
  const collaboratorId = form.get("collaborator_id")
  const category = String(form.get("category") || "").trim().slice(0, 80)
  const title = String(form.get("title") || "").trim().slice(0, 160)
  const description = String(form.get("description") || "").trim().slice(0, 1000)

  if (!(file instanceof File) || !title || !category || (ownerType !== "linke" && ownerType !== "employee")) {
    return NextResponse.json({ error: "Preencha o título, a categoria, o destino e escolha um ficheiro." }, { status: 400 })
  }
  if (!file.size || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "O ficheiro tem de ter até 4 MB." }, { status: 400 })
  const extension = FILE_TYPES[file.type]
  if (!extension) return NextResponse.json({ error: "Formato não suportado. Use PDF, JPG, PNG, WebP, DOCX ou XLSX." }, { status: 415 })

  let collaboratorName: string | null = null
  if (ownerType === "employee") {
    if (typeof collaboratorId !== "string" || !collaboratorId.trim()) {
      return NextResponse.json({ error: "Selecione o colaborador." }, { status: 400 })
    }
    const admin = createAdminClient()
    const { data: collaborator } = await admin.from("colaboradores").select("id, name").eq("id", collaboratorId).maybeSingle()
    collaboratorName = collaborator?.name || DEFAULT_COLABORADORES.find((item) => item.id === collaboratorId)?.name || null
    if (!collaboratorName) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 400 })
  }

  const admin = createAdminClient()
  const documentId = randomUUID()
  const ownerFolder = ownerType === "linke" ? "linke" : `employees/${encodeURIComponent(String(collaboratorId))}`
  const storagePath = `${context.tenant_id}/${ownerFolder}/${documentId}.${extension}`
  const bytes = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: file.type,
    cacheControl: "0",
    upsert: false,
  })
  if (uploadError) return NextResponse.json({ error: "Não foi possível guardar o ficheiro. Confirme que a migração de documentos foi aplicada." }, { status: 500 })

  const { data: document, error: insertError } = await admin.from("staff_documents").insert({
    id: documentId,
    tenant_id: context.tenant_id,
    owner_type: ownerType,
    collaborator_id: ownerType === "employee" ? collaboratorId : null,
    collaborator_name: collaboratorName,
    category,
    title,
    description: description || null,
    original_name: file.name.replace(/[\\/\0]/g, "_").slice(0, 240) || `documento.${extension}`,
    mime_type: file.type,
    size_bytes: file.size,
    storage_path: storagePath,
    uploaded_by: context.user.email?.toLowerCase() || "",
  }).select("id, owner_type, collaborator_id, collaborator_name, category, title, description, original_name, mime_type, size_bytes, uploaded_by, created_at").single()

  if (insertError || !document) {
    await admin.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: "Não foi possível registar os dados do documento." }, { status: 500 })
  }
  return NextResponse.json({ document }, { status: 201 })
}

export async function DELETE(request: Request) {
  const context = await authorizedContext()
  if (!context) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 })

  let body: { id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 })
  }
  if (!body.id) return NextResponse.json({ error: "Documento não indicado." }, { status: 400 })

  const admin = createAdminClient()
  const { data: document } = await admin.from("staff_documents")
    .select("id, storage_path")
    .eq("tenant_id", context.tenant_id)
    .eq("id", body.id)
    .maybeSingle()
  if (!document) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 })

  const { error: storageError } = await admin.storage.from(BUCKET).remove([document.storage_path])
  if (storageError) return NextResponse.json({ error: "Não foi possível remover o ficheiro." }, { status: 500 })
  const { error } = await admin.from("staff_documents").delete().eq("tenant_id", context.tenant_id).eq("id", body.id)
  if (error) return NextResponse.json({ error: "Não foi possível remover o registo do documento." }, { status: 500 })
  return NextResponse.json({ success: true })
}
