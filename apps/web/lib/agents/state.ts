/**
 * LangGraph Agent State Types
 * 
 * Defines the typed state for the commerce agent workflow.
 * Used by LangGraph StateGraph for type-safe state transitions.
 */

import { Annotation } from '@langchain/langgraph';

/**
 * Intent types for e-commerce domain
 */
export type IntentType =
  | 'product_search'
  | 'cart_add'
  | 'cart_update'
  | 'cart_remove'
  | 'cart_view'
  | 'checkout'
  | 'payment'
  | 'order_status'
  | 'order_history'
  | 'order_cancel'
  | 'refund_request'
  | 'support'
  | 'recommendation'
  | 'general';

/**
 * Extracted entities from user query
 */
export interface Entities {
  /** Product names or brands mentioned */
  products?: string[];
  /** Categories (e.g., "laptops", "audio") */
  categories?: string[];
  /** Price constraints */
  maxPrice?: number;
  minPrice?: number;
  /** Quantities */
  quantity?: number;
  /** Order IDs */
  orderId?: string;
  /** Product IDs */
  productId?: string;
  /** Customer email */
  email?: string;
}

/**
 * Sentiment analysis result
 */
export type SentimentType = 'positive' | 'neutral' | 'negative' | 'frustrated';

/**
 * Classification result from intent node
 */
export interface Classification {
  /** Detected intent */
  intent: IntentType;
  /** Extracted entities */
  entities: Entities;
  /** User sentiment */
  sentiment: SentimentType;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /** Tool name */
  tool: string;
  /** Success status */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Error message if failed */
  error?: string;
}

/**
 * UI component hint for GenUI rendering
 */
export interface UIHint {
  /** Component name (e.g., "ProductGrid", "CartDrawer") */
  component: string;
  /** Component props */
  props: Record<string, unknown>;
}

/**
 * Agent State - Root annotation for LangGraph workflow
 * 
 * This defines the complete state schema for the commerce agent.
 * Each node in the graph reads/writes to this state.
 */
export const AgentState = Annotation.Root({
  /**
   * Message history for the conversation
   * Accumulates all user and assistant messages
   */
  messages: Annotation<string[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),

  /**
   * User ID for personalization and auth
   */
  userId: Annotation<string | undefined>({
    reducer: (prev, next) => next ?? prev,
  }),

  /**
   * Current intent classification
   */
  intent: Annotation<IntentType | undefined>({
    reducer: (prev, next) => next ?? prev,
  }),

  /**
   * Extracted entities from classification
   */
  entities: Annotation<Entities | undefined>({
    reducer: (prev, next) => next ?? prev,
  }),

  /**
   * User sentiment
   */
  sentiment: Annotation<SentimentType | undefined>({
    reducer: (prev, next) => next ?? prev,
  }),

  /**
   * Classification confidence
   */
  confidence: Annotation<number | undefined>({
    reducer: (prev, next) => next ?? prev,
  }),

  /**
   * Tool execution results
   */
  toolResults: Annotation<ToolResult[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),

  /**
   * UI components to render
   */
  uiComponents: Annotation<UIHint[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),

  /**
   * Error message if any node failed
   */
  error: Annotation<string | undefined>({
    reducer: (prev, next) => next ?? prev,
  }),

  /**
   * Additional metadata for tracing
   */
  metadata: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
});

/**
 * Type inference for AgentState
 */
export type AgentStateType = typeof AgentState.State;

/**
 * Next node routing type
 */
export type NextNodeType =
  | 'classify_node'
  | 'search_node'
  | 'cart_node'
  | 'checkout_node'
  | 'order_node'
  | 'refund_node'
  | 'support_node'
  | 'recommendation_node'
  | 'response_node'
  | 'END';
