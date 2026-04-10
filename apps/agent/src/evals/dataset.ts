// apps/agent/src/evals/dataset.ts
// LLM Evaluation Dataset for Agentic AI Quality
// Tests: Tool Selection, Parameter Quality, Hallucination Prevention

export type EvalCase = {
  id: string
  input: string  // user message
  expectedTools: string[]  // tools that MUST be called
  forbiddenTools?: string[]  // tools that must NOT be called
  expectedArgs?: Record<string, unknown>  // arg shape to verify
  expectedNoHallucination?: {
    forbiddenPatterns: string[]  // fields that must NOT appear
  }
  tags: string[]  // 'search' | 'cart' | 'orders' | 'returns' | 'no-tool' | 'hallucination' | 'params'
}

// Custom matcher helper for flexible parameter validation
export function expect_contains_any(options: string[]) {
  return { __type: 'contains_any' as const, options }
}

export function expect_contains(substring: string) {
  return { __type: 'contains' as const, substring }
}

export function expect_number_in_range(min: number, max: number) {
  return { __type: 'number_in_range' as const, min, max }
}

export const EVAL_DATASET: EvalCase[] = [
  // ============================================
  // TOOL SELECTION: Search Products
  // ============================================
  {
    id: 'search-01',
    input: 'Show me headphones under ₹15000',
    expectedTools: ['searchProducts'],
    expectedArgs: { query: 'headphones', maxPrice: 15000 },
    tags: ['search', 'price-filter'],
  },
  {
    id: 'search-02',
    input: 'I need earbuds for working out at the gym',
    expectedTools: ['searchProducts'],
    expectedArgs: {
      query: expect_contains_any(['earbuds', 'audio', 'wireless', 'sport', 'gym']),
    },
    tags: ['search', 'semantic'],
  },
  {
    id: 'search-03',
    input: 'Looking for a gaming laptop under ₹80000',
    expectedTools: ['searchProducts'],
    expectedArgs: { query: expect_contains('gaming'), maxPrice: 80000 },
    tags: ['search', 'price-filter'],
  },
  {
    id: 'search-04',
    input: 'What smartphones are available?',
    expectedTools: ['searchProducts'],
    expectedArgs: { query: expect_contains_any(['smartphone', 'phone', 'mobile']) },
    tags: ['search', 'general'],
  },
  {
    id: 'search-05',
    input: 'Show me Sony products',
    expectedTools: ['searchProducts'],
    expectedArgs: { brand: 'Sony' },
    tags: ['search', 'brand-filter'],
  },
  {
    id: 'search-06',
    input: 'I want to buy a smartwatch',
    expectedTools: ['searchProducts'],
    expectedArgs: { query: expect_contains_any(['smartwatch', 'watch']) },
    tags: ['search', 'intent'],
  },

  // ============================================
  // TOOL SELECTION: Cart Operations
  // ============================================
  {
    id: 'cart-01',
    input: 'What\'s in my cart?',
    expectedTools: ['viewCart'],
    forbiddenTools: ['searchProducts', 'getOrders', 'initiateReturn'],
    tags: ['cart', 'view'],
  },
  {
    id: 'cart-02',
    input: 'Show me my shopping cart',
    expectedTools: ['viewCart'],
    forbiddenTools: ['searchProducts', 'getOrders'],
    tags: ['cart', 'view'],
  },
  {
    id: 'cart-03',
    input: 'Add the Sony headphones to my cart',
    expectedTools: ['addToCart'],
    forbiddenTools: ['viewCart', 'getOrders'],
    tags: ['cart', 'add'],
  },
  {
    id: 'cart-04',
    input: 'Can you put 2 of those in my cart?',
    expectedTools: ['addToCart'],
    expectedArgs: { quantity: expect_number_in_range(1, 10) },
    tags: ['cart', 'add', 'quantity'],
  },

  // ============================================
  // TOOL SELECTION: Order Management
  // ============================================
  {
    id: 'orders-01',
    input: 'Show my recent orders',
    expectedTools: ['getOrders'],
    forbiddenTools: ['searchProducts', 'viewCart'],
    tags: ['orders', 'list'],
  },
  {
    id: 'orders-02',
    input: 'Where is my order?',
    expectedTools: ['getOrders'],
    forbiddenTools: ['searchProducts', 'viewCart'],
    tags: ['orders', 'tracking'],
  },
  {
    id: 'orders-03',
    input: 'I want to track order ORD-12345',
    expectedTools: ['getOrders'],
    expectedArgs: { limit: expect_number_in_range(1, 10) },
    tags: ['orders', 'tracking'],
  },
  {
    id: 'orders-04',
    input: 'What orders have I placed recently?',
    expectedTools: ['getOrders'],
    forbiddenTools: ['searchProducts', 'viewCart', 'initiateReturn'],
    tags: ['orders', 'history'],
  },

  // ============================================
  // TOOL SELECTION: Returns
  // ============================================
  {
    id: 'returns-01',
    input: 'I want to return order ORD-ABC123',
    expectedTools: ['initiateReturn'],
    expectedArgs: { orderId: expect_contains('ORD-ABC123') },
    tags: ['returns'],
  },
  {
    id: 'returns-02',
    input: 'This product is defective, I need to return it',
    expectedTools: ['initiateReturn'],
    tags: ['returns', 'defective'],
  },
  {
    id: 'returns-03',
    input: 'How do I return my order?',
    expectedTools: ['initiateReturn'],
    tags: ['returns', 'inquiry'],
  },

  // ============================================
  // NO TOOL: Greetings & General Chat
  // ============================================
  {
    id: 'no-tool-01',
    input: 'Hello! How are you?',
    expectedTools: [],
    forbiddenTools: ['searchProducts', 'viewCart', 'getOrders', 'initiateReturn', 'addToCart'],
    tags: ['no-tool', 'greeting'],
  },
  {
    id: 'no-tool-02',
    input: 'Thank you for your help',
    expectedTools: [],
    forbiddenTools: ['searchProducts', 'viewCart', 'getOrders'],
    tags: ['no-tool', 'gratitude'],
  },
  {
    id: 'no-tool-03',
    input: 'What are your store hours?',
    expectedTools: [],
    forbiddenTools: ['searchProducts', 'viewCart', 'getOrders', 'initiateReturn'],
    tags: ['no-tool', 'inquiry'],
  },
  {
    id: 'no-tool-04',
    input: 'Do you have a physical store?',
    expectedTools: [],
    forbiddenTools: ['searchProducts', 'viewCart', 'getOrders'],
    tags: ['no-tool', 'inquiry'],
  },

  // ============================================
  // HALLUCINATION PREVENTION
  // Agent must call tools — not answer from memory
  // ============================================
  {
    id: 'hallucination-01',
    input: 'Tell me the exact specs of Sony WH-1000XM5',
    expectedTools: ['searchProducts'],
    expectedNoHallucination: {
      forbiddenPatterns: [
        '30-hour battery',
        '40mm driver',
        'Bluetooth 5.2',
        'noise cancelling',
        'frequency response',
      ],
    },
    tags: ['hallucination', 'specs'],
  },
  {
    id: 'hallucination-02',
    input: 'What is the price of AirPods Pro 2?',
    expectedTools: ['searchProducts'],
    expectedNoHallucination: {
      forbiddenPatterns: [
        '₹24999',
        '24999',
        'price is',
        'costs',
      ],
    },
    tags: ['hallucination', 'price'],
  },
  {
    id: 'hallucination-03',
    input: 'Is the iPhone 15 in stock?',
    expectedTools: ['searchProducts'],
    expectedNoHallucination: {
      forbiddenPatterns: [
        'in stock',
        'available',
        'out of stock',
        'yes',
        'no',
      ],
    },
    tags: ['hallucination', 'stock'],
  },
  {
    id: 'hallucination-04',
    input: 'What customers say about the Samsung Galaxy S24?',
    expectedTools: ['searchProducts'],
    expectedNoHallucination: {
      forbiddenPatterns: [
        'rating',
        'review',
        'star',
        'customers say',
        '4.5',
        '5 star',
      ],
    },
    tags: ['hallucination', 'reviews'],
  },

  // ============================================
  // PARAMETER QUALITY: Price Extraction
  // ============================================
  {
    id: 'param-price-01',
    input: 'Show headphones between ₹5000 and ₹20000',
    expectedTools: ['searchProducts'],
    expectedArgs: { minPrice: 5000, maxPrice: 20000 },
    tags: ['params', 'price-range'],
  },
  {
    id: 'param-price-02',
    input: 'I want something under 10000 rupees',
    expectedTools: ['searchProducts'],
    expectedArgs: { maxPrice: 10000 },
    tags: ['params', 'price-max'],
  },
  {
    id: 'param-price-03',
    input: 'Budget is ₹50000, show me laptops',
    expectedTools: ['searchProducts'],
    expectedArgs: { maxPrice: 50000, query: expect_contains('laptop') },
    tags: ['params', 'price-max'],
  },

  // ============================================
  // PARAMETER QUALITY: Quantity Extraction
  // ============================================
  {
    id: 'param-qty-01',
    input: 'Add 3 of these to my cart',
    expectedTools: ['addToCart'],
    expectedArgs: { quantity: 3 },
    tags: ['params', 'quantity'],
  },
  {
    id: 'param-qty-02',
    input: 'I\'ll take two please',
    expectedTools: ['addToCart'],
    expectedArgs: { quantity: expect_number_in_range(2, 2) },
    tags: ['params', 'quantity'],
  },

  // ============================================
  // COMPLEX MULTI-INTENT
  // ============================================
  {
    id: 'multi-01',
    input: 'Show me headphones and then add the first one to cart',
    expectedTools: ['searchProducts', 'addToCart'],
    tags: ['multi-intent', 'search-cart'],
  },
  {
    id: 'multi-02',
    input: 'What\'s in my cart and also show my orders',
    expectedTools: ['viewCart', 'getOrders'],
    tags: ['multi-intent', 'cart-orders'],
  },
]

export const EVAL_TARGETS = {
  toolSelection: 90,  // ≥90% tool selection accuracy
  paramQuality: 85,   // ≥85% parameter extraction accuracy
  hallucination: 100, // 100% hallucination prevention
  overall: 88,        // ≥88% overall pass rate
}

export function getEvalCasesByTag(tag: string): EvalCase[] {
  return EVAL_DATASET.filter(c => c.tags.includes(tag))
}

export function getEvalCasesByIds(ids: string[]): EvalCase[] {
  return EVAL_DATASET.filter(c => ids.includes(c.id))
}
