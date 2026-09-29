import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
              supabaseResponse.cookies.delete(name)
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
  if (!user && (isProtectedApp || isProtectedOps)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    const role = user.app_metadata?.role

    // Redirect away from login page if already logged in
    if (pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = role === 'client' ? '/app' : '/ops'
      return NextResponse.redirect(url)
    }

    // Secure Impersonation Logic
    if (role === 'employee' || role === 'admin') {
      if (isProtectedApp && pathname !== '/app/selecionar' && request.nextUrl.searchParams.has('clientId')) {
        const clientId = request.nextUrl.searchParams.get('clientId')
        const url = request.nextUrl.clone()
        url.searchParams.delete('clientId') // Remove sensitive param from URL
        url.searchParams.delete('clientName')
        
        const res = NextResponse.redirect(url)
        if (clientId) {
          res.cookies.set('impersonated_client_id', clientId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
          })
        }
        return res
      }

      // Clear impersonation cookie when returning to ops
      if (isProtectedOps && request.cookies.has('impersonated_client_id')) {
        const res = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })
        res.cookies.delete('impersonated_client_id')
        return res
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
