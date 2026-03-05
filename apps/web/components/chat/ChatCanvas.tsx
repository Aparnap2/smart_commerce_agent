/**
 * ChatCanvas Component
 *
 * Main chat conversation display with virtualized scrolling.
 * Renders messages with support for text, tool calls, UI actions, and errors.
 *
 * @packageDocumentation
 */

'use client';

import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatStream, type ChatMessage } from '@/hooks/useChatStream';
import { StreamingMessage } from './StreamingMessage';
import { AgentThinking } from './AgentThinking';
import { GenUIRouter } from '@/components/genui/GenUIRouter';

/**
 * Props for ChatCanvas component
 */
interface ChatCanvasProps {
  /** Chat stream from useChatStream hook */
  chatStream: ReturnType<typeof useChatStream>;
}

/**
 * ErrorCard component displays error messages
 */
function ErrorCard({ message }: { message: string }) {
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
        <p className="text-sm text-red-800 dark:text-red-300">{message}</p>
      </div>
    </div>
  );
}

/**
 * ChatCanvas Component
 *
 * Displays chat messages with virtualized scrolling for performance.
 * Supports multiple message types:
 * - 'text': Streaming text messages
 * - 'tool_call': Agent thinking indicator
 * - 'ui_actions': Dynamic UI components via GenUIRouter
 * - 'error': Error messages
 *
 * User messages are right-aligned with blue background.
 * Assistant messages are left-aligned with zinc background.
 *
 * @example
 * ```tsx
 * const chatStream = useChatStream({ threadId, userId, token });
 * return <ChatCanvas chatStream={chatStream} />;
 * ```
 */
export function ChatCanvas({ chatStream }: ChatCanvasProps) {
  const { messages } = chatStream;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  // Virtualizer for efficient rendering of large message lists
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (i) => {
      const msg = messages[i];
      if (msg.type === 'ui_actions') return 350;
      if (msg.role === 'user') return 60;
      return 100;
    },
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 5,
  });

  // Track scroll position to determine if user is near bottom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      isNearBottom.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  // Always scroll if user just sent a message, otherwise only if near bottom
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const shouldScroll = lastMessage?.role === 'user' || isNearBottom.current;
    
    if (shouldScroll && anchorRef.current) {
      anchorRef.current.scrollIntoView({ block: 'end', behavior: 'instant' });
    }
  }, [messages.length]);

  /**
   * Renders a single message row based on message type
   */
  function MessageRow({ message }: { message: ChatMessage }) {
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
        return <ErrorCard message={message.content} />;
      default:
        return null;
    }
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto scroll-smooth bg-white dark:bg-gray-950 px-4 md:px-0"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
    >
      <div
        className="max-w-4xl mx-auto py-10 relative h-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((v) => {
          const msg = messages[v.index];
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              ref={virtualizer.measureElement}
              data-index={v.index}
              className="absolute top-0 left-0 w-full mb-8"
              style={{ transform: `translateY(${v.start}px)` }}
            >
              <div
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center mr-3 mt-1 shrink-0">
                    <span className="text-white text-[10px] font-bold">AI</span>
                  </div>
                )}

                {/* Message Content */}
                <div className={`max-w-[85%] ${isUser ? '' : 'flex-1'}`}>
                  {msg.type === 'ui_actions' ? (
                    <div className="w-full">
                      <MessageRow message={msg} />
                    </div>
                  ) : (
                    <div
                      className={`p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-tl-none'
                      }`}
                    >
                      <MessageRow message={msg} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Scroll anchor for auto-scrolling */}
        <div ref={anchorRef} className="h-4 w-full" />
      </div>
    </div>
  );
}

export default ChatCanvas;
