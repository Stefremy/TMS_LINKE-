export const CHAT_MAX_LENGTH = 4000
export const CHAT_PAGE_SIZE = 50

export type ChatMember = { user_id: string; name: string; avatar_url: string | null }
export type ChatChannel = {
  id: string
  slug: string
  name: string
  description: string
  is_default?: boolean
  created_at?: string
  created_by?: string
}
export type ChatMessage = {
  id: string; sequence: number; sender_id: string; recipient_id: string | null
  sender_name: string; sender_avatar_url: string | null; body: string; created_at: string
  channel_slug?: string
}
export type ChatPage = {
  viewerId: string
  members: ChatMember[]
  channels: ChatChannel[]
  activeChannel: string
  messages: ChatMessage[]
  hasMore: boolean
}

export const DEFAULT_CHANNELS: ChatChannel[] = [
  { id: "geral", slug: "geral", name: "Sala geral", description: "Toda a equipa", is_default: true },
  { id: "operacoes", slug: "operacoes", name: "Operações", description: "Recolhas, trânsito e incidências" },
]

export function normalizeChannelSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "canal"
}

export class ChatError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function isChatUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function chatRecipient(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (!isChatUuid(value)) throw new ChatError("Conversa inválida.")
  return value.toLowerCase()
}

export function chatCursor(value: string | null): number | null {
  if (value === null) return null
  const number = Number(value)
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1) throw new ChatError("Página inválida.")
  return number
}

export function chatBody(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > CHAT_MAX_LENGTH || value.includes("\0")) {
    throw new ChatError(`Escreva uma mensagem com até ${CHAT_MAX_LENGTH} caracteres.`)
  }
  return value.trim()
}

export function mergeChatMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  return [...new Map([...existing, ...incoming].map(message => [message.id, message])).values()]
    .sort((a, b) => a.sequence - b.sequence)
}
