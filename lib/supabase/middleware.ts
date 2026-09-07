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

  if (!user && (pathname.startsWith('/ops') || pathname.startsWith('/app'))) {
    // no user, potentially respond by redirecting the user to the login page
    // const url = request.nextUrl.clone()
    // url.pathname = '/login'
    // return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    // Already logged in, redirect to ops or app depending on what they are
    // For Phase 1 we will just redirect to /ops if they go to login while logged in
    const url = request.nextUrl.clone()
    url.pathname = '/ops'
    return NextResponse.redirect(url)
  }

  // Phase 1 Rules:
  // If user is accessing /ops but they are a client -> redirect to /app
  // If user is accessing /app but they are staff without active_tenant_id -> stay on /app or redirect back to /ops?
  // We can enforce those deeper role checks via DB queries here if we want,
  // but usually it's better to protect components or layout by fetching the membership.

  return supabaseResponse
}
