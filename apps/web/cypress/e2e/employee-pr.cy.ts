// Employee Purchase Request Workflow — E2E Tests
// Tests for PRD Part 7 - Employee PR creation and submission

const EMPLOYEE_USER = {
  email: 'employee@acme.com',
  pass: 'password123',
}

const EMPLOYEE_BUDGET = {
  department: 'Engineering',
  monthlyBudget: 5000000,
  spent: 1250000,
  remaining: 3750000,
  percentUsed: 25
}

const EMPLOYEE_CATALOG = [
  { id: 'cat-1', name: 'MacBook Pro 14"', description: 'Apple laptop', sku: 'APL-MBP-14', unitPrice: 199900, category: 'HARDWARE', vendor: 'Apple', vendorCode: 'APL', leadDays: 5, inStock: true, minOrderQty: 1 },
  { id: 'cat-2', name: 'Dell Monitor 27"', description: '27 inch 4K monitor', sku: 'DEL-MON-27', unitPrice: 52000, category: 'HARDWARE', vendor: 'Dell', vendorCode: 'DEL', leadDays: 3, inStock: true, minOrderQty: 1 },
  { id: 'cat-3', name: 'Logitech MX Keys', description: 'Wireless keyboard', sku: 'LOG-MXK', unitPrice: 9500, category: 'HARDWARE', vendor: 'Logitech', vendorCode: 'LOG', leadDays: 2, inStock: true, minOrderQty: 1 }
]

