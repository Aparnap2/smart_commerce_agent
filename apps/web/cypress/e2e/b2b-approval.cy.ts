// B2B Approval Flow — E2E
// Uses REAL routes only: /chat, /admin/chat, /auth/login

const EMPLOYEE = {
  email: 'employee@techtrend.com',
  pass:  'password123',
}
const MANAGER = {
  email: 'manager@techtrend.com',
  pass:  'password123',
}

// Mock product data for B2B catalog
const MOCK_LAPTOPS = [
  { id: 1, name: 'MacBook Pro 14"', price: 199900, stock: 10, category: 'HARDWARE', brand: 'Apple', rating: 4.8 },
  { id: 2, name: 'Dell XPS 15', price: 149900, stock: 15, category: 'HARDWARE', brand: 'Dell', rating: 4.5 },
  { id: 3, name: 'ThinkPad X1 Carbon', price: 129900, stock: 20, category: 'HARDWARE', brand: 'Lenovo', rating: 4.6 },
]

const MOCK_BUDGET = {
  total: 5000000,
  spent: 1250000,
  remaining: 3750000,
  department: 'Engineering'
}

const MOCK_PR = {
  id: 'PR-2024-001',
  items: [{ name: 'MacBook Pro 14"', price: 199900, quantity: 1 }],
  total: 199900,
  status: 'DRAFT'
}

const MOCK_APPROVALS = [
  { id: 'PR-2024-001', requester: 'Priya Sharma', items: 'MacBook Pro 14"', total: 199900, date: '2024-01-15' },
  { id: 'PR-2024-002', requester: 'Raj Patel', items: 'Dell Monitor x2', total: 104000, date: '2024-01-14' },
]

