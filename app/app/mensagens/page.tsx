import { redirectLegacyPortal } from "@/lib/client-portal/access"

export default async function LegacyMensagensPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return redirectLegacyPortal("mensagens", await searchParams)
}
