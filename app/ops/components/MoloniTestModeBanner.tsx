import Link from "next/link"
import { FlaskConical } from "lucide-react"
import { createAdminClient } from "@/lib/supabase/server"
import { getTenantId } from "@/lib/auth/context"
import { getActiveMoloniEnvironment } from "@/lib/moloni/connection"

/** Always-visible reminder that billing documents go to the Moloni sandbox, not the official company. */
export async function MoloniTestModeBanner() {
  let environment: "test" | "live" = "test"
  try {
    environment = await getActiveMoloniEnvironment(createAdminClient(), await getTenantId())
  } catch {
    return null
  }
  if (environment !== "test") return null
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-900">
      <span className="flex items-center gap-2">
        <FlaskConical aria-hidden="true" className="h-4 w-4 text-amber-700" />
        MODO TESTE MOLONI · as faturas emitidas vão para a conta de testes e não são documentos fiscais reais.
      </span>
      <Link href="/ops/configuracao/faturacao" className="underline underline-offset-2 hover:text-amber-950">Mudar ambiente</Link>
    </div>
  )
}
