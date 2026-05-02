/// <reference types="cypress" />

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

export {}
