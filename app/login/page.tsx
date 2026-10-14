import { redirect } from "next/navigation"
import { getAuthContext } from "@/lib/auth/context"
import OpsLoginForm from "./OpsLoginForm"

export default async function OpsLoginPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const ctx = await getAuthContext()
  if (ctx?.role === "client") redirect("/app")
  // Staff can review the generic form without logging out; this grants no access.
  if ((ctx?.role === "employee" || ctx?.role === "admin") && params.preview !== "true") redirect("/ops")
  return <OpsLoginForm />
}
