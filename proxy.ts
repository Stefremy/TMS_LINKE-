import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { domainDestination } from '@/lib/config/public-origins'

export async function proxy(request: NextRequest) {
  const destination = domainDestination(request.url)
  if (destination) {
    // Never forward a login password or a Server Action POST across hosts.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new NextResponse('Abra o endereço correto do portal e tente novamente.', { status: 421 })
    }
    return NextResponse.redirect(destination)
  }
  if (request.nextUrl.pathname === '/') return NextResponse.next()
  return await updateSession(request)
}

export const config = {
  matcher: ['/', '/ops/:path*', '/app/:path*', '/login'],
}
