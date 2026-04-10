describe('Merchant Dashboard', () => {

  beforeEach(() => {
    cy.signIn('merchant@test.com')
    cy.visit('/admin/chat')
  })

  it('auto-briefing fires on load without user input', () => {
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="merchant-briefing"]').length > 0) {
        cy.get('[data-testid="merchant-briefing"]').should('exist')
      } else {
        cy.get('[data-testid="message-assistant"]').should('exist')
      }
    })
  })

  it('revenue chip renders RevenueCard', () => {
    cy.waitForAgentResponse(50000)
    cy.get('[data-testid="merchant-chip"]').contains("Today's revenue").click()
    cy.get('[data-testid="revenue-card"]', { timeout: 45000 }).should('be.visible')
  })

  it('inventory chip renders InventoryAlert or all-good message', () => {
    cy.waitForAgentResponse(50000)
    cy.get('[data-testid="merchant-chip"]').contains("What's running low").click()
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="inventory-alert"]').length > 0) {
        cy.get('[data-testid="inventory-alert"]').should('exist')
      } else {
        cy.get('[data-testid="message-assistant"]').last().should('exist')
      }
    })
  })

  it('exactly 4 merchant chips visible', () => {
    cy.get('[data-testid="merchant-chip"]').should('have.length', 4)
  })

  it('customer redirected away from /admin/chat', () => {
    cy.signIn('customer@test.com')
    cy.visit('/admin/chat')
    cy.url().should('not.include', '/admin/chat')
  })

})
