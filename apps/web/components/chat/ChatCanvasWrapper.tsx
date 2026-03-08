/**
 * ChatCanvasWrapper Component
 *
 * Adapter layer between useChatStream and ChatCanvas.
 * Converts ChatMessage[] to ReactNode[] format for the new AI provider pattern.
 *
 * @packageDocumentation
 */

'use client';

import React, { type ReactNode } from 'react';
import { useChatStream, type ChatMessage } from '@/hooks/useChatStream';
import { ChatCanvas } from './ChatCanvas';
import { StreamingMessage } from './StreamingMessage';
import { AgentThinking } from './AgentThinking';
import { GenUIRouter } from '@/components/genui/GenUIRouter';

/**
 * Props for ChatCanvasWrapper
 */
interface ChatCanvasWrapperProps {
  /** Chat stream from useChatStream hook */
  chatStream: ReturnType<typeof useChatStream>;
}

/**
 * Converts a ChatMessage to the ReactNode display format
 */
function convertMessageToDisplay(message: ChatMessage): ReactNode {
  switch (message.type) {
    case 'text':
      return (
        <StreamingMessage
          content={message.content}
          isStreaming={!!message.isStreaming}
        />
      );
    case 'tool_call':
      return <AgentThinking toolName={message.toolName} />;
    case 'ui_actions':
      return <GenUIRouter actions={message.uiActions!} />;
    case 'error':
      return (
        <div
          className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-800 dark:text-red-300">{message.content}</p>
          </div>
        </div>
      );
    default:
      return message.content;
  }
}

/**
 * ChatCanvasWrapper Component
 *
 * Adapts useChatStream output to ChatCanvas input:
 * - Converts ChatMessage[] to ReactNode[] format
 * - Preserves message IDs and roles
 * - Handles loading state
 *
 * @example
 * ```tsx
 * const chatStream = useChatStream({ threadId, userId, token });
 * return <ChatCanvasWrapper chatStream={chatStream} />;
 * ```
 */
export function ChatCanvasWrapper({ chatStream }: ChatCanvasWrapperProps) {
  const { messages, isLoading } = chatStream;

  // Convert ChatMessage[] to ReactNode[] format
  const convertedMessages = messages.map((msg: ChatMessage) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    display: convertMessageToDisplay(msg),
  }));

  return <ChatCanvas messages={convertedMessages} isLoading={isLoading} />;
}

export default ChatCanvasWrapper;
