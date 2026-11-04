import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { requireEmployee } from "@/lib/auth/context"
import { getMyProfile } from "@/lib/auth/profile"
import { getClientesAction } from "@/app/actions/clientes"
import { listMailboxMessages } from "@/lib/ops-mailbox-server"
import { getSeededMailboxMessages, MAIL_ACCOUNTS, type MailListResponse } from "@/lib/ops-mailbox"
import { MailboxClient } from "./MailboxClient"

export const metadata = { title: "Caixa de Correio (geral@linke.pt) | Linke TMS" }

export default async function OpsMailPage() {
  await requireOpsPageAccess("/ops/mail")

  const context = await requireEmployee()
  const profile = await getMyProfile()

  let initialData: MailListResponse = {
    account: "geral@linke.pt",
    accounts: MAIL_ACCOUNTS,
    messages: getSeededMailboxMessages(),
    resendConnected: Boolean(process.env.RESEND_API_KEY),
    inboundWebhookUrl: `${(process.env.CLIENT_PORTAL_ORIGIN || "https://app.toke.pt").replace(/\/$/, "")}/api/webhooks/resend`,
  }

  let contacts: { name: string; email: string; category?: string }[] = []

  try {
    const [mailData, clientes] = await Promise.all([
      listMailboxMessages(context, "geral@linke.pt"),
      getClientesAction().catch(() => []),
    ])
    initialData = mailData
    const contactMap = new Map<string, { name: string; email: string; category?: string }>()
    for (const c of clientes) {
      const label = c.short_name || c.legal_name || "Cliente"
      if (c.email && c.email.includes("@")) {
        const cleanEmail = c.email.trim()
        const key = `${cleanEmail.toLowerCase()}:${label.toLowerCase()}`
        if (!contactMap.has(key)) {
          contactMap.set(key, { name: label, email: cleanEmail, category: "Cliente" })
        }
      }
      if (
        c.billing_email &&
        c.billing_email.includes("@") &&
        c.billing_email.trim().toLowerCase() !== c.email?.trim().toLowerCase()
      ) {
        const cleanBilling = c.billing_email.trim()
        const key = `${cleanBilling.toLowerCase()}:${label.toLowerCase()}:billing`
        if (!contactMap.has(key)) {
          contactMap.set(key, {
            name: `${label} (Faturação)`,
            email: cleanBilling,
            category: "Faturação",
          })
        }
      }
    }
    contacts = [...contactMap.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-PT"))
  } catch {
    // Fallback to seeded data if DB query fails
  }

  const viewerName =
    profile?.name ||
    context.user?.user_metadata?.full_name ||
    context.user?.user_metadata?.name ||
    context.user?.email?.split("@")[0] ||
    "Equipa Linke"

  const viewerEmail = context.user?.email || "geral@linke.pt"

  return (
    <MailboxClient
      initialData={initialData}
      contacts={contacts}
      viewerName={viewerName}
      viewerEmail={viewerEmail}
    />
  )
}

