/**
 * useChatStream Hook
 *
 * Connects the UI to the agent backend via Server-Sent Events (SSE).
 * Handles streaming message updates, tool calls, UI actions, and errors.
 *
 * @packageDocumentation
 */

'use client';

import { useState, useRef, useCallback } from 'react';

// ============================================================================
// Type Definitions
// ============================================================================

export type MessageRole = 'user' | 'assistant';

export interface UIAction {
  component: string;
  props: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  type: 'text' | 'ui_actions' | 'tool_call' | 'error';
  uiActions?: UIAction[];
  toolName?: string;
  isStreaming?: boolean;
  createdAt: number;
}

export interface SSEEvent {
  type: 'delta' | 'tool_call' | 'ui_actions' | 'complete' | 'error';
  content?: string;
  tool?: string;
  actions?: UIAction[];
  text?: string;
  message?: string;
}

// ============================================================================
// Hook Options
// ============================================================================

export interface UseChatStreamOptions {
  threadId: string;
  userId: string;
  token: string;
}

// ============================================================================
// Hook Return Type
// ============================================================================

export interface UseChatStreamReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const AGENT_API_ENDPOINT = '/api/agent';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Parse SSE event data
 */
function parseSSEEvent(data: string): SSEEvent | null {
  try {
    const parsed = JSON.parse(data);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'type' in parsed &&
      ['delta', 'tool_call', 'ui_actions', 'complete', 'error'].includes(parsed.type)
    ) {
      return parsed as SSEEvent;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a new assistant message
 */
function createAssistantMessage(): ChatMessage {
  return {
    id: generateMessageId(),
    role: 'assistant',
    content: '',
    type: 'text',
    isStreaming: true,
    createdAt: Date.now(),
  };
}

/**
 * Create a new user message
 */
function createUserMessage(content: string): ChatMessage {
  return {
    id: generateMessageId(),
    role: 'user',
    content,
    type: 'text',
    isStreaming: false,
    createdAt: Date.now(),
  };
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * useChatStream Hook
 *
 * Manages chat message streaming via SSE from the agent backend.
 * Supports optimistic UI updates, tool calls, and dynamic UI component rendering.
 *
 * @example
 * ```tsx
 * const { messages, isLoading, sendMessage, stopStreaming } = useChatStream({
 *   threadId: 'thread-123',
 *   userId: 'user-456',
 *   token: 'auth-token',
 * });
 *
 * await sendMessage('Hello, how can you help me?');
 * ```
 */
export function useChatStream({
  threadId,
  userId,
  token,
}: UseChatStreamOptions): UseChatStreamReturn {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  /**
   * Send a message to the agent
   */
  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      if (!content.trim()) return;

      // Clear any previous error
      setError(null);

      // Create optimistic user message
      const userMessage = createUserMessage(content);

      // Create assistant placeholder message
      const assistantMessage = createAssistantMessage();

      // Update state with both messages
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      streamingMessageIdRef.current = assistantMessage.id;

      // Set loading state
      setIsLoading(true);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        // Build request URL with query parameters
        const url = new URL(AGENT_API_ENDPOINT, window.location.origin);
        url.searchParams.set('threadId', threadId);
        url.searchParams.set('userId', userId);

        // Start SSE stream
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            threadId,
            userId,
            message: content,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        // Process SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmedLine = line.trim();

            // Skip empty lines and non-data lines
            if (!trimmedLine || !trimmedLine.startsWith('data:')) {
              continue;
            }

            // Extract JSON data
            const data = trimmedLine.slice(5).trim(); // Remove 'data: ' prefix

            // Parse SSE event
            const event = parseSSEEvent(data);
            if (!event) continue;

            // Handle different event types
            setMessages((prev) => {
              const updated = [...prev];
              const assistantMsgIndex = updated.findIndex(
                (msg) => msg.id === streamingMessageIdRef.current
              );

              if (assistantMsgIndex === -1) return prev;

              const assistantMsg = { ...updated[assistantMsgIndex] };

              switch (event.type) {
                case 'delta':
                  // Append content to assistant message
                  if (event.content) {
                    assistantMsg.content += event.content;
                  }
                  break;

                case 'tool_call':
                  // Update message type to tool_call
                  assistantMsg.type = 'tool_call';
                  assistantMsg.toolName = event.tool;
                  break;

                case 'ui_actions':
                  // Update message type and set UI actions
                  assistantMsg.type = 'ui_actions';
                  assistantMsg.uiActions = event.actions || [];
                  if (event.text) {
                    assistantMsg.content = event.text;
                  }
                  break;

                case 'complete':
                  // Clear streaming flag
                  assistantMsg.isStreaming = false;
                  break;

                case 'error':
                  // Set error on message
                  assistantMsg.type = 'error';
                  assistantMsg.content = event.message || 'An error occurred';
                  assistantMsg.isStreaming = false;
                  break;
              }

              updated[assistantMsgIndex] = assistantMsg;
              return updated;
            });
          }
        }
      } catch (err) {
        // Handle errors
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            // Request was aborted - don't show error
            return;
          }

          setError(err.message);

          // Update the streaming message to show error
          setMessages((prev) => {
            const updated = [...prev];
            const assistantMsgIndex = updated.findIndex(
              (msg) => msg.id === streamingMessageIdRef.current
            );

            if (assistantMsgIndex !== -1) {
              updated[assistantMsgIndex] = {
                ...updated[assistantMsgIndex],
                type: 'error',
                content: err.message,
                isStreaming: false,
              };
            }

            return updated;
          });
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        // Clean up
        setIsLoading(false);
        streamingMessageIdRef.current = null;
        abortControllerRef.current = null;
      }
    },
    [threadId, userId, token]
  );

  /**
   * Stop the current streaming request
   */
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear streaming state
    setMessages((prev) => {
      const updated = [...prev];
      const assistantMsgIndex = updated.findIndex(
        (msg) => msg.id === streamingMessageIdRef.current
      );

      if (assistantMsgIndex !== -1) {
        updated[assistantMsgIndex] = {
          ...updated[assistantMsgIndex],
          isStreaming: false,
        };
      }

      return updated;
    });

    streamingMessageIdRef.current = null;
    setIsLoading(false);
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    stopStreaming();
  }, [stopStreaming]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  };
}

export default useChatStream;
