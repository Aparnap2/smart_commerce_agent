/**
 * E2E Tests: GenUI Edge Cases
 * 
 * Tests that UI doesn't break when data is:
 * - Missing (null/undefined)
 * - Malformed (wrong types)
 * - Empty arrays
 * - Extreme values
 * 
 * Run with: pnpm cy:run --spec "cypress/e2e/genui-edge-cases.cy.ts"
 */

import { describe, it, expect } from 'cypress'

describe('GenUI Edge Cases - CatalogGrid', () => {
  it('handles missing unitPrice (null)', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showCatalogGrid', 
        items: [{ id: '1', name: 'Test', vendor: 'Acme', unitPrice: null }] 
      }, '*')
    })
    cy.get('[data-testid="catalog-grid"]').should('exist')
    cy.contains('Test').should('be.visible')
  })

  it('handles missing leadDays', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showCatalogGrid', 
        items: [{ id: '1', name: 'Test', vendor: 'Acme', unitPrice: 1000 }] 
      }, '*')
    })
    cy.get('[data-testid="catalog-grid"]').should('exist')
  })

  it('handles empty items array', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ type: 'genui', action: 'showCatalogGrid', items: [] }, '*')
    })
    cy.get('[data-testid="catalog-grid-empty"]').should('contain', 'No items found')
  })

  it('handles undefined items', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ type: 'genui', action: 'showCatalogGrid', items: undefined }, '*')
    })
    cy.get('[data-testid="catalog-grid-empty"]').should('exist')
  })

  it('handles malformed item (no id)', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showCatalogGrid', 
        items: [{ name: 'Test', vendor: 'Acme', unitPrice: 1000 }] 
      }, '*')
    })
    // Should still render, React uses index as key fallback
    cy.contains('Test').should('be.visible')
  })
})

describe('GenUI Edge Cases - PRDraft', () => {
  it('handles empty line items', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showPRDraft', 
        items: [], 
        total: 0 
      }, '*')
    })
    cy.get('[data-testid="pr-draft"]').should('exist')
    cy.contains('₹0').should('be.visible')
  })

  it('handles undefined total', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showPRDraft', 
        items: [{ id: '1', name: 'Item', quantity: 1, unitPrice: 100, totalPrice: 100 }] 
      }, '*')
    })
    cy.get('[data-testid="pr-draft-total"]').should('contain', '100')
  })
})

describe('GenUI Edge Cases - BudgetGauge', () => {
  it('handles zero budget', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showBudgetGauge', 
        spent: 0, 
        total: 0 
      }, '*')
    })
    cy.get('[data-testid="budget-gauge"]').should('exist')
  })

  it('handles exceeded budget', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showBudgetGauge', 
        spent: 150000, 
        total: 100000 
      }, '*')
    })
    cy.get('[data-testid="budget-gauge"]').should('exist')
  })

  it('handles undefined values', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showBudgetGauge', 
        spent: undefined, 
        total: undefined 
      }, '*')
    })
    // Should not crash
    cy.get('[data-testid="budget-gauge"]').should('exist')
  })
})

describe('GenUI Edge Cases - ApprovalCard', () => {
  it('handles missing requester info', () => {
    cy.visit('/manager')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showApprovalCard', 
        pr: { id: '1', prNumber: 'PR-001', status: 'PENDING', requestedBy: null }
      }, '*')
    })
    cy.get('[data-testid="approval-card"]').should('exist')
  })

  it('handles empty line items', () => {
    cy.visit('/manager')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showApprovalCard', 
        pr: { 
          id: '1', 
          prNumber: 'PR-001', 
          status: 'PENDING', 
          total: 0,
          lineItems: [] 
        }
      }, '*')
    })
    cy.get('[data-testid="approval-card"]').should('exist')
  })
})

describe('GenUI Edge Cases - PRList', () => {
  it('handles empty list', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showPRList', 
        requests: [] 
      }, '*')
    })
    cy.get('[data-testid="pr-list-empty"]').should('exist')
  })

  it('handles mixed status types', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showPRList', 
        requests: [
          { id: '1', status: 'DRAFT' },
          { id: '2', status: 'PENDING' },
          { id: '3', status: 'APPROVED' },
          { id: '4', status: 'REJECTED' },
          { id: '5', status: 'UNKNOWN_STATUS' }
        ] 
      }, '*')
    })
    // Should not crash on unknown status
    cy.get('[data-testid="pr-list"]').should('exist')
  })
})

describe('GenUI Edge Cases - Extreme Values', () => {
  it('handles very large numbers', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showCatalogGrid', 
        items: [{ id: '1', name: 'Enterprise', vendor: 'Vendor', unitPrice: 999999999999 }] 
      }, '*')
    })
    cy.get('[data-testid="item-price"]').should('contain', '999,999,999,999')
  })

  it('handles negative prices', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showCatalogGrid', 
        items: [{ id: '1', name: 'Error Item', vendor: 'Vendor', unitPrice: -100 }] 
      }, '*')
    })
    // Should still render (negative price is invalid but shouldn't crash)
    cy.contains('Error Item').should('be.visible')
  })

  it('handles unicode in names', () => {
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showCatalogGrid', 
        items: [{ id: '1', name: ' लैपटॉप ', vendor: 'एक्वा', unitPrice: 50000 }] 
      }, '*')
    })
    cy.contains('लैपटॉप').should('be.visible')
  })

  it('handles very long strings', () => {
    const longName = 'A'.repeat(500)
    cy.visit('/chat')
    cy.window().then(win => {
      win.postMessage({ 
        type: 'genui', 
        action: 'showCatalogGrid', 
        items: [{ id: '1', name: longName, vendor: 'Vendor', unitPrice: 100 }] 
      }, '*')
    })
    // Should truncate, not overflow
    cy.get('[data-testid="catalog-grid"]').should('exist')
  })
})