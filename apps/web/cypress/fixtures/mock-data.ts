/**
 * Mock Data Fixtures for Agentic GenUI E2E Tests
 * 
 * Realistic test data that matches the shape of production data.
 * All prices are in paise (₹1 = 100 paise) for INR format.
 */

import type { MockProduct, MockCart, MockOrder, MockReturnOption } from '../support/langgraph-mock'

// ============================================================================
// Product Fixtures
// ============================================================================

export const MOCK_PRODUCTS = {
  /** Headphones category - in stock */
  headphones: [
    {
      id: 1,
      name: 'Sony WH-1000XM5',
      price: 2699000, // ₹26,990
      stock: 10,
      category: 'headphones',
      brand: 'Sony',
      rating: 4.8,
    },
    {
      id: 2,
      name: 'JBL Tune 760NC',
      price: 599900, // ₹5,999
      stock: 8,
      category: 'headphones',
      brand: 'JBL',
      rating: 4.3,
    },
    {
      id: 3,
      name: 'Sennheiser Momentum 4',
      price: 3499000, // ₹34,990
      stock: 5,
      category: 'headphones',
      brand: 'Sennheiser',
      rating: 4.7,
    },
  ] as MockProduct[],

  /** Earbuds category - in stock */
  earbuds: [
    {
      id: 10,
      name: 'Apple AirPods Pro 2',
      price: 2490000, // ₹24,900
      stock: 15,
      category: 'earbuds',
      brand: 'Apple',
      rating: 4.9,
    },
    {
      id: 11,
      name: 'Samsung Galaxy Buds2 Pro',
      price: 1699900, // ₹16,999
      stock: 12,
      category: 'earbuds',
      brand: 'Samsung',
      rating: 4.5,
    },
  ] as MockProduct[],

  /** Out of stock products */
  outOfStock: [
    {
      id: 5,
      name: 'Apple AirPods Pro',
      price: 2490000, // ₹24,900
      stock: 0,
      category: 'earbuds',
      brand: 'Apple',
      rating: 4.9,
    },
    {
      id: 6,
      name: 'Bose QuietComfort Earbuds',
      price: 2690000, // ₹26,900
      stock: 0,
      category: 'earbuds',
      brand: 'Bose',
      rating: 4.6,
    },
  ] as MockProduct[],

  /** Budget products under ₹10,000 */
  budget: [
    {
      id: 20,
      name: 'boAt Rockerz 450',
      price: 149900, // ₹1,499
      stock: 50,
      category: 'headphones',
      brand: 'boAt',
      rating: 4.1,
    },
    {
      id: 21,
      name: 'Realme Buds Air 3',
      price: 399900, // ₹3,999
      stock: 30,
      category: 'earbuds',
      brand: 'Realme',
      rating: 4.2,
    },
  ] as MockProduct[],

  /** Empty search results */
  empty: [] as MockProduct[],

  /** Mixed stock - some in stock, some out */
  mixed: [
    {
      id: 1,
      name: 'Sony WH-1000XM5',
      price: 2699000,
      stock: 10,
      category: 'headphones',
      brand: 'Sony',
      rating: 4.8,
    },
    {
      id: 5,
      name: 'Apple AirPods Pro',
      price: 2490000,
      stock: 0,
      category: 'earbuds',
      brand: 'Apple',
      rating: 4.9,
    },
  ] as MockProduct[],
}

// ============================================================================
// Cart Fixtures
// ============================================================================

