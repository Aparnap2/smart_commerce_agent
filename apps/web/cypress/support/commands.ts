// ============================================================================
// Type Augmentation for Custom Cypress Commands
// ============================================================================

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Sign in with email and password
       */
      signIn(email: string, password?: string): Chainable<void>
      
      /**
       * Send a message in the chat interface
       */
      sendMessage(text: string): Chainable<void>
      
      /**
       * Wait for agent response (streaming to complete)
       */
      waitForAgentResponse(timeout?: number): Chainable<void>
      
      /**
       * Mock the LangGraph SSE stream with a single response
       */
      mockLangGraph(responseBody: string): Chainable<void>
      
      /**
       * Mock the LangGraph SSE stream with a sequence of responses
       */
      mockLangGraphSequence(responseBodies: string[]): Chainable<void>
      
      /**
       * Wait for the stream to start (agent-thinking appears)
       */
      waitForStream(timeout?: number): Chainable<void>
      
      /**
       * Wait for a specific component to render by data-testid
       */
      waitForComponent(testId: string, timeout?: number): Chainable<void>
      
      /**
       * Wait for the stream to complete (agent-thinking disappears)
       */
      waitForStreamEnd(timeout?: number): Chainable<void>
    }
  }
}

// ============================================================================
// Authentication Commands
// ============================================================================

/**
 * Sign in with email and password
 * For mocked tests, we bypass authentication completely using Cypress test mode
 */
Cypress.Commands.add('signIn', (email: string, password: string = 'password123') => {
  // Visit the root page - authentication is skipped in Cypress test mode
  cy.visit('/', {
    failOnStatusCode: false,
  })
})

// ============================================================================
// Chat Interaction Commands
// ============================================================================

/**
 * Send a message in the chat interface
 */
Cypress.Commands.add('sendMessage', (text: string) => {
  cy.get('[aria-label="Message input"]', { timeout: 10000 })
    .should('be.visible')
    .should('not.be.disabled')
    .type(text)
  cy.get('[aria-label="Send message"]').click()
})

/**
 * Wait for agent response (streaming to complete)
 */
Cypress.Commands.add('waitForAgentResponse', (timeout: number = 45000) => {
  // First wait for thinking indicator to appear
  cy.get('[data-testid="agent-thinking"]', { timeout: 8000 })
    .should('exist')
  
  // Then wait for it to disappear (streaming complete)
  cy.get('[data-testid="agent-thinking"]', { timeout })
    .should('not.exist')
})

// ============================================================================
// LangGraph Mock Commands (Implementation)
// ============================================================================

/**
 * Mock the LangGraph SSE stream with a single response
 */
Cypress.Commands.add('mockLangGraph', (responseBody: string) => {
  cy.intercept('POST', '/api/copilotkit', {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
    body: responseBody,
  }).as('langGraphMock')
})

/**
 * Mock the LangGraph SSE stream with a sequence of responses
 * Each call to sendMessage will use the next response in the sequence
 */
Cypress.Commands.add('mockLangGraphSequence', (responseBodies: string[]) => {
  let callIndex = 0
  
  cy.intercept('POST', '/api/copilotkit', (req) => {
    if (callIndex < responseBodies.length) {
      req.reply({
        statusCode: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        body: responseBodies[callIndex],
      })
      callIndex++
    } else {
      // Return empty stream for extra calls
      req.reply({
        statusCode: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
        body: 'event: end\ndata: {}\n\n',
      })
    }
  }).as('langGraphSequence')
})

/**
 * Wait for the stream to start (agent-thinking appears)
 */
Cypress.Commands.add('waitForStream', (timeout = 8000) => {
  cy.get('[data-testid="agent-thinking"]', { timeout })
    .should('exist')
})

/**
 * Wait for a specific component to render by data-testid
 */
Cypress.Commands.add('waitForComponent', (testId: string, timeout = 15000) => {
  cy.get(`[data-testid="${testId}"]`, { timeout })
    .should('exist')
})

/**
 * Wait for the stream to complete (agent-thinking disappears)
 */
Cypress.Commands.add('waitForStreamEnd', (timeout = 45000) => {
  cy.get('[data-testid="agent-thinking"]', { timeout })
    .should('not.exist')
})

