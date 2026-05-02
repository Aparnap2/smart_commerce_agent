/**
 * Mocked Product Search E2E Tests
 * 
 * Tests for GenUI ProductGrid component rendering with mocked LangGraph responses.
 * Asserts on STRUCTURE (component rendered with correct data shape) not CONTENT.
 */

import {
  mockProductSearchStream,
  mockErrorStream,
  mockThinkingThenEmpty,
  type MockProduct,
} from '../../support/langgraph-mock'
import { MOCK_PRODUCTS, MOCK_ERRORS } from '../../fixtures/mock-data'

describe('[Mocked] Product Search — GenUI', () => {

  beforeEach(() => {
    cy.signIn('customer@test.com')
  })

  // ============================================================================
  // Component Rendering Tests
  // ============================================================================

  it('ProductGrid renders after search message', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.headphones)
    )

    cy.sendMessage('Show me headphones')
    cy.waitForStream()
    cy.waitForStreamEnd()

    cy.waitForComponent('product-grid')
    cy.get('[data-testid="product-card"]')
      .should('have.length', 3)
  })

  it('renders correct number of product cards', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.earbuds)
    )

    cy.sendMessage('Show me earbuds')
    cy.waitForStreamEnd()

    cy.waitForComponent('product-grid')
    cy.get('[data-testid="product-card"]')
      .should('have.length', 2)
  })

  it('empty state shown when no products found', () => {
    cy.mockLangGraph(
      mockThinkingThenEmpty('xyznonexistentproduct9999')
    )

    cy.sendMessage('xyznonexistentproduct9999')
    cy.waitForStreamEnd()

    cy.waitForComponent('product-grid-empty')
  })

  // ============================================================================
  // Data Format Tests
  // ============================================================================

  it('prices shown in ₹ INR format', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.headphones)
    )

    cy.sendMessage('Show me headphones')
    cy.waitForStreamEnd()

    cy.get('[data-testid="product-price"]')
      .each(($el) => {
        const text = $el.text().trim()
        expect(text).to.match(/^₹[\d,]+$/)
      })
  })

  it('product names are visible', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.headphones)
    )

    cy.sendMessage('Show me headphones')
    cy.waitForStreamEnd()

    cy.get('[data-testid="product-card"]')
      .each(($card) => {
        cy.wrap($card)
          .find('[data-testid="product-name"]')
          .should('exist')
          .invoke('text')
          .should('have.length.greaterThan', 0)
      })
  })

  it('product ratings displayed', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.headphones)
    )

    cy.sendMessage('Show me headphones')
    cy.waitForStreamEnd()

    cy.get('[data-testid="product-rating"]')
      .should('have.length', 3)
  })

  // ============================================================================
  // Stock Status Tests
  // ============================================================================

  it('out-of-stock product shows disabled button', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.outOfStock)
    )

    cy.sendMessage('Show all headphones')
    cy.waitForStreamEnd()

    cy.get('[data-testid="product-card"]')
      .first()
      .find('[data-testid="add-to-cart-button"]')
      .should('be.disabled')
  })

  it('in-stock product shows enabled add to cart button', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.headphones)
    )

    cy.sendMessage('Show me headphones in stock')
    cy.waitForStreamEnd()

    cy.get('[data-testid="product-card"]')
      .first()
      .find('[data-testid="add-to-cart-button"]')
      .should('not.be.disabled')
      .should('be.enabled')
  })

  it('mixed stock products render correctly', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.mixed)
    )

    cy.sendMessage('Show all products')
    cy.waitForStreamEnd()

    // First product (in stock) - enabled
    cy.get('[data-testid="product-card"]')
      .eq(0)
      .find('[data-testid="add-to-cart-button"]')
      .should('not.be.disabled')

    // Second product (out of stock) - disabled
    cy.get('[data-testid="product-card"]')
      .eq(1)
      .find('[data-testid="add-to-cart-button"]')
      .should('be.disabled')
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it('LLM error shows message not crash', () => {
    cy.mockLangGraph(
      mockErrorStream(MOCK_ERRORS.searchError)
    )

    cy.sendMessage('Show me headphones')
    cy.waitForStreamEnd()

    // No product grid — just the text message
    cy.get('[data-testid="product-grid"]').should('not.exist')
    cy.get('[data-testid="message-assistant"]')
      .should('exist')
      .should('contain', 'trouble')
  })

  it('empty results do not crash the UI', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.empty)
    )

    cy.sendMessage('search for nothing')
    cy.waitForStreamEnd()

    // Should show empty state, not crash
    cy.get('[data-testid="product-grid-empty"]').should('exist')
  })

  // ============================================================================
  // Multi-turn Conversation Tests
  // ============================================================================

  it('refines search with follow-up message', () => {
    const responses = [
      mockProductSearchStream(MOCK_PRODUCTS.headphones),
      mockProductSearchStream(MOCK_PRODUCTS.budget),
    ]

    cy.mockLangGraphSequence(responses)

    // First search
    cy.sendMessage('Show me headphones')
    cy.waitForStreamEnd()
    cy.waitForComponent('product-grid')
    cy.get('[data-testid="product-card"]').should('have.length', 3)

    // Follow-up refinement
    cy.sendMessage('Show cheaper ones under 10000')
    cy.waitForStreamEnd()
    cy.waitForComponent('product-grid')
    cy.get('[data-testid="product-card"]').should('have.length', 2)
  })

  it('context persists across multiple searches', () => {
    const responses = [
      mockProductSearchStream(MOCK_PRODUCTS.headphones),
      mockProductSearchStream(MOCK_PRODUCTS.earbuds),
      mockProductSearchStream(MOCK_PRODUCTS.headphones),
    ]

    cy.mockLangGraphSequence(responses)

    cy.sendMessage('Show headphones')
    cy.waitForStreamEnd()
    cy.get('[data-testid="product-card"]').should('have.length', 3)

    cy.sendMessage('Actually show earbuds')
    cy.waitForStreamEnd()
    cy.get('[data-testid="product-card"]').should('have.length', 2)

    cy.sendMessage('Go back to headphones')
    cy.waitForStreamEnd()
    cy.get('[data-testid="product-card"]').should('have.length', 3)
  })

  // ============================================================================
  // UI Interaction Tests
  // ============================================================================

  it('product card is clickable', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.headphones)
    )

    cy.sendMessage('Show me headphones')
    cy.waitForStreamEnd()

    cy.get('[data-testid="product-card"]')
      .first()
      .should('exist')
      .click({ force: true })
  })

  it('add to cart button can be clicked for in-stock items', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.headphones)
    )

    cy.sendMessage('Show me headphones')
    cy.waitForStreamEnd()

    cy.get('[data-testid="add-to-cart-button"]')
      .first()
      .should('not.be.disabled')
      .click({ force: true })
  })

  // ============================================================================
  // Performance Tests
  // ============================================================================

  it('product grid renders within timeout', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.headphones)
    )

    const startTime = Date.now()

    cy.sendMessage('Show me headphones')
    cy.waitForComponent('product-grid', 10000)

    const renderTime = Date.now() - startTime
    cy.log(`Product grid rendered in ${renderTime}ms`)
    
    // Assert it rendered in reasonable time (< 5 seconds for mocked response)
    expect(renderTime).to.be.lessThan(5000)
  })

  it('stream completes within expected time', () => {
    cy.mockLangGraph(
      mockProductSearchStream(MOCK_PRODUCTS.headphones)
    )

    const startTime = Date.now()

    cy.sendMessage('Show me headphones')
    cy.waitForStreamEnd(15000)

    const totalTime = Date.now() - startTime
    cy.log(`Stream completed in ${totalTime}ms`)
    
    expect(totalTime).to.be.lessThan(10000)
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  it('handles very long product names', () => {
    const longNameProducts: MockProduct[] = [
      {
        id: 100,
        name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones with Premium Sound Quality and 30 Hour Battery Life - Black',
        price: 2699000,
        stock: 10,
        category: 'headphones',
        brand: 'Sony',
        rating: 4.8,
      },
    ]

    cy.mockLangGraph(mockProductSearchStream(longNameProducts))
    cy.sendMessage('Show premium headphones')
    cy.waitForStreamEnd()

    cy.get('[data-testid="product-name"]')
      .should('exist')
      .invoke('text')
      .should('have.length.greaterThan', 50)
  })

  it('handles high price values', () => {
    const expensiveProducts: MockProduct[] = [
      {
        id: 200,
        name: 'Luxury Headphones',
        price: 99999900, // ₹9,99,999
        stock: 2,
        category: 'headphones',
        brand: 'Luxury',
        rating: 5.0,
      },
    ]

    cy.mockLangGraph(mockProductSearchStream(expensiveProducts))
    cy.sendMessage('Show luxury headphones')
    cy.waitForStreamEnd()

    cy.get('[data-testid="product-price"]')
      .invoke('text')
      .should('contain', '₹')
  })

  it('handles zero rating', () => {
    const unratedProducts: MockProduct[] = [
      {
        id: 300,
        name: 'New Product',
        price: 99900,
        stock: 5,
        category: 'headphones',
        brand: 'NewBrand',
        rating: 0,
      },
    ]

    cy.mockLangGraph(mockProductSearchStream(unratedProducts))
    cy.sendMessage('Show new products')
    cy.waitForStreamEnd()

    cy.get('[data-testid="product-rating"]')
      .should('exist')
  })
})
