import * as React from "react"
import type { ClientMessage, MessageCursor } from "@/lib/client-messages/types"
import { requirePortalStore } from "@/lib/client-portal/access"
import { ClientInbox } from "../../components/ClientInbox"
import { listClientMessages } from "@/lib/client-messages/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/auth/context"

export const dynamic = "force-dynamic"

export default async function MensagensPage({
  params
}: {
  params: Promise<{ storeSlug: string }>
}) {
  const { storeSlug } = await params
  const { client: targetClient } = await requirePortalStore(storeSlug)
  const ctx = await getAuthContext()

  let initialMessages: ClientMessage[] = []
  let initialNext: MessageCursor | null = null
  let initialError = ""
  let initialUnreadCount = 0

  if (targetClient?.id) {
    try {
      const page = await listClientMessages(createAdminClient(), ctx, targetClient.id, new URLSearchParams())
      initialMessages = page.messages || []
      initialNext = page.next
      initialUnreadCount = typeof page.unreadCount === "number" ? page.unreadCount : 0
    } catch {
      initialError = "Não foi possível carregar as mensagens. Tente atualizar."
      initialMessages = []
      initialUnreadCount = 0
    }
  }

  return (
    <div className="p-4 sm:p-8">
      <ClientInbox initialMessages={initialMessages} initialUnreadCount={initialUnreadCount} initialNext={initialNext} initialError={initialError} />
    </div>
  )
}
