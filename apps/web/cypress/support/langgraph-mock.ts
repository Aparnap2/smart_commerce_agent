/**
 * LangGraph Mock Support for Agentic GenUI E2E Tests
 * 
 * Intercepts the LangGraph SSE stream and returns scripted responses
 * that include both text messages AND ui_events that render components.
 * 
 * Key technique: Assert on STRUCTURE (did the right component render with
 * the right shape of data?) not CONTENT (exact text from LLM).
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type SSEEvent = {
  event: string
  data: unknown
}

export type MockProduct = {
  id: number
  name: string
  price: number
  stock: number
  category: string
  brand: string
  rating: number
}

export type MockCartItem = {
  productId: number
  name: string
  price: number
  quantity: number
}

export type MockCart = {
  items: MockCartItem[]
  total: number
}

export type MockOrder = {
  id: string
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'
  total: number
  orderDate: string
  trackingNumber?: string
}

export type MockReturnOption = {
  type: 'refund' | 'replacement' | 'store_credit'
  label: string
  bonus?: number
}

// ============================================================================
// SSE Stream Builder
// ============================================================================

/**
 * Builds a properly formatted SSE stream from an array of events
 */
function sseChunk(events: SSEEvent[]): string {
  return events
    .map(e => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join('')
}

// ============================================================================
// Mock Stream Builders
// ============================================================================

/**
 * Simulates: agent responds with text + tool call → tool executes → ui_event fires
 */
export function mockProductSearchStream(products: MockProduct[]): string {
  return sseChunk([
    // 1. Run starts
    {
      event: 'metadata',
      data: { run_id: 'mock-run-' + Date.now() }
    },
    // 2. Agent decides to call searchProducts tool
    {
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: 'msg-1',
        content: '',
        tool_calls: [{
          id: 'call-1',
          name: 'searchProducts',
          args: { query: 'headphones', inStockOnly: true }
        }]
      }]
    },
    // 3. Tool executes — result comes back
    {
      event: 'messages/partial',
      data: [{
        type: 'tool',
        id: 'tool-1',
        name: 'searchProducts',
        content: JSON.stringify(products),
        tool_call_id: 'call-1',
      }]
    },
    // 4. GenUI component event fires
    {
      event: 'custom',
      data: {
        type: 'ui',
        name: 'product-grid',
        props: { loading: false, products },
        metadata: { messageId: 'msg-1' }
      }
    },
    // 5. Agent sends final text
    {
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: 'msg-2',
        content: 'Here are some products I found for you.',
        tool_calls: []
      }]
    },
    // 6. Stream ends
    {
      event: 'end',
      data: {}
    }
  ])
}

/**
 * Simulates cart retrieval with items
 */
export function mockCartStream(cart: MockCart): string {
  return sseChunk([
    {
      event: 'metadata',
      data: { run_id: 'mock-cart-' + Date.now() }
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: 'msg-1',
        content: '',
        tool_calls: [{
          id: 'call-cart-1',
          name: 'getCart',
          args: {}
        }]
      }]
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'tool',
        id: 'tool-cart-1',
        name: 'getCart',
        content: JSON.stringify(cart),
        tool_call_id: 'call-cart-1',
      }]
    },
    {
      event: 'custom',
      data: {
        type: 'ui',
        name: 'cart-canvas',
        props: { items: cart.items, total: cart.total },
        metadata: { messageId: 'msg-1' }
      }
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: 'msg-2',
        content: cart.items.length > 0 
          ? `You have ${cart.items.length} item(s) in your cart. Total: ₹${cart.total.toLocaleString('en-IN')}`
          : 'Your cart is empty.',
        tool_calls: []
      }]
    },
    {
      event: 'end',
      data: {}
    }
  ])
}

/**
 * Simulates order history retrieval
 */
export function mockOrdersStream(orders: MockOrder[]): string {
  return sseChunk([
    {
      event: 'metadata',
      data: { run_id: 'mock-orders-' + Date.now() }
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: 'msg-1',
        content: '',
        tool_calls: [{
          id: 'call-orders-1',
          name: 'getOrders',
          args: { limit: 5 }
        }]
      }]
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'tool',
        id: 'tool-orders-1',
        name: 'getOrders',
        content: JSON.stringify(orders),
        tool_call_id: 'call-orders-1',
      }]
    },
    {
      event: 'custom',
      data: {
        type: 'ui',
        name: 'order-list',
        props: { orders },
        metadata: { messageId: 'msg-1' }
      }
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: 'msg-2',
        content: orders.length > 0
          ? `Here are your recent ${orders.length} order(s).`
          : "You haven't placed any orders yet.",
        tool_calls: []
      }]
    },
    {
      event: 'end',
      data: {}
    }
  ])
}

