/**
 * Chat Dashboard Page
 *
 * Main chat-first dashboard interface with GenUI components.
 * Wires together useChatStream, ChatCanvas, and InputBar within a Shell layout.
 *
 * @packageDocumentation
 */

'use client';

import { useSession } from 'next-auth/react';
import { useChatStream } from '@/hooks/useChatStream';
import { ChatCanvas } from '@/components/chat/ChatCanvas';
import { InputBar } from '@/components/chat/InputBar';
import { Shell } from '@/components/shell/Shell';
import { Rail } from '@/components/shell/Rail';
import { Header } from '@/components/shell/Header';

/**
 * Custom hook to manage thread ID in session storage
 *
 * Generates a unique thread ID on first visit and persists it
 * in session storage for the duration of the browser session.
 *
 * @returns The thread ID string
 */
function useThreadId(): string {
  if (typeof window === 'undefined') return 'thread-ssr';

  let id = sessionStorage.getItem('threadId');
  if (!id) {
    id = `thread-${Date.now()}`;
    sessionStorage.setItem('threadId', id);
  }
  return id;
}

/**
 * ChatDashboard Page Component
 *
 * Main chat-first dashboard interface that:
 * - Manages user session and authentication
 * - Creates/manages thread ID for conversation context
 * - Connects to chat stream via useChatStream hook
 * - Renders chat canvas with virtualized message list
 * - Provides input bar for user messages
 *
 * @example
 * ```tsx
 * // Accessed via /chat-dashboard route
 * // User session provides userId and token
 * // Thread ID persists conversation context
 * ```
 */
export default function ChatDashboard() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id ?? 'anonymous';
  const token = (session as any)?.accessToken ?? '';
  const threadId = useThreadId();

  // Initialize chat stream with user context
  const chatStream = useChatStream({ threadId, userId, token });

  return (
    <Shell rail={<Rail />}>
      <div className="flex flex-col h-full">
        <Header title="Shopping Assistant" />

        {/* Chat Canvas - Main conversation area with virtualized message list */}
        <ChatCanvas chatStream={chatStream} />

        {/* Input Bar - Primary interaction point */}
        <InputBar
          onSend={chatStream.sendMessage}
          onStop={chatStream.stopStreaming}
          disabled={chatStream.isLoading}
          isStreaming={chatStream.isLoading}
        />
      </div>
    </Shell>
  );
}
