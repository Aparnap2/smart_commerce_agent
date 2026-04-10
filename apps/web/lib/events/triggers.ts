import { prisma } from '@/lib/db/client'
import { writeCommerceEvent } from './commerce'
import { getProactiveCount } from '@/lib/redis/memory'

const CART_ABANDONMENT_HOURS = 2
const LOW_STOCK_THRESHOLD = 5

export async function checkCartAbandonment(): Promise<void> {
  const cutoff = new Date(
    Date.now() - CART_ABANDONMENT_HOURS * 60 * 60 * 1000
  )

  const abandonedCarts = await prisma.cart.findMany({
    where: {
      updatedAt: { lt: cutoff },
    },
    include: {
      cartItems: true,
    },
  })

  for (const cart of abandonedCarts) {
    if (cart.cartItems.length === 0) continue

    const count = await getProactiveCount(cart.customerId)
    if (count >= 1) continue

    const recentEvent = await prisma.commerceEvent.findFirst({
      where: {
        event_type: 'cart_abandoned',
        userId: cart.customerId,
        createdAt: { gt: new Date(Date.now() - 4 * 60 * 60 * 1000) }
      }
    })
    if (recentEvent) continue

    await writeCommerceEvent(
      'cart_abandoned',
      cart.customerId,
      {
        cartId: cart.id,
        itemCount: cart.cartItems.length,
      }
    )
  }
}

export async function checkLowStock(): Promise<void> {
  const lowStockProducts = await prisma.product.findMany({
    where: {
      stock: { gt: 0, lt: LOW_STOCK_THRESHOLD }
    },
    select: { id: true, name: true, stock: true }
  })

  for (const product of lowStockProducts) {
    const recentEvent = await prisma.commerceEvent.findFirst({
      where: {
        event_type: 'stock_low',
        payload: { path: ['productId'], equals: product.id },
        createdAt: {
          gt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })
    if (recentEvent) continue

    await writeCommerceEvent('stock_low', null, {
      productId: product.id,
      productName: product.name,
      stock: product.stock,
    })
  }
}