/**
 * Simulates return eligibility check with options
 */
export function mockReturnStream(orderId: string, eligible: boolean, options?: MockReturnOption[]): string {
  if (!eligible) {
    return sseChunk([
      {
        event: 'metadata',
        data: { run_id: 'mock-return-' + Date.now() }
      },
      {
        event: 'messages/partial',
        data: [{
          type: 'ai',
          id: 'msg-1',
          content: '',
          tool_calls: [{
            id: 'call-return-1',
            name: 'checkReturnEligibility',
            args: { orderId }
          }]
        }]
      },
      {
        event: 'messages/partial',
        data: [{
          type: 'tool',
          id: 'tool-return-1',
          name: 'checkReturnEligibility',
          content: JSON.stringify({ eligible: false, reason: 'Outside 7-day return window' }),
          tool_call_id: 'call-return-1',
        }]
      },
      {
        event: 'messages/partial',
        data: [{
          type: 'ai',
          id: 'msg-2',
          content: `I'm sorry, but order ${orderId} is not eligible for return as it's outside the 7-day return window.`,
          tool_calls: []
        }]
      },
      {
        event: 'end',
        data: {}
      }
    ])
  }

  const returnOptions = options || [
    { type: 'refund', label: 'Refund to original payment method', bonus: 0 },
    { type: 'replacement', label: 'Replacement with same product', bonus: 0 },
    { type: 'store_credit', label: 'Store credit with ₹500 bonus', bonus: 500 }
  ]

  return sseChunk([
    {
      event: 'metadata',
      data: { run_id: 'mock-return-' + Date.now() }
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: 'msg-1',
        content: '',
        tool_calls: [{
          id: 'call-return-1',
          name: 'checkReturnEligibility',
          args: { orderId }
        }]
      }]
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'tool',
        id: 'tool-return-1',
        name: 'checkReturnEligibility',
        content: JSON.stringify({ eligible: true, orderId, options: returnOptions }),
        tool_call_id: 'call-return-1',
      }]
    },
    {
      event: 'custom',
      data: {
        type: 'ui',
        name: 'return-card',
        props: { orderId, options: returnOptions },
        metadata: { messageId: 'msg-1' }
      }
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: 'msg-2',
        content: `Great news! Order ${orderId} is eligible for return. Please select your preferred return option below.`,
        tool_calls: []
      }]
    },
    {
      event: 'end',
      data: {}
    }
  ])
}

/**
 * Simulates an error response from the LLM
 */
export function mockErrorStream(message: string): string {
  return sseChunk([
    {
      event: 'metadata',
      data: { run_id: 'mock-error-' + Date.now() }
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: 'msg-1',
        content: message,
        tool_calls: []
      }]
    },
    {
      event: 'end',
      data: {}
    }
  ])
}

/**
 * Simulates agent thinking then returning empty results
 */
export function mockThinkingThenEmpty(query: string): string {
  return sseChunk([
    {
      event: 'metadata',
      data: { run_id: 'mock-empty-' + Date.now() }
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: 'msg-1',
        content: '',
        tool_calls: [{
          id: 'call-search-1',
          name: 'searchProducts',
          args: { query }
        }]
      }]
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'tool',
        id: 'tool-search-1',
        name: 'searchProducts',
        content: JSON.stringify([]),
        tool_call_id: 'call-search-1',
      }]
    },
    {
      event: 'custom',
      data: {
        type: 'ui',
        name: 'product-grid-empty',
        props: { query },
        metadata: { messageId: 'msg-1' }
      }
    },
    {
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: 'msg-2',
        content: `I couldn't find any products matching "${query}". Try different keywords or browse our categories.`,
        tool_calls: []
      }]
    },
    {
      event: 'end',
      data: {}
    }
  ])
}

/**
 * Simulates multi-turn conversation with context persistence
 */
export function mockMultiTurnStream(turns: Array<{
  toolCall: string
  toolResult: unknown
  uiComponent?: string
  uiProps?: Record<string, unknown>
  response: string
}>): string {
  const events: SSEEvent[] = [
    { event: 'metadata', data: { run_id: 'mock-multiturn-' + Date.now() } }
  ]

  turns.forEach((turn, index) => {
    const msgId = `msg-${index + 1}`
    const callId = `call-${index + 1}`
    const toolId = `tool-${index + 1}`

    // Tool call
    events.push({
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: msgId,
        content: '',
        tool_calls: [{
          id: callId,
          name: turn.toolCall,
          args: {}
        }]
      }]
    })

    // Tool result
    events.push({
      event: 'messages/partial',
      data: [{
        type: 'tool',
        id: toolId,
        name: turn.toolCall,
        content: JSON.stringify(turn.toolResult),
        tool_call_id: callId,
      }]
    })

    // Optional UI component
    if (turn.uiComponent) {
      events.push({
        event: 'custom',
        data: {
          type: 'ui',
          name: turn.uiComponent,
          props: turn.uiProps || {},
          metadata: { messageId: msgId }
        }
      })
    }

    // Agent response
    events.push({
      event: 'messages/partial',
      data: [{
        type: 'ai',
        id: `msg-response-${index + 1}`,
        content: turn.response,
        tool_calls: []
      }]
    })
  })

  events.push({ event: 'end', data: {} })

  return sseChunk(events)
}

// ============================================================================
// Cypress Command Registration
// ============================================================================

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Mock the LangGraph SSE stream with a single response
       */
      mockLangGraph(responseBody: string): Chainable<void>
      
      /**
       * Mock the LangGraph SSE stream with a sequence of responses
       */
      mockLangGraphSequence(responseBodies: string[]): Chainable<void>
      
      /**
       * Wait for the stream to start (agent-thinking appears)
       */
      waitForStream(timeout?: number): Chainable<void>
      
      /**
       * Wait for a specific component to render by data-testid
       */
      waitForComponent(testId: string, timeout?: number): Chainable<void>
      
      /**
       * Wait for the stream to complete (agent-thinking disappears)
       */
      waitForStreamEnd(timeout?: number): Chainable<void>
    }
  }
}

/**
 * Register all LangGraph mock Cypress commands
 */
export function registerLangGraphMockCommands() {
  /**
   * Mock the LangGraph SSE stream with a single response
   * Intercepts LangGraph SDK endpoints at http://localhost:2024
   */
  Cypress.Commands.add('mockLangGraph', (responseBody: string) => {
    // Intercept LangGraph SDK run endpoint
    cy.intercept('POST', '**/assistants/*/threads/*/runs', {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        run_id: 'mock-run-' + Date.now(),
        thread_id: 'mock-thread',
        assistant_id: 'customer',
      }),
    }).as('langGraphRun')

    // Intercept LangGraph SDK stream endpoint
    cy.intercept('GET', '**/assistants/*/threads/*/runs/*/stream', {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body: responseBody,
    }).as('langGraphStream')

    // Also intercept /api/copilotkit for backwards compatibility
    cy.intercept('POST', '/api/copilotkit', {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body: responseBody,
    }).as('langGraphMock')
  })

  /**
   * Mock the LangGraph SSE stream with a sequence of responses
   * Each call to sendMessage will use the next response in the sequence
   */
  Cypress.Commands.add('mockLangGraphSequence', (responseBodies: string[]) => {
    let callIndex = 0

    // Intercept LangGraph SDK stream endpoint with sequence
    cy.intercept('GET', '**/assistants/*/threads/*/runs/*/stream', (req) => {
      if (callIndex < responseBodies.length) {
        req.reply({
          statusCode: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
          body: responseBodies[callIndex],
        })
        callIndex++
      } else {
        // Return empty stream for extra calls
        req.reply({
          statusCode: 200,
          headers: {
            'Content-Type': 'text/event-stream',
          },
          body: sseChunk([{ event: 'end', data: {} }]),
        })
      }
    }).as('langGraphSequence')

    // Also intercept /api/copilotkit for backwards compatibility
    cy.intercept('POST', '/api/copilotkit', (req) => {
      if (callIndex < responseBodies.length) {
        req.reply({
          statusCode: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
          body: responseBodies[callIndex],
        })
        callIndex++
      } else {
        req.reply({
          statusCode: 200,
          headers: {
            'Content-Type': 'text/event-stream',
          },
          body: sseChunk([{ event: 'end', data: {} }]),
        })
      }
    }).as('langGraphSequenceLegacy')
  })

  /**
   * Wait for the stream to start (agent-thinking appears)
   */
  Cypress.Commands.add('waitForStream', (timeout = 8000) => {
    cy.get('[data-testid="agent-thinking"]', { timeout })
      .should('exist')
  })

  /**
   * Wait for a specific component to render by data-testid
   */
  Cypress.Commands.add('waitForComponent', (testId: string, timeout = 15000) => {
    cy.get(`[data-testid="${testId}"]`, { timeout })
      .should('exist')
  })

  /**
   * Wait for the stream to complete (agent-thinking disappears)
   */
  Cypress.Commands.add('waitForStreamEnd', (timeout = 45000) => {
    cy.get('[data-testid="agent-thinking"]', { timeout })
      .should('not.exist')
  })
}
