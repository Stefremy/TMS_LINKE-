import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { PORTAL_SECTIONS } from '@/lib/client-portal/paths'
import { clientLoginPath } from '@/lib/client-portal/login-paths'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )

          // Clean up stale Supabase auth chunk cookies to prevent 494 header overflow
          const cookieNamesBeingSet = new Set(cookiesToSet.map(c => c.name))
          request.cookies.getAll().forEach(({ name }) => {
            const isChunk = /^sb-[^-]+-auth-token\.\d+$/.test(name)
            if (isChunk && !cookieNamesBeingSet.has(name)) {
              supabaseResponse.cookies.set(name, '', {
                maxAge: 0,
                path: '/',
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
              })
            }
          })
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isProtectedApp = pathname.startsWith('/app')
  const isProtectedOps = pathname.startsWith('/ops')

  // Enforce login for protected routes
  if (!user && ((isProtectedApp && pathname !== '/app/login' && pathname !== '/app/ativar') || isProtectedOps)) {
    const url = request.nextUrl.clone()
    const destination = isProtectedApp ? clientLoginPath(pathname) : '/login'
    const res = NextResponse.redirect(new URL(destination, url))
    supabaseResponse.cookies.getAll().forEach(cookie => res.cookies.set(cookie))
    return res
  }

  if (user) {
    const role = user.app_metadata?.role

    // Login pages resolve the existing session on the server using the auth context.
    if (pathname === '/login' || pathname === '/app/login' || pathname === '/app/ativar') return supabaseResponse

    // Secure Impersonation Logic
    if (role === 'employee' || role === 'admin') {
      if (isProtectedApp && pathname !== '/app/selecionar' && request.nextUrl.searchParams.has('clientId')) {
        const clientId = request.nextUrl.searchParams.get('clientId')
        const url = request.nextUrl.clone()
        const section = PORTAL_SECTIONS.find(s => pathname === `/app/${s}`)
        const topup = url.searchParams.get('topup')
        url.pathname = '/app/selecionar'
        url.search = ''
        if (clientId) url.searchParams.set('clientId', clientId)
        if (section) url.searchParams.set('section', section)
        if (topup === 'success' || topup === 'cancelled') url.searchParams.set('topup', topup)

        // The selection route validates the company/store before writing a cookie.
        const res = NextResponse.redirect(url)
        supabaseResponse.cookies.getAll().forEach(cookie => res.cookies.set(cookie))
        return res
      }

      // Clear impersonation cookie when returning to ops
      if (isProtectedOps && request.cookies.has('impersonated_client_id')) {
        supabaseResponse.cookies.delete('impersonated_client_id')
        return supabaseResponse
      }
    }

    // Restrict clients from accessing the Ops portal
    if (role === 'client' && isProtectedOps) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
