import { redirectLegacyPortal } from "@/lib/client-portal/access"

export default async function LegacyIntegracoesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return redirectLegacyPortal("integracoes", await searchParams)
}

