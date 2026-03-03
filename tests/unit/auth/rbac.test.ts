/**
 * RBAC Tests
 * 
 * Tests for role-based access control.
 */

import { describe, it, expect } from 'vitest';
import { requireRole, hasAnyRole, meetsRoleLevel, AuthError } from '@/lib/auth/rbac';
import type { Role } from '@/lib/auth/jwt';

describe('RBAC', () => {
  it('should not throw when role is allowed', () => {
    expect(() => requireRole('ADMIN', 'MERCHANT', 'ADMIN')).not.toThrow();
    expect(() => requireRole('MERCHANT', 'MERCHANT')).not.toThrow();
    expect(() => requireRole('SHOPPER', 'SHOPPER', 'MERCHANT')).not.toThrow();
  });

  it('should throw AuthError when role is not allowed', () => {
    expect(() => requireRole('SHOPPER', 'MERCHANT', 'ADMIN')).toThrow(AuthError);
    expect(() => requireRole('MERCHANT', 'ADMIN')).toThrow('Insufficient permissions');
  });

  it('should check hasAnyRole correctly', () => {
    expect(hasAnyRole('ADMIN', 'MERCHANT', 'ADMIN')).toBe(true);
    expect(hasAnyRole('SHOPPER', 'MERCHANT', 'ADMIN')).toBe(false);
    expect(hasAnyRole('SUPPORT', 'SUPPORT', 'ADMIN')).toBe(true);
  });

  it('should check meetsRoleLevel correctly', () => {
    // Hierarchy: SHOPPER < MERCHANT < SUPPORT < ADMIN
    expect(meetsRoleLevel('ADMIN', 'SHOPPER')).toBe(true);
    expect(meetsRoleLevel('ADMIN', 'MERCHANT')).toBe(true);
    expect(meetsRoleLevel('MERCHANT', 'SHOPPER')).toBe(true);
    expect(meetsRoleLevel('SHOPPER', 'MERCHANT')).toBe(false);
    expect(meetsRoleLevel('MERCHANT', 'ADMIN')).toBe(false);
  });
});
