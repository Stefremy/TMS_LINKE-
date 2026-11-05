import "server-only"
import { getAuthContext, type AuthContext } from "@/lib/auth/context"
import { getChatStaffAvatars, getChatStaffMembers } from "@/lib/team-chat-avatars"
import { getMyProfile } from "@/lib/auth/profile"
import { createAdminClient } from "@/lib/supabase/server"
import { CHAT_PAGE_SIZE, ChatError, DEFAULT_CHANNELS, normalizeChannelSlug, type ChatChannel, type ChatInboxItem, type ChatMember, type ChatNotification, type ChatMessage, type ChatPage } from "@/lib/team-chat"

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

export async function listTeamChatChannels(tenantId: string): Promise<ChatChannel[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from("audit_log")
    .select("details")
    .eq("tenant_id", tenantId)
    .eq("action", "team_chat_channel")
    .order("created_at", { ascending: true })

  const customChannels: ChatChannel[] = []
  if (!error && Array.isArray(data)) {
    for (const row of data) {
      if (row.details && typeof row.details === "object") {
        const d = row.details as Partial<ChatChannel>
        if (d.slug && d.name) {
          customChannels.push({
            id: d.id || d.slug,
            slug: d.slug,
            name: d.name,
            description: d.description || "",
            is_default: false,
            created_at: d.created_at,
            created_by: d.created_by,
          })
        }
      }
    }
  }

  // Combine default channels with custom channels, avoiding duplicate slugs
  const channelMap = new Map<string, ChatChannel>()
  for (const ch of DEFAULT_CHANNELS) channelMap.set(ch.slug, ch)
  for (const ch of customChannels) channelMap.set(ch.slug, ch)
  return Array.from(channelMap.values())
}

export async function createTeamChatChannel(context: AuthContext, name: string, description: string): Promise<ChatChannel> {
  const cleanName = name?.trim() || ""
  if (cleanName.length < 2 || cleanName.length > 80) {
    throw new ChatError("O nome do canal deve ter entre 2 e 80 caracteres.")
  }
  const cleanDesc = (description || "").trim().slice(0, 250)
  const slug = normalizeChannelSlug(cleanName)
  if (!slug) throw new ChatError("Nome de canal inválido.")

  const channels = await listTeamChatChannels(context.tenant_id)
  if (channels.some(c => c.slug === slug || c.name.toLowerCase() === cleanName.toLowerCase())) {
    throw new ChatError("Já existe um canal com esse nome ou identificador.")
  }

  const channel: ChatChannel = {
    id: crypto.randomUUID(),
    slug,
    name: cleanName,
    description: cleanDesc,
    is_default: false,
    created_at: new Date().toISOString(),
    created_by: context.user.id,
  }

  const admin = createAdminClient()
  const { error } = await admin.from("audit_log").insert({
    tenant_id: context.tenant_id,
    user_id: context.user.id,
    action: "team_chat_channel",
    details: channel,
  })
  if (error) throw new ChatError("Não foi possível criar o canal. Tente novamente.")
  return channel
}

export async function registerChatMember(context: AuthContext): Promise<ChatMember> {
  const profile = await getMyProfile()
  const metadata = context.user.user_metadata || {}
  const name = [profile?.name, metadata.full_name, metadata.name, context.user.email?.split("@")[0], "Colaborador"]
    .find(value => typeof value === "string" && value.trim()).trim().slice(0, 120)
  const staffAvatars = await getChatStaffAvatars(context.tenant_id)
  const rawAvatar = staffAvatars.has(context.user.id) ? staffAvatars.get(context.user.id) : profile?.avatar_url || metadata.avatar
  const avatar = typeof rawAvatar === "string" && rawAvatar.length <= 500 && /^https:\/\//i.test(rawAvatar) ? rawAvatar : null
  const member: ChatMember = { user_id: context.user.id, name, avatar_url: avatar }
  const { error } = await createAdminClient().from("team_chat_members").upsert({ tenant_id: context.tenant_id, ...member }, { onConflict: "tenant_id,user_id" })
  databaseError(error)
  return member
}

