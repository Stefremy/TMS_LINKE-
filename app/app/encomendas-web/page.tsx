import { redirectLegacyPortal } from "@/lib/client-portal/access"

export default async function LegacyEncomendasWebPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return redirectLegacyPortal("encomendas-web", await searchParams)
}
