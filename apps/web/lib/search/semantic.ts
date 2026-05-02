import { prisma } from '@/lib/db/client'
import { embedText, buildProductText, arrayToPgVector } from './embed'
import type { Product } from '@prisma/client'

export interface SemanticSearchOptions {
  limit?: number
  offset?: number
  minPrice?: number
  maxPrice?: number
  category?: string
  brand?: string
  inStock?: boolean
}

export interface ProductSearchResult {
  id: number
  name: string
  description: string | null
  price: number
  stock: number
  image: string | null
  category: string | null
  brand: string | null
  sku: string | null
  _score?: number
}

export async function semanticSearch(
  query: string,
  options: SemanticSearchOptions = {}
): Promise<ProductSearchResult[]> {
  const embedding = await embedText(query)
  if (!embedding) {
    console.warn('[semantic] No embedding generated, falling back to keyword search')
    return keywordSearch(query, options)
  }

  const limit = options.limit ?? 10
  const offset = options.offset ?? 0

  const filters: string[] = []
  if (options.minPrice !== undefined) filters.push(`price >= ${options.minPrice}`)
  if (options.maxPrice !== undefined) filters.push(`price <= ${options.maxPrice}`)
  if (options.category) filters.push(`category = '${options.category}'`)
  if (options.brand) filters.push(`brand = '${options.brand}'`)
  if (options.inStock) filters.push(`stock > 0`)

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''
  const vectorStr = arrayToPgVector(embedding)

  try {
    let sql = `SELECT id, name, description, price, stock, image, category, brand, sku,
                 1 - (embedding <=> ${vectorStr}::vector) as similarity
                 FROM "Product"`
    if (whereClause) sql += ` ${whereClause}`
    sql += ` ORDER BY embedding <=> ${vectorStr}::vector LIMIT ${limit} OFFSET ${offset}`
    
    const results = await prisma.$queryRawUnsafe<Product[]>(sql)

    return results.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
      image: p.image,
      category: p.category,
      brand: p.brand,
      sku: p.sku,
      _score: Number((p as any).similarity ?? 0),
    }))
  } catch (error) {
    console.error('[semantic] Search failed:', error)
    return keywordSearch(query, options)
  }
}

export async function keywordSearch(
  query: string,
  options: SemanticSearchOptions = {}
): Promise<ProductSearchResult[]> {
  const limit = options.limit ?? 10
  const offset = options.offset ?? 0

  const where: any = {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { category: { contains: query, mode: 'insensitive' } },
      { brand: { contains: query, mode: 'insensitive' } },
    ],
  }

  if (options.minPrice !== undefined || options.maxPrice !== undefined) {
    where.price = {}
    if (options.minPrice !== undefined) where.price.gte = options.minPrice
    if (options.maxPrice !== undefined) where.price.lte = options.maxPrice
  }
  if (options.category) where.category = options.category
  if (options.brand) where.brand = options.brand
  if (options.inStock) where.stock = { gt: 0 }

  const products = await prisma.product.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { name: 'asc' },
  })

  return products.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    image: p.image,
    category: p.category,
    brand: p.brand,
    sku: p.sku,
  }))
}

export async function hybridSearch(
  query: string,
  options: SemanticSearchOptions = {}
): Promise<ProductSearchResult[]> {
  const semanticResults = await semanticSearch(query, { ...options, limit: options.limit ?? 20 })
  
  if (semanticResults.length === 0) {
    return keywordSearch(query, options)
  }

  const semanticIds = new Set(semanticResults.map(r => r.id))
  const keywordResults = await keywordSearch(query, { ...options, limit: 50 })

  const keywordOnly = keywordResults.filter(r => !semanticIds.has(r.id))
  const combined = [...semanticResults, ...keywordOnly]

  return combined.slice(0, options.limit ?? 10)
}

export async function ensureProductEmbedding(productId: number): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, description: true, category: true, brand: true, sku: true },
  }) as (Pick<Product, 'name' | 'description' | 'category' | 'brand' | 'sku'> & { embedding: unknown }) | null

  if (!product) return false
  
  const hasEmbedding = (product as any).embedding !== null && (product as any).embedding !== undefined
  if (hasEmbedding) return true

  const text = buildProductText(product)
  const embedding = await embedText(text)
  if (!embedding) return false

  try {
    const vectorStr = arrayToPgVector(embedding)
    await prisma.$executeRaw`UPDATE "Product" SET embedding = ${vectorStr}::vector WHERE id = ${productId}`
    return true
  } catch (error) {
    console.error('[semantic] Failed to store embedding:', error)
    return false
  }
}

export async function embedAllProducts(): Promise<{ success: number; failed: number }> {
  const products = await prisma.$queryRaw<Pick<Product, 'id' | 'name' | 'description' | 'category' | 'brand' | 'sku'>[]>`
    SELECT id, name, description, category, brand, sku FROM "Product" WHERE embedding IS NULL
  `

  let success = 0
  let failed = 0

  for (const product of products) {
    const text = buildProductText(product)
    const embedding = await embedText(text)
    
    if (!embedding) {
      failed++
      continue
    }

    try {
      const vectorStr = arrayToPgVector(embedding)
      await prisma.$executeRaw`UPDATE "Product" SET embedding = ${vectorStr}::vector WHERE id = ${product.id}`
      success++
    } catch (error) {
      console.error(`[embed] Failed to embed product ${product.id}:`, error)
      failed++
    }
  }

  return { success, failed }
}
