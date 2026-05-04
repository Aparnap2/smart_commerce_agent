// B2B Approval Flow - Simple Auth Test
const EMPLOYEE = { email: 'employee@acme.com', pass: 'password123' }
const MANAGER = { email: 'manager@acme.com', pass: 'password123' }

function signIn(email: string, pass: string) {
  cy.visit('/auth/login', { failOnStatusCode: false })
  cy.get('body').should('contain', 'Sign in').or('contain', 'email')
  cy.get('input[name="email"], input[type="email"]', { timeout: 10000 }).first().type(email)
  cy.get('input[name="password"], input[type="password"]').first().type(pass)
  cy.get('button[type="submit"]').click()
}

describe('Auth Flow', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  it('employee login redirects somewhere', () => {
    signIn(EMPLOYEE.email, EMPLOYEE.pass)
    cy.url({ timeout: 15000 }).should('not.include', '/auth/login')
  })

  it('manager login redirects somewhere', () => {
    signIn(MANAGER.email, MANAGER.pass)
    cy.url({ timeout: 15000 }).should('not.include', '/auth/login')
  })
})