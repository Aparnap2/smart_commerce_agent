import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }
  
  const role = token.role as string
  const path = req.nextUrl.pathname
  
  if (path.startsWith('/manager') && !['MANAGER', 'ADMIN'].includes(role)) {
    return NextResponse.redirect(new URL('/chat', req.url))
  }
  
  if (path.startsWith('/finance') && !['FINANCE', 'ADMIN'].includes(role)) {
    return NextResponse.redirect(new URL('/chat', req.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/manager/:path*', '/finance/:path*'],
}