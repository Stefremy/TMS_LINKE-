import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { loadCommunicationsConfig, maskConfigSecrets } from "@/lib/services/communications/config"
import { WhatsappCommunicationsClient } from "./WhatsappCommunicationsClient"

export const dynamic = "force-dynamic"

export default async function WhatsappCommunicationsPage() {
  await requireOpsPageAccess("/ops/comunicacoes/whatsapp")
  const rawConfig = await loadCommunicationsConfig()
  const initialConfig = maskConfigSecrets(rawConfig)

  return <WhatsappCommunicationsClient initialConfig={initialConfig} />
}
