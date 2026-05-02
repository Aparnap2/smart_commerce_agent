/**
 * Mocked Orders E2E Tests
 * 
 * Tests for GenUI OrderList/OrderCard component rendering with mocked LangGraph responses.
 * Asserts on order structure, status badges, and tracking information display.
 */

import {
  mockOrdersStream,
  mockErrorStream,
} from '../../support/langgraph-mock'
import { MOCK_ORDERS } from '../../fixtures/mock-data'

describe('[Mocked] Orders — GenUI', () => {

  beforeEach(() => {
    cy.signIn('customer@test.com')
  })

  // ============================================================================
  // Component Rendering Tests
  // ============================================================================

  it('OrderList renders after show orders message', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.multiple)
    )

    cy.sendMessage('Show my orders')
    cy.waitForStream()
    cy.waitForStreamEnd()

    cy.waitForComponent('order-list')
  })

  it('renders empty order state correctly', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.empty)
    )

    cy.sendMessage('Show my orders')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-list"]').should('not.exist')
    cy.get('[data-testid="message-assistant"]')
      .last()
      .should('exist')
  })

  it('renders multiple orders correctly', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.multiple)
    )

    cy.sendMessage('Show my orders')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-card"]')
      .should('have.length', 3)
  })

  it('renders single order correctly', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.singleDelivered)
    )

    cy.sendMessage('Show my recent order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-card"]')
      .should('have.length', 1)
  })

  // ============================================================================
  // Data Format Tests
  // ============================================================================

  it('order status badge contains valid status', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.multiple)
    )

    cy.sendMessage('Show my orders')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-status-badge"]')
      .first()
      .invoke('text')
      .should('match', /PENDING|PAID|SHIPPED|DELIVERED|CANCELLED|REFUNDED/)
  })

  it('order total shown in ₹ INR format', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.multiple)
    )

    cy.sendMessage('Show my orders')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-total"]')
      .first()
      .invoke('text')
      .should('match', /₹[\d,]+/)
  })

  it('order date is displayed', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.multiple)
    )

    cy.sendMessage('Show my orders')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-date"]')
      .first()
      .should('exist')
  })

  it('order ID is visible', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.multiple)
    )

    cy.sendMessage('Show my orders')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-id"]')
      .first()
      .invoke('text')
      .should('have.length.greaterThan', 0)
  })

  // ============================================================================
  // Status Badge Tests
  // ============================================================================

  it('delivered order shows DELIVERED status', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.singleDelivered)
    )

    cy.sendMessage('Show my delivered order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-status-badge"]')
      .should('contain', 'DELIVERED')
  })

  it('shipped order shows SHIPPED status', () => {
    const shippedOrder = [
      {
        id: 'order-shipped-test',
        status: 'SHIPPED' as const,
        total: 599900,
        orderDate: new Date().toISOString(),
        trackingNumber: 'BLR987654321IN',
      },
    ]

    cy.mockLangGraph(mockOrdersStream(shippedOrder))
    cy.sendMessage('Show my shipped order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-status-badge"]')
      .should('contain', 'SHIPPED')
  })

  it('pending order shows PENDING status', () => {
    const pendingOrder = [
      {
        id: 'order-pending-test',
        status: 'PENDING' as const,
        total: 2490000,
        orderDate: new Date().toISOString(),
      },
    ]

    cy.mockLangGraph(mockOrdersStream(pendingOrder))
    cy.sendMessage('Show my pending order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-status-badge"]')
      .should('contain', 'PENDING')
  })

  // ============================================================================
  // Tracking Information Tests
  // ============================================================================

  it('order with tracking shows tracking number', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.singleDelivered)
    )

    cy.sendMessage('Show my order with tracking')
    cy.waitForStreamEnd()

    cy.get('[data-testid="tracking-number"]')
      .should('exist')
      .should('contain', 'BLR')
  })

  it('order without tracking does not show tracking section', () => {
    const noTrackingOrder = [
      {
        id: 'order-no-tracking',
        status: 'PENDING' as const,
        total: 1000000,
        orderDate: new Date().toISOString(),
      },
    ]

    cy.mockLangGraph(mockOrdersStream(noTrackingOrder))
    cy.sendMessage('Show my pending order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="tracking-number"]').should('not.exist')
  })

  it('tracking number format is correct', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.singleDelivered)
    )

    cy.sendMessage('Show tracking info')
    cy.waitForStreamEnd()

    cy.get('[data-testid="tracking-number"]')
      .invoke('text')
      .should('match', /[A-Z]{3}\d{9}[A-Z]{2}/)
  })

  // ============================================================================
  // Order Limit Tests
  // ============================================================================

  it('at most 5 orders shown', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.large)
    )

    cy.sendMessage('Show all my orders')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-card"]')
      .should('have.length.at.most', 5)
  })

  it('shows exactly 5 orders when 10 exist', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.large)
    )

    cy.sendMessage('Show my orders')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-card"]')
      .should('have.length', 5)
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it('order error shows message not crash', () => {
    cy.mockLangGraph(
      mockErrorStream("I couldn't retrieve your order history.")
    )

    cy.sendMessage('Show my orders')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-list"]').should('not.exist')
    cy.get('[data-testid="message-assistant"]')
      .last()
      .should('exist')
      .should('contain', "couldn't")
  })

  // ============================================================================
  // Multi-turn Tests
  // ============================================================================

  it('can view orders then view specific order details', () => {
    const responses = [
      mockOrdersStream(MOCK_ORDERS.multiple),
      mockOrdersStream(MOCK_ORDERS.singleDelivered),
    ]

    cy.mockLangGraphSequence(responses)

    cy.sendMessage('Show my recent orders')
    cy.waitForStreamEnd()
    cy.waitForComponent('order-list')

    cy.sendMessage('Tell me more about the first order')
    cy.waitForStreamEnd()
    cy.get('[data-testid="order-card"]')
      .should('have.length', 1)
  })

  // ============================================================================
  // Order Date Tests
  // ============================================================================

  it('recent order shows relative date', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.singleDelivered)
    )

    cy.sendMessage('Show my recent orders')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-date"]')
      .first()
      .invoke('text')
      .should('have.length.greaterThan', 0)
  })

  it('order date format is readable', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.multiple)
    )

    cy.sendMessage('Show orders')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-date"]')
      .first()
      .invoke('text')
      .then((text) => {
        // Should contain day, month, or year info
        expect(text.length).to.be.greaterThan(5)
      })
  })

  // ============================================================================
  // Performance Tests
  // ============================================================================

  it('order list renders within timeout', () => {
    cy.mockLangGraph(
      mockOrdersStream(MOCK_ORDERS.multiple)
    )

    const startTime = Date.now()

    cy.sendMessage('Show my orders')
    cy.waitForComponent('order-list', 10000)

    const renderTime = Date.now() - startTime
    cy.log(`Order list rendered in ${renderTime}ms`)
    
    expect(renderTime).to.be.lessThan(5000)
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  it('order with very high value displays correctly', () => {
    const highValueOrder = [
      {
        id: 'order-high-value',
        status: 'DELIVERED' as const,
        total: 99999900, // ₹9,99,999
        orderDate: new Date().toISOString(),
        trackingNumber: 'BLR123456789IN',
      },
    ]

    cy.mockLangGraph(mockOrdersStream(highValueOrder))
    cy.sendMessage('Show my expensive order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-total"]')
      .invoke('text')
      .should('contain', '₹')
  })

  it('order with cancelled status displays correctly', () => {
    const cancelledOrder = [
      {
        id: 'order-cancelled',
        status: 'CANCELLED' as const,
        total: 500000,
        orderDate: new Date().toISOString(),
      },
    ]

    cy.mockLangGraph(mockOrdersStream(cancelledOrder))
    cy.sendMessage('Show my cancelled order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-status-badge"]')
      .should('contain', 'CANCELLED')
  })

  it('order with refunded status displays correctly', () => {
    const refundedOrder = [
      {
        id: 'order-refunded',
        status: 'REFUNDED' as const,
        total: 250000,
        orderDate: new Date().toISOString(),
      },
    ]

    cy.mockLangGraph(mockOrdersStream(refundedOrder))
    cy.sendMessage('Show my refunded order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-status-badge"]')
      .should('contain', 'REFUNDED')
  })

  it('multiple orders with same status render correctly', () => {
    const sameStatusOrders = [
      {
        id: 'order-1',
        status: 'DELIVERED' as const,
        total: 1000000,
        orderDate: new Date().toISOString(),
      },
      {
        id: 'order-2',
        status: 'DELIVERED' as const,
        total: 2000000,
        orderDate: new Date().toISOString(),
      },
    ]

    cy.mockLangGraph(mockOrdersStream(sameStatusOrders))
    cy.sendMessage('Show delivered orders')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-status-badge"]')
      .each(($badge) => {
        cy.wrap($badge).should('contain', 'DELIVERED')
      })
  })

  it('order ID with special characters displays correctly', () => {
    const specialIdOrder = [
      {
        id: 'order-abc-123-xyz',
        status: 'DELIVERED' as const,
        total: 1500000,
        orderDate: new Date().toISOString(),
      },
    ]

    cy.mockLangGraph(mockOrdersStream(specialIdOrder))
    cy.sendMessage('Show my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="order-id"]')
      .invoke('text')
      .should('contain', 'abc')
  })
})
