import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MARKETING_HOST = 'landing.kiri.naperu.cloud'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://kiri.naperu.cloud'

function getHost(request: NextRequest) {
  return (request.headers.get('host') || '').split(':')[0].toLowerCase()
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = getHost(request)
  const isMarketingHost = host === MARKETING_HOST

  const authToken = request.cookies.get('auth-token')
  const refreshToken = request.cookies.get('refresh-token')
  const hasAnyAuth = !!(authToken?.value || refreshToken?.value)

  if (isMarketingHost) {
    return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, APP_URL), 301)
  }

  // Dashboard routes: the client will validate/refresh the session.
  if (pathname.startsWith('/dashboard')) {
    if (!hasAnyAuth) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/signup', '/dashboard/:path*', '/api/:path*', '/ws/:path*', '/health'],
}
