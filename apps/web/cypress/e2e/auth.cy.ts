describe('Authentication + Route Protection', () => {

  it('unauthenticated user redirected to signin from root', () => {
    cy.visit('/')
    cy.url().should('include', '/auth/signin')
  })

  it('unauthenticated user cannot access /chat-dashboard', () => {
    cy.visit('/chat-dashboard')
    cy.url().should('include', '/auth/signin')
  })

  it('unauthenticated user cannot access /admin/chat', () => {
    cy.visit('/admin/chat')
    cy.url().should('include', '/auth/signin')
  })

  it('customer signs in and lands on /chat-dashboard', () => {
    cy.signIn('customer@test.com')
    cy.url().should('include', '/chat-dashboard')
    cy.get('[aria-label="Message input"]').should('be.visible')
  })

  it('merchant signs in and lands on /admin/chat', () => {
    cy.signIn('merchant@test.com')
    cy.url().should('include', '/admin/chat')
    cy.get('[aria-label="Merchant message input"]').should('be.visible')
  })

  it('customer cannot access merchant dashboard', () => {
    cy.signIn('customer@test.com')
    cy.visit('/admin/chat')
    cy.url().should('not.include', '/admin/chat')
  })

  it('wrong password stays on signin page', () => {
    cy.visit('/auth/signin')
    cy.get('input[type="email"]').type('customer@test.com')
    cy.get('input[type="password"]').type('wrongpassword')
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/auth/signin')
  })

})