export const MOCK_CART = {
  /** Empty cart */
  empty: {
    items: [],
    total: 0,
  } as MockCart,

  /** Cart with single item */
  withSingleItem: {
    items: [
      {
        productId: 1,
        name: 'Sony WH-1000XM5',
        price: 2699000,
        quantity: 1,
      },
    ],
    total: 2699000,
  } as MockCart,

  /** Cart with multiple items */
  withMultipleItems: {
    items: [
      {
        productId: 1,
        name: 'Sony WH-1000XM5',
        price: 2699000,
        quantity: 1,
      },
      {
        productId: 2,
        name: 'JBL Tune 760NC',
        price: 599900,
        quantity: 2,
      },
      {
        productId: 20,
        name: 'boAt Rockerz 450',
        price: 149900,
        quantity: 1,
      },
    ],
    total: 4048700, // ₹40,487
  } as MockCart,

  /** Cart with high value items */
  highValue: {
    items: [
      {
        productId: 3,
        name: 'Sennheiser Momentum 4',
        price: 3499000,
        quantity: 1,
      },
      {
        productId: 10,
        name: 'Apple AirPods Pro 2',
        price: 2490000,
        quantity: 1,
      },
    ],
    total: 5989000, // ₹59,890
  } as MockCart,
}

// ============================================================================
// Order Fixtures
// ============================================================================

export const MOCK_ORDERS = {
  /** Empty order history */
  empty: [] as MockOrder[],

  /** Single delivered order */
  singleDelivered: [
    {
      id: 'order-abc12345',
      status: 'DELIVERED',
      total: 2699000, // ₹26,990
      orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      trackingNumber: 'BLR123456789IN',
    },
  ] as MockOrder[],

  /** Multiple orders with various statuses */
  multiple: [
    {
      id: 'order-abc12345',
      status: 'DELIVERED',
      total: 2699000, // ₹26,990
      orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      trackingNumber: 'BLR123456789IN',
    },
    {
      id: 'order-def67890',
      status: 'SHIPPED',
      total: 599900, // ₹5,999
      orderDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      trackingNumber: 'BLR987654321IN',
    },
    {
      id: 'order-ghi11111',
      status: 'PENDING',
      total: 2490000, // ₹24,900
      orderDate: new Date().toISOString(),
    },
  ] as MockOrder[],

  /** Orders eligible for return (within 7 days) */
  eligibleForReturn: [
    {
      id: 'order-return-eligible',
      status: 'DELIVERED',
      total: 1699900, // ₹16,999
      orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      trackingNumber: 'BLR111222333IN',
    },
  ] as MockOrder[],

  /** Orders NOT eligible for return (outside 7 days) */
  notEligibleForReturn: [
    {
      id: 'order-return-expired',
      status: 'DELIVERED',
      total: 149900, // ₹1,499
      orderDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
      trackingNumber: 'BLR444555666IN',
    },
  ] as MockOrder[],

  /** Large order history (testing pagination/limits) */
  large: Array.from({ length: 10 }, (_, i) => ({
    id: `order-large-${String(i + 1).padStart(5, '0')}`,
    status: ['DELIVERED', 'SHIPPED', 'PENDING', 'CANCELLED'][i % 4] as MockOrder['status'],
    total: (Math.random() * 5000000 + 100000) | 0, // Random between ₹1,000 and ₹60,000
    orderDate: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
    trackingNumber: i % 2 === 0 ? `BLR${String(i).padStart(9, '0')}IN` : undefined,
  })) as MockOrder[],
}

// ============================================================================
// Return Option Fixtures
// ============================================================================

export const MOCK_RETURN_OPTIONS = {
  /** Standard return options */
  standard: [
    {
      type: 'refund' as const,
      label: 'Refund to original payment method',
      bonus: 0,
    },
    {
      type: 'replacement' as const,
      label: 'Replacement with same product',
      bonus: 0,
    },
    {
      type: 'store_credit' as const,
      label: 'Store credit with ₹500 bonus',
      bonus: 500,
    },
  ] as MockReturnOption[],

  /** Refund only (no replacement available) */
  refundOnly: [
    {
      type: 'refund' as const,
      label: 'Refund to original payment method',
      bonus: 0,
    },
    {
      type: 'store_credit' as const,
      label: 'Store credit with ₹500 bonus',
      bonus: 500,
    },
  ] as MockReturnOption[],

  /** Enhanced store credit offer */
  enhancedCredit: [
    {
      type: 'refund' as const,
      label: 'Refund to original payment method',
      bonus: 0,
    },
    {
      type: 'replacement' as const,
      label: 'Replacement with same product',
      bonus: 0,
    },
    {
      type: 'store_credit' as const,
      label: 'Store credit with ₹1000 bonus',
      bonus: 1000,
    },
  ] as MockReturnOption[],
}

