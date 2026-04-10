// apps/agent/src/tools/customer-tools.ts
import { z } from 'zod'
import { tool } from '@langchain/core/tools'
import {
  searchProductsHandler,
  addToCartHandler,
  viewCartHandler,
  getOrdersHandler,
  initiateReturnHandler,
  trackOrderHandler,
} from './handlers-bridge.js'

// Tool 1: Semantic product search
export const searchProductsTool = tool(
  async ({ query, maxPrice, minPrice, brand, category, inStockOnly }, config) => {
    const userId = config?.configurable?.userId as string
    const products = await searchProductsHandler(
      { query, maxPrice, minPrice, brand, category, inStockOnly },
      userId
    )
    return JSON.stringify(products)
  },
  {
    name: 'searchProducts',
    description: `Semantic product search — understands natural language and use cases.
      "headphones for gym" finds sports earbuds.
      "gift for gamer under ₹5000" finds gaming accessories.
      ALWAYS use this for product discovery.
      Returns up to 6 products with price, stock, rating.`,
    schema: z.object({
      query: z.string().describe('Natural language product search query'),
      maxPrice: z.number().optional().describe('Maximum price in INR'),
      minPrice: z.number().optional().describe('Minimum price in INR'),
      brand: z.string().optional().describe('Filter by brand name'),
      category: z.string().optional().describe('Filter by category'),
      inStockOnly: z.boolean().default(true).describe('Only return in-stock products'),
    }),
  }
)

// Tool 2: Add to cart
export const addToCartTool = tool(
  async ({ productId, quantity }, config) => {
    const userId = config?.configurable?.userId as string
    const result = await addToCartHandler({ productId, quantity }, userId)
    return JSON.stringify(result)
  },
  {
    name: 'addToCart',
    description: `Add a product to the customer's cart.
      Use after customer confirms they want a specific product.
      Always confirm product name + price before calling.
      Returns updated cart summary.`,
    schema: z.object({
      productId: z.number().describe('Product ID to add'),
      quantity: z.number().int().positive().default(1).describe('Quantity to add'),
    }),
  }
)

// Tool 3: View cart
export const viewCartTool = tool(
  async (_, config) => {
    const userId = config?.configurable?.userId as string
    const cart = await viewCartHandler({}, userId)
    return JSON.stringify(cart)
  },
  {
    name: 'viewCart',
    description: `Show the customer's current cart.
      Use when customer asks "what's in my cart", "show my cart", or "view cart".
      Returns all items, quantities, prices, and total.`,
    schema: z.object({}),
  }
)

// Tool 4: Get order history
export const getOrdersTool = tool(
  async ({ limit, status }, config) => {
    const userId = config?.configurable?.userId as string
    const orders = await getOrdersHandler({ limit, status }, userId)
    return JSON.stringify(orders)
  },
  {
    name: 'getOrders',
    description: `Get the customer's order history.
      Use for "my orders", "recent orders", "where is my order", "order status" queries.
      Returns orders with status, tracking, date, items.`,
    schema: z.object({
      limit: z.number().int().positive().default(5).describe('Max orders to return'),
      status: z.string().optional().describe('Filter by status: PENDING, SHIPPED, DELIVERED'),
    }),
  }
)

// Tool 5: Initiate return
export const initiateReturnTool = tool(
  async ({ orderId, reason }, config) => {
    const userId = config?.configurable?.userId as string
    const result = await initiateReturnHandler({ orderId, reason }, userId)
    return JSON.stringify(result)
  },
  {
    name: 'initiateReturn',
    description: `Start a product return.
      Use when customer wants to return an order.
      Always get orderId and reason before calling.
      Returns 3 options: refund, exchange, store credit.
      Store credit option includes ₹500 bonus.
      Only eligible within 7 days of delivery.`,
    schema: z.object({
      orderId: z.string().describe('Order ID to return'),
      reason: z.string().describe('Return reason: DEFECTIVE, NOT_AS_DESCRIBED, etc.'),
    }),
  }
)

// Tool 6: Track order
export const trackOrderTool = tool(
  async ({ orderId }, config) => {
    const userId = config?.configurable?.userId as string
    const result = await trackOrderHandler({ orderId }, userId)
    return JSON.stringify(result)
  },
  {
    name: 'trackOrder',
    description: `Track a specific order's delivery status.
      Use when customer asks about a specific order.
      Returns tracking number, carrier, estimated delivery.`,
    schema: z.object({
      orderId: z.string().describe('Order ID to track'),
    }),
  }
)

// All customer tools in one array
export const customerTools = [
  searchProductsTool,
  addToCartTool,
  viewCartTool,
  getOrdersTool,
  initiateReturnTool,
  trackOrderTool,
]
