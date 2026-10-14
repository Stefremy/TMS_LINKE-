import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/server"
import { LINKE_TENANT_ID } from "@/lib/auth/context"
import { assertBoundClient, assertClientEmail, loadInvitationStore, normalizeInvitationEmail, validPasswordSetup } from "@/lib/client-portal/invitations"

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
const invalid = () => Response.json({ error: "Este convite é inválido ou expirou. Peça um novo convite à equipa Linke." }, { status: 400, headers })

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin
    || !request.headers.get("content-type")?.startsWith("application/json")
    || Number(request.headers.get("content-length")) > 4096) return invalid()
  let input: unknown
  try {
    const raw = await request.text()
    if (raw.length > 4096) return invalid()
    input = JSON.parse(raw)
  } catch { return invalid() }
  if (!validPasswordSetup(input)) return Response.json({ error: "Use o link do convite e uma palavra-passe de 12 a 128 caracteres, igual nos dois campos." }, { status: 400, headers })

  // An isolated anonymous client verifies the email token. No browser/administrator
  // session is replaced, and no privileged service key is used to change passwords.
  let auth: ReturnType<typeof createSupabaseClient>["auth"] | undefined
  let verified = false
  try {
    auth = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }).auth
    const { data, error } = await auth.verifyOtp({ token_hash: input.token_hash, type: input.type })
    if (error || !data.user || !data.session) return invalid()
    verified = true
    const { data: fresh, error: userError } = await auth.getUser()
    const user = fresh.user
    if (userError || !user || user.id !== data.user.id || !user.email
      || typeof user.app_metadata.client_id !== "string" || user.app_metadata.tenant_id !== LINKE_TENANT_ID) return invalid()
    assertBoundClient(user, user.app_metadata.client_id, LINKE_TENANT_ID)
    const db = createAdminClient()
    await assertClientEmail(db, normalizeInvitationEmail(user.email))
    await loadInvitationStore(db, user.app_metadata.client_id, LINKE_TENANT_ID)
    const { error: passwordError } = await auth.updateUser({ password: input.password })
    if (passwordError) return Response.json({ error: "Não foi possível guardar esta palavra-passe. Peça um novo convite e escolha outra palavra-passe." }, { status: 400, headers })
    return Response.json({ success: true }, { headers })
  } catch { return invalid() }
  finally {
    if (verified && auth) {
      try { await auth.signOut({ scope: "local" }) } catch { /* Never expose the temporary session. */ }
    }
  }
}
