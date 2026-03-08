/**
 * Prisma Client Singleton
 *
 * Global singleton pattern to prevent multiple database connections.
 * In development, reuses the same connection across hot reloads.
 * In production, ensures only one connection per process.
 *
 * @example
 * ```typescript
 * import { prisma, checkPrismaHealth } from '@/lib/prisma/client';
 *
 * // Use the singleton
 * const users = await prisma.user.findMany();
 *
 * // Check health
 * const health = await checkPrismaHealth();
 * if (health.ok) {
 *   console.log(`Database healthy: ${health.tableCount} tables`);
 * }
 * ```
 */

import { PrismaClient } from '@prisma/client';

// Singleton pattern - one connection, not one per request
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Health check function for Prisma database connection
 *
 * Tests database connectivity and returns metadata about the database state.
 * Useful for health check endpoints and startup validation.
 *
 * @returns Promise with health status including:
 *   - ok: Whether the database is accessible
 *   - tableCount: Number of tables in the public schema
 *   - productCount: Number of products (if table exists)
 *
 * @example
 * ```typescript
 * const health = await checkPrismaHealth();
 * if (!health.ok) {
 *   // Handle database connection error
 *   logger.error('Database health check failed');
 * }
 * ```
 */
export async function checkPrismaHealth(): Promise<{
  ok: boolean;
  tableCount?: number;
  productCount?: number;
}> {
  try {
    // Test connection
    await prisma.$queryRaw`SELECT 1`;

    // Count tables
    const tables = await prisma.$queryRaw<
      Array<{ table_name: string }>
    >`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;

    // Count products (if table exists)
    let productCount = 0;
    try {
      productCount = await prisma.product.count();
    } catch {
      // Table doesn't exist yet
    }

    return {
      ok: true,
      tableCount: tables.length,
      productCount,
    };
  } catch (error) {
    return { ok: false };
  }
}

// Graceful shutdown in production
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}
