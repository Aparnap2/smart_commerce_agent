/**
 * Role-Based Access Control (RBAC)
 * 
 * Enforces role-based permissions across the application.
 * Supports both B2C and B2B procurement role models,
 * plus SupportPilot support role model (additive).
 */

import type { AppRole } from './jwt';

export class AuthError extends Error {
  code: string;
  status: number;
  
  constructor(message: string, code: string = 'AUTH_001', status: number = 403) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = 'AuthError';
  }
}

/**
 * Require specific role(s) for access
 */
export function requireRole(userRole: AppRole, ...allowed: AppRole[]): void {
  if (!allowed.includes(userRole)) {
    throw new AuthError('Insufficient permissions', 'AUTH_001', 403);
  }
}

/**
 * Check if user has any of the allowed roles
 */
export function hasAnyRole(userRole: AppRole, ...allowed: AppRole[]): boolean {
  return allowed.includes(userRole);
}

/**
 * B2C role hierarchy (higher index = more permissions)
 */
const ROLE_HIERARCHY: AppRole[] = ['SHOPPER', 'MERCHANT', 'SUPPORT', 'ADMIN'];

/**
 * B2B procurement role hierarchy
 */
const B2B_ROLE_HIERARCHY: AppRole[] = ['EMPLOYEE', 'MANAGER', 'FINANCE', 'ADMIN'];

/**
 * Check if user role meets minimum required role level (B2C hierarchy)
 */
export function meetsRoleLevel(userRole: AppRole, minimumRole: AppRole): boolean {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const minIndex = ROLE_HIERARCHY.indexOf(minimumRole);
  return userIndex >= minIndex;
}

// ─────────────────────────────────────────────────────────
// ROUTE PROTECTION
// ─────────────────────────────────────────────────────────

/** Public paths that never require authentication */
export const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/api/auth',
  '/_next',
  '/favicon.ico',
];

/**
 * Route protection rules.
 * Each entry maps a route prefix to the list of roles allowed to access it.
 * Routes not listed here require only authentication (any role).
 */
export const ROUTE_RULES: Record<string, AppRole[]> = {
  '/manager': ['MANAGER', 'ADMIN'],
  '/finance': ['FINANCE', 'ADMIN'],
  '/admin': ['ADMIN'],
};

/**
 * Result of a route access check.
 */
export interface RouteAccessResult {
  /** Whether the request is allowed to proceed */
  allowed: boolean;
  /** URL to redirect to if not allowed */
  redirectTo: string;
  /** Whether the user is authenticated */
  authenticated: boolean;
}

/**
 * Check whether a user with the given role can access a path.
 * 
 * This is a pure function — no I/O, no side effects — making it
 * directly testable without Next.js mocks.
 *
 * @param path - The URL pathname being accessed
 * @param role - The user's role (null if not authenticated)
 * @returns RouteAccessResult with allowed/redirectTo decisions
 */
export function checkRouteAccess(
  path: string,
  role: AppRole | null,
): RouteAccessResult {
  // ── Public paths ──────────────────────────────────────
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return { allowed: true, redirectTo: '', authenticated: role !== null };
  }

  // ── Root path ─────────────────────────────────────────
  if (path === '/') {
    if (role) {
      return { allowed: true, redirectTo: '/chat', authenticated: true };
    }
    return { allowed: false, redirectTo: '/auth/login', authenticated: false };
  }

  // ── Unauthenticated user trying protected route ───────
  if (!role) {
    return { allowed: false, redirectTo: '/auth/login', authenticated: false };
  }

  // ── Check specific route rules ────────────────────────
  for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_RULES)) {
    if (path.startsWith(routePrefix)) {
      if (allowedRoles.includes(role)) {
        return { allowed: true, redirectTo: '', authenticated: true };
      }
      // Authenticated but wrong role — redirect to chat home
      return { allowed: false, redirectTo: '/chat', authenticated: true };
    }
  }

  // ── All other authenticated routes are allowed ────────
  return { allowed: true, redirectTo: '', authenticated: true };
}

// ─────────────────────────────────────────────────────────
// SUPPORT PILOT ROLE SYSTEM (additive — existing logic above untouched)
// ─────────────────────────────────────────────────────────

/**
 * SupportPilot role type.
 * Additive to existing B2C/B2B role models.
 */
export type SupportRole =
  | 'SUPPORT_AGENT'
  | 'TEAM_LEAD'
  | 'SUPPORT_OPS'
  | 'ADMIN';

/**
 * SupportPilot role hierarchy (higher number = more privileges).
 */
export const SUPPORT_ROLE_HIERARCHY: Record<SupportRole, number> = {
  SUPPORT_AGENT: 1,
  TEAM_LEAD: 2,
  SUPPORT_OPS: 3,
  ADMIN: 4,
};

/**
 * SupportPilot route protection rules.
 * Each entry maps a route prefix to the list of support roles
 * allowed to access it. ADMIN is included in every route as the
 * top-level role (hierarchy override).
 */
export const SUPPORT_ROUTES: Record<string, SupportRole[]> = {
  '/support': ['SUPPORT_AGENT', 'TEAM_LEAD', 'SUPPORT_OPS', 'ADMIN'],
  '/team-lead': ['TEAM_LEAD', 'ADMIN'],
  '/support-ops': ['SUPPORT_OPS', 'ADMIN'],
  '/admin': ['ADMIN'],
};

/**
 * Check whether a support role can access a given path.
 *
 * Uses SUPPORT_ROUTES to determine explicit access, with ADMIN
 * granted hierarchy-based access to all support routes.
 *
 * @param role - The user's support role (string — cast to SupportRole)
 * @param path - The URL pathname being accessed
 * @returns boolean — true if access is allowed
 */
export function checkSupportRouteAccess(role: string, path: string): boolean {
  for (const [route, allowedRoles] of Object.entries(SUPPORT_ROUTES)) {
    if (path === route || path.startsWith(route + '/')) {
      // Direct role match
      if (allowedRoles.includes(role as SupportRole)) {
        return true;
      }
      // Hierarchy override: ADMIN can access any support route
      if (role === 'ADMIN') {
        return true;
      }
      return false;
    }
  }
  return false;
}
