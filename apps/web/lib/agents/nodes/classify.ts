/**
 * Classify Intent Node
 * 
 * LangGraph node for intent classification using Azure AI Foundry.
 * Analyzes user messages to determine intent, extract entities, and detect sentiment.
 */

import { env } from '../../env';
import type { AgentStateType, IntentType, SentimentType, Entities } from './state';

/**
 * Classification prompt for Azure OpenAI (gpt-oss-120b reasoning model)
 */
const CLASSIFICATION_PROMPT = `You are an intent classifier for an e-commerce assistant.

Analyze the user's message and classify it into one of these intents:
- product_search: Searching, browsing, or filtering products
- cart_add: Adding items to cart
- cart_update: Updating cart item quantities
- cart_remove: Removing items from cart
- cart_view: Viewing cart contents
- checkout: Starting checkout process
- payment: Payment-related queries
- order_status: Checking order status or tracking
- order_history: Viewing past orders
- order_cancel: Cancelling an order
- refund_request: Requesting refund or return
- support: Customer support, complaints, help requests
- recommendation: Asking for product recommendations
- general: Greetings, small talk, or uncategorized

Also extract:
- products: Product names or brands mentioned
- categories: Product categories
- maxPrice/minPrice: Price constraints
- quantity: Quantities mentioned
- orderId: Order IDs
- productId: Product IDs
- email: Customer email addresses

And detect sentiment: positive, neutral, negative, or frustrated

Respond ONLY with valid JSON in this exact format:
{"intent":"intent_type","entities":{"products":["product1"],"maxPrice":1000},"sentiment":"neutral","confidence":0.95}

Do NOT include any reasoning or explanation. ONLY the JSON object.`;

/**
 * Classify intent from user message using Azure AI Foundry
 * 
 * @param state - Current agent state
 * @returns Updated state with classification results
 */
