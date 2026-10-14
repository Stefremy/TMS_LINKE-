import { redirectLegacyPortal } from "@/lib/client-portal/access"

export default async function LegacyPortalPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return redirectLegacyPortal("destinatarios", await searchParams)
}
