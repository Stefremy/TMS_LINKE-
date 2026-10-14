"use server"

import { Resend } from "resend"
import { requireAdmin } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { assertBoundClient, assertClientEmail, findClientUser, invitationConfig, invitationEmail, loadInvitationStore, normalizeInvitationEmail } from "@/lib/client-portal/invitations"

/** Explicit administrator action. Never called merely by opening a client record. */
export async function inviteClientAccessAction(clientId: string, requestedEmail: string) {
  const ctx = await requireAdmin()
  const config = invitationConfig() // Fail before provisioning if delivery cannot be configured.
  const email = normalizeInvitationEmail(requestedEmail)
  const db = createAdminClient()
  const store = await loadInvitationStore(db, clientId, ctx.tenant_id)
  await assertClientEmail(db, email)
  const existing = await findClientUser(db, email, clientId, ctx.tenant_id)
  // Recovery also lets an already invited client receive a fresh link without changing stores.
  const type = existing ? "recovery" : "invite"
  const { data, error } = await db.auth.admin.generateLink({ type, email })
  if (error || !data?.user || !data.properties?.hashed_token || data.properties.verification_type !== type
    || data.user.email?.toLowerCase() !== email) throw new Error("Não foi possível preparar o convite. Tente novamente.")
  if (existing) {
    if (existing.id !== data.user.id) throw new Error("Não foi possível verificar o acesso do cliente.")
    assertBoundClient(data.user, clientId, ctx.tenant_id)
  } else if (data.user.app_metadata.role || data.user.app_metadata.client_id || data.user.app_metadata.colaborador_id) {
    // Do not overwrite an account that appeared concurrently or already has another identity.
    throw new Error("Este email já tem outro acesso. Use um email próprio desta loja.")
  }
  const { error: assignmentError } = await db.auth.admin.updateUserById(data.user.id, {
    app_metadata: { ...data.user.app_metadata, role: "client", client_id: clientId, tenant_id: ctx.tenant_id },
  })
  if (assignmentError) throw new Error("Não foi possível associar o acesso à loja. O convite não foi enviado.")
  const { error: auditError } = await db.from("audit_log").insert({
    tenant_id: ctx.tenant_id, action: "client_portal_invitation_requested",
    details: { client_id: clientId, auth_user_id: data.user.id, email, initiated_by: ctx.user.id },
  })
  if (auditError) throw new Error("Não foi possível registar o convite. O email não foi enviado.")
  // The fragment is never sent in HTTP URLs. Opening/scanning the page does not consume the token.
  const link = new URL("/app/ativar", config.origin)
  link.hash = new URLSearchParams({ token_hash: data.properties.hashed_token, type }).toString()
  try {
    const { error: deliveryError } = await new Resend(process.env.RESEND_API_KEY!).emails.send({
      from: config.from, to: [email], subject: "Defina a sua palavra-passe · Área do Cliente Linke",
      html: invitationEmail(store.name, link.toString()),
    })
    if (deliveryError) throw new Error("delivery-failed")
  } catch {
    // Provider responses can include sensitive request data. Never log them or the invitation URL.
    throw new Error("O serviço de email não aceitou o convite. Verifique a configuração e tente reenviar em Acesso Portal.")
  }
  return { success: true, message: "Convite enviado. O cliente pode escolher a própria palavra-passe no email." }
}
