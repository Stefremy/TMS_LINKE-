import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getAuthContext } from "@/lib/auth/context"
import { safePortalReturn } from "@/lib/client-portal/login-paths"
import { ClientLoginForm } from "./ClientLoginForm"

export const metadata: Metadata = { title: "Área do Cliente | Linke", robots: { index: false, follow: false } }

export default async function ClientLoginPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const returnTo = safePortalReturn(params.next)
  const ctx = await getAuthContext()
  if (ctx?.role === "client") redirect(returnTo || "/app")
  if ((ctx?.role === "employee" || ctx?.role === "admin") && params.preview !== "true") redirect(returnTo || "/ops")
  return <ClientLoginForm returnTo={returnTo} isError={params.error === "true"} />
}
