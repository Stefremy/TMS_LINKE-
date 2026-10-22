'use server'

import { revalidatePath } from 'next/cache'
import { redirect, unstable_rethrow } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { clientLoginPath, safePortalReturn } from '@/lib/client-portal/login-paths'
import { cookies } from 'next/headers'

async function discardLoginSession(supabase: Awaited<ReturnType<typeof createClient>>) {
  // Reject only this browser's new session; other client sessions remain usable.
  try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* Clear browser cookies even if the provider fails. */ }
  const cookieStore = await cookies()
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]
  const prefix = `sb-${projectRef}-auth-token`
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name === prefix || (cookie.name.startsWith(`${prefix}.`) && /^\d+$/.test(cookie.name.slice(prefix.length + 1)))) {
      cookieStore.delete(cookie.name)
    }
  }
  cookieStore.delete('impersonated_client_id')
  cookieStore.delete('portal_login_source')
}

async function authenticate(formData: FormData, portal: boolean) {
  const returnTo = portal ? safePortalReturn(formData.get('returnTo')) : undefined
  const failure = portal ? clientLoginPath(returnTo, true) : '/login?error=true'
  const email = formData.get('email')
  const password = formData.get('password')
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) redirect(failure)
  let destination = failure
  let supabase: Awaited<ReturnType<typeof createClient>> | undefined
  let authenticated = false
  try {
    supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (!error && user) {
      authenticated = true
      // A form or return URL cannot grant a role. Resolve the verified account.
      const ctx = await getAuthContext()
      if (ctx?.user.id === user.id && (ctx.role === 'client' || ctx.role === 'employee' || ctx.role === 'admin')) {
        if (ctx.role === 'client' && !portal) {
          await discardLoginSession(supabase)
          destination = '/login?error=client_portal'
        } else if (ctx.role === 'client' && !ctx.client_id) {
          await discardLoginSession(supabase)
        } else {
          destination = portal && returnTo ? returnTo : ctx.role === 'client' ? '/app' : '/ops'
          const cookieStore = await cookies()
          cookieStore.set('portal_login_source', ctx.role === 'client' || portal ? 'client' : 'ops', {
            httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
          })
          revalidatePath('/', 'layout')
        }
      } else {
        await discardLoginSession(supabase)
      }
    }
  } catch (error) {
    unstable_rethrow(error)
    // Provider failures do not reveal technical details or credentials.
    if (authenticated && supabase) {
      destination = failure
      await discardLoginSession(supabase)
    }
  }
  redirect(destination)
}

export async function login(formData: FormData) {
  return authenticate(formData, false)
}

export async function clientLogin(formData: FormData) {
  return authenticate(formData, true)
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const cookieStore = await cookies()
  const source = cookieStore.get('portal_login_source')?.value
  cookieStore.delete('impersonated_client_id')
  cookieStore.delete('portal_login_source')
  redirect(source === 'client' ? '/app/login' : '/login')
}
