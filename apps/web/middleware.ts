import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  
  // Public paths that don't require auth
  const publicPaths = ['/auth/login', '/auth/signup', '/auth/forgot-password', '/api/auth', '/_next', '/favicon.ico']
  if (publicPaths.some(p => path.startsWith(p))) {
    return NextResponse.next()
  }
  
  // Check for custom JWT auth cookie (set by /api/auth/login)
  const cookieHeader = req.headers.get('cookie') || ''
  const hasAuthCookie = cookieHeader.includes('token=')
  
  // Debug logging (remove in production)
  console.log('[Middleware] Path:', path, '| Has token cookie:', hasAuthCookie, '| Cookie:', cookieHeader.slice(0, 100))
  
  if (!hasAuthCookie) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/chat/:path*', '/manager/:path*', '/finance/:path*', '/admin/:path*'],
}