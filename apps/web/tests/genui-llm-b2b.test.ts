/**
 * TDD Test: LLM must respond with B2B terms
 * 
 * RED: Human writes failing test first (this file)
 * GREEN: Implementation to pass test
 * 
 * This tests actual LLM behavior, not file scanning.
 * Requires: LLM_API_KEY, LLM_BASE_URL env vars
 */

import { describe, it, expect, beforeAll, skipIf } from 'vitest'

const hasLLM = !!(process.env.LLM_API_KEY && process.env.LLM_BASE_URL)

const B2C_TERMS = ['cart', 'order', 'checkout', 'add to cart', 'view cart']
const B2B_TERMS = ['purchase request', 'pr', 'catalog', 'budget', 'approval']

describe.skipIf(!hasLLM)('LLM B2B Behavior (TDD)', () => {
  it('should use B2B terms in response', async () => {
    // Test query that could trigger B2C or B2B response
    const query = "I want to buy a laptop for the design team"
    
    const response = await fetch(`${LLM_ENDPOINT}/openai/deployments/${LLM_DEPLOYMENT}/chat/completions?api-version=2024-10-21`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are ProcureAI, a B2B procurement assistant. Use procurement terminology: purchase request, PR, catalog item, budget, approval workflow.' },
          { role: 'user', content: query }
        ],
        max_tokens: 200,
      }),
    })

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content ?? ''
    
    // Business requirement: response should NOT contain B2C terms
    const hasB2C = B2C_TERMS.some(term => reply.toLowerCase().includes(term))
    expect(hasB2C).toBe(false)
    
    // Business requirement: response SHOULD use B2B terms
    const hasB2B = B2B_TERMS.some(term => reply.toLowerCase().includes(term))
    expect(hasB2B).toBe(true)
  })

  it('should use B2B tool names in tool_calls', async () => {
    const query = "show me the budget status for my department"
    
    const response = await fetch(`${LLM_ENDPOINT}/openai/deployments/${LLM_DEPLOYMENT}/chat/completions?api-version=2024-10-21`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are ProcureAI, a B2B procurement assistant. Available tools: search_catalog, get_budget_status, manage_purchase_request, submit_for_approval, get_purchase_requests, process_approval, raise_dispute.' },
          { role: 'user', content: query }
        ],
        tools: [
          { type: 'function', function: { name: 'search_catalog', description: 'Search vendor catalog' } },
          { type: 'function', function: { name: 'get_budget_status', description: 'Get department budget status' } },
          { type: 'function', function: { name: 'manage_purchase_request', description: 'Create/update purchase request' } },
        ],
        max_tokens: 200,
      }),
    })

    const data = await response.json()
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.name
    
    // Business requirement: must call B2B tool, not B2C
    expect(toolCall).toBeDefined()
    expect(toolCall).not.toContain('cart')
    expect(toolCall).not.toContain('order')
    expect(toolCall).not.toContain('product')
  })
})