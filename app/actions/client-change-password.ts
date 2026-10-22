'use server'

import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/auth/context'

export async function changeClientPasswordAction(input: {
  currentPassword: string; password: string; confirmation: string
}): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireUser()
  if (ctx.role !== 'client' || !ctx.client_id || !ctx.user?.id || !ctx.user.email) {
    return { success: false, error: 'Apenas o próprio cliente pode alterar a sua palavra-passe.' }
  }
  if (!input || typeof input.currentPassword !== 'string' || !input.currentPassword || input.currentPassword.length > 1024
    || typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128
    || input.password !== input.confirmation) {
    return { success: false, error: 'Preencha a palavra-passe atual e uma nova de 12 a 128 caracteres, igual nos dois campos.' }
  }
  if (input.currentPassword === input.password) return { success: false, error: 'Escolha uma palavra-passe diferente da atual.' }

  // Verify the password in an isolated, unprivileged session. Never replace the
  // browser's cookies or use admin.updateUserById to bypass reauthentication.
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth
  let signedIn = false
  try {
    const { data, error } = await auth.signInWithPassword({ email: ctx.user.email, password: input.currentPassword })
    signedIn = Boolean(data.session)
    if (error || !data.session || data.user?.id !== ctx.user.id) {
      return { success: false, error: 'Não foi possível confirmar a palavra-passe atual. Verifique-a e tente novamente.' }
    }
    const { data: updated, error: updateError } = await auth.updateUser({ password: input.password, current_password: input.currentPassword })
    if (updateError || updated.user?.id !== ctx.user.id) {
      return { success: false, error: 'Não foi possível alterar a palavra-passe. Tente novamente ou contacte geral@linke.pt.' }
    }
    return { success: true }
  } catch {
    return { success: false, error: 'Não foi possível alterar a palavra-passe. Tente novamente ou contacte geral@linke.pt.' }
  } finally {
    if (signedIn) {
      try { await auth.signOut({ scope: 'local' }) } catch { /* Never expose session tokens or provider errors. */ }
    }
  }
}