// ============================================================================
// Error Scenarios
// ============================================================================

export const MOCK_ERRORS = {
  /** Generic LLM error */
  generic: 'I had trouble processing your request. Please try again.',

  /** Search error */
  searchError: 'I had trouble searching for products. Please try again.',

  /** Cart error */
  cartError: "I'm having trouble accessing your cart. Please refresh the page.",

  /** Order error */
  orderError: "I couldn't retrieve your order history. Please try again later.",

  /** Return error */
  returnError: "I'm unable to process return requests at the moment. Please contact support.",

  /** Network error simulation */
  networkError: 'I lost connection. Please check your internet and try again.',

  /** Rate limit error */
  rateLimit: 'Too many requests. Please wait a moment and try again.',
}

// ============================================================================
// Multi-turn Conversation Fixtures
// ============================================================================

export const MOCK_CONVERSATIONS = {
  /** Search → Add to Cart flow */
  searchThenAddToCart: [
    {
      toolCall: 'searchProducts',
      toolResult: MOCK_PRODUCTS.headphones,
      uiComponent: 'product-grid',
      uiProps: { products: MOCK_PRODUCTS.headphones },
      response: 'Here are some headphones I found for you.',
    },
    {
      toolCall: 'addToCart',
      toolResult: { success: true, productId: 1 },
      uiComponent: 'cart-canvas',
      uiProps: MOCK_CART.withSingleItem,
      response: "I've added the Sony WH-1000XM5 to your cart.",
    },
  ],

  /** Cart → Checkout flow */
  cartThenCheckout: [
    {
      toolCall: 'getCart',
      toolResult: MOCK_CART.withMultipleItems,
      uiComponent: 'cart-canvas',
      uiProps: MOCK_CART.withMultipleItems,
      response: `You have ${MOCK_CART.withMultipleItems.items.length} items in your cart. Total: ₹${MOCK_CART.withMultipleItems.total.toLocaleString('en-IN')}`,
    },
  ],

  /** Order → Return flow */
  orderThenReturn: [
    {
      toolCall: 'getOrders',
      toolResult: MOCK_ORDERS.eligibleForReturn,
      uiComponent: 'order-list',
      uiProps: { orders: MOCK_ORDERS.eligibleForReturn },
      response: `Here are your recent ${MOCK_ORDERS.eligibleForReturn.length} order(s).`,
    },
    {
      toolCall: 'checkReturnEligibility',
      toolResult: { eligible: true, orderId: 'order-return-eligible', options: MOCK_RETURN_OPTIONS.standard },
      uiComponent: 'return-card',
      uiProps: { orderId: 'order-return-eligible', options: MOCK_RETURN_OPTIONS.standard },
      response: 'Great news! This order is eligible for return. Please select your preferred return option.',
    },
  ],
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a product with custom overrides
 */
export function createProduct(overrides: Partial<MockProduct>): MockProduct {
  return {
    id: Math.floor(Math.random() * 10000),
    name: 'Test Product',
    price: 999900,
    stock: 10,
    category: 'electronics',
    brand: 'Test Brand',
    rating: 4.5,
    ...overrides,
  }
}

/**
 * Creates an order with custom overrides
 */
export function createOrder(overrides: Partial<MockOrder>): MockOrder {
  return {
    id: `order-${Date.now()}`,
    status: 'PENDING',
    total: 1000000,
    orderDate: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Formats price in INR format (₹X,XXX)
 */
export function formatPrice(priceInPaise: number): string {
  return `₹${(priceInPaise / 100).toLocaleString('en-IN')}`
}
