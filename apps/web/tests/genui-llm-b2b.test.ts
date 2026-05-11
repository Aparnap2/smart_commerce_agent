/**
 * TDD Test: LLM must respond with B2B terms
 * 
 * RED: Human writes failing test first (this file)
 * GREEN: Implementation to pass test
 * 
 * Uses .env.local: OLLAMA_BASE_URL, OLLAMA_API_KEY, OLLAMA_CHAT_MODEL
 */

import { describe, it, expect } from 'vitest'

const hasOllama = !!(process.env.OLLAMA_BASE_URL && process.env.OLLAMA_API_KEY)

describe.skipIf(!hasOllama)('LLM B2B Behavior (TDD)', () => {
  it('should use B2B terms in response', async () => {
    const query = "I want to buy a laptop for the design team"
    
    const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_CHAT_MODEL,
        messages: [
          { role: 'system', content: 'You are ProcureAI, a B2B procurement assistant. Use procurement terminology: purchase request, PR, catalog item, budget, approval workflow.' },
          { role: 'user', content: query }
        ],
        stream: false,
      }),
    })

    const data = await response.json()
    const reply = data.message?.content ?? ''
    
    const hasB2C = ['cart', 'order', 'checkout', 'add to cart', 'view cart'].some(t => reply.toLowerCase().includes(t))
    expect(hasB2C).toBe(false)
    
    const hasB2B = ['purchase request', 'pr', 'catalog', 'budget', 'approval'].some(t => reply.toLowerCase().includes(t))
    expect(hasB2B).toBe(true)
  })

  it('should NOT use B2C tool names', async () => {
    const query = "show me the budget status for my department"
    
    const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_CHAT_MODEL,
        messages: [
          { role: 'system', content: 'You are ProcureAI, a B2B procurement assistant. Available tools: search_catalog, get_budget_status, manage_purchase_request, submit_for_approval.' },
          { role: 'user', content: query }
        ],
        stream: false,
      }),
    })

    const data = await response.json()
    const reply = data.message?.content ?? ''
    
    expect(reply.toLowerCase()).not.toContain('cart')
    expect(reply.toLowerCase()).not.toContain('order')
    expect(reply.toLowerCase()).not.toContain('product')
  })
})