/**
 * Auth Middleware - Protects routes requiring authentication
 *
 * This middleware:
 * 1. Checks for valid sessions on protected routes
 * 2. Redirects unauthenticated users to login
 * 3. Handles session refresh
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Configuration
// ============================================================================

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/settings', '/profile', '/api/protected'];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/auth/login', '/auth/signup', '/auth/forgot-password'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a Supabase client with cookie handling for middleware
 */
function createMiddlewareClient(
  request: NextRequest,
  response: NextResponse
): SupabaseClient {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: { path?: string; domain?: string; sameSite?: 'lax' | 'strict' | 'none'; secure?: boolean; httpOnly?: boolean; maxAge?: number }) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: { path?: string; domain?: string }) {
          response.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
          });
        },
      },
    }
  );
}

/**
 * Check if the request path matches any of the given patterns
 */
function matchesRoute(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith('/:path*')) {
      const basePath = pattern.replace('/:path*', '');
      return path.startsWith(basePath);
    }
    return path === pattern || path.startsWith(`${pattern}/`);
  });
}

// ============================================================================
// Middleware Handler
// ============================================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Create Supabase client with response for cookie handling
  const supabase = createMiddlewareClient(request, response);

  // Get current session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check if route is protected
  const isProtectedRoute = matchesRoute(pathname, protectedRoutes);
  const isAuthRoute = matchesRoute(pathname, authRoutes);
  const isApiRoute = pathname.startsWith('/api/');
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Files with extensions (js, css, images, etc.)
  ;

  // Handle API routes that need auth
  if (isApiRoute && pathname.includes('protected')) {
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    return response;
  }

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !session) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth routes to dashboard
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Allow public routes and authenticated access to protected routes
  return response;
}

// ============================================================================
// Middleware Configuration
// ============================================================================

export const config = {
  // Match protected routes explicitly, then all non-static paths excluding other /api routes
  matcher: [
    '/api/protected/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