function parseMessageBody(rawBody: string): { cleanBody: string; channelSlug: string } {
  const match = rawBody.match(/^\[c:([a-z0-9_-]+)\]\s*([\s\S]*)$/)
  if (match) {
    return { cleanBody: match[2], channelSlug: match[1] }
  }
  return { cleanBody: rawBody, channelSlug: "geral" }
}

export async function readTeamChat(
  context: AuthContext,
  recipient: string | null,
  channelSlug: string | null = "geral",
  before: number | null = null,
  after: number | null = null
): Promise<ChatPage> {
  const admin = createAdminClient()
  const [membersData, channels, staff] = await Promise.all([
    admin.from("team_chat_members").select("user_id, name, avatar_url").eq("tenant_id", context.tenant_id).order("name"),
    listTeamChatChannels(context.tenant_id),
    getChatStaffMembers(context.tenant_id),
  ])
  databaseError(membersData.error)
  const avatars = new Map([...staff].map(([id, member]) => [id, member.avatar_url]))
  const memberMap = new Map<string, ChatMember>((membersData.data || []).map((member: ChatMember) => [member.user_id, {
    ...member, avatar_url: avatars.has(member.user_id) ? avatars.get(member.user_id)! : member.avatar_url,
  }]))
  for (const [id, member] of staff) memberMap.set(id, member)
  const members = [...memberMap.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-PT"))
  if (!members.some(member => member.user_id === context.user.id)) members.push(await registerChatMember(context))
  if (recipient && (recipient === context.user.id || !members.some(member => member.user_id === recipient))) {
    throw new ChatError("Colega não encontrado nesta equipa.", 404)
  }

  const activeChannel = recipient ? "" : (channelSlug || "geral")
  let query = admin.from("team_chat_messages").select(MESSAGE_FIELDS).eq("tenant_id", context.tenant_id)

  if (recipient) {
    // Private 1-on-1 direct message
    query = query.or(`and(sender_id.eq.${context.user.id},recipient_id.eq.${recipient}),and(sender_id.eq.${recipient},recipient_id.eq.${context.user.id})`)
  } else {
    // Public room/channel messages
    query = query.is("recipient_id", null)
    if (activeChannel && activeChannel !== "geral") {
      query = query.like("body", `[c:${activeChannel}]%`)
    } else {
      query = query.not("body", "like", "[c:%")
    }
  }

  if (before) query = query.lt("sequence", before)
  if (after) query = query.gt("sequence", after)
  const { data, error } = await query.order("sequence", { ascending: !!after }).limit(CHAT_PAGE_SIZE + 1)
  databaseError(error)

  const rows: ChatMessage[] = (data || []).slice(0, CHAT_PAGE_SIZE).map((row: ChatMessage) => {
    const { cleanBody, channelSlug: foundChannel } = parseMessageBody(row.body)
    return {
      ...row,
      body: cleanBody,
      sender_avatar_url: avatars.has(row.sender_id) ? avatars.get(row.sender_id)! : row.sender_avatar_url,
      channel_slug: foundChannel,
    }
  })

  return {
    viewerId: context.user.id,
    members,
    channels,
    activeChannel,
    messages: after ? rows : rows.reverse(),
    hasMore: (data || []).length > CHAT_PAGE_SIZE,
  }
}

/** Returns one private-safe latest-message preview for every channel and staff DM. */
export async function readTeamChatInbox(context: AuthContext): Promise<ChatInboxItem[]> {
  const admin = createAdminClient()
  const [messageResult, memberResult, channels, staff] = await Promise.all([
    admin.from("team_chat_messages").select(MESSAGE_FIELDS).eq("tenant_id", context.tenant_id)
      .order("sequence", { ascending: false }).limit(1000),
    admin.from("team_chat_members").select("user_id, name, avatar_url").eq("tenant_id", context.tenant_id),
    listTeamChatChannels(context.tenant_id),
    getChatStaffMembers(context.tenant_id),
  ])
  databaseError(messageResult.error)
  databaseError(memberResult.error)
  const members = new Map<string, ChatMember>((memberResult.data || []).map((member: ChatMember) => [member.user_id, member]))
  for (const [id, member] of staff) members.set(id, member)
  const channelMap = new Map(channels.map(channel => [channel.slug, channel]))
  const items = new Map<string, ChatInboxItem>()
  const itemSequences = new Map<string, number[]>()
  for (const row of (messageResult.data || []) as ChatMessage[]) {
    let key: string, kind: ChatInboxItem["kind"], title: string, subtitle: string, avatar_url: string | null
    let body = row.body
    if (row.recipient_id) {
      if (row.sender_id !== context.user.id && row.recipient_id !== context.user.id) continue
      const peerId = row.sender_id === context.user.id ? row.recipient_id : row.sender_id
      const peer = members.get(peerId)
      if (!peer) continue
      key = `dm_${peerId}`; kind = "dm"; title = peer.name; subtitle = "Conversa privada"; avatar_url = peer.avatar_url
    } else {
      const parsed = parseMessageBody(body)
      const channel = channelMap.get(parsed.channelSlug)
      if (!channel) continue
      key = `ch_${channel.slug}`; kind = "channel"; title = channel.name; subtitle = channel.description || "Canal da equipa"; avatar_url = null
      body = parsed.cleanBody
    }
    const seqList = itemSequences.get(key) || []
    seqList.push(row.sequence)
    itemSequences.set(key, seqList)
    if (items.has(key)) continue
    let preview: string
    if (/^\[gif:https?:\/\//i.test(body)) {
      preview = "GIF"
    } else if (/^\[call:video:/i.test(body)) {
      preview = "Videochamada"
    } else if (/^\[call:audio:/i.test(body)) {
      preview = "Chamada de voz"
    } else if (/^\[file:https?:\/\//i.test(body)) {
      const nameMatch = body.match(/^\[file:https?:\/\/[^|\s\]]+\|([^|\]]+)\|/i)
      preview = nameMatch ? `Anexo: ${nameMatch[1].trim()}` : "Anexo"
    } else {
      preview = body.slice(0, 300)
    }
    items.set(key, { key, kind, title, subtitle, avatar_url, preview, sender_name: row.sender_name, created_at: row.created_at, sequence: row.sequence })
  }
  for (const [key, item] of items) {
    item.sequences = itemSequences.get(key) || [item.sequence]
  }
  for (const channel of channels) {
    const key = `ch_${channel.slug}`
    if (!items.has(key)) items.set(key, { key, kind: "channel", title: channel.name, subtitle: channel.description || "Canal da equipa", avatar_url: null, preview: "Sem mensagens", sender_name: null, created_at: null, sequence: 0, sequences: [] })
  }
  for (const [id, person] of staff) {
    if (id === context.user.id) continue
    const key = `dm_${id}`
    if (!items.has(key)) items.set(key, { key, kind: "dm", title: person.name, subtitle: "Conversa privada", avatar_url: person.avatar_url, preview: "Iniciar conversa", sender_name: null, created_at: null, sequence: 0, sequences: [] })
  }
  return [...items.values()].sort((a, b) => (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0) || a.title.localeCompare(b.title, "pt-PT"))
}

export async function sendTeamChat(
  context: AuthContext,
  recipient: string | null,
  channelSlug: string | null,
  body: string,
  clientMessageId: string
): Promise<ChatMessage> {
  const admin = createAdminClient()
  const sender = await registerChatMember(context)
  if (recipient) {
    if (recipient === context.user.id) throw new ChatError("Selecione outro colega.")
    if (!(await getChatStaffMembers(context.tenant_id)).has(recipient)) {
      throw new ChatError("Colega não encontrado nesta equipa.", 404)
    }
  }

  const effectiveChannel = !recipient ? (channelSlug || "geral") : null
  const bodyToSend = effectiveChannel && effectiveChannel !== "geral" ? `[c:${effectiveChannel}] ${body}` : body

  const { data, error } = await admin.from("team_chat_messages").insert({
    tenant_id: context.tenant_id,
    sender_id: context.user.id,
    recipient_id: recipient,
    sender_name: sender.name,
    sender_avatar_url: sender.avatar_url,
    body: bodyToSend,
    client_message_id: clientMessageId,
  }).select(MESSAGE_FIELDS).single()

  if (error?.code === "23505") {
    const { data: existing, error: readError } = await admin.from("team_chat_messages").select(MESSAGE_FIELDS)
      .eq("tenant_id", context.tenant_id).eq("sender_id", context.user.id).eq("client_message_id", clientMessageId).maybeSingle()
    databaseError(readError)
    if (existing?.body === bodyToSend && existing?.recipient_id === recipient) {
      const { cleanBody, channelSlug: ch } = parseMessageBody(existing.body)
      return { ...existing, body: cleanBody, channel_slug: ch } as ChatMessage
    }
    throw new ChatError("Este pedido já foi utilizado. Atualize a conversa.", 409)
  }
  databaseError(error)
  if (!data) throw new ChatError("Não foi possível guardar a mensagem.", 503)

  const { cleanBody, channelSlug: ch } = parseMessageBody(data.body)
  return { ...data, body: cleanBody, channel_slug: ch } as ChatMessage
}



function notificationPreview(body: string): string {
  if (/^\[gif:https?:\/\//i.test(body)) return "Enviou um GIF"
  if (/^\[call:video:/i.test(body)) return "Videochamada"
  if (/^\[call:audio:/i.test(body)) return "Chamada de voz"
  if (/^\[file:https?:\/\//i.test(body)) {
    const name = body.match(/^\[file:https?:\/\/[^|\s\]]+\|([^|\]]+)\|/i)
    return name ? `Anexo: ${name[1].trim()}` : "Enviou um anexo"
  }
  return body.slice(0, 140)
}

/**
 * Lightweight feed for the global top-of-page toasts: only messages from
 * colleagues that this viewer may read. Without a cursor it just returns the
 * latest sequence so the client can start from "now" without replaying history.
 */
export async function readTeamChatNotifications(context: AuthContext, after: number | null): Promise<{ latestSequence: number; items: ChatNotification[] }> {
  const admin = createAdminClient()
  if (after === null) {
    const { data, error } = await admin.from("team_chat_messages").select("sequence").eq("tenant_id", context.tenant_id)
      .order("sequence", { ascending: false }).limit(1)
    databaseError(error)
    return { latestSequence: (data?.[0] as { sequence: number } | undefined)?.sequence || 0, items: [] }
  }
  const { data, error } = await admin.from("team_chat_messages").select(MESSAGE_FIELDS).eq("tenant_id", context.tenant_id)
    .gt("sequence", after).order("sequence", { ascending: true }).limit(30)
  databaseError(error)
  const rows = (data || []) as ChatMessage[]
  let latestSequence = after
  const staff = rows.length ? await getChatStaffMembers(context.tenant_id) : new Map<string, ChatMember>()
  const channels = rows.some(row => !row.recipient_id) ? await listTeamChatChannels(context.tenant_id) : []
  const channelNames = new Map(channels.map(channel => [channel.slug, channel.name]))
  const items: ChatNotification[] = []
  for (const row of rows) {
    latestSequence = Math.max(latestSequence, row.sequence)
    if (row.sender_id === context.user.id) continue
    if (row.recipient_id && row.recipient_id !== context.user.id) continue
    const parsed = parseMessageBody(row.body)
    const staffMember = staff.get(row.sender_id)
    const base = { id: row.id, sequence: row.sequence, sender_id: row.sender_id, sender_name: staffMember?.name || row.sender_name,
      sender_avatar_url: staffMember ? staffMember.avatar_url : row.sender_avatar_url, preview: notificationPreview(parsed.cleanBody), created_at: row.created_at }
    if (row.recipient_id) items.push({ ...base, key: `dm_${row.sender_id}`, kind: "dm", title: base.sender_name })
    else items.push({ ...base, key: `ch_${parsed.channelSlug}`, kind: "channel", title: channelNames.get(parsed.channelSlug) || parsed.channelSlug })
  }
  return { latestSequence, items }
}