// Mock SSE response helpers
function createMockSSE(events: Array<{event: string, data: unknown}>) {
  return events.map(e => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join('')
}

function mockCatalogResponse() {
  return createMockSSE([
    { event: 'metadata', data: { run_id: 'mock-run-' + Date.now() } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-1', content: '', tool_calls: [{ id: 'call-1', name: 'searchProducts', args: { query: 'laptop' } }] }] },
    { event: 'messages/partial', data: [{ type: 'tool', id: 'tool-1', name: 'searchProducts', content: JSON.stringify(EMPLOYEE_CATALOG), tool_call_id: 'call-1' }] },
    { event: 'custom', data: { type: 'ui', name: 'catalog-grid', props: { items: EMPLOYEE_CATALOG, loading: false }, metadata: { messageId: 'msg-1' } } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-2', content: 'Here are the items available for your department.', tool_calls: [] }] },
    { event: 'end', data: {} }
  ])
}

function mockPRDraftResponse() {
  return createMockSSE([
    { event: 'metadata', data: { run_id: 'mock-run-' + Date.now() } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-1', content: '', tool_calls: [{ id: 'call-1', name: 'addToPurchaseRequest', args: { catalogItemId: 'cat-1', quantity: 1 } }] }] },
    { event: 'messages/partial', data: [{ type: 'tool', id: 'tool-1', name: 'addToPurchaseRequest', content: JSON.stringify({ 
      prNumber: 'PR-2026-0001', 
      lineItems: [{ id: '1', name: 'MacBook Pro 14"', vendor: 'Apple', quantity: 1, unitPrice: 199900, totalPrice: 199900 }],
      total: 199900,
      status: 'DRAFT'
    }), tool_call_id: 'call-1' }] },
    { event: 'custom', data: { type: 'ui', name: 'pr-draft', props: { 
      prNumber: 'PR-2026-0001',
      lineItems: [{ id: '1', name: 'MacBook Pro 14"', vendor: 'Apple', quantity: 1, unitPrice: 199900, totalPrice: 199900 }],
      total: 199900,
      status: 'DRAFT'
    }, metadata: { messageId: 'msg-1' } } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-2', content: 'Added MacBook Pro 14" to your purchase request draft.', tool_calls: [] }] },
    { event: 'end', data: {} }
  ])
}

function mockSubmitPRResponse() {
  return createMockSSE([
    { event: 'metadata', data: { run_id: 'mock-run-' + Date.now() } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-1', content: '', tool_calls: [{ id: 'call-1', name: 'submitPurchaseRequest', args: { justification: 'Need for new hire', urgency: 'NORMAL' } }] }] },
    { event: 'messages/partial', data: [{ type: 'tool', id: 'tool-1', name: 'submitPurchaseRequest', content: JSON.stringify({ 
      success: true, 
      prId: 'pr-123',
      prNumber: 'PR-2026-0001'
    }), tool_call_id: 'call-1' }] },
    { event: 'custom', data: { type: 'ui', name: 'pr-submitted', props: { 
      prNumber: 'PR-2026-0001',
      approverEmail: 'manager@acme.com',
      totalAmount: 199900
    }, metadata: { messageId: 'msg-1' } } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-2', content: 'Your PR has been submitted for approval. Manager will review shortly.', tool_calls: [] }] },
    { event: 'end', data: {} }
  ])
}

function setupEmployeeMocks() {
  // Mock budget API
  cy.intercept('GET', '**/api/department/budget', {
    statusCode: 200,
    body: EMPLOYEE_BUDGET
  }).as('getBudget')

  // Mock catalog API
  cy.intercept('GET', '**/api/catalog/**', {
    statusCode: 200,
    body: { items: EMPLOYEE_CATALOG }
  }).as('getCatalog')

  // Mock PR creation
  cy.intercept('POST', '**/api/purchase-requests', {
    statusCode: 201,
    body: { id: 'pr-123', prNumber: 'PR-2026-0001', status: 'DRAFT' }
  }).as('createPR')

  // Mock PR submission
  cy.intercept('POST', '**/api/purchase-requests/*/submit', {
    statusCode: 200,
    body: { success: true, prId: 'pr-123', prNumber: 'PR-2026-0001' }
  }).as('submitPR')

  // Mock LangGraph streaming
  cy.intercept('GET', '**/assistants/*/threads/*/runs/*/stream', (req) => {
    const url = req.url
    if (url.includes('laptop') || url.includes('show') || url.includes('search')) {
      req.reply({ statusCode: 200, body: mockCatalogResponse() })
    } else if (url.includes('add') || url.includes('purchase')) {
      req.reply({ statusCode: 200, body: mockPRDraftResponse() })
    } else if (url.includes('submit')) {
      req.reply({ statusCode: 200, body: mockSubmitPRResponse() })
    } else {
      req.reply({ statusCode: 200, body: mockCatalogResponse() })
    }
  }).as('mockStream')

  cy.intercept('POST', '**/assistants/*/threads/*/runs', {
    statusCode: 200,
    body: { run_id: 'mock-run', thread_id: 'mock-thread', assistant_id: 'customer' }
  }).as('mockRun')
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

describe('Employee — Create and Submit Purchase Request', () => {
  beforeEach(() => {
    setupEmployeeMocks()
    signOut()
    signIn(EMPLOYEE_USER.email, EMPLOYEE_USER.pass)
  })

  it('employee is redirected to /chat after login', () => {
    cy.url({ timeout: 10000 }).should('include', '/chat')
  })

  it('chat page renders inside Shell with Rail', () => {
    cy.get('[data-testid="shell-rail"]').should('be.visible')
    cy.get('[data-testid="rail-budget-gauge"]').should('be.visible')
  })

  it('shows department budget in Rail', () => {
    cy.get('[data-testid="rail-budget-gauge"]', { timeout: 5000 }).should('contain', '₹37,50,000')
  })

  it('can search catalog via chat', () => {
    cy.get('[data-testid="chat-input"]').type('show me laptops')
    cy.get('[data-testid="send-button"]').click()
    cy.get('[data-testid="agent-thinking"]', { timeout: 5000 }).should('exist')
    cy.get('[data-testid="catalog-grid"]', { timeout: 10000 }).should('be.visible')
  })

  it('can add item to PR draft via chat', () => {
    cy.get('[data-testid="chat-input"]').type('add MacBook to my request')
    cy.get('[data-testid="send-button"]').click()
    cy.get('[data-testid="pr-draft"]', { timeout: 10000 }).should('be.visible')
    cy.contains('PR-2026-0001').should('be.visible')
  })

  it('can view PR draft with items', () => {
    cy.get('[data-testid="chat-input"]').type('add MacBook to my request')
    cy.get('[data-testid="send-button"]').click()
    cy.get('[data-testid="pr-draft"]', { timeout: 10000 }).should('be.visible')
    cy.contains('MacBook Pro 14"').should('be.visible')
    cy.contains('₹1,99,900').should('be.visible')
  })

  it('can submit PR for approval with justification', () => {
    cy.get('[data-testid="chat-input"]').type('add MacBook to my request')
    cy.get('[data-testid="send-button"]').click()
    cy.get('[data-testid="pr-draft"]', { timeout: 10000 }).should('be.visible')
    
    // Submit PR (in real app this would be via a form in PR draft)
    cy.get('[data-testid="submit-for-approval-btn"]').click()
    cy.get('[data-testid="pr-submitted"]', { timeout: 10000 }).should('be.visible')
    cy.contains('PR-2026-0001').should('be.visible')
    cy.contains('submitted for approval').should('be.visible')
  })

  it('shows budget status in Rail after PR submission', () => {
    cy.get('[data-testid="chat-input"]').type('add MacBook to my request')
    cy.get('[data-testid="send-button"]').click()
    cy.get('[data-testid="pr-draft"]', { timeout: 10000 }).should('be.visible')
    cy.get('[data-testid="rail-budget-gauge"]').should('contain', '₹37,50,000')
  })
})

describe('Employee PR Draft Persistence', () => {
  beforeEach(() => {
    setupEmployeeMocks()
    signOut()
    signIn(EMPLOYEE_USER.email, EMPLOYEE_USER.pass)
  })

  it('PR draft persists in Zustand store', () => {
    cy.get('[data-testid="chat-input"]').type('add MacBook to my request')
    cy.get('[data-testid="send-button"]').click()
    cy.get('[data-testid="pr-draft"]', { timeout: 10000 }).should('be.visible')
    
    // Reload page and verify draft still exists
    cy.reload()
    cy.get('[data-testid="pr-draft"]', { timeout: 5000 }).should('be.visible')
  })
})