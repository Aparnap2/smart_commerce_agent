/**
 * Mocked Cart E2E Tests
 * 
 * Tests for GenUI CartCanvas component rendering with mocked LangGraph responses.
 * Asserts on cart structure, item rendering, and total calculation display.
 */

import {
  mockCartStream,
  mockProductSearchStream,
  mockErrorStream,
} from '../../support/langgraph-mock'
import { MOCK_CART, MOCK_PRODUCTS } from '../../fixtures/mock-data'

describe('[Mocked] Cart Management — GenUI', () => {

  beforeEach(() => {
    cy.signIn('customer@test.com')
  })

  // ============================================================================
  // Component Rendering Tests
  // ============================================================================

  it('CartCanvas renders after view cart message', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withSingleItem)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStream()
    cy.waitForStreamEnd()

    cy.waitForComponent('cart-canvas')
  })

  it('renders empty cart state correctly', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.empty)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.waitForComponent('cart-canvas')
    cy.get('[data-testid="cart-empty-state"]').should('exist')
  })

  it('renders cart with multiple items', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withMultipleItems)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.waitForComponent('cart-canvas')
    cy.get('[data-testid="cart-item"]')
      .should('have.length', 3)
  })

  // ============================================================================
  // Data Format Tests
  // ============================================================================

  it('cart total is visible in ₹ INR format', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withMultipleItems)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="cart-total"]')
      .should('be.visible')
      .invoke('text')
      .should('match', /₹[\d,]+/)
  })

  it('individual item prices shown correctly', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withMultipleItems)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="cart-item-price"]')
      .first()
      .invoke('text')
      .should('match', /₹[\d,]+/)
  })

  it('item quantities are displayed', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withMultipleItems)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="cart-item-quantity"]')
      .should('have.length.at.least', 1)
  })

  it('item names are visible', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withMultipleItems)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="cart-item-name"]')
      .each(($el) => {
        cy.wrap($el)
          .invoke('text')
          .should('have.length.greaterThan', 0)
      })
  })

  // ============================================================================
  // Empty Cart Tests
  // ============================================================================

  it('empty cart shows helpful message', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.empty)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="cart-empty-state"]')
      .should('exist')
      .invoke('text')
      .should('have.length.greaterThan', 0)
  })

  it('empty cart does not show checkout button', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.empty)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="checkout-button"]').should('not.exist')
  })

  // ============================================================================
  // Cart with Items Tests
  // ============================================================================

  it('cart with items shows checkout button', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withSingleItem)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="checkout-button"]')
      .should('be.visible')
      .should('not.be.disabled')
  })

  it('cart with items shows item count', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withMultipleItems)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="cart-item-count"]')
      .should('contain', '3')
  })

  it('subtotal calculation is correct', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withMultipleItems)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    // Total should match the mock data (₹40,487)
    cy.get('[data-testid="cart-total"]')
      .invoke('text')
      .should('contain', '40,487')
  })

  // ============================================================================
  // Cart Interaction Tests
  // ============================================================================

  it('quantity can be increased', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withSingleItem)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="increase-quantity-button"]')
      .first()
      .should('exist')
      .should('not.be.disabled')
  })

  it('quantity can be decreased', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withSingleItem)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="decrease-quantity-button"]')
      .first()
      .should('exist')
      .should('not.be.disabled')
  })

  it('item can be removed from cart', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withSingleItem)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="remove-item-button"]')
      .first()
      .should('exist')
      .should('not.be.disabled')
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it('cart error shows message not crash', () => {
    cy.mockLangGraph(
      mockErrorStream("I'm having trouble accessing your cart.")
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="cart-canvas"]').should('not.exist')
    cy.get('[data-testid="message-assistant"]')
      .should('exist')
      .should('contain', 'trouble')
  })

  // ============================================================================
  // Multi-turn Tests: Search → Add to Cart → View Cart
  // ============================================================================

  it('add product to cart shows updated CartCanvas', () => {
    const responses = [
      mockProductSearchStream(MOCK_PRODUCTS.headphones),
      mockCartStream(MOCK_CART.withSingleItem),
    ]

    cy.mockLangGraphSequence(responses)

    // First: Search for products
    cy.sendMessage('Show me headphones under ₹20000')
    cy.waitForStreamEnd()
    cy.waitForComponent('product-grid')

    // Second: Add to cart (simulated by second response)
    cy.sendMessage('Add the first one to my cart')
    cy.waitForStreamEnd()
    cy.waitForComponent('cart-canvas')

    // Verify cart shows the item
    cy.get('[data-testid="cart-total"]')
      .invoke('text')
      .should('match', /₹/)
  })

  it('view cart after adding item shows correct total', () => {
    const responses = [
      mockProductSearchStream(MOCK_PRODUCTS.headphones),
      mockCartStream(MOCK_CART.withSingleItem),
      mockCartStream(MOCK_CART.withSingleItem),
    ]

    cy.mockLangGraphSequence(responses)

    cy.sendMessage('Show headphones')
    cy.waitForStreamEnd()

    cy.sendMessage('Add Sony headphones to cart')
    cy.waitForStreamEnd()

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="cart-total"]')
      .invoke('text')
      .should('contain', '26,990')
  })

  // ============================================================================
  // High Value Cart Tests
  // ============================================================================

  it('high value cart displays correctly', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.highValue)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="cart-total"]')
      .invoke('text')
      .should('contain', '59,890')
  })

  it('high value cart shows all items', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.highValue)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="cart-item"]')
      .should('have.length', 2)
  })

  // ============================================================================
  // Performance Tests
  // ============================================================================

  it('cart renders within timeout', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withSingleItem)
    )

    const startTime = Date.now()

    cy.sendMessage('Show my cart')
    cy.waitForComponent('cart-canvas', 10000)

    const renderTime = Date.now() - startTime
    cy.log(`Cart rendered in ${renderTime}ms`)
    
    expect(renderTime).to.be.lessThan(5000)
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  it('cart with single item renders correctly', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withSingleItem)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="cart-item"]')
      .should('have.length', 1)
  })

  it('cart item with quantity > 1 displays correctly', () => {
    cy.mockLangGraph(
      mockCartStream(MOCK_CART.withMultipleItems)
    )

    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    // Second item has quantity 2
    cy.get('[data-testid="cart-item-quantity"]')
      .eq(1)
      .should('contain', '2')
  })

  it('cart handles very long item names', () => {
    const longNameCart = {
      items: [
        {
          productId: 1,
          name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones with Premium Sound Quality and 30 Hour Battery Life - Black Edition',
          price: 2699000,
          quantity: 1,
        },
      ],
      total: 2699000,
    }

    cy.mockLangGraph(mockCartStream(longNameCart))
    cy.sendMessage('Show my cart')
    cy.waitForStreamEnd()

    cy.get('[data-testid="cart-item-name"]')
      .should('exist')
      .invoke('text')
      .should('have.length.greaterThan', 50)
  })
})
