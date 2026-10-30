import { redirectLegacyPortal } from '@/lib/client-portal/access'
export default async function LegacyReembolsos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return redirectLegacyPortal('reembolsos', await searchParams)
}
