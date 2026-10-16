import { notFound } from "next/navigation"
import { getAuthContext, requireEmployee } from "@/lib/auth/context"
import { canAccessStaffDocuments } from "@/lib/auth/staff-documents"
import { createAdminClient } from "@/lib/supabase/server"
import { getColaboradoresAction } from "@/app/actions/colaboradores"
import { DocumentsClient } from "./DocumentsClient"

export const metadata = { title: "Documentos Internos | Linke TMS" }

export default async function DocumentsPage() {
  await requireEmployee()
  const context = await getAuthContext()
  if (!canAccessStaffDocuments(context)) notFound()

  const admin = createAdminClient()
  const [{ data: documents, error }, collaborators] = await Promise.all([
    admin.from("staff_documents")
      .select("id, owner_type, collaborator_id, collaborator_name, category, title, description, original_name, mime_type, size_bytes, uploaded_by, created_at")
      .eq("tenant_id", context!.tenant_id)
      .order("created_at", { ascending: false }),
    getColaboradoresAction(),
  ])

  return <DocumentsClient
    initialDocuments={error ? [] : documents || []}
    collaborators={collaborators.map(({ id, name, email }) => ({ id, name, email }))}
    loadError={error ? "A área de documentos ainda não está preparada. Aplique a migração de documentos no Supabase e tente novamente." : null}
  />
}
