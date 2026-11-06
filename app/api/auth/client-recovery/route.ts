import { createHash } from "node:crypto"
import type { User } from "@supabase/supabase-js"
import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/server"
import { LINKE_TENANT_ID } from "@/lib/auth/context"
import { assertBoundClient, assertClientEmail, invitationConfig, loadInvitationStore, normalizeInvitationEmail } from "@/lib/client-portal/invitations"

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
const message = "Se existir uma conta de cliente com este email, receberá um link para definir uma nova palavra-passe. Verifique também a pasta de spam."

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin
    || !request.headers.get("content-type")?.startsWith("application/json")
    || Number(request.headers.get("content-length")) > 1024) {
    return Response.json({ error: "Pedido inválido." }, { status: 400, headers })
  }
  let email: string
  try {
    const raw = await request.text()
    if (raw.length > 1024) throw new Error("Invalid body")
    email = normalizeInvitationEmail(JSON.parse(raw).email)
  } catch {
    return Response.json({ error: "Indique um email válido." }, { status: 400, headers })
  }
  try {
    const config = invitationConfig()
    const db = createAdminClient()
    // A database uniqueness claim limits recovery attempts across server instances.
    // Store a fingerprint, never the address or recovery token, in the audit log.
    const fingerprint = createHash("sha256").update(email).digest("hex")
    const bucket = Math.floor(Date.now() / 600_000)
    const digest = createHash("sha256").update(`client-recovery:${LINKE_TENANT_ID}:${fingerprint}:${bucket}`).digest("hex")
    const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`
    const { error: claimError } = await db.from("audit_log").insert({
      id, tenant_id: LINKE_TENANT_ID, action: "client_password_recovery_requested", details: { fingerprint, bucket },
    })
    if (claimError) return Response.json({ message }, { headers })

    // Inspect an existing identity before generating a link. This endpoint never
    // provisions accounts or changes roles, store associations or passwords.
    let account: User | undefined
    for (let page = 1; ; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw new Error("Account lookup failed")
      account = data.users.find((user: User) => user.email?.toLowerCase() === email)
      if (account || data.users.length < 1000) break
    }
    if (!account || typeof account.app_metadata.client_id !== "string"
      || account.app_metadata.tenant_id !== LINKE_TENANT_ID) return Response.json({ message }, { headers })
    const clientId = account.app_metadata.client_id
    assertBoundClient(account, clientId, LINKE_TENANT_ID)
    await assertClientEmail(db, email)
    await loadInvitationStore(db, clientId, LINKE_TENANT_ID)
    const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email })
    if (error || !data?.user || data.user.id !== account.id || !data.properties?.hashed_token
      || data.properties.verification_type !== "recovery") throw new Error("Recovery link failed")
    assertBoundClient(data.user, clientId, LINKE_TENANT_ID)
    const link = new URL("/app/ativar", config.origin)
    link.hash = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "recovery" }).toString()
    const { error: deliveryError } = await new Resend(process.env.RESEND_API_KEY!).emails.send({
      from: config.from, to: [email], subject: "Recuperar palavra-passe · Área do Cliente Linke",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a3028;padding:32px"><h1>Recuperar palavra-passe</h1><p>Recebemos um pedido para definir uma nova palavra-passe na Área do Cliente Linke.</p><p><a href="${link.toString().replace(/&/g, "&amp;")}">Definir nova palavra-passe</a></p><p>Este link é pessoal, tem validade limitada e só pode ser utilizado uma vez. A palavra-passe atual continua válida até guardar uma nova.</p><p>Se não fez este pedido, ignore este email.</p></div>`,
    })
    if (deliveryError) throw new Error("Recovery delivery failed")
  } catch {
    // Do not reveal whether the address exists, belongs to staff or is inactive.
    console.warn("Client password recovery could not be completed.")
  }
  return Response.json({ message }, { headers })
}
