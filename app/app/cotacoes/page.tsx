import { redirectLegacyPortal } from "@/lib/client-portal/access"

export default async function LegacyQuotationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return redirectLegacyPortal("cotacoes", await searchParams)
}
