/**
 * Role-Based Access Control (RBAC)
 * 
 * Enforces role-based permissions across the application.
 */

import { Role } from './jwt';

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
export function requireRole(userRole: Role, ...allowed: Role[]): void {
  if (!allowed.includes(userRole)) {
    throw new AuthError('Insufficient permissions', 'AUTH_001', 403);
  }
}

/**
 * Check if user has any of the allowed roles
 */
export function hasAnyRole(userRole: Role, ...allowed: Role[]): boolean {
  return allowed.includes(userRole);
}

/**
 * Role hierarchy (higher index = more permissions)
 */
const ROLE_HIERARCHY: Role[] = ['SHOPPER', 'MERCHANT', 'SUPPORT', 'ADMIN'];

/**
 * Check if user role meets minimum required role level
 */
export function meetsRoleLevel(userRole: Role, minimumRole: Role): boolean {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const minIndex = ROLE_HIERARCHY.indexOf(minimumRole);
  return userIndex >= minIndex;
}
