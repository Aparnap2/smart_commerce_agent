// Rail Budget Display — E2E Tests
// Tests for PRD Part 7D - Shell/Rail with real budget data

const RAIL_EMPLOYEE = {
  email: 'employee@acme.com',
  pass: 'password123',
}

const RAIL_MANAGER = {
  email: 'manager@acme.com',
  pass: 'password123',
}

// Real budget data from database
const RAIL_BUDGET = {
  department: 'Engineering',
  monthlyBudget: 5000000,
  spent: 1250000,
  remaining: 3750000,
  percentUsed: 25
}

const RAIL_PENDING_COUNT = 2

function setupRailBudgetMocks() {
  // Mock department budget from API
  cy.intercept('GET', '**/api/department/budget', {
    statusCode: 200,
    body: RAIL_BUDGET
  }).as('getBudget')

  // Mock pending approvals count for managers
  cy.intercept('GET', '**/api/approvals/pending/count', {
    statusCode: 200,
    body: { count: RAIL_PENDING_COUNT }
  }).as('getPendingCount')
}

function signIn(email: string, pass: string) {
  cy.visit('/auth/login')
  cy.get('input[name="email"]', { timeout: 8000 }).type(email)
  cy.get('input[name="password"]').type(pass)
  cy.get('button[type="submit"]').click()
}

function signOut() {
  cy.clearCookies()
  cy.clearLocalStorage()
}

describe('Rail — Budget Display', () => {
  beforeEach(() => {
    setupRailBudgetMocks()
    signOut()
    signIn(RAIL_EMPLOYEE.email, RAIL_EMPLOYEE.pass)
  })

  it('Rail component renders on chat page', () => {
    cy.url({ timeout: 10000 }).should('include', '/chat')
    cy.get('[data-testid="shell-rail"]').should('be.visible')
  })

  it('Rail displays department budget from API', () => {
    cy.get('[data-testid="rail-budget-gauge"]', { timeout: 5000 }).should('be.visible')
    cy.contains('Engineering Budget').should('be.visible')
  })

  it('BudgetGauge shows correct spent amount', () => {
    cy.get('[data-testid="rail-budget-gauge"]').within(() => {
      cy.contains('Spent:').should('be.visible')
      cy.contains('₹12,50,000').should('be.visible')
    })
  })

  it('BudgetGauge shows correct total budget', () => {
    cy.get('[data-testid="rail-budget-gauge"]').within(() => {
      cy.contains('Budget:').should('be.visible')
      cy.contains('₹50,00,000').should('be.visible')
    })
  })

  it('BudgetGauge shows correct remaining amount', () => {
    cy.get('[data-testid="rail-budget-gauge"]').within(() => {
      cy.contains('Remaining:').should('be.visible')
      cy.contains('₹37,50,000').should('be.visible')
    })
  })

  it('BudgetGauge shows percentage used', () => {
    cy.get('[data-testid="rail-budget-gauge"]').within(() => {
      cy.contains('25% used').should('be.visible')
    })
  })

  it('BudgetGauge visual bar reflects percentage', () => {
    cy.get('[data-testid="rail-budget-gauge"]').within(() => {
      // The gauge bar should show ~25% width
      cy.get('.bg-green-500').should('be.visible') // Green for < 70% usage
    })
  })

  it('Budget updates when user navigates', () => {
    // Initial load
    cy.get('[data-testid="rail-budget-gauge"]').should('contain', '₹37,50,000')
    
    // Reload should re-fetch budget
    cy.reload()
    cy.get('[data-testid="rail-budget-gauge"]', { timeout: 5000 }).should('contain', '₹37,50,000')
  })
})

describe('Rail — Manager Specific Features', () => {
  beforeEach(() => {
    setupRailBudgetMocks()
    signOut()
    signIn(RAIL_MANAGER.email, RAIL_MANAGER.pass)
  })

  it('manager sees pending approval count in Rail', () => {
    cy.url({ timeout: 10000 }).should('include', '/manager')
    cy.get('[data-testid="rail-pending-count"]', { timeout: 5000 }).should('be.visible')
    cy.get('[data-testid="rail-pending-count"]').should('contain', '2')
  })

  it('manager can see quick link to pending approvals', () => {
    cy.get('[data-testid="rail-pending-link"]').should('be.visible')
    cy.get('[data-testid="rail-pending-link"]').click()
    cy.url().should('include', '/manager')
    cy.get('[data-testid="approval-card"]').should('have.length', 2)
  })
})

describe('Rail — Budget Alert States', () => {
  beforeEach(() => {
    // High budget warning scenario
    const HIGH_USAGE_BUDGET = {
      department: 'Engineering',
      monthlyBudget: 5000000,
      spent: 4200000,
      remaining: 800000,
      percentUsed: 84
    }
    
    cy.intercept('GET', '**/api/department/budget', {
      statusCode: 200,
      body: HIGH_USAGE_BUDGET
    }).as('getHighBudget')
    
    signOut()
    signIn(RAIL_EMPLOYEE.email, RAIL_EMPLOYEE.pass)
  })

  it('shows warning color when budget > 70%', () => {
    cy.get('[data-testid="rail-budget-gauge"]').within(() => {
      // Amber color for 70-90% usage
      cy.get('.bg-amber-500').should('be.visible')
    })
  })

  it('shows danger color when budget > 90%', () => {
    const CRITICAL_BUDGET = {
      department: 'Engineering',
      monthlyBudget: 5000000,
      spent: 4800000,
      remaining: 200000,
      percentUsed: 96
    }
    
    cy.intercept('GET', '**/api/department/budget', {
      statusCode: 200,
      body: CRITICAL_BUDGET
    }).as('getCriticalBudget')
    
    cy.reload()
    cy.get('[data-testid="rail-budget-gauge"]', { timeout: 5000 }).within(() => {
      cy.get('.bg-red-500').should('be.visible')
    })
  })
})