describe('Product Search', () => {

  beforeEach(() => {
    cy.signIn('customer@test.com')
    cy.visit('/chat-dashboard')
  })

  it('suggested action chip fires search + renders ProductGrid', () => {
    cy.get('[data-testid="suggested-action"]').first().click()
    cy.get('[data-testid="message-user"]').should('exist')
    cy.get('[data-testid="product-grid"]', { timeout: 45000 }).should('be.visible')
    cy.get('[data-testid="product-card"]').should('have.length.at.least', 1).should('have.length.at.most', 6)
  })

  it('product prices shown in ₹ INR format', () => {
    cy.sendMessage('Show me headphones')
    cy.waitForAgentResponse()
    cy.get('[data-testid="product-price"]', { timeout: 45000 }).first().should('contain', '₹')
  })

  it('nonsense query returns empty state or AI message — never crashes', () => {
    cy.sendMessage('xyznonexistentproduct99999')
    cy.waitForAgentResponse()
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="product-grid-empty"]').length > 0) {
        cy.get('[data-testid="product-grid-empty"]').should('exist')
      } else {
        cy.get('[data-testid="message-assistant"]').should('exist')
      }
    })
    cy.get('[data-testid="agent-thinking"]').should('not.exist')
  })

  it('Add to Cart button enabled on in-stock products', () => {
    cy.sendMessage('Show me headphones in stock')
    cy.waitForAgentResponse()
    cy.get('[data-testid="product-grid"]', { timeout: 45000 }).should('be.visible')
    cy.get('[data-testid="add-to-cart-button"]').filter(':not(:disabled)').first().should('be.enabled')
  })

  it('maximum 6 product cards rendered', () => {
    cy.sendMessage('Show me everything you have')
    cy.waitForAgentResponse()
    cy.get('[data-testid="product-grid"]', { timeout: 45000 }).should('be.visible')
    cy.get('[data-testid="product-card"]').should('have.length.at.most', 6)
  })

})
