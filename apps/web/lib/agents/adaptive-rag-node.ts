/**
 * Adaptive RAG Decision Node
 *
 * Extends supervisor with intelligent RAG routing:
 * - Determines if retrieval is necessary for a query
 * - Routes to RAG pipeline or direct LLM response
 * - Optimizes for latency and accuracy
 *
 * @packageDocumentation
 */

import { logger } from '../redis/logger.js';
import { env } from '../env.js';
import { createChatCompletion, type ChatMessage } from '../llm/provider.js';

/**
 * Adaptive RAG decision
 */
export interface AdaptiveRAGDecision {
  /** Whether to use retrieval */
  useRetrieval: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for decision */
  reason: string;
  /** Suggested retrieval queries if applicable */
  queries?: string[];
}

/**
 * Determine if retrieval is needed for a query
 *
 * @param query - User query
 * @param conversationHistory - Previous messages
 * @returns RAG decision
 */
export async function decideRetrievalNecessity(
  query: string,
  conversationHistory: ChatMessage[] = []
): Promise<AdaptiveRAGDecision> {
  logger.debug('RAG', 'Deciding retrieval necessity', {
    query: query.substring(0, 100),
    historyLength: conversationHistory.length,
  });

  const conversationContext = conversationHistory
    .slice(-4)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `You are determining whether a user query requires information retrieval from a knowledge base.

${conversationContext ? `CONVERSATION HISTORY:
${conversationContext}
` : ''}
USER QUERY: "${query}"

Analyze if this query requires external information retrieval:

RETRIEVAL NEEDED for:
- Product information, availability, specifications
- Order status, shipping, tracking
- Company policies (returns, warranties, shipping)
- Factual questions about specific items
- Questions referencing previous conversations about products/orders

NO RETRIEVAL NEEDED for:
- Simple greetings (hello, hi, good morning)
- Small talk (how are you, thanks)
- General questions answerable from common knowledge
- Opinion questions
- Mathematical calculations
- Programming help (unless about specific products)

Respond with ONLY a JSON object:
{
  "useRetrieval": true|false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation",
  "queries": ["suggested search query 1", "query 2"] // Only if retrieval needed
}

JSON:`;

  try {
    const response = await createChatCompletion({
      model: env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      maxTokens: 300,
    });

    const content = response.choices[0]?.message?.content || '{}';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const decision = JSON.parse(jsonMatch[0]) as AdaptiveRAGDecision;
      
      logger.info('RAG', 'Retrieval decision made', {
        useRetrieval: decision.useRetrieval,
        confidence: decision.confidence,
        reason: decision.reason.substring(0, 100),
      });

      return {
        ...decision,
        confidence: Math.max(0, Math.min(1, decision.confidence)),
      };
    }

    // Fallback: simple keyword-based decision
    return fallbackDecision(query);
  } catch (error) {
    logger.error('RAG', 'Retrieval decision failed', error);
    return fallbackDecision(query);
  }
}

/**
 * Fallback decision logic using keyword matching
 */
function fallbackDecision(query: string): AdaptiveRAGDecision {
  const lowerQuery = query.toLowerCase();

  // Keywords that indicate retrieval is needed
  const retrievalKeywords = [
    'product', 'order', 'shipping', 'return', 'refund', 'price',
    'available', 'stock', 'inventory', 'tracking', 'delivery',
    'warranty', 'policy', 'discount', 'coupon', 'sale',
    'my order', 'my account', 'my cart',
  ];

  // Keywords that indicate retrieval is NOT needed
  const noRetrievalKeywords = [
    'hello', 'hi', 'hey', 'good morning', 'good afternoon',
    'thank', 'thanks', 'bye', 'goodbye',
    'how are you', 'help me', 'who are you',
  ];

  const needsRetrieval = retrievalKeywords.some((kw) => lowerQuery.includes(kw));
  const noRetrieval = noRetrievalKeywords.some((kw) => lowerQuery.includes(kw));

  if (noRetrieval) {
    return {
      useRetrieval: false,
      confidence: 0.8,
      reason: 'Query appears to be greeting or small talk',
    };
  }

  if (needsRetrieval) {
    return {
      useRetrieval: true,
      confidence: 0.7,
      reason: 'Query contains keywords indicating information retrieval needed',
      queries: [lowerQuery],
    };
  }

  // Default to retrieval for ambiguous queries
  return {
    useRetrieval: true,
    confidence: 0.5,
    reason: 'Ambiguous query, defaulting to retrieval for safety',
    queries: [lowerQuery],
  };
}

/**
 * Adaptive RAG node for LangGraph workflow
 *
 * @returns Node function for LangGraph
 */
export function createAdaptiveRAGNode() {
  return async function adaptiveRAGNode(state: {
    messages: Array<{ role: string; content: string }>;
    intent?: { type: string };
    currentAgent?: string;
  }): Promise<{
    currentAgent: string;
    useRAG?: boolean;
    ragQueries?: string[];
  }> {
    const lastMessage = state.messages[state.messages.length - 1];
    const query = lastMessage?.content || '';

    logger.info('RAG', 'Adaptive RAG node executing', {
      query: query.substring(0, 100),
      intent: state.intent?.type,
    });

    // Always use retrieval for specific intents
    const retrievalIntents = ['product_search', 'order_lookup', 'policy_query'];
    if (state.intent && retrievalIntents.includes(state.intent.type)) {
      logger.debug('RAG', 'Intent requires retrieval');
      return {
        currentAgent: 'rag',
        useRAG: true,
        ragQueries: [query],
      };
    }

    // Use LLM to decide for other intents
    const decision = await decideRetrievalNecessity(query, state.messages as ChatMessage[]);

    if (decision.useRetrieval) {
      logger.info('RAG', 'Routing to RAG pipeline');
      return {
        currentAgent: 'rag',
        useRAG: true,
        ragQueries: decision.queries || [query],
      };
    }

    logger.info('RAG', 'Routing to direct LLM response');
    return {
      currentAgent: 'llm',
      useRAG: false,
    };
  };
}

/**
 * Integrate adaptive RAG into existing supervisor
 *
 * Call this from your supervisor's routing logic
 */
export async function routeWithAdaptiveRAG(
  query: string,
  context?: {
    userId?: string;
    threadId?: string;
    intent?: string;
  }
): Promise<{
  shouldUseRAG: boolean;
  queries: string[];
  reason: string;
}> {
  logger.info('RAG', 'Routing with adaptive RAG', {
    query: query.substring(0, 100),
    context,
  });

  const decision = await decideRetrievalNecessity(query);

  return {
    shouldUseRAG: decision.useRetrieval,
    queries: decision.queries || [query],
    reason: decision.reason,
  };
}
