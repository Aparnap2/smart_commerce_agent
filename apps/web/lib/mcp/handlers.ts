import { prisma } from '@/lib/db/client'
import { redis } from '@/lib/redis/client'
import {
  checkIdempotencyKey,
  setIdempotencyKey,
  setUserContext,
} from '@/lib/redis/memory'
import { z } from 'zod'
import {
  isWithinReturnWindow,
  getRefundOptions,
  type RefundOption,
} from '@/lib/policies/returns'

export type CartWithItems = {
  id: string
  customerId: string
  items: CartItem[]
  total: number
  version?: number
}

export type CartItem = {
  productId: number
  name: string
  price: number
  quantity: number
}

export async function getCartHandler(
  userId: string
): Promise<CartWithItems> {
  const cart = await prisma.cart.findUnique({
    where: { customerId: userId },
    include: {
      cartItems: {
        include: {
          product: true
        }
      }
    },
  })

  if (!cart) {
    return {
      id: '',
      customerId: userId,
      items: [],
      total: 0,
    }
  }

  const items: CartItem[] = cart.cartItems.map(item => ({
    productId: item.productId,
    name: item.product.name,
    price: item.price,
    quantity: item.quantity,
  }))

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  )

  return {
    id: cart.id,
    customerId: cart.customerId,
    items,
    total,
    version: cart.version,
  }
}

const addToCartSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99),
})

export async function addToCartHandler(
  params: { productId: number; quantity: number },
  userId: string
): Promise<CartWithItems> {
  const validated = addToCartSchema.parse(params)
  const { productId, quantity } = validated

  const idemKey = `cart:${userId}:${productId}`
  const isDuplicate = await checkIdempotencyKey(idemKey)
  if (isDuplicate) {
    return getCartHandler(userId)
  }

  const product = await prisma.product.findUnique({
    where: { id: productId }
  })
  if (!product) throw new Error('Product not found')

  if (product.stock <= 0) {
    throw new Error(`Product is out of stock`)
  }

  let cart = await prisma.cart.findUnique({
    where: { customerId: userId }
  })
  if (!cart) {
    cart = await prisma.cart.create({
      data: { customerId: userId }
    })
  }

  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId,
      }
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updatedCart: any
  if (existingItem) {
    updatedCart = await prisma.cart.update({
      where: { id: cart.id },
      data: {
        version: { increment: 1 },
        updatedAt: new Date(),
        cartItems: {
          update: {
            where: { id: existingItem.id },
            data: { quantity: { increment: quantity } }
          }
        }
      },
      include: {
        cartItems: {
          include: { product: true }
        }
      }
    })
  } else {
    updatedCart = await prisma.cart.update({
      where: { id: cart.id },
      data: {
        version: { increment: 1 },
        updatedAt: new Date(),
        cartItems: {
          create: {
            productId,
            price: product.price,
            quantity,
          }
        }
      },
      include: {
        cartItems: {
          include: { product: true }
        }
      }
    })
  }

  await setIdempotencyKey(idemKey)
  await setUserContext(userId, { lastAction: 'addToCart', lastProductId: productId })

  const items: CartItem[] = updatedCart.cartItems.map(item => ({
    productId: item.productId,
    name: item.product.name,
    price: item.price,
    quantity: item.quantity,
  }))

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  )

  return {
    id: updatedCart.id,
    customerId: userId,
    items,
    total,
    version: updatedCart.version,
  }
}

export async function getOrdersHandler(
  params: { limit: number },
  userId: string
): Promise<any[]> {
  const { limit } = z.object({
    limit: z.number().int().min(1).max(10)
  }).parse(params)

  const user = await prisma.user.findUnique({
    where: { id: userId }
  })
  if (!user) return []

  const customer = await prisma.customer.findFirst({
    where: { email: user.email }
  })
  if (!customer) return []

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { orderDate: 'desc' },
    take: limit,
  })

  return orders
}

export type ReturnOptions = {
  orderId: number
  options: RefundOption[]
  autoApproved: boolean
}

export async function initiateReturnHandler(
  params: { orderId: number; reason: string },
  userId: string
): Promise<ReturnOptions> {
  const { orderId, reason } = z.object({
    orderId: z.number().int().positive(),
    reason: z.string().min(1).max(500),
  }).parse(params)

  const order = await prisma.order.findUnique({
    where: { id: orderId }
  })
  if (!order) throw new Error('Order not found')

  const user = await prisma.user.findUnique({
    where: { id: userId }
  })
  if (!user) throw new Error('User not found')

  const customer = await prisma.customer.findFirst({
    where: { email: user.email }
  })
  if (!customer || order.customerId !== customer.id) {
    throw new Error('Order does not belong to this user')
  }

  if (!isWithinReturnWindow(order as any)) {
    throw new Error(
      `Outside return window — returns accepted within 7 days of order`
    )
  }

  const options = getRefundOptions(order as any)

  return {
    orderId,
    options,
    autoApproved: false,
  }
}

export async function searchProductsHandler(
  params: {
    query: string
    maxPrice?: number
    minPrice?: number
    brand?: string
    category?: string
    useCase?: string
    inStockOnly?: boolean
  },
  userId: string
): Promise<any[]> {
  const {
    query,
    maxPrice,
    minPrice,
    brand,
    category,
    inStockOnly = true,
  } = params

  try {
    const where: any = {}

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { brand: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } },
      ]
    }

    if (brand) {
      where.brand = { equals: brand, mode: 'insensitive' }
    }

    if (category) {
      where.category = { equals: category, mode: 'insensitive' }
    }

    if (maxPrice !== undefined || minPrice !== undefined) {
      where.price = {}
      if (maxPrice !== undefined) where.price.lte = maxPrice
      if (minPrice !== undefined) where.price.gte = minPrice
    }

    if (inStockOnly) {
      where.stock = { gt: 0 }
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { rating: 'desc' },
      take: 6,
    })

    return products
  } catch {
    return []
  }
}

// Alias for viewCart - uses same logic as getCartHandler
export async function viewCartHandler(
  _: Record<string, never>,
  userId: string
): Promise<CartWithItems> {
  return getCartHandler(userId)
}

export type TrackingInfo = {
  orderId: string
  status: string
  trackingNumber?: string
  carrier?: string
  estimatedDelivery?: string
  history: Array<{
    status: string
    location: string
    timestamp: string
    message: string
  }>
}

export async function trackOrderHandler(
  params: { orderId: string },
  userId: string
): Promise<TrackingInfo> {
  const { orderId } = z.object({
    orderId: z.string().min(1),
  }).parse(params)

  const order = await prisma.order.findUnique({
    where: { id: orderId }
  })
  if (!order) throw new Error('Order not found')

  const user = await prisma.user.findUnique({
    where: { id: userId }
  })
  if (!user) throw new Error('User not found')

  const customer = await prisma.customer.findFirst({
    where: { email: user.email }
  })
  if (!customer || order.customerId !== customer.id) {
    throw new Error('Order does not belong to this user')
  }

  // Build tracking history from order status
  const history: TrackingInfo['history'] = []
  
  if (order.orderDate) {
    history.push({
      status: 'PENDING',
      location: 'Warehouse',
      timestamp: order.orderDate.toISOString(),
      message: 'Order placed',
    })
  }

  if (order.status === 'SHIPPED' || order.status === 'DELIVERED') {
    history.push({
      status: 'SHIPPED',
      location: 'Distribution Center',
      timestamp: new Date(order.orderDate.getTime() + 86400000).toISOString(),
      message: 'Order shipped',
    })
  }

  if (order.status === 'DELIVERED') {
    history.push({
      status: 'DELIVERED',
      location: 'Customer Address',
      timestamp: new Date(order.orderDate.getTime() + 172800000).toISOString(),
      message: 'Order delivered',
    })
  }

  return {
    orderId,
    status: order.status,
    trackingNumber: order.trackingNumber || undefined,
    carrier: order.carrier || undefined,
    estimatedDelivery: order.estimatedDelivery?.toISOString(),
    history,
  }
}
