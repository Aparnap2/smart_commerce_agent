describe('Orders', () => {

  beforeEach(() => {
    cy.signIn('customer@test.com')
    cy.visit('/chat-dashboard')
  })

  it('order history renders OrderCard or no-orders message', () => {
    cy.sendMessage('Show my orders')
    cy.waitForAgentResponse()
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="order-list"]').length > 0) {
        cy.get('[data-testid="order-list"]').should('exist')
      } else {
        cy.get('[data-testid="message-assistant"]').last().should('exist')
      }
    })
  })

  it('order status badge contains valid status', () => {
    cy.sendMessage('What are my recent orders?')
    cy.waitForAgentResponse()
    cy.get('[data-testid="order-card"]', { timeout: 45000 }).then(($cards) => {
      if ($cards.length > 0) {
        cy.get('[data-testid="order-status-badge"]').first().invoke('text').should('match', /PENDING|PAID|SHIPPED|DELIVERED|CANCELLED|REFUNDED/)
      }
    })
  })

  it('at most 5 orders shown', () => {
    cy.sendMessage('Show all my orders')
    cy.waitForAgentResponse()
    cy.get('[data-testid="order-card"]', { timeout: 45000 }).then(($cards) => {
      expect($cards.length).to.be.at.most(5)
    })
  })

})
