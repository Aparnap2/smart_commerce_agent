/**
 * Tests for SupportPilot Role-Based Access Control (RBAC)
 *
 * Verifies:
 *  1. Support role types are defined correctly
 *  2. Role hierarchy is ordered correctly
 *  3. Route access rules for each support role
 *  4. Backward compatibility with existing procurement RBAC
 */

import { describe, it, expect } from 'vitest';
import {
  checkSupportRouteAccess,
  SUPPORT_ROLE_HIERARCHY,
  SUPPORT_ROUTES,
  type SupportRole,
  checkRouteAccess,
} from '@/lib/auth/rbac';

describe('SupportRole RBAC', () => {
  // ── Type existence ──────────────────────────────────────────────

  it('should define SupportRole type with SUPPORT_AGENT, TEAM_LEAD, SUPPORT_OPS, ADMIN', () => {
    const supportRoles: SupportRole[] = [
      'SUPPORT_AGENT',
      'TEAM_LEAD',
      'SUPPORT_OPS',
      'ADMIN',
    ];
    expect(supportRoles).toContain('SUPPORT_AGENT');
    expect(supportRoles).toContain('TEAM_LEAD');
    expect(supportRoles).toContain('SUPPORT_OPS');
    expect(supportRoles).toContain('ADMIN');
  });

  // ── Hierarchy ──────────────────────────────────────────────────

  it('should have correct role hierarchy: SUPPORT_AGENT < TEAM_LEAD < SUPPORT_OPS < ADMIN', () => {
    // Numeric values
    expect(SUPPORT_ROLE_HIERARCHY['SUPPORT_AGENT']).toBe(1);
    expect(SUPPORT_ROLE_HIERARCHY['TEAM_LEAD']).toBe(2);
    expect(SUPPORT_ROLE_HIERARCHY['SUPPORT_OPS']).toBe(3);
    expect(SUPPORT_ROLE_HIERARCHY['ADMIN']).toBe(4);

    // Ordering
    expect(SUPPORT_ROLE_HIERARCHY['SUPPORT_AGENT']).toBeLessThan(
      SUPPORT_ROLE_HIERARCHY['TEAM_LEAD'],
    );
    expect(SUPPORT_ROLE_HIERARCHY['TEAM_LEAD']).toBeLessThan(
      SUPPORT_ROLE_HIERARCHY['SUPPORT_OPS'],
    );
    expect(SUPPORT_ROLE_HIERARCHY['SUPPORT_OPS']).toBeLessThan(
      SUPPORT_ROLE_HIERARCHY['ADMIN'],
    );
  });

  // ── SUPPORT_AGENT route access ─────────────────────────────────

  it('should allow SUPPORT_AGENT to access /support', () => {
    expect(checkSupportRouteAccess('SUPPORT_AGENT', '/support')).toBe(true);
  });

  it('should deny SUPPORT_AGENT access to /team-lead', () => {
    expect(checkSupportRouteAccess('SUPPORT_AGENT', '/team-lead')).toBe(false);
  });

  // ── TEAM_LEAD route access ─────────────────────────────────────

  it('should allow TEAM_LEAD to access /team-lead', () => {
    expect(checkSupportRouteAccess('TEAM_LEAD', '/team-lead')).toBe(true);
  });

  // ── SUPPORT_OPS route access ───────────────────────────────────

  it('should allow SUPPORT_OPS to access /support-ops', () => {
    expect(checkSupportRouteAccess('SUPPORT_OPS', '/support-ops')).toBe(true);
  });

  it('should deny SUPPORT_OPS access to /team-lead (only TEAM_LEAD/ADMIN)', () => {
    expect(checkSupportRouteAccess('SUPPORT_OPS', '/team-lead')).toBe(false);
  });

  // ── ADMIN route access ─────────────────────────────────────────

  it('should allow ADMIN to access /support-ops', () => {
    expect(checkSupportRouteAccess('ADMIN', '/support-ops')).toBe(true);
  });

  it('should allow ADMIN to access /team-lead', () => {
    expect(checkSupportRouteAccess('ADMIN', '/team-lead')).toBe(true);
  });

  it('should deny SUPPORT_AGENT access to /admin', () => {
    expect(checkSupportRouteAccess('SUPPORT_AGENT', '/admin')).toBe(false);
  });

  it('should allow ADMIN to access /admin', () => {
    expect(checkSupportRouteAccess('ADMIN', '/admin')).toBe(true);
  });

  // ── Backward compatibility ────────────────────────────────────

  it('should maintain backward compatibility — old checkRouteAccess still works with EMPLOYEE, MANAGER, FINANCE roles', () => {
    // EMPLOYEE can access default authenticated routes
    const empChat = checkRouteAccess('/chat', 'EMPLOYEE');
    expect(empChat.allowed).toBe(true);

    // MANAGER can access /manager
    const mgrResult = checkRouteAccess('/manager', 'MANAGER');
    expect(mgrResult.allowed).toBe(true);

    // FINANCE can access /finance
    const finResult = checkRouteAccess('/finance', 'FINANCE');
    expect(finResult.allowed).toBe(true);

    // EMPLOYEE cannot access /admin
    const empAdmin = checkRouteAccess('/admin', 'EMPLOYEE');
    expect(empAdmin.allowed).toBe(false);

    // ADMIN (procurement) can access /admin
    const adminResult = checkRouteAccess('/admin', 'ADMIN');
    expect(adminResult.allowed).toBe(true);
  });
});
