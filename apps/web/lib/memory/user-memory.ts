/**
 * User Memory Module with Mem0
 *
 * Provides persistent user memory for personalized interactions.
 * Stores and retrieves user preferences, conversation history, and context.
 *
 * @packageDocumentation
 */

import { logger } from '../redis/logger.js';

/**
 * User memory context
 */
export interface UserMemoryContext {
  /** User preferences */
  preferences: Record<string, string | number | boolean>;
  /** Conversation history summary */
  conversationSummary: string;
  /** Important user facts */
  facts: string[];
  /** Last interaction timestamp */
  lastInteraction?: number;
  /** Interaction count */
  interactionCount: number;
}

/**
 * Memory item for storage
 */
export interface MemoryItem {
  userId: string;
  key: string;
  value: string | number | boolean | object;
  timestamp: number;
  ttl?: number;
}

/**
 * Mem0 client configuration
 */
export interface Mem0Config {
  /** Mem0 API key */
  apiKey?: string;
  /** Mem0 API base URL */
  baseUrl?: string;
  /** Enable memory persistence */
  enabled: boolean;
  /** Default TTL for memories (seconds) */
  defaultTTL: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Mem0Config = {
  enabled: false, // Disabled by default, enable with MEM0_API_KEY
  defaultTTL: 2592000, // 30 days
};

/**
 * Get Mem0 config from environment
 */
function getMem0Config(): Mem0Config {
  const apiKey = process.env.MEM0_API_KEY;
  const baseUrl = process.env.MEM0_BASE_URL || 'https://api.mem0.ai';

  return {
    ...DEFAULT_CONFIG,
    apiKey,
    baseUrl,
    enabled: !!apiKey,
  };
}

/**
 * Mem0 client wrapper
 */
class Mem0Client {
  private config: Mem0Config;

  constructor(config: Mem0Config) {
    this.config = config;
  }

  /**
   * Add a memory for a user
   */
  async addMemory(
    userId: string,
    key: string,
    value: string | number | boolean | object,
    ttl?: number
  ): Promise<boolean> {
    if (!this.config.enabled || !this.config.apiKey) {
      logger.debug('RAG', 'Mem0 not enabled, skipping memory storage');
      return false;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          user_id: userId,
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          ttl: ttl || this.config.defaultTTL,
        }),
      });

      if (!response.ok) {
        logger.warn('RAG', 'Mem0 add memory failed', {
          status: response.status,
          userId,
        });
        return false;
      }

      logger.info('RAG', 'Memory added', { userId, key });
      return true;
    } catch (error) {
      logger.error('RAG', 'Mem0 add memory error', error);
      return false;
    }
  }

  /**
   * Get memories for a user
   */
  async getMemories(userId: string): Promise<Record<string, unknown>> {
    if (!this.config.enabled || !this.config.apiKey) {
      logger.debug('RAG', 'Mem0 not enabled, returning empty memories');
      return {};
    }

    try {
      const response = await fetch(
        `${this.config.baseUrl}/v1/memories/${userId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Token ${this.config.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        logger.warn('RAG', 'Mem0 get memories failed', {
          status: response.status,
          userId,
        });
        return {};
      }

      const data = await response.json() as Array<{
        key: string;
        value: string;
        timestamp: number;
      }>;

      // Convert to record
      const memories: Record<string, unknown> = {};
      for (const item of data) {
        try {
          memories[item.key] = JSON.parse(item.value);
        } catch {
          memories[item.key] = item.value;
        }
      }

      return memories;
    } catch (error) {
      logger.error('RAG', 'Mem0 get memories error', error);
      return {};
    }
  }

  /**
   * Delete a memory
   */
  async deleteMemory(userId: string, key: string): Promise<boolean> {
    if (!this.config.enabled || !this.config.apiKey) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.config.baseUrl}/v1/memories/${userId}/${key}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Token ${this.config.apiKey}`,
          },
        }
      );

      return response.ok;
    } catch (error) {
      logger.error('RAG', 'Mem0 delete memory error', error);
      return false;
    }
  }

  /**
   * Search memories
   */
  async searchMemories(userId: string, query: string): Promise<Record<string, unknown>[]> {
    if (!this.config.enabled || !this.config.apiKey) {
      return [];
    }

    try {
      const response = await fetch(
        `${this.config.baseUrl}/v1/memories/${userId}/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${this.config.apiKey}`,
          },
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (error) {
      logger.error('RAG', 'Mem0 search memories error', error);
      return [];
    }
  }
}

/**
 * Singleton Mem0 client
 */
let mem0ClientInstance: Mem0Client | null = null;

/**
 * Get or create Mem0 client
 */
function getMem0Client(): Mem0Client {
  if (!mem0ClientInstance) {
    mem0ClientInstance = new Mem0Client(getMem0Config());
  }
  return mem0ClientInstance;
}

/**
 * Remember user context (store in memory)
 *
 * @param userId - Unique user identifier
 * @param context - Context data to remember
 * @returns Success status
 *
 * @example
 * ```typescript
 * await rememberUserContext('user123', {
 *   preferences: { currency: 'USD', language: 'en' },
 *   facts: ['Prefers email communication'],
 * });
 * ```
 */
export async function rememberUserContext(
  userId: string,
  context: Partial<UserMemoryContext>
): Promise<boolean> {
  const client = getMem0Client();
  const config = getMem0Config();

  if (!config.enabled) {
    logger.debug('RAG', 'Memory storage disabled');
    return false;
  }

  logger.info('RAG', 'Remembering user context', {
    userId,
    hasPreferences: !!context.preferences,
    hasFacts: !!context.facts,
  });

  try {
    const promises: Promise<boolean>[] = [];

    // Store preferences
    if (context.preferences) {
      for (const [key, value] of Object.entries(context.preferences)) {
        promises.push(client.addMemory(userId, `preference:${key}`, value));
      }
    }

    // Store facts
    if (context.facts) {
      for (let i = 0; i < context.facts.length; i++) {
        promises.push(client.addMemory(userId, `fact:${i}`, context.facts[i]));
      }
    }

    // Store conversation summary
    if (context.conversationSummary) {
      promises.push(
        client.addMemory(userId, 'conversation_summary', context.conversationSummary)
      );
    }

    // Store interaction metadata
    if (context.interactionCount > 0) {
      promises.push(
        client.addMemory(userId, 'interaction_count', context.interactionCount)
      );
    }

    await Promise.all(promises);

    logger.info('RAG', 'User context stored', { userId });
    return true;
  } catch (error) {
    logger.error('RAG', 'Failed to store user context', error);
    return false;
  }
}

/**
 * Recall user context (retrieve from memory)
 *
 * @param userId - Unique user identifier
 * @returns User memory context
 */
export async function recallUserContext(userId: string): Promise<UserMemoryContext> {
  const client = getMem0Client();
  const config = getMem0Config();

  const defaultContext: UserMemoryContext = {
    preferences: {},
    conversationSummary: '',
    facts: [],
    lastInteraction: undefined,
    interactionCount: 0,
  };

  if (!config.enabled) {
    logger.debug('RAG', 'Memory retrieval disabled');
    return defaultContext;
  }

  logger.debug('RAG', 'Recalling user context', { userId });

  try {
    const memories = await client.getMemories(userId);

    const context: UserMemoryContext = {
      preferences: {},
      conversationSummary: '',
      facts: [],
      lastInteraction: undefined,
      interactionCount: 0,
    };

    // Extract preferences
    for (const [key, value] of Object.entries(memories)) {
      if (key.startsWith('preference:')) {
        const prefKey = key.replace('preference:', '');
        context.preferences[prefKey] = value as string | number | boolean;
      } else if (key.startsWith('fact:')) {
        context.facts.push(String(value));
      } else if (key === 'conversation_summary') {
        context.conversationSummary = String(value);
      } else if (key === 'interaction_count') {
        context.interactionCount = Number(value);
      } else if (key === 'last_interaction') {
        context.lastInteraction = Number(value);
      }
    }

    // Sort facts by index
    context.facts.sort();

    logger.debug('RAG', 'User context recalled', {
      userId,
      preferenceCount: Object.keys(context.preferences).length,
      factCount: context.facts.length,
    });

    return context;
  } catch (error) {
    logger.error('RAG', 'Failed to recall user context', error);
    return defaultContext;
  }
}

/**
 * Add a specific fact about a user
 */
export async function addUserFact(
  userId: string,
  fact: string
): Promise<boolean> {
  const client = getMem0Client();
  const config = getMem0Config();

  if (!config.enabled) {
    return false;
  }

  // Get current facts
  const context = await recallUserContext(userId);
  context.facts.push(fact);
  context.interactionCount++;
  context.lastInteraction = Date.now();

  return rememberUserContext(userId, context);
}

/**
 * Set a user preference
 */
export async function setUserPreference(
  userId: string,
  key: string,
  value: string | number | boolean
): Promise<boolean> {
  const client = getMem0Client();
  const config = getMem0Config();

  if (!config.enabled) {
    return false;
  }

  const context = await recallUserContext(userId);
  context.preferences[key] = value;
  context.lastInteraction = Date.now();

  return rememberUserContext(userId, context);
}

/**
 * Get a specific user preference
 */
export async function getUserPreference<T = string>(
  userId: string,
  key: string,
  defaultValue?: T
): Promise<T | undefined> {
  const context = await recallUserContext(userId);
  return (context.preferences[key] as T) ?? defaultValue;
}

/**
 * Update conversation summary
 */
export async function updateConversationSummary(
  userId: string,
  summary: string
): Promise<boolean> {
  const client = getMem0Client();
  const config = getMem0Config();

  if (!config.enabled) {
    return false;
  }

  const context = await recallUserContext(userId);
  context.conversationSummary = summary;
  context.lastInteraction = Date.now();

  return rememberUserContext(userId, context);
}

/**
 * Search user memories
 */
export async function searchUserMemories(
  userId: string,
  query: string
): Promise<Record<string, unknown>[]> {
  const client = getMem0Client();
  const config = getMem0Config();

  if (!config.enabled) {
    return [];
  }

  return client.searchMemories(userId, query);
}

/**
 * Clear all user memories
 */
export async function clearUserMemories(userId: string): Promise<boolean> {
  const client = getMem0Client();
  const config = getMem0Config();

  if (!config.enabled) {
    return false;
  }

  const context = await recallUserContext(userId);

  // Delete all memories
  const promises: Promise<boolean>[] = [];

  for (const key of Object.keys(context.preferences)) {
    promises.push(client.deleteMemory(userId, `preference:${key}`));
  }

  for (let i = 0; i < context.facts.length; i++) {
    promises.push(client.deleteMemory(userId, `fact:${i}`));
  }

  promises.push(client.deleteMemory(userId, 'conversation_summary'));
  promises.push(client.deleteMemory(userId, 'interaction_count'));

  await Promise.all(promises);

  logger.info('RAG', 'User memories cleared', { userId });
  return true;
}
