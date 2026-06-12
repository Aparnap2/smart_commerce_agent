/**
 * Security Middleware — Route Protection & Header Injection
 *
 * Enforces:
 *  1. Authentication — redirects to /auth/login if no valid JWT cookie
 *  2. Role-based access — route rules per ROUTE_RULES in lib/auth/rbac
 *  3. SupportPilot role-based access — check via checkSupportRouteAccess
 *  4. Header injection — x-role, x-user-id, x-department-id, x-org-id, x-sf-org
 *     on every downstream request for API routes to validate
 *
 * SupportPilot route rules:
 *  /support    → SUPPORT_AGENT, TEAM_LEAD, SUPPORT_OPS, ADMIN
 *  /team-lead  → TEAM_LEAD, ADMIN
 *  /support-ops→ SUPPORT_OPS, ADMIN
 *  /admin      → ADMIN
 *  /auth/*     → public (no auth required)
 *  /           → redirects to /support (auth'd) or /auth/login (not auth'd)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { checkRouteAccess, checkSupportRouteAccess, SUPPORT_ROUTES } from '@/lib/auth/rbac';
import type { AppRole } from '@/lib/auth/jwt';

/**
 * Public paths that bypass all checks.
 * These must NOT appear in the `config.matcher` to avoid running
 * middleware at all, but we list them here as a safety net.
 */
const PUBLIC_PATH_PREFIXES = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/api/auth',
  '/_next',
  '/favicon.ico',
];

/**
 * Extract and verify the JWT token from the request cookie.
 * Returns { role, userId, departmentId } or null if invalid/missing.
 */
async function parseSession(
  req: NextRequest,
): Promise<{ role: AppRole; userId: string; departmentId?: string | null; orgId?: string; sfOrgMapping?: string } | null> {
  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  if (!tokenMatch) return null;

  try {
    const payload = await verifyToken(tokenMatch[1]);
    return {
      role: payload.role as AppRole,
      userId: payload.userId,
      departmentId: payload.departmentId,
      orgId: payload.orgId,
      sfOrgMapping: payload.sfOrgMapping,
    };
  } catch {
    // Invalid or expired token — treat as unauthenticated
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ── Safety net for public paths (even though matcher excludes them) ─
  // This handles edge cases where Next.js processes the middleware anyway
  if (PUBLIC_PATH_PREFIXES.some(p => path.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Parse session ──────────────────────────────────────────────────
  const session = await parseSession(req);

  // ── Check route access ─────────────────────────────────────────────
  const { allowed, redirectTo } = checkRouteAccess(path, session?.role ?? null);

  if (!allowed) {
    // Log access denial for observability
    console.log(
      `[Auth] Blocked ${path} for ${session?.userId ?? 'anonymous'} (role: ${session?.role ?? 'none'}) → ${redirectTo}`,
    );
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

  // ── Inherited redirect (root / → /chat for authenticated users) ────
  if (redirectTo && path === '/') {
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

  // ── Support route check ────────────────────────────────────────────
  const supportRouteMatch = Object.keys(SUPPORT_ROUTES).some(route =>
    path === route || path.startsWith(route + '/'),
  );

  if (supportRouteMatch) {
    const hasAccess = checkSupportRouteAccess(session?.role ?? '', path);
    if (!hasAccess) {
      console.log(
        `[Auth] Support route blocked ${path} for ${session?.userId ?? 'anonymous'} (role: ${session?.role ?? 'none'})`,
      );
      return NextResponse.redirect(new URL('/chat', req.url));
    }
  }

  // ── Forward session headers to downstream route handlers ───────────
  // This allows API routes and pages to read x-role, x-user-id, etc.
  // without re-parsing the JWT cookie.
  const response = NextResponse.next();

  if (session) {
    response.headers.set('x-role', session.role);
    response.headers.set('x-user-id', session.userId);
    if (session.departmentId) {
      response.headers.set('x-department-id', session.departmentId);
    }
    if (session.orgId) {
      response.headers.set('x-org-id', session.orgId);
    }
    if (session.sfOrgMapping) {
      response.headers.set('x-sf-org', session.sfOrgMapping);
    }
  }

  return response;
}

/**
 * Middleware matcher — only trigger on these paths for performance.
 *
 * Critical: Public paths (/auth/*, /api/auth/*, /_next/*) are excluded
 * so the middleware never runs on them, avoiding unnecessary JWT parsing.
 */
export const config = {
  matcher: [
    '/',
    '/chat/:path*',
    '/admin/:path*',
    '/api/agent/:path*',
    '/support/:path*',
    '/team-lead/:path*',
    '/support-ops/:path*',
  ],
};
