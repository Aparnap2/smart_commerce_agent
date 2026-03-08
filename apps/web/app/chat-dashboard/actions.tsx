"use server";

/**
 * Chat Dashboard Server Actions & AI Provider
 *
 * Core server actions for Vercel AI SDK RSC patterns.
 * Uses @ai-sdk/react for streaming with tool support.
 * Exports AI provider component for wrapping chat dashboard.
 *
 * @file app/chat-dashboard/actions.tsx
 */

import { llm } from "@/lib/llm/client";
import { z } from "zod";
import { generateId, streamText, stepCountIs } from "ai";
import type { ReactNode } from "react";
import { createAI } from "@ai-sdk/rsc";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Message type for chat conversations
 */
export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: Date;
};

/**
 * Chat state for persistence
 */
export type ChatState = {
  chatId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Tool call result types
 */
export interface ToolResult {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Search products tool schema
 */
export const searchProductsSchema = z.object({
  query: z.string().describe("The search query for products"),
  maxPrice: z.number().optional().describe("Maximum price filter"),
  category: z.string().optional().describe("Product category to filter by"),
});

/**
 * Add to cart tool schema
 */
export const addToCartSchema = z.object({
  productId: z.string().describe("The product ID to add to cart"),
  quantity: z.number().default(1).describe("Quantity to add"),
});

/**
 * Track order tool schema
 */
export const trackOrderSchema = z.object({
  orderNumber: z.string().describe("The order number to track"),
});

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Send a message to the shopping assistant
 * Streams response from the LLM with tool support.
 *
 * @param input - User's message text
 * @returns AsyncIterableStream of text deltas
 */
export async function sendMessage(input: string) {
  "use server";

  // Build conversation history
  const conversationMessages = [
    {
      role: "system" as const,
      content: `You are a shopping assistant for TechTrend, an e-commerce platform.
      Help users find products, manage their cart, and track orders.
      Use tools when users ask about products, cart, or orders.
      Always be helpful, concise, and friendly.`,
    },
    {
      role: "user" as const,
      content: input,
    },
  ];

  // Create streaming response with tools
  const result = streamText({
    model: llm,
    messages: conversationMessages,
    stopWhen: stepCountIs(5), // CRITICAL: Prevent infinite tool call loops. Hard limit of 5 tool calls per turn.
    tools: {
      /**
       * Search for products by query
       * Placeholder - will be connected to hybrid search in Phase 2
       */
      searchProducts: {
        description: "Search for products by query, optional price filter and category",
        inputSchema: searchProductsSchema,
        execute: async ({ query, maxPrice, category }, { abortSignal }) => {
          // Check abort signal before expensive operation
          if (abortSignal?.aborted) {
            throw new Error('Stream aborted');
          }

          // TODO: Call hybridSearch from lib/search/hybrid.ts
          // const results = await hybridSearch({ query, maxPrice, category });

          // Check again after potential async operation
          if (abortSignal?.aborted) {
            throw new Error('Stream aborted');
          }

          return {
            success: true,
            message: `Searching for "${query}"`,
            filters: { maxPrice, category },
            placeholder: true,
          };
        },
      },

      /**
       * Add product to cart
       * Placeholder - will be connected to cart service in Phase 2
       */
      addToCart: {
        description: "Add a product to the user's shopping cart",
        inputSchema: addToCartSchema,
        execute: async ({ productId, quantity }, { abortSignal }) => {
          // Check abort signal
          if (abortSignal?.aborted) {
            throw new Error('Stream aborted');
          }

          // TODO: Call cart service
          return {
            success: true,
            productId,
            quantity,
            message: `Added ${quantity} item(s) to cart`,
          };
        },
      },

      /**
       * Get order status
       * Placeholder - will be connected to order service in Phase 2
       */
      trackOrder: {
        description: "Track an order by order number",
        inputSchema: trackOrderSchema,
        execute: async ({ orderNumber }, { abortSignal }) => {
          // Check abort signal
          if (abortSignal?.aborted) {
            throw new Error('Stream aborted');
          }

          // TODO: Call order service
          return {
            success: true,
            orderNumber,
            status: "processing",
            message: `Order ${orderNumber} is being processed`,
          };
        },
      },
    },
  });

  return result;
}

/**
 * Create a new chat session
 *
 * @returns Chat state with new chatId
 */
export async function createChat() {
  "use server";

  const chatId = generateId();

  const state: ChatState = {
    chatId,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // TODO: Persist to database in Phase 2
  // await db.chat.create({ data: state });

  return state;
}

/**
 * Get chat history by ID
 *
 * @param chatId - The chat session ID
 * @returns Chat state with messages
 */
export async function getChat(chatId: string) {
  "use server";

  // TODO: Fetch from database in Phase 2
  // const chat = await db.chat.findUnique({ where: { chatId } });

  return {
    chatId,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ChatState;
}

/**
 * Save chat messages to persistence
 *
 * @param chatId - The chat session ID
 * @param messages - Messages to save
 */
export async function saveChat(chatId: string, messages: Message[]) {
  "use server";

  // TODO: Persist to database in Phase 2
  // await db.chat.update({
  //   where: { chatId },
  //   data: { messages, updatedAt: new Date() },
  // });

  console.log(`[Save Chat] ${chatId}: ${messages.length} messages`);

  return { success: true, chatId, messageCount: messages.length };
}

// ============================================================================
// AI Provider Configuration
// ============================================================================

/**
 * AI Provider for Chat Dashboard
 *
 * Creates AI context provider using createAI from @ai-sdk/rsc.
 * Enables useActions() hook in client components to access server actions.
 *
 * @example
 * ```tsx
 * // In layout.tsx
 * import { AI } from "./actions"
 *
 * export default function Layout({ children }) {
 *   return <AI>{children}</AI>
 * }
 *
 * // In page.tsx
 * 'use client'
 * import { useActions } from '@ai-sdk/rsc'
 *
 * export default function Page() {
 *   const { sendMessage } = useActions<typeof AI>()
 *   // ...
 * }
 * ```
 */
export const AI = createAI({
  actions: {
    sendMessage,
    createChat,
    getChat,
    saveChat,
  },
  initialAIState: [] as Message[],
  initialUIState: [] as any[],
});
