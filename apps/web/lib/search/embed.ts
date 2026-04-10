import { embeddingModel } from '@/lib/llm/client'
import type { Product } from '@prisma/client'

const EMBEDDING_DIMENSION = 1536

export async function embedText(text: string): Promise<Float32Array | null> {
  try {
    const result = await embeddingModel.embedQuery(text)
    return new Float32Array(result)
  } catch (error) {
    console.error('[embed] embedText failed:', error)
    return null
  }
}

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return []
  
  try {
    const results = await embeddingModel.embedDocuments(texts)
    return results.map(r => new Float32Array(r))
  } catch (error) {
    console.error('[embed] embedBatch failed:', error)
    return []
  }
}

export function buildProductText(product: Pick<Product, 'name' | 'description' | 'category' | 'brand' | 'sku'>): string {
  const parts: string[] = []
  
  if (product.name) parts.push(product.name)
  if (product.description) parts.push(product.description)
  if (product.category) parts.push(product.category)
  if (product.brand) parts.push(product.brand)
  if (product.sku) parts.push(product.sku)
  
  return parts.join(' ')
}

export function vectorToArray(vector: unknown): Float32Array | null {
  if (!vector) return null
  if (vector instanceof Float32Array) return vector
  if (Array.isArray(vector)) return new Float32Array(vector)
  return null
}

export function arrayToPgVector(arr: Float32Array): string {
  return `[${Array.from(arr).join(',')}]`
}

export { EMBEDDING_DIMENSION }
