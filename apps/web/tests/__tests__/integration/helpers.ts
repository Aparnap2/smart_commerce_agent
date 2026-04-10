import { prisma } from '@/lib/db/client'
import { redis } from '@/lib/redis/client'
import bcrypt from 'bcryptjs'

export async function createTestUser(role = 'SHOPPER') {
  return prisma.user.upsert({
    where: { email: `test-${role.toLowerCase()}-${Date.now()}@test.com` },
    update: {},
    create: {
      email: `test-${role.toLowerCase()}-${Date.now()}@test.com`,
      name: `Test ${role}`,
      role,
      passwordHash: await bcrypt.hash('password123', 10),
    },
  })
}

export async function createTestProduct(overrides = {}) {
  return prisma.product.create({
    data: {
      name: 'Test Headphones',
      description: 'Test product for integration tests',
      price: 9999,
      stock: 10,
      category: 'headphones',
      sku: `TEST-${Date.now()}`,
      brand: 'TestBrand',
      rating: 4.5,
      ...overrides,
    },
  })
}

export async function cleanupTestData(opts: {
  userIds?: string[]
  productIds?: number[]
  orderIds?: number[]
  redisKeys?: string[]
}) {
  if (opts.orderIds?.length) {
    await prisma.order.deleteMany({
      where: { id: { in: opts.orderIds } }
    })
  }
  if (opts.userIds?.length) {
    const carts = await prisma.cart.findMany({
      where: { customerId: { in: opts.userIds } }
    })
    for (const cart of carts) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
      })
    }
    await prisma.cart.deleteMany({
      where: { customerId: { in: opts.userIds } }
    })
    await prisma.user.deleteMany({
      where: { id: { in: opts.userIds } }
    })
  }
  if (opts.productIds?.length) {
    await prisma.product.deleteMany({
      where: { id: { in: opts.productIds } }
    })
  }
  for (const key of opts.redisKeys ?? []) {
    try {
      await redis.del(`idem:${key}`)
    } catch {
      // Ignore Redis errors during cleanup
    }
  }
  try {
    if (opts.userIds?.length && opts.productIds?.length) {
      for (const userId of opts.userIds) {
        for (const productId of opts.productIds) {
          await redis.del(`idem:cart:${userId}:${productId}`)
        }
      }
    }
  } catch {
    // Ignore Redis errors
  }
}
