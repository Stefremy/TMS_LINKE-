import type { ReactNode } from "react"
import { requirePortalStore } from "@/lib/client-portal/access"
import { readPortalAccess } from "@/lib/client-portal/suspension"
import { getTenantId } from "@/lib/auth/context"
import { ClientPortalShell } from "../components/ClientPortalShell"

export default async function StoreLayout({ children, params }: {
  children: ReactNode
  params: Promise<{ storeSlug: string }>
}) {
  const store = await requirePortalStore((await params).storeSlug)
  const tenantId = await getTenantId()
  const access = tenantId ? await readPortalAccess(tenantId, store.client.id).catch(() => null) : null

  return (
    <ClientPortalShell
      store={store}
      isSuspended={access?.suspended ?? false}
      accessStatus={access?.status ?? "active"}
    >
      {children}
    </ClientPortalShell>
  )
}
