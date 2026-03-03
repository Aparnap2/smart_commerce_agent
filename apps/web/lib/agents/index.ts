/**
 * E-Commerce Support Agent - Agent Index
 *
 * Central export for all agent modules.
 * Provides factory functions and classes for creating agent instances.
 *
 * @packageDocumentation
 */

// State definitions
export * from './state';

// Tool agent (with hybrid search)
// Note: createToolGraph requires @langchain/google-genai which may have type issues
// export {
//   createToolGraph,
//   createDefaultToolGraph,
//   ToolAgent,
//   createToolAgent,
// } from './tool';

/**
 * Agent type for routing decisions.
 */
export type AgentType = 'tool';

/**
 * Creates all agent graphs with default configuration.
 * Note: LangGraph agent temporarily disabled - using Ollama route instead.
 */
export interface AgentGraphs {
  // tool: ReturnType<typeof createToolGraph>;
}

/**
 * Creates all agent graphs with default configuration.
 */
export function createAllAgentGraphs(): AgentGraphs {
  return {
    // tool: createDefaultToolGraph(),
  };
}
