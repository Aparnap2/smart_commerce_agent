import './commands'
import '@testing-library/cypress/add-commands'
import { registerLangGraphMockCommands } from './langgraph-mock'

// Register all LangGraph mock commands
registerLangGraphMockCommands()

// Enhanced error suppression for streaming SDK and mocked tests
Cypress.on('uncaught:exception', (err) => {
  // Suppress non-fatal errors from streaming SDK
  if (
    err.message.includes('ResizeObserver') ||
    err.message.includes('Non-Error promise rejection') ||
    err.message.includes('AbortError') ||
    err.message.includes('ReadableStream') ||
    err.message.includes('NetworkError') ||
    err.message.includes('Failed to fetch') ||
    err.message.includes('SSE') ||
    err.message.includes('EventSource')
  ) {
    return false
  }
  
  // Suppress errors from mocked responses (expected in tests)
  if (err.message.includes('mock-') || err.message.includes('Mocked')) {
    return false
  }
  
  return true
})
