// Debug login test

describe('Debug Login Test', () => {
  it('should trace login request', () => {
    // Listen to all requests
    cy.intercept('**/*', (req) => {
      console.log('Request:', req.method, req.url)
    }).as('all')

    cy.visit('/auth/login', { timeout: 60000 })
    cy.contains('Welcome Back').should('be.visible')

    // Fill in the form
    cy.get('input[name="email"]').type('employee@acme.com')
    cy.get('input[name="password"]').type('password123')

    // Click submit and wait
    cy.get('button[type="submit"]').click()

    // Wait for network requests
    cy.wait(3000)
  })
})