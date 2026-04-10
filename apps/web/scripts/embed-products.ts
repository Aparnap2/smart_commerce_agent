#!/usr/bin/env node

import { prisma } from '../lib/prisma/client'
import { embedAllProducts } from '../lib/search/semantic'

async function main() {
  console.log('[embed-products] Starting bulk embedding...')
  
  try {
    const result = await embedAllProducts()
    console.log(`[embed-products] Done! Success: ${result.success}, Failed: ${result.failed}`)
    
    const total = await prisma.product.count()
    const embeddedResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Product" WHERE embedding IS NOT NULL
    `
    const embedded = Number(embeddedResult[0]?.count ?? 0)
    console.log(`[embed-products] Total products: ${total}, Embedded: ${embedded}`)
    
    process.exit(result.failed > 0 ? 1 : 0)
  } catch (error) {
    console.error('[embed-products] Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