export async function classifyIntent(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const lastMessage = state.messages[state.messages.length - 1];

  if (!lastMessage) {
    return {
      intent: 'general',
      entities: {},
      sentiment: 'neutral',
      confidence: 0,
      error: 'No messages to classify',
    };
  }

  try {
    // Call Azure AI Foundry for classification
    const response = await fetch(
      `${env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${env.AZURE_OPENAI_API_VERSION || '2024-10-21'}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': env.AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: CLASSIFICATION_PROMPT },
            { role: 'user', content: lastMessage },
          ],
          max_tokens: 500,
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Azure AI error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      choices: Array<{
        message: { content: string; reasoning_content?: string };
      }>;
    };

    // gpt-oss-120b is a reasoning model that outputs reasoning_content
    // The reasoning contains the model's thinking, we need to extract intent from it
    let rawContent = data.choices[0]?.message?.content || '';
    
    // If content is empty, use reasoning_content (gpt-oss behavior)
    if (!rawContent && data.choices[0]?.message?.reasoning_content) {
      rawContent = data.choices[0].message.reasoning_content;
    }

    if (!rawContent) {
      throw new Error('Empty response from Azure OpenAI');
    }

    // Try to extract JSON from reasoning content
    // Look for patterns like: "intent": "product_search" or intent "product_search"
    let classification: { intent: IntentType; entities: Entities; sentiment: SentimentType; confidence: number };
    
    // First try to find complete JSON object
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        classification = JSON.parse(jsonMatch[0]);
      } catch {
        // JSON parse failed, extract from reasoning text
        classification = extractIntentFromReasoning(rawContent);
      }
    } else {
      // No JSON found, extract from reasoning text
      classification = extractIntentFromReasoning(rawContent);
    }

    // Validate intent
    const validIntents: IntentType[] = [
      'product_search',
      'cart_add',
      'cart_update',
      'cart_remove',
      'cart_view',
      'checkout',
      'payment',
      'order_status',
      'order_history',
      'order_cancel',
      'refund_request',
      'support',
      'recommendation',
      'general',
    ];

    if (!validIntents.includes(classification.intent)) {
      throw new Error(`Invalid intent: ${classification.intent}`);
    }

    return {
      intent: classification.intent,
      entities: classification.entities || {},
      sentiment: classification.sentiment || 'neutral',
      confidence: classification.confidence || 0,
      metadata: {
        classifiedAt: new Date().toISOString(),
        classificationModel: env.AZURE_OPENAI_DEPLOYMENT,
      },
    };
  } catch (error) {
    console.error('[CLASSIFY] Error:', error);

    // Fallback to keyword-based classification on error
    const lastMessage = state.messages[state.messages.length - 1];
    const fallback = keywordClassify(lastMessage || '');
    
    return {
      intent: fallback.intent,
      entities: fallback.entities,
      sentiment: fallback.sentiment,
      confidence: fallback.confidence,
      error: error instanceof Error ? error.message : 'Classification failed',
      metadata: {
        classificationError: true,
        fallbackUsed: true,
      },
    };
  }
}

/**
 * Extract intent from reasoning text (for gpt-oss model)
 */
function extractIntentFromReasoning(reasoning: string): {
  intent: IntentType;
  entities: Entities;
  sentiment: SentimentType;
  confidence: number;
} {
  const lower = reasoning.toLowerCase();
  
  // Extract intent from reasoning patterns
  let intent: IntentType = 'general';
  
  // Check specific patterns first, then general patterns
  if (lower.includes('where is my order') || lower.includes('order status') || lower.includes('track') || (lower.includes('order') && lower.includes('status'))) {
    intent = 'order_status';
  } else if (lower.includes('past orders') || lower.includes('order history')) {
    intent = 'order_history';
  } else if (lower.includes('cancel order') || lower.includes('order_cancel')) {
    intent = 'order_cancel';
  } else if (lower.includes('view cart') || lower.includes('cart_view')) {
    intent = 'cart_view';
  } else if ((lower.includes('update') || lower.includes('change')) && lower.includes('cart')) {
    intent = 'cart_update';
  } else if ((lower.includes('remove') || lower.includes('delete')) && lower.includes('cart')) {
    intent = 'cart_remove';
  } else if (lower.includes('add') && lower.includes('cart')) {
    intent = 'cart_add';
  } else if (lower.includes('buy now') || lower.includes('checkout') || (lower.includes('buy') && !lower.includes('macbook') && !lower.includes('laptop') && !lower.includes('product'))) {
    intent = 'checkout';
  } else if (lower.includes('refund') || lower.includes('return')) {
    intent = 'refund_request';
  } else if (lower.includes('support') || lower.includes('help') || lower.includes('complaint') || lower.includes('ridiculous')) {
    intent = 'support';
  } else if (lower.includes('recommend') || lower.includes('suggestion')) {
    intent = 'recommendation';
  } else if (lower.includes('payment') || lower.includes('pay')) {
    intent = 'payment';
  } else if (lower.includes('product_search') || lower.includes('search') || lower.includes('show me') || lower.includes('find') || lower.includes('want') || lower.includes('looking for') || (lower.includes('buy') && (lower.includes('macbook') || lower.includes('laptop') || lower.includes('product')))) {
    intent = 'product_search';
  }
  
  // Extract entities
  const entities: Entities = {};
  
  // Extract price
  const priceMatch = reasoning.match(/\$?(\d+)/);
  if (priceMatch) {
    entities.maxPrice = parseInt(priceMatch[1], 10);
  }
  
  // Extract order ID (ORD-12345 pattern) - preserve uppercase
  const orderMatch = reasoning.match(/(ORD-?\d+)/i);
  if (orderMatch) {
    entities.orderId = orderMatch[1].toUpperCase();
  }
  
  // Extract product names (look for capitalized words in quotes or common products)
  const productMatches = reasoning.match(/"([^"]+)"/g);
  if (productMatches) {
    entities.products = productMatches.map(p => p.replace(/"/g, ''));
  }
  
  // Also extract common product mentions
  if (reasoning.includes('MacBook') || reasoning.includes('macbook')) {
    if (!entities.products) entities.products = [];
    if (!entities.products.includes('MacBook Pro')) entities.products.push('MacBook Pro');
  }
  if (reasoning.includes('laptop') || reasoning.includes('Laptop')) {
    if (!entities.products) entities.products = [];
    if (!entities.products.includes('laptop')) entities.products.push('laptop');
  }
  
  // Extract sentiment
  let sentiment: SentimentType = 'neutral';
  if (lower.includes('frustrated') || lower.includes('angry') || lower.includes('ridiculous')) {
    sentiment = 'frustrated';
  } else if (lower.includes('negative') || lower.includes('unhappy')) {
    sentiment = 'negative';
  } else if (lower.includes('positive') || lower.includes('happy') || lower.includes('want to buy')) {
    sentiment = 'positive';
  }
  
  return {
    intent,
    entities,
    sentiment,
    confidence: 0.7, // Lower confidence for extracted classification
  };
}

/**
 * Simple keyword-based classification (fallback)
 * 
 * @param message - User message
 * @returns Classification result
 */
export function keywordClassify(message: string): {
  intent: IntentType;
  entities: Entities;
  sentiment: SentimentType;
  confidence: number;
} {
  const lower = message.toLowerCase();

  // Product search keywords
  if (lower.includes('show') || lower.includes('find') || lower.includes('search') || lower.includes('looking for')) {
    const entities: Entities = {};
    
    // Extract price constraints
    const priceMatch = lower.match(/\$?(\d+)/);
    if (priceMatch) {
      entities.maxPrice = parseInt(priceMatch[1], 10);
    }

    // Extract "under $X" pattern
    const underMatch = lower.match(/under\s*\$?(\d+)/);
    if (underMatch) {
      entities.maxPrice = parseInt(underMatch[1], 10);
    }

    return {
      intent: 'product_search',
      entities,
      sentiment: 'neutral',
      confidence: 0.7,
    };
  }

  // Cart add keywords
  if (lower.includes('add') && (lower.includes('cart') || lower.includes('basket'))) {
    return {
      intent: 'cart_add',
      entities: {},
      sentiment: 'positive',
      confidence: 0.8,
    };
  }

  // Checkout keywords
  if (lower.includes('checkout') || lower.includes('buy') || lower.includes('purchase')) {
    return {
      intent: 'checkout',
      entities: {},
      sentiment: 'positive',
      confidence: 0.85,
    };
  }

  // Order status keywords
  if (lower.includes('order') && (lower.includes('status') || lower.includes('where') || lower.includes('track'))) {
    const orderId = lower.match(/ord-?\d+/i)?.[0];
    return {
      intent: 'order_status',
      entities: orderId ? { orderId } : {},
      sentiment: 'neutral',
      confidence: 0.75,
    };
  }

  // Frustrated sentiment detection
  if (lower.includes('ridiculous') || lower.includes('angry') || lower.includes('terrible') || lower.includes('worst')) {
    return {
      intent: 'support',
      entities: {},
      sentiment: 'frustrated',
      confidence: 0.9,
    };
  }

  // Default to general
  return {
    intent: 'general',
    entities: {},
    sentiment: 'neutral',
    confidence: 0.5,
  };
}
