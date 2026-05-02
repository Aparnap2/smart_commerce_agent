import { prisma } from '@/lib/db/client'
import { getUserContext } from '@/lib/redis/memory'

export async function buildSystemContext(
  userId: string
): Promise<string> {
  const parts: string[] = []

  try {
    const [context, cart, lastOrder] = await Promise.allSettled([
      getUserContext(userId),
      prisma.cart.findUnique({ where: { customerId: userId } }),
      prisma.order.findFirst({
        where: { customerId: userId as unknown as number },
        orderBy: { orderDate: 'desc' },
        select: { id: true, status: true, orderDate: true, total: true },
      }),
    ])

    if (context.status === 'fulfilled' && context.value?.lastSearch) {
      parts.push(`User last searched for: "${context.value.lastSearch}"`)
    }

    if (cart.status === 'fulfilled' && cart.value) {
      const items = await prisma.cartItem.findMany({
        where: { cartId: cart.value.id }
      })
      if (items.length > 0) {
        const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
        parts.push(`Cart has ${items.length} item(s), total ₹${total.toLocaleString('en-IN')}`)
      }
    }

    if (lastOrder.status === 'fulfilled' && lastOrder.value) {
      const order = lastOrder.value
      parts.push(`Last order #${order.id} is ${order.status}`)
    }
  } catch {
    return ''
  }

  return parts.join('. ')
}

export function compactToolResult(
  toolName: string,
  result: unknown
): string {
  const MAX = 200

  try {
    if (toolName === 'searchProducts') {
      const items = result as Array<{ name?: string; price?: number }>
      if (!items || items.length === 0) return 'No products found.'
      const top = items[0]
      const summary = `Found ${items.length} product(s). Top: ${top.name} at ₹${top.price?.toLocaleString('en-IN')}.`
      return summary.slice(0, MAX)
    }

    if (toolName === 'addToCart' || toolName === 'getCart') {
      const cart = result as { items?: Array<unknown>; total?: number }
      const count = cart?.items?.length ?? 0
      const total = cart?.total ?? 0
      return `Cart updated. ${count} item(s). Total: ₹${total.toLocaleString('en-IN')}.`.slice(0, MAX)
    }

    if (toolName === 'getOrders') {
      const orders = result as Array<{ id?: number; status?: string }>
      if (!orders || orders.length === 0) return 'No orders found.'
      const latest = orders[0]
      return `${orders.length} order(s). Latest: #${latest.id} — ${latest.status}.`.slice(0, MAX)
    }

    if (toolName === 'initiateReturn') {
      const ret = result as { orderId?: number }
      return `Return options presented for order #${ret.orderId}.`.slice(0, MAX)
    }

    const str = JSON.stringify(result)
    return str.slice(0, MAX)
  } catch {
    return 'Tool completed.'
  }
}
