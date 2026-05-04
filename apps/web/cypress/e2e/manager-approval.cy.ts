// Manager Approval Flow — E2E Tests
// Tests for PRD Part 7 - Manager Dashboard functionality

const MANAGER_USER = {
  email: 'manager@acme.com',
  pass: 'password123',
}

// Mock pending approvals data
const MOCK_PENDING_APPROVALS_DATA = [
  {
    id: 'PR-2026-001',
    prNumber: 'PR-2026-001',
    requestorName: 'Priya Sharma',
    totalAmount: 199900,
    lineItems: [
      { id: '1', name: 'MacBook Pro 14"', vendor: 'Apple', quantity: 1, unitPrice: 199900, totalPrice: 199900 }
    ],
    justification: 'Need laptop for new dev hire',
    urgency: 'HIGH' as const,
    threadId: 'thread-123'
  },
  {
    id: 'PR-2026-002',
    prNumber: 'PR-2026-002',
    requestorName: 'Raj Patel',
    totalAmount: 104000,
    lineItems: [
      { id: '2', name: 'Dell Monitor 27"', vendor: 'Dell', quantity: 2, unitPrice: 52000, totalPrice: 104000 }
    ],
    justification: 'Second monitor for workstation',
    urgency: 'NORMAL' as const,
    threadId: 'thread-456'
  }
]

const MOCK_BUDGET_DATA = {
  department: 'Engineering',
  monthlyBudget: 5000000,
  spent: 1250000,
  remaining: 3750000,
  percentUsed: 25
}

// Setup mock for fetching pending approvals
function setupManagerMocks() {
  // Mock department budget API
  cy.intercept('GET', '**/api/department/budget', {
    statusCode: 200,
    body: MOCK_BUDGET_DATA
  }).as('getBudget')

  // Mock pending approvals API
  cy.intercept('GET', '**/api/approvals/pending', {
    statusCode: 200,
    body: { approvals: MOCK_PENDING_APPROVALS_DATA }
  }).as('getPendingApprovals')

  // Mock approve/reject API
  cy.intercept('POST', '**/api/approvals/*/decide', {
    statusCode: 200,
    body: { success: true }
  }).as('approvePR')
}

function signInManager() {
  cy.visit('/auth/login')
  cy.get('input[name="email"]', { timeout: 8000 }).type(MANAGER_USER.email)
  cy.get('input[name="password"]').type(MANAGER_USER.pass)
  cy.get('button[type="submit"]').click()
}

function signOut() {
  cy.clearCookies()
  cy.clearLocalStorage()
}

describe('Manager Dashboard — Approval Workflow', () => {
  beforeEach(() => {
    setupManagerMocks()
    signOut()
    signInManager()
  })

  it('redirects manager to /manager on login', () => {
    cy.url({ timeout: 10000 }).should('include', '/manager')
  })

  it('displays manager dashboard page', () => {
    cy.visit('/manager')
    cy.get('[data-testid="manager-dashboard"]').should('be.visible')
  })

  it('shows budget gauge in sidebar', () => {
    cy.visit('/manager')
    cy.get('[data-testid="budget-gauge"]', { timeout: 5000 }).should('be.visible')
    cy.contains('Engineering Budget').should('be.visible')
  })

  it('shows pending approval count in rail', () => {
    cy.visit('/manager')
    cy.get('[data-testid="rail-pending-count"]', { timeout: 5000 }).should('contain', '2')
  })

  it('displays list of PRs needing approval', () => {
    cy.visit('/manager')
    cy.get('[data-testid="pr-list"]', { timeout: 5000 }).should('be.visible')
    cy.contains('PR-2026-001').should('be.visible')
    cy.contains('PR-2026-002').should('be.visible')
  })

  it('shows approval cards for pending PRs', () => {
    cy.visit('/manager')
    cy.get('[data-testid="approval-card"]', { timeout: 5000 }).should('have.length', 2)
  })

  it('manager can approve a PR', () => {
    cy.visit('/manager')
    cy.get('[data-testid="approval-card"]').first().within(() => {
      cy.get('[data-testid="approve-pr-btn"]').click()
    })
    cy.get('[data-testid="approval-decided"]', { timeout: 3000 }).should('be.visible')
    cy.contains('APPROVED').should('be.visible')
  })

  it('manager can reject a PR with comments', () => {
    cy.visit('/manager')
    cy.get('[data-testid="approval-card"]').first().within(() => {
      cy.get('[data-testid="approval-comments"]').type('Please get prior approval from finance')
      cy.get('[data-testid="reject-pr-btn"]').click()
    })
    cy.get('[data-testid="approval-decided"]', { timeout: 3000 }).should('be.visible')
    cy.contains('REJECTED').should('be.visible')
  })
})

describe('Manager Access Control', () => {
  beforeEach(() => {
    setupManagerMocks()
    signOut()
  })

  it('employee cannot access manager dashboard', () => {
    cy.visit('/auth/login')
    cy.get('input[name="email"]').type('employee@acme.com')
    cy.get('input[name="password"]').type('password123')
    cy.get('button[type="submit"]').click()
    cy.url({ timeout: 10000 }).should('not.include', '/manager')
  })
})