import Link from "next/link"
import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"

export default async function SemAcessoPage() {
  await requireOpsPageAccess("/ops/sem-acesso")
  return (
    <div className="mx-auto my-12 max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-8">
      <h1 className="text-xl font-bold">Sem acesso a este módulo</h1>
      <p className="mt-3 text-sm text-[var(--text-secondary)]">Peça a um administrador para rever os seus módulos em Colaboradores → Acesso e credenciais.</p>
      <Link href="/ops" className="mt-6 inline-block font-semibold text-[var(--accent)]">Voltar à visão geral</Link>
    </div>
  )
}
