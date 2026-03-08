/**
 * Prisma Client Singleton Tests (TDD)
 *
 * Tests for the Prisma client singleton pattern, health checks, and basic CRUD operations.
 * Uses global singleton pattern to prevent multiple connections in development.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, checkPrismaHealth } from '../client';

describe('Prisma Client', () => {
  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================

  describe('Configuration', () => {
    it('exports prisma singleton', () => {
      expect(prisma).toBeDefined();
    });

    it('exports checkPrismaHealth function', () => {
      expect(checkPrismaHealth).toBeDefined();
    });
  });

  // ==========================================================================
  // SINGLETON PATTERN TESTS
  // ==========================================================================

  describe('Singleton Pattern', () => {
    it('returns same instance on multiple imports', async () => {
      // Dynamic import to test singleton behavior
      const module1 = await import('../client');
      const module2 = await import('../client');
      
      expect(module1.prisma).toBe(module2.prisma);
    });
  });

  // ==========================================================================
  // HEALTH CHECK TESTS
  // ==========================================================================

  describe('Health Check', () => {
    it('returns ok: true when PostgreSQL is accessible', async () => {
      const result = await checkPrismaHealth();
      expect(result.ok).toBe(true);
    });

    it('returns table count', async () => {
      const result = await checkPrismaHealth();
      expect(result.tableCount).toBeDefined();
      expect(result.tableCount!).toBeGreaterThan(0);
    });

    it('can execute raw SQL', async () => {
      const result = await prisma.$queryRaw`SELECT 1 as num`;
      expect(result).toEqual([{ num: 1 }]);
    });
  });

  // ==========================================================================
  // BASIC CRUD OPERATIONS TESTS
  // ==========================================================================

  describe('Basic Operations', () => {
    it('can create and find User', async () => {
      const email = `test-${Date.now()}@test.com`;
      
      const user = await prisma.user.create({
        data: {
          email,
          password: 'hashed-password',
          role: 'CUSTOMER',
        },
      });
      
      expect(user.email).toBe(email);
      expect(user.role).toBe('CUSTOMER');
      
      // Cleanup
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('can create and find Product', async () => {
      const product = await prisma.product.create({
        data: {
          name: `Test Product ${Date.now()}`,
          description: 'Test description',
          price: 9999,
          category: 'test',
          stockCount: 10,
        },
      });
      
      expect(product.name).toContain('Test Product');
      expect(product.price).toBe(9999);
      
      // Cleanup
      await prisma.product.delete({ where: { id: product.id } });
    });
  });
});
