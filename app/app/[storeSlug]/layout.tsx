import type { ReactNode } from "react"
import { requirePortalStore } from "@/lib/client-portal/access"
import { ClientPortalShell } from "../components/ClientPortalShell"

export default async function StoreLayout({ children, params }: {
  children: ReactNode
  params: Promise<{ storeSlug: string }>
}) {
  const store = await requirePortalStore((await params).storeSlug)
  return <ClientPortalShell store={store}>{children}</ClientPortalShell>
}
