/**
 * ChatCanvas Component
 *
 * Main chat conversation display with virtualized scrolling.
 * Renders messages with support for text, tool calls, UI actions, and errors.
 *
 * @packageDocumentation
 */

'use client';

import React, { useRef, useEffect, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EmptyState } from './EmptyState';

/**
 * Message interface for ChatCanvas
 */
interface ChatCanvasMessage {
  /** Unique message identifier */
  id: string;
  /** Message role - user or assistant */
  role: 'user' | 'assistant';
  /** React node to display as message content */
  display: ReactNode;
}

/**
 * Props for ChatCanvas component
 */
interface ChatCanvasProps {
  /** Array of messages to display */
  messages: ChatCanvasMessage[];
  /** Loading state indicator */
  isLoading?: boolean;
}

/**
 * ChatCanvas Component
 *
 * Displays chat messages with virtualized scrolling for performance.
 * Accepts ReactNode[] messages from the AI provider pattern.
 *
 * User messages are right-aligned with blue background.
 * Assistant messages are left-aligned with zinc background and proper dark mode support.
 *
 * @example
 * ```tsx
 * const messages = [
 *   { id: '1', role: 'user', display: <div>Hello</div> },
 *   { id: '2', role: 'assistant', display: <div>Hi there!</div> }
 * ];
 * return <ChatCanvas messages={messages} />;
 * ```
 */
export function ChatCanvas({ messages, isLoading }: ChatCanvasProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  // Show empty state if no messages
  if (messages.length === 0) {
    return <EmptyState onSend={() => {}} />;
  }

  // Virtualizer for efficient rendering of large message lists
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (i) => {
      const msg = messages[i];
      // Check what type of component is being rendered
      if (typeof msg.display === 'string') return 80;
      // Could check for specific component types here
      return 100; // Default
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

  return (
    <div
      ref={scrollContainerRef}
      className="chat-canvas flex-1 overflow-y-auto scroll-smooth bg-white dark:bg-gray-950 px-4 md:px-0 scrollbar-thin scrollbar-thin-dark"
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
                  <div
                    className={`p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none'
                    }`}
                  >
                    {msg.display}
                  </div>
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
