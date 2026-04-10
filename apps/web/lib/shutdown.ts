import { prisma } from '@/lib/db/client'
import { redis } from '@/lib/redis/client'
import { langfuse } from '@/lib/observability/langfuse'

let isShuttingDown = false

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`[shutdown] ${signal} — shutting down cleanly`)
  try {
    await Promise.allSettled([
      prisma.$disconnect(),
      redis.quit(),
      langfuse.shutdownAsync(),
    ])
  } catch (err) {
    console.error('[shutdown] Error:', err)
  }
  process.exit(0)
}

export function registerShutdownHandlers() {
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.once('SIGINT', () => gracefulShutdown('SIGINT'))
}
