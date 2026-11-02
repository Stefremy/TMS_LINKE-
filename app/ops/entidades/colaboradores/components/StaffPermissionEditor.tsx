"use client"

import { PERMISSION_GROUPS, PERMISSION_PRESETS, PERMISSIONS, type StaffAccessLevel } from "@/lib/auth/permissions"

type Props = {
  level: StaffAccessLevel
  permissions: string[]
  email?: string
  onChange: (level: StaffAccessLevel, permissions: string[]) => void
}

export function StaffPermissionEditor({ level, permissions, email, onChange }: Props) {
  const admin = level === "Administrador"
  const known = PERMISSION_GROUPS.flatMap(group => group.items.map(item => item.id)) as string[]
  const unknown = permissions.filter(p => p !== PERMISSIONS.all && !known.includes(p))
  const normalizedEmail = email?.trim().toLowerCase()
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-xs font-semibold">Perfil de acesso</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["Administrador", "Operacional", "Comercial / Suporte"] as const).map(value => (
            <label key={value} className={`cursor-pointer rounded-xl border p-3 text-xs font-semibold ${level === value ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-subtle)]"}`}>
              <input type="radio" name="staff-access-level" checked={level === value} onChange={() => onChange(value,
                value === "Administrador" ? [PERMISSIONS.all]
                  : admin ? [...PERMISSION_PRESETS[value === "Operacional" ? 0 : 1].permissions]
                  : permissions.filter(p => p !== PERMISSIONS.all),
              )} className="mr-2 accent-[var(--accent)]" />
              {value}
            </label>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-secondary)]">Administrador tem acesso a todos os módulos e gere colaboradores e credenciais. Nos restantes perfis, o acesso depende dos módulos selecionados abaixo.</p>
      </fieldset>

      <div>
        <p className="mb-2 text-xs font-semibold">Sugestões por função</p>
        <div className="grid grid-cols-2 gap-2">
          {PERMISSION_PRESETS.map(preset => (
            <button key={preset.id} type="button" onClick={() => onChange(preset.accessLevel, [...preset.permissions])}
              className="rounded-xl border border-[var(--border-subtle)] p-3 text-left hover:border-[var(--accent)] hover:bg-[var(--surface-muted)]">
              <span className="block text-xs font-semibold">{preset.title}</span>
              <span className="mt-1 block text-[11px] text-[var(--text-secondary)]">{preset.description}</span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Ao aplicar uma sugestão, a seleção atual é substituída. Pode personalizar antes de guardar.</p>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-xs" role="status">
        {admin ? "Acesso total. As permissões individuais não limitam o perfil Administrador."
          : `${known.filter(p => permissions.includes(p)).length} de ${known.length} módulos selecionados. Visão geral, perfil, calendário e chat da equipa estão disponíveis a todos os colaboradores ativos.`}
      </div>
      {PERMISSION_GROUPS.map(group => (
        <fieldset key={group.title} className="rounded-xl border border-[var(--border-subtle)] p-3">
          <legend className="px-1 text-xs font-bold">{group.title}</legend>
          <div className="space-y-1">
            {group.items.map(item => (
              <label key={item.id} className={`flex items-start gap-3 rounded-lg p-2 ${admin ? "opacity-75" : "cursor-pointer hover:bg-[var(--surface-muted)]"}`}>
                <input type="checkbox" checked={admin || permissions.includes(item.id)} disabled={admin}
                  onChange={() => onChange(level, permissions.includes(item.id) ? permissions.filter(p => p !== item.id) : [...permissions, item.id])}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
                <span><span className="block text-xs font-semibold">{item.title}</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-[var(--text-secondary)]">{item.description}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {normalizedEmail === "geral@linke.pt" && <p className="text-[11px] text-[var(--text-secondary)]">A conta de direção mantém também o acesso existente aos documentos internos.</p>}
      {["clientes@linke.pt", "aldara.linke@gmail.com"].includes(normalizedEmail || "") && <p className="text-[11px] text-[var(--text-secondary)]">Esta conta mantém também a autorização existente para enviar emails de acesso ao cliente.</p>}
      {unknown.length > 0 && <div className="rounded-xl border border-amber-300 p-3 text-xs">
        <p className="font-semibold">Permissões antigas sem módulo associado</p>
        <p className="mt-1 text-[var(--text-secondary)]">Remova estas entradas e selecione os módulos equivalentes antes de guardar.</p>
        {unknown.map(permission => <button key={permission} type="button" onClick={() => onChange(level, permissions.filter(p => p !== permission))} className="mt-2 block underline">Remover: {permission}</button>)}
      </div>}
    </div>
  )
}
