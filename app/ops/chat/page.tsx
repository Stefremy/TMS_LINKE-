import { requireEmployee } from "@/lib/auth/context"
import { readTeamChat, registerChatMember } from "@/lib/team-chat-server"
import { ChatError, type ChatPage } from "@/lib/team-chat"
import { TeamChatClient } from "./TeamChatClient"

export default async function TeamChatPage() {
  const context = await requireEmployee()
  let initial: ChatPage = { viewerId: context.user.id, members: [], channels: [], activeChannel: "geral", messages: [], hasMore: false }
  let error: string | null = null
  try {
    await registerChatMember(context)
    initial = await readTeamChat(context, null, "geral")
  } catch (failure) {
    error = failure instanceof ChatError ? failure.message : "Não foi possível abrir o chat. Tente atualizar a página."
  }
  return <TeamChatClient initial={initial} initialError={error} />
}
