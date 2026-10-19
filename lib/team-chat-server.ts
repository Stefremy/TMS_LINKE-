import "server-only"
import { getAuthContext, type AuthContext } from "@/lib/auth/context"
import { getMyProfile } from "@/lib/auth/profile"
import { createAdminClient } from "@/lib/supabase/server"
import { CHAT_PAGE_SIZE, ChatError, type ChatMember, type ChatMessage, type ChatPage } from "@/lib/team-chat"

const MESSAGE_FIELDS = "id, sequence, sender_id, recipient_id, sender_name, sender_avatar_url, body, created_at"

export async function chatContext(expectedUserId?: string): Promise<AuthContext> {
  const context = await getAuthContext()
  if (!context?.user?.id) throw new ChatError("Inicie sessão para abrir o chat.", 401)
  if (context.role !== "admin" && context.role !== "employee") throw new ChatError("O chat é exclusivo da equipa.", 403)
  if (expectedUserId && expectedUserId !== context.user.id) throw new ChatError("A sessão mudou. Atualize a página antes de continuar.", 409)
  return context
}

function databaseError(error: { code?: string } | null) {
  if (!error) return
  if (["42P01", "PGRST205"].includes(error.code || "")) {
    throw new ChatError("O chat ainda não está preparado. Aplique a migração team_chat no Supabase.", 503)
  }
  throw new ChatError("Não foi possível aceder ao chat. Tente novamente.", 503)
}

export async function registerChatMember(context: AuthContext): Promise<ChatMember> {
  const profile = await getMyProfile()
  const metadata = context.user.user_metadata || {}
  const name = [profile?.name, metadata.full_name, metadata.name, context.user.email?.split("@")[0], "Colaborador"]
    .find(value => typeof value === "string" && value.trim()).trim().slice(0, 120)
  const rawAvatar = profile?.avatar_url || metadata.avatar
  const avatar = typeof rawAvatar === "string" && rawAvatar.length <= 500 && /^https:\/\//i.test(rawAvatar) ? rawAvatar : null
  const member: ChatMember = { user_id: context.user.id, name, avatar_url: avatar }
  const { error } = await createAdminClient().from("team_chat_members").upsert({ tenant_id: context.tenant_id, ...member }, { onConflict: "tenant_id,user_id" })
  databaseError(error)
  return member
}

export async function readTeamChat(context: AuthContext, recipient: string | null, before: number | null = null, after: number | null = null): Promise<ChatPage> {
  const admin = createAdminClient()
  const { data: membersData, error: membersError } = await admin.from("team_chat_members")
    .select("user_id, name, avatar_url").eq("tenant_id", context.tenant_id).order("name")
  databaseError(membersError)
  const members: ChatMember[] = membersData || []
  if (!members.some(member => member.user_id === context.user.id)) members.push(await registerChatMember(context))
  if (recipient && (recipient === context.user.id || !members.some(member => member.user_id === recipient))) {
    throw new ChatError("Colega não encontrado nesta equipa.", 404)
  }
  let query = admin.from("team_chat_messages").select(MESSAGE_FIELDS).eq("tenant_id", context.tenant_id)
  // Even administrators only read DMs in which they participate.
  query = recipient ? query.or(`and(sender_id.eq.${context.user.id},recipient_id.eq.${recipient}),and(sender_id.eq.${recipient},recipient_id.eq.${context.user.id})`) : query.is("recipient_id", null)
  if (before) query = query.lt("sequence", before)
  if (after) query = query.gt("sequence", after)
  const { data, error } = await query.order("sequence", { ascending: !!after }).limit(CHAT_PAGE_SIZE + 1)
  databaseError(error)
  const rows: ChatMessage[] = (data || []).slice(0, CHAT_PAGE_SIZE)
  return { viewerId: context.user.id, members, messages: after ? rows : rows.reverse(), hasMore: (data || []).length > CHAT_PAGE_SIZE }
}

export async function sendTeamChat(context: AuthContext, recipient: string | null, body: string, clientMessageId: string) {
  const admin = createAdminClient()
  const sender = await registerChatMember(context)
  if (recipient) {
    if (recipient === context.user.id) throw new ChatError("Selecione outro colega.")
    const { data, error } = await admin.from("team_chat_members").select("user_id")
      .eq("tenant_id", context.tenant_id).eq("user_id", recipient).maybeSingle()
    databaseError(error)
    if (!data) throw new ChatError("Colega não encontrado nesta equipa.", 404)
  }
  const { data, error } = await admin.from("team_chat_messages").insert({
    tenant_id: context.tenant_id, sender_id: context.user.id, recipient_id: recipient,
    sender_name: sender.name, sender_avatar_url: sender.avatar_url, body, client_message_id: clientMessageId,
  }).select(MESSAGE_FIELDS).single()
  if (error?.code === "23505") {
    const { data: existing, error: readError } = await admin.from("team_chat_messages").select(MESSAGE_FIELDS)
      .eq("tenant_id", context.tenant_id).eq("sender_id", context.user.id).eq("client_message_id", clientMessageId).maybeSingle()
    databaseError(readError)
    if (existing?.body === body && existing?.recipient_id === recipient) return existing as ChatMessage
    throw new ChatError("Este pedido já foi utilizado. Atualize a conversa.", 409)
  }
  databaseError(error)
  if (!data) throw new ChatError("Não foi possível guardar a mensagem.", 503)
  return data as ChatMessage
}
