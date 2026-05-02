describe('Cart', () => {

  beforeEach(() => {
    cy.signIn('customer@test.com')
    cy.visit('/chat-dashboard')
  })

  it('view cart renders CartCanvas', () => {
    cy.sendMessage('Show my cart')
    cy.waitForAgentResponse()
    cy.get('[data-testid="cart-canvas"]', { timeout: 45000 }).should('be.visible')
  })

  it('cart total is visible when cart has items', () => {
    cy.sendMessage('Show my cart')
    cy.waitForAgentResponse()
    cy.get('[data-testid="cart-canvas"]', { timeout: 45000 }).then(() => {
      cy.get('[data-testid="cart-item"]').then(($items) => {
        if ($items.length > 0) {
          cy.get('[data-testid="cart-total"]').should('be.visible').invoke('text').should('match', /₹/)
        }
      })
    })
  })

  it('add product to cart shows updated CartCanvas', () => {
    cy.sendMessage('Show me headphones under ₹20000')
    cy.waitForAgentResponse()
    cy.get('[data-testid="product-grid"]', { timeout: 45000 }).should('be.visible')
    cy.sendMessage('Add the first one to my cart')
    cy.waitForAgentResponse()
    cy.get('[data-testid="cart-canvas"]', { timeout: 45000 }).should('be.visible')
    cy.get('[data-testid="cart-total"]').invoke('text').should('match', /₹/)
  })

  it('checkout button appears when cart is non-empty', () => {
    cy.sendMessage('Show my cart')
    cy.waitForAgentResponse()
    cy.get('[data-testid="cart-canvas"]', { timeout: 45000 }).then(() => {
      cy.get('[data-testid="cart-item"]').then(($items) => {
        if ($items.length > 0) {
          cy.get('[data-testid="checkout-button"]').should('be.visible')
        }
      })
    })
  })

})
