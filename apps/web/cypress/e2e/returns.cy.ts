describe('Returns', () => {

  beforeEach(() => {
    cy.signIn('customer@test.com')
    cy.visit('/chat-dashboard')
  })

  it('return card shows 3 options for eligible order', () => {
    cy.request('/api/test/recent-order').then((resp) => {
      if (resp.status === 200 && resp.body.orderId) {
        const orderId = resp.body.orderId
        cy.sendMessage(`I want to return order ${orderId}, it was defective`)
        cy.waitForAgentResponse(50000)
        cy.get('[data-testid="return-card"]', { timeout: 45000 }).should('be.visible')
        cy.get('[data-testid^="return-option-"]').should('have.length', 3)
      }
    })
  })

  it('store credit option shows ₹500 bonus badge', () => {
    cy.request('/api/test/recent-order').then((resp) => {
      if (resp.status === 200 && resp.body.orderId) {
        const orderId = resp.body.orderId
        cy.sendMessage(`Return order ${orderId}`)
        cy.waitForAgentResponse(50000)
        cy.get('[data-testid="return-option-store_credit"]', { timeout: 45000 }).should('be.visible').invoke('text').should('contain', '500')
      }
    })
  })

  it('return outside 7-day window shows error message', () => {
    cy.request('/api/test/old-order').then((resp) => {
      if (resp.status === 200 && resp.body.orderId) {
        const orderId = resp.body.orderId
        cy.sendMessage(`Return order ${orderId}`)
        cy.waitForAgentResponse()
        cy.get('[data-testid="return-card"]').should('not.exist')
        cy.get('[data-testid="message-assistant"]').last().invoke('text').should('match', /window|7 day|eligible|cannot/i)
      }
    })
  })

})
