/**
 * Commerce API Integration Tests
 * 
 * Prerequisites:
 *   - commerce-api running on http://localhost:3001
 *   - Database seeded with products and test user
 * 
 * Run: pnpm vitest run tests/integration/commerce-api/products.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'

const BASE = 'http://localhost:3001'
let TOKEN = ''

beforeAll(async () => {
  // Get auth token from web login
  const r = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'shopper@test.com',
      password: 'Test1234!'
    })
  })
  const d = await r.json()
  TOKEN = d.token ?? d.accessToken ?? ''
  if (!TOKEN) throw new Error('Auth failed - is web running?')
})

function gql(query: string) {
  return fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({ query })
  }).then(r => r.json())
}

describe('Products GraphQL API', () => {
  it.skip('products query returns array', async () => {
    const b = await gql('{ products(limit: 5) { items { id name price } total } }')
    expect(b.errors).toBeUndefined()
    expect(Array.isArray(b.data?.products?.items)).toBe(true)
  })

  it.skip('product(id) returns single product', async () => {
    const list = await gql('{ products(limit: 1) { items { id } } }')
    const id = list.data?.products?.items[0]?.id
    const b = await gql(`{ product(id: "${id}") { id name price } }`)
    expect(b.data?.product?.id).toBe(id)
  })

  it.skip('unauthenticated request returns 401', async () => {
    const r = await fetch(`${BASE}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ products(limit: 1) { items { id } } }' })
    })
    expect(r.status).toBe(401)
  })
})

describe('MCP Endpoints', () => {
  it.skip('/mcp/tools returns tool list', async () => {
    const r = await fetch(`${BASE}/mcp/tools`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    })
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(Array.isArray(b.tools)).toBe(true)
  })

  it.skip('/mcp/graphql/query returns data', async () => {
    const r = await fetch(`${BASE}/mcp/graphql/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        query: '{ products(limit: 3) { items { id name } } }'
      })
    })
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(b.data?.products?.items).toBeDefined()
  })
})
