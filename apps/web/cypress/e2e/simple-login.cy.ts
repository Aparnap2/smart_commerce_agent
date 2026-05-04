// Simple login test to debug sign-in

describe('Simple Login Debug', () => {
  it('should sign in as employee', () => {
    cy.visit('/auth/login')
    cy.get('input[name="email"]', { timeout: 8000 }).should('be.visible')
    cy.get('input[name="email"]').type('employee@acme.com')
    cy.get('input[name="password"]').type('password123')
    cy.get('button[type="submit"]').click()
    cy.url({ timeout: 15000 }).should('include', '/chat')
  })
})