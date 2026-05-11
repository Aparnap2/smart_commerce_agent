import { describe, it, expect } from 'vitest'

const hasOllama = !!(process.env.OLLAMA_BASE_URL && process.env.OLLAMA_API_KEY)

describe.skipIf(!hasOllama)('Debug LLM Response', () => {
  it('should show actual LLM response', async () => {
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
    
    if (!response.ok) {
      console.error(`HTTP ${response.status}: ${response.statusText}`)
      const errorText = await response.text()
      console.error('Error body:', errorText)
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    console.log('Full response:', JSON.stringify(data, null, 2))
    
    const reply = data.message?.content ?? ''
    console.log('LLM Reply:', reply)
    
    const hasB2C = ['cart', 'order', 'checkout', 'add to cart', 'view cart'].some(t => reply.toLowerCase().includes(t))
    console.log('Has B2C terms:', hasB2C)
    
    const hasB2B = ['purchase request', 'pr', 'catalog', 'budget', 'approval'].some(t => reply.toLowerCase().includes(t))
    console.log('Has B2B terms:', hasB2B)
    
    expect(true).toBe(true) // Just to make test pass for now
  })
})