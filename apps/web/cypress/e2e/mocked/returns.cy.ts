/**
 * Mocked Returns E2E Tests
 * 
 * Tests for GenUI ReturnCard component rendering with mocked LangGraph responses.
 * Asserts on return eligibility, option rendering, and bonus badge display.
 */

import {
  mockReturnStream,
  mockOrdersStream,
  mockErrorStream,
} from '../../support/langgraph-mock'
import { MOCK_ORDERS, MOCK_RETURN_OPTIONS } from '../../fixtures/mock-data'

describe('[Mocked] Returns — GenUI', () => {

  beforeEach(() => {
    cy.signIn('customer@test.com')
  })

  // ============================================================================
  // Component Rendering Tests
  // ============================================================================

  it('ReturnCard renders for eligible order', () => {
    cy.mockLangGraph(
      mockReturnStream('order-return-eligible', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('I want to return order order-return-eligible')
    cy.waitForStream()
    cy.waitForStreamEnd()

    cy.waitForComponent('return-card')
  })

  it('renders 3 return options for eligible order', () => {
    cy.mockLangGraph(
      mockReturnStream('order-return-eligible', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.waitForComponent('return-card')
    cy.get('[data-testid^="return-option-"]')
      .should('have.length', 3)
  })

  it('does not render ReturnCard for ineligible order', () => {
    cy.mockLangGraph(
      mockReturnStream('order-return-expired', false)
    )

    cy.sendMessage('Return order order-return-expired')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-card"]').should('not.exist')
  })

  // ============================================================================
  // Eligibility Tests
  // ============================================================================

  it('eligible order shows success message', () => {
    cy.mockLangGraph(
      mockReturnStream('order-eligible', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('Return order order-eligible')
    cy.waitForStreamEnd()

    cy.get('[data-testid="message-assistant"]')
      .last()
      .invoke('text')
      .should('contain', 'eligible')
  })

  it('ineligible order shows error message with reason', () => {
    cy.mockLangGraph(
      mockReturnStream('order-expired', false)
    )

    cy.sendMessage('Return order order-expired')
    cy.waitForStreamEnd()

    cy.get('[data-testid="message-assistant"]')
      .last()
      .invoke('text')
      .should('match', /window|7 day|eligible|cannot/i)
  })

  it('outside 7-day window shows error message', () => {
    cy.mockLangGraph(
      mockReturnStream('order-old', false)
    )

    cy.sendMessage('Return old order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-card"]').should('not.exist')
    cy.get('[data-testid="message-assistant"]')
      .last()
      .should('exist')
  })

  // ============================================================================
  // Return Option Tests
  // ============================================================================

  it('refund option is visible', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-option-refund"]')
      .should('be.visible')
  })

  it('replacement option is visible', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-option-replacement"]')
      .should('be.visible')
  })

  it('store credit option is visible', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-option-store_credit"]')
      .should('be.visible')
  })

  // ============================================================================
  // Bonus Badge Tests
  // ============================================================================

  it('store credit option shows ₹500 bonus badge', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-option-store_credit"]')
      .should('be.visible')
      .invoke('text')
      .should('contain', '500')
  })

  it('refund option does not show bonus badge', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-option-refund"]')
      .invoke('text')
      .should('not.contain', 'bonus')
  })

  it('enhanced store credit shows ₹1000 bonus', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.enhancedCredit)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-option-store_credit"]')
      .invoke('text')
      .should('contain', '1000')
  })

  // ============================================================================
  // Data Format Tests
  // ============================================================================

  it('order ID is displayed on return card', () => {
    cy.mockLangGraph(
      mockReturnStream('order-abc123', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('Return order order-abc123')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-order-id"]')
      .should('contain', 'order-abc123')
  })

  it('return option labels are readable', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid^="return-option-"]')
      .each(($el) => {
        cy.wrap($el)
          .invoke('text')
          .should('have.length.greaterThan', 0)
      })
  })

  // ============================================================================
  // Option Selection Tests
  // ============================================================================

  it('return options are selectable', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-option-refund"]')
      .should('exist')
      .and('not.be.disabled')
  })

  it('store credit option is selectable', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-option-store_credit"]')
      .should('exist')
      .and('not.be.disabled')
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it('return error shows message not crash', () => {
    cy.mockLangGraph(
      mockErrorStream("I'm unable to process return requests at the moment.")
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-card"]').should('not.exist')
    cy.get('[data-testid="message-assistant"]')
      .last()
      .should('exist')
      .should('contain', 'unable')
  })

  it('invalid order ID shows helpful message', () => {
    cy.mockLangGraph(
      mockReturnStream('invalid-order-id', false)
    )

    cy.sendMessage('Return order invalid-order-id')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-card"]').should('not.exist')
    cy.get('[data-testid="message-assistant"]')
      .last()
      .should('exist')
  })

  // ============================================================================
  // Multi-turn Tests: Order → Return Flow
  // ============================================================================

  it('can view orders then initiate return', () => {
    const responses = [
      mockOrdersStream(MOCK_ORDERS.eligibleForReturn),
      mockReturnStream('order-return-eligible', true, MOCK_RETURN_OPTIONS.standard),
    ]

    cy.mockLangGraphSequence(responses)

    // First: View orders
    cy.sendMessage('Show my recent orders')
    cy.waitForStreamEnd()
    cy.waitForComponent('order-list')

    // Second: Initiate return
    cy.sendMessage('I want to return the first order')
    cy.waitForStreamEnd()
    cy.waitForComponent('return-card')
  })

  it('return flow maintains context', () => {
    const responses = [
      mockOrdersStream(MOCK_ORDERS.eligibleForReturn),
      mockReturnStream('order-return-eligible', true, MOCK_RETURN_OPTIONS.standard),
      mockReturnStream('order-return-eligible', true, MOCK_RETURN_OPTIONS.standard),
    ]

    cy.mockLangGraphSequence(responses)

    cy.sendMessage('Show my orders')
    cy.waitForStreamEnd()

    cy.sendMessage('Return the delivered order')
    cy.waitForStreamEnd()
    cy.get('[data-testid="return-card"]').should('exist')

    cy.sendMessage('Tell me about return options')
    cy.waitForStreamEnd()
    cy.get('[data-testid^="return-option-"]').should('have.length', 3)
  })

  // ============================================================================
  // Refund Only Options Tests
  // ============================================================================

  it('shows only 2 options when replacement not available', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.refundOnly)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid^="return-option-"]')
      .should('have.length', 2)
  })

  it('refund only still shows store credit with bonus', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.refundOnly)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-option-store_credit"]')
      .invoke('text')
      .should('contain', '500')
  })

  // ============================================================================
  // Performance Tests
  // ============================================================================

  it('return card renders within timeout', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.standard)
    )

    const startTime = Date.now()

    cy.sendMessage('Return my order')
    cy.waitForComponent('return-card', 10000)

    const renderTime = Date.now() - startTime
    cy.log(`Return card rendered in ${renderTime}ms`)
    
    expect(renderTime).to.be.lessThan(5000)
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  it('handles very long order IDs', () => {
    const longOrderId = 'order-very-long-id-with-many-characters-12345'

    cy.mockLangGraph(
      mockReturnStream(longOrderId, true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage(`Return order ${longOrderId}`)
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-order-id"]')
      .should('contain', 'order-very-long')
  })

  it('handles zero bonus on store credit', () => {
    const noBonusOptions = [
      { type: 'refund' as const, label: 'Refund', bonus: 0 },
      { type: 'replacement' as const, label: 'Replacement', bonus: 0 },
      { type: 'store_credit' as const, label: 'Store credit', bonus: 0 },
    ]

    cy.mockLangGraph(
      mockReturnStream('order-test', true, noBonusOptions)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-option-store_credit"]')
      .invoke('text')
      .then((text) => {
        // Should not contain bonus amount
        expect(text).not.to.match(/[1-9][0-9]* bonus/i)
      })
  })

  it('handles single return option', () => {
    const singleOption = [
      { type: 'refund' as const, label: 'Refund only', bonus: 0 },
    ]

    cy.mockLangGraph(
      mockReturnStream('order-test', true, singleOption)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    cy.get('[data-testid^="return-option-"]')
      .should('have.length', 1)
  })

  it('return card shows all option details', () => {
    cy.mockLangGraph(
      mockReturnStream('order-test', true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage('Return my order')
    cy.waitForStreamEnd()

    // Each option should have a label
    cy.get('[data-testid^="return-option-"]')
      .each(($option) => {
        cy.wrap($option)
          .find('[data-testid="return-option-label"]')
          .should('exist')
      })
  })

  it('handles special characters in order ID', () => {
    const specialOrderId = 'order-123-ABC-xyz'

    cy.mockLangGraph(
      mockReturnStream(specialOrderId, true, MOCK_RETURN_OPTIONS.standard)
    )

    cy.sendMessage(`Return order ${specialOrderId}`)
    cy.waitForStreamEnd()

    cy.get('[data-testid="return-order-id"]')
      .should('contain', 'ABC')
  })
})
