'use client'

import { useState } from 'react'
import { LockKeyhole, Loader2, CheckCircle2 } from 'lucide-react'
import { changeClientPasswordAction } from '@/app/actions/client-change-password'

export function ClientChangePasswordForm() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const data = new FormData(form)
    const input = { currentPassword: String(data.get('currentPassword') || ''), password: String(data.get('password') || ''), confirmation: String(data.get('confirmation') || '') }
    setError('')
    setSuccess(false)
    if (input.password !== input.confirmation) { setError('As duas palavras-passe novas devem ser iguais.'); return }
    setPending(true)
    try {
      const result = await changeClientPasswordAction(input)
      if (!result.success) { setError(result.error || 'Não foi possível alterar a palavra-passe.'); return }
      form.reset()
      setSuccess(true)
    } catch { setError('Não foi possível alterar a palavra-passe. Tente novamente.') }
    finally { setPending(false) }
  }

  const inputClass = 'mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2.5 text-base text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60 sm:text-sm'
  return <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><LockKeyhole className="h-4 w-4 text-[var(--accent)]" />Alterar palavra-passe</h3>
    <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">Confirme a sua palavra-passe atual para escolher uma nova. A alteração aplica-se ao seu acesso de cliente.</p>
    <form onSubmit={submit} className="mt-5 max-w-md space-y-4">
      <label className="block text-xs font-semibold text-[var(--text-secondary)]">Palavra-passe atual<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={1024} disabled={pending} className={inputClass} /></label>
      <label className="block text-xs font-semibold text-[var(--text-secondary)]">Nova palavra-passe<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={pending} className={inputClass} /><span className="mt-1.5 block text-xs font-normal">De 12 a 128 caracteres. Pode usar uma frase fácil de recordar.</span></label>
      <label className="block text-xs font-semibold text-[var(--text-secondary)]">Confirmar nova palavra-passe<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={pending} className={inputClass} /></label>
      {error && <p role="alert" className="text-xs leading-5 text-[#b13b35]">{error}</p>}
      {success && <p role="status" className="flex items-center gap-2 text-xs leading-5 text-[var(--accent)]"><CheckCircle2 className="h-4 w-4 shrink-0" />Palavra-passe alterada com sucesso. Utilize a nova palavra-passe no próximo acesso.</p>}
      <button type="submit" disabled={pending} className="flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-wait disabled:opacity-60">{pending ? <><Loader2 className="h-4 w-4 animate-spin" />A guardar…</> : 'Guardar nova palavra-passe'}</button>
    </form>
  </section>
}
