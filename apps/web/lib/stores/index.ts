/**
 * Stores Module Index
 *
 * State management stores for the e-commerce agent.
 *
 * @packageDocumentation
 */

export {
  useAgentStore,
  selectSession,
  selectMessages,
  selectActiveView,
  selectIsLoading,
  selectIsStreaming,
  selectPreferences,
} from './agent-store.js';

export type {
  AgentState,
  AgentActions,
  AgentSession,
  AgentMessage,
  AgentUIState,
  MessageRole,
} from './agent-store.js';
