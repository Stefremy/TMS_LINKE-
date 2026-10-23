export type MessageKind = 'info' | 'invoice' | 'payment' | 'incident' | 'weight'
export type MessageSection = 'faturas' | 'carregamentos' | 'envios' | null
export type ClientMessage = {
  id: string; kind: MessageKind; title: string; body: string; section: MessageSection;
  reference: string | null; created_at: string; read_at: string | null
}
export type MessageCursor = { at: string; id: string }
export type MessagePage = { messages: ClientMessage[]; unreadCount: number; next: MessageCursor | null }
export class ClientMessageError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export function messageUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)
}
export function messageText(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || value.includes('\0')) throw new ClientMessageError(`Preencha o texto com até ${max} caracteres.`)
  return value.trim()
}
export function messageLink(base: string, section: MessageSection) {
  return section && ['envios', 'faturas', 'carregamentos'].includes(section) ? `${base}/${section}` : null
}
export function canSendClientMessages(ctx: { role: string | null; permissions: string[] } | null) {
  return !!ctx && (ctx.role === 'admin' || ctx.role === 'employee' &&
    ctx.permissions.some(p => ['Gestão de Clientes & Contratos', 'Acesso Total (Super-Admin)'].includes(p)))
}
