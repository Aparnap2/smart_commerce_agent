// Simplified stub handlers - actual implementations would call the web workspace handlers
// For now, returning mock data to test the graph structure

export interface SearchParams {
  query?: string
  maxPrice?: number
  minPrice?: number
  brand?: string
  category?: string
  inStockOnly?: boolean
}

export interface CartParams {
  productId: number
  quantity?: number
}

export interface OrderParams {
  limit?: number
}

export interface ReturnParams {
  orderId: number
  reason: string
}

export async function searchProductsHandler(params: SearchParams, userId: string) {
  // Mock - replace with actual call to web workspace handlers
  return [
    { id: 1, name: 'Sony WH-1000XM5', price: 34999, stock: 45, category: 'headphones' },
    { id: 2, name: 'AirPods Pro 2', price: 24999, stock: 120, category: 'earbuds' },
  ]
}

export async function addToCartHandler(params: CartParams, userId: string) {
  return { items: [], total: 0 }
}

export async function getCartHandler(userId: string) {
  return { items: [], total: 0 }
}

export async function getOrdersHandler(params: OrderParams, userId: string) {
  return []
}

export async function initiateReturnHandler(params: ReturnParams, userId: string) {
  return { orderId: params.orderId, options: [] }
}

export function sanitizeForLLM(input: string): string {
  return input.replace(/[<>]/g, '').trim()
}

export async function buildSystemContext(userId: string): Promise<string> {
  return ''
}

export function compactToolResult(name: string, data: unknown): string {
  return JSON.stringify(data)
}