// Helper to create mock SSE responses
function createMockResponse(events: Array<{event: string, data: unknown}>) {
  return events
    .map(e => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join('')
}

function mockCatalogResponse() {
  return createMockResponse([
    { event: 'metadata', data: { run_id: 'mock-run-' + Date.now() } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-1', content: '', tool_calls: [{ id: 'call-1', name: 'searchProducts', args: { query: 'laptop' } }] }] },
    { event: 'messages/partial', data: [{ type: 'tool', id: 'tool-1', name: 'searchProducts', content: JSON.stringify(MOCK_LAPTOPS), tool_call_id: 'call-1' }] },
    { event: 'custom', data: { type: 'ui', name: 'catalog-grid', props: { products: MOCK_LAPTOPS }, metadata: { messageId: 'msg-1' } } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-2', content: 'Here are some laptops available for purchase.', tool_calls: [] }] },
    { event: 'end', data: {} }
  ])
}

function mockBudgetResponse() {
  return createMockResponse([
    { event: 'metadata', data: { run_id: 'mock-run-' + Date.now() } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-1', content: '', tool_calls: [{ id: 'call-1', name: 'getDepartmentBudget', args: {} }] }] },
    { event: 'messages/partial', data: [{ type: 'tool', id: 'tool-1', name: 'getDepartmentBudget', content: JSON.stringify(MOCK_BUDGET), tool_call_id: 'call-1' }] },
    { event: 'custom', data: { type: 'ui', name: 'budget-gauge', props: MOCK_BUDGET, metadata: { messageId: 'msg-1' } } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-2', content: 'Your department has ₹37,50,000 remaining of ₹50,00,000 budget.', tool_calls: [] }] },
    { event: 'end', data: {} }
  ])
}

function mockPRDraftResponse() {
  return createMockResponse([
    { event: 'metadata', data: { run_id: 'mock-run-' + Date.now() } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-1', content: '', tool_calls: [{ id: 'call-1', name: 'addToPurchaseRequest', args: { productId: 1 } }] }] },
    { event: 'messages/partial', data: [{ type: 'tool', id: 'tool-1', name: 'addToPurchaseRequest', content: JSON.stringify(MOCK_PR), tool_call_id: 'call-1' }] },
    { event: 'custom', data: { type: 'ui', name: 'pr-draft', props: MOCK_PR, metadata: { messageId: 'msg-1' } } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-2', content: 'Added MacBook Pro 14" to your purchase request. Total: ₹1,99,900', tool_calls: [] }] },
    { event: 'end', data: {} }
  ])
}

function mockPRSubmittedResponse() {
  return createMockResponse([
    { event: 'metadata', data: { run_id: 'mock-run-' + Date.now() } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-1', content: '', tool_calls: [{ id: 'call-1', name: 'submitPurchaseRequest', args: {} }] }] },
    { event: 'messages/partial', data: [{ type: 'tool', id: 'tool-1', name: 'submitPurchaseRequest', content: JSON.stringify({ success: true, prId: 'PR-2024-001' }), tool_call_id: 'call-1' }] },
    { event: 'custom', data: { type: 'ui', name: 'pr-submitted', props: { prId: 'PR-2024-001' }, metadata: { messageId: 'msg-1' } } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-2', content: 'Your purchase request PR-2024-001 has been submitted for approval.', tool_calls: [] }] },
    { event: 'end', data: {} }
  ])
}

function mockApprovalsResponse() {
  return createMockResponse([
    { event: 'metadata', data: { run_id: 'mock-run-' + Date.now() } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-1', content: '', tool_calls: [{ id: 'call-1', name: 'getPendingApprovals', args: {} }] }] },
    { event: 'messages/partial', data: [{ type: 'tool', id: 'tool-1', name: 'getPendingApprovals', content: JSON.stringify(MOCK_APPROVALS), tool_call_id: 'call-1' }] },
    { event: 'custom', data: { type: 'ui', name: 'approval-card', props: { approvals: MOCK_APPROVALS }, metadata: { messageId: 'msg-1' } } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-2', content: 'You have 2 pending purchase requests requiring your approval.', tool_calls: [] }] },
    { event: 'end', data: {} }
  ])
}

function mockBudgetAlertResponse() {
  return createMockResponse([
    { event: 'metadata', data: { run_id: 'mock-run-' + Date.now() } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-1', content: '', tool_calls: [{ id: 'call-1', name: 'searchProducts', args: { query: 'MacBook Pro' } }] }] },
    { event: 'messages/partial', data: [{ type: 'tool', id: 'tool-1', name: 'searchProducts', content: JSON.stringify([{ id: 1, name: 'MacBook Pro M4 14"', price: 199900, stock: 10, category: 'HARDWARE', brand: 'Apple', rating: 4.8 }]), tool_call_id: 'call-1' }] },
    { event: 'custom', data: { type: 'ui', name: 'catalog-grid', props: { products: [{ id: 1, name: 'MacBook Pro M4 14"', price: 199900, stock: 10, category: 'HARDWARE', brand: 'Apple', rating: 4.8 }] }, metadata: { messageId: 'msg-1' } } },
    { event: 'custom', data: { type: 'ui', name: 'budget-alert', props: { message: 'This item exceeds your department budget', itemPrice: 199900, budgetRemaining: 50000 }, metadata: { messageId: 'msg-1' } } },
    { event: 'messages/partial', data: [{ type: 'ai', id: 'msg-2', content: 'Warning: MacBook Pro M4 14" costs ₹1,99,900 which exceeds your remaining budget of ₹50,000.', tool_calls: [] }] },
    { event: 'end', data: {} }
  ])
}

// Setup - use REAL LLM (no mocks)
function setupMocks() {
  // Using real LLM - no interceptors
  // The app will call actual API endpoints with deepseek-v3.2:cloud
}

function signIn(email: string, pass: string) {
  cy.visit('/auth/login')
  cy.get('input[name="email"]', { timeout: 8000 }).type(email)
  cy.get('input[name="password"]').type(pass)
  cy.get('button[type="submit"]').click()
  cy.url({ timeout: 10000 }).should('include', '/chat')
}

function signOut() {
  cy.clearCookies()
  cy.clearLocalStorage()
}

describe('Employee — Create and Submit PR', () => {
  beforeEach(() => {
    setupMocks()
    signOut()
    signIn(EMPLOYEE.email, EMPLOYEE.pass)
  })

  it('lands on /chat after sign-in', () => {
    cy.url().should('include', '/chat')
    cy.get('[data-testid="chat-input"]', { timeout: 8000 }).should('be.visible')
  })

  it('can search catalog via chat', () => {
    cy.get('[data-testid="chat-input"]').type('I need a laptop')
    cy.get('[data-testid="send-button"]').click()
    cy.get('[data-testid="agent-thinking"]', { timeout: 5000 }).should('exist')
    cy.get('[data-testid="catalog-grid"]', { timeout: 10000 }).should('be.visible')
  })

  it('can check department budget', () => {
    cy.get('[data-testid="chat-input"]').type('check my budget')
    cy.get('[data-testid="send-button"]').click()
    cy.get('[data-testid="agent-thinking"]', { timeout: 5000 }).should('exist')
    cy.get('[data-testid="budget-gauge"]', { timeout: 10000 }).should('be.visible')
  })

  it('can add item to purchase request', () => {
    cy.get('[data-testid="chat-input"]').type('show me laptops')
    cy.get('[data-testid="send-button"]').click()
    cy.get('[data-testid="catalog-grid"]', { timeout: 10000 }).should('be.visible')
    cy.get('[data-testid="add-to-request-btn"]').first().click()
    cy.get('[data-testid="pr-draft"]', { timeout: 10000 }).should('be.visible')
  })

  it('can submit PR for approval', () => {
    cy.get('[data-testid="chat-input"]').type('show me laptops')
    cy.get('[data-testid="send-button"]').click()
    cy.get('[data-testid="catalog-grid"]', { timeout: 10000 }).should('be.visible')
    cy.get('[data-testid="add-to-request-btn"]').first().click()
    cy.get('[data-testid="pr-draft"]', { timeout: 10000 }).should('be.visible')
    cy.get('[data-testid="submit-for-approval-btn"]').click()
    cy.get('[data-testid="pr-submitted"]', { timeout: 10000 }).should('be.visible')
  })
})

describe('Manager — Review and Approve PR', () => {
  beforeEach(() => {
    setupMocks()
    signOut()
    signIn(MANAGER.email, MANAGER.pass)
  })

  it('sees manager role on /admin/chat', () => {
    cy.url().should('include', '/admin/chat')
  })

  it('can view pending approvals', () => {
    cy.get('[data-testid="chat-input"]').type('show pending approvals')
    cy.get('[data-testid="send-button"]').click()
    cy.get('[data-testid="agent-thinking"]', { timeout: 5000 }).should('exist')
    cy.get('[data-testid="approval-card"]', { timeout: 10000 }).should('be.visible')
  })
})

describe('Budget guardrail', () => {
  it('shows budget-alert when item exceeds budget', () => {
    setupMocks()
    cy.visit('/auth/login')
    cy.get('input[name="email"]').type(EMPLOYEE.email)
    cy.get('input[name="password"]').type(EMPLOYEE.pass)
    cy.get('button[type="submit"]').click()
    cy.url({ timeout: 10000 }).should('include', '/chat')
    cy.get('[data-testid="chat-input"]').type('I need a MacBook Pro')
    cy.get('[data-testid="send-button"]').click()
    cy.get('[data-testid="agent-thinking"]', { timeout: 5000 }).should('exist')
    cy.get('[data-testid="catalog-grid"]', { timeout: 10000 }).should('be.visible')
    cy.get('[data-testid="budget-alert"]', { timeout: 10000 }).should('be.visible')
  })
})