import Link from "next/link"
import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { PERMISSION_GROUPS, PERMISSION_PRESETS } from "@/lib/auth/permissions"

export default async function PermissoesPage() {
  await requireOpsPageAccess("/ops/configuracao/permissoes")
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-xl font-bold">Mapa de acessos</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">O que cada permissão permite e sugestões para distribuir funções na equipa.</p></div>
        <Link href="/ops/entidades/colaboradores" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Gerir colaboradores</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PERMISSION_PRESETS.map(preset => <div key={preset.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4">
          <h2 className="text-sm font-bold">{preset.title}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{preset.description}</p>
          <p className="mt-3 text-xs">{preset.permissions.length} módulos · {preset.accessLevel}</p>
        </div>)}
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
        <table className="w-full text-left text-xs">
          <caption className="p-4 text-left text-sm font-bold">Módulos incluídos nas sugestões</caption>
          <thead className="bg-[var(--surface-muted)]"><tr><th scope="col" className="p-3">Módulo e acesso</th>{PERMISSION_PRESETS.map(preset => <th key={preset.id} scope="col" className="p-3 text-center">{preset.title}</th>)}<th scope="col" className="p-3 text-center">Administrador</th></tr></thead>
          <tbody>{PERMISSION_GROUPS.flatMap(group => group.items).map(item => <tr key={item.id} className="border-t border-[var(--border-subtle)]">
            <th scope="row" className="max-w-md p-3 font-normal"><span className="block font-semibold">{item.title}</span><span className="mt-1 block leading-relaxed text-[var(--text-secondary)]">{item.description}</span></th>
            {PERMISSION_PRESETS.map(preset => <td key={preset.id} className="p-3 text-center">{preset.permissions.includes(item.id) ? "Incluído" : "—"}</td>)}
            <td className="p-3 text-center">Incluído</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 text-sm"><h2 className="font-bold">Acesso comum à equipa</h2><p className="mt-2 text-[var(--text-secondary)]">Visão geral, perfil pessoal, calendário e chat estão disponíveis a todos os colaboradores ativos. O perfil Administrador gere também colaboradores, credenciais e configurações gerais.</p></div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 text-sm"><h2 className="font-bold">Sugestões de atribuição</h2><p className="mt-2 text-[var(--text-secondary)]">Comece pelo perfil da função e adicione apenas os módulos necessários. Mantenha salários, documentos e webservices separados da operação diária. Reveja os acessos sempre que a função mudar.</p></div>
      </div>
    </div>
  )
}
