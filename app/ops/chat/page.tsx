import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { requireEmployee } from "@/lib/auth/context"
import { readTeamChat, readTeamChatInbox, registerChatMember } from "@/lib/team-chat-server"
import { ChatError, type ChatInboxItem, type ChatPage } from "@/lib/team-chat"
import { TeamChatClient } from "./TeamChatClient"

export default async function TeamChatPage() {
  await requireOpsPageAccess("/ops/chat")

  const context = await requireEmployee()
  let initial: ChatPage = { viewerId: context.user.id, members: [], channels: [], activeChannel: "geral", messages: [], hasMore: false }
  let error: string | null = null
  let inbox: ChatInboxItem[] = []
  try {
    await registerChatMember(context)
    const [page, items] = await Promise.all([readTeamChat(context, null, "geral"), readTeamChatInbox(context)])
    initial = page
    inbox = items
  } catch (failure) {
    error = failure instanceof ChatError ? failure.message : "Não foi possível abrir o chat. Tente atualizar a página."
  }
  return <TeamChatClient initial={initial} initialError={error} initialInbox={inbox} />
}
