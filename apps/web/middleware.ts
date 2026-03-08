/**
 * Auth Middleware - Protects routes requiring authentication
 * 
 * Uses custom JWT (not Supabase) for authentication.
 * Validates tokens and sets user context headers.
 */

import { verifyToken } from '@/lib/auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED_PAGES = ['/dashboard', '/settings', '/profile'];
const PROTECTED_API = ['/api/protected'];
// Public API routes (no auth required) - for demo/testing
const PUBLIC_API = ['/api/agent'];

/**
 * Middleware handler
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public API routes without auth
  const isPublicApi = PUBLIC_API.some(p => pathname.startsWith(p));
  if (isPublicApi) {
    return NextResponse.next();
  }

  const isPage = PROTECTED_PAGES.some(p => pathname.startsWith(p));
  const isApi = PROTECTED_API.some(p => pathname.startsWith(p));

  if (!isPage && !isApi) {
    return NextResponse.next();
  }

  // Get token from header or cookie
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
    ?? request.cookies.get('token')?.value;

  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  try {
    const payload = await verifyToken(token);
    const response = NextResponse.next();
    
    // Set user context headers for downstream
    response.headers.set('x-user-id', payload.userId);
    response.headers.set('x-user-role', payload.role);
    
    return response;
  } catch {
    if (isApi) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
