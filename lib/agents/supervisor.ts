/**
 * E-Commerce Support Agent - Supervisor Agent
 *
 * Implements the supervisor agent that routes queries to specialized agents:
 * - RefundAgent: Handles refund requests
 * - ToolAgent: Handles database queries and searches
 * - UIAgent: Handles response formatting and streaming
 *
 * Uses Gemini 2.0 Flash for fast intent classification.
 *
 * @packageDocumentation
 * TEMPORARILY DISABLED - LangGraph API incompatible with current version
 */

import type {
  AgentState,
  IntentClassification,
  QueryContext,
} from './state';
import {
  IntentTypeSchema,
  createInitialState,
} from './state';

// Note: LangGraph imports commented out due to API version mismatch
// import {
//   StateGraph,
//   END,
//   START,
//   Annotation,
//   CompiledStateGraph,
// } from '@langchain/langgraph';
// import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
// import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';

/**
 * Supervisor configuration constants.
 */
const SUPERVISOR_SYSTEM_PROMPT = `You are the supervisor for an e-commerce support system.
Your role is to classify incoming user queries and route them to the appropriate specialized agent.

Available agents:
1. REFUND_AGENT - Handles refund requests, order cancellations, and payment issues
2. TOOL_AGENT - Handles database queries, product searches, order lookups, and information retrieval
3. UI_AGENT - Handles response formatting, streaming, and UI updates for general inquiries

When classifying, consider:
- Is the user asking for a refund or reversal of payment? -> REFUND_AGENT
- Is the user asking for specific data (orders, products, account info)? -> TOOL_AGENT
- Is the user asking a general question or needing a response formatted? -> UI_AGENT

Return a JSON object with:
- intent: one of ['refund_request', 'order_inquiry', 'product_search', 'ticket_create', 'general_support']
- confidence: a number between 0 and 1
- extracted_entities: any relevant order IDs, product IDs, emails, etc.
- suggested_routing: one of ['refund', 'tool', 'ui']`;

/**
 * Creates the supervisor graph with all nodes and edges.
 * TEMPORARILY DISABLED - returns null
 */
export function createSupervisorGraph() {
  console.warn('LangGraph supervisor disabled - using Ollama route instead');
  return null;
}
