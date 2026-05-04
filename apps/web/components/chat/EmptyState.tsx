/**
 * EmptyState Component
 *
 * Displays an engaging onboarding screen when the chat has no messages.
 * Shows a greeting and suggested prompts to help users get started.
 *
 * @packageDocumentation
 */

'use client';

import React from 'react';

/**
 * Props for EmptyState component
 */
interface EmptyStateProps {
  /** Callback when a suggested prompt is clicked */
  onSend: (message: string) => void;
}

/**
 * Props for SuggestedPrompt component
 */
interface SuggestedPromptProps {
  /** Emoji icon to display */
  icon: string;
  /** Prompt text to display */
  text: string;
  /** Callback when prompt is clicked */
  onClick: () => void;
}

/**
 * SuggestedPrompt Component
 *
 * A clickable button that displays a suggested prompt with an icon.
 * Features hover effects and smooth transitions.
 *
 * @example
 * ```tsx
 * <SuggestedPrompt
 *   icon="🎧"
 *   text="Headphones under ₹15,000"
 *   onClick={() => onSend("Show me wireless headphones under ₹15,000")}
 * />
 * ```
 */
function SuggestedPrompt({ icon, text, onClick }: SuggestedPromptProps) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700
                 bg-white dark:bg-zinc-800
                 hover:bg-zinc-50 dark:hover:bg-zinc-700
                 hover:border-indigo-300 dark:hover:border-indigo-700
                 hover:shadow-md
                 text-left transition-all duration-200
                 group"
      type="button"
      aria-label={`Send: ${text}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl flex-shrink-0" aria-hidden="true">
          {icon}
        </span>
        <span className="text-sm text-zinc-900 dark:text-zinc-100
                         group-hover:text-indigo-600 dark:group-hover:text-indigo-400
                         font-medium">
          {text}
        </span>
      </div>
    </button>
  );
}

/**
 * EmptyState Component
 *
 * Displays when the chat has no messages (messages.length === 0).
 * Provides:
 * - Friendly greeting with AI assistant introduction
 * - Description of capabilities
 * - Grid of 4 suggested prompts for common actions
 *
 * Suggested prompts cover:
 * - Product search (headphones)
 * - Order tracking
 * - Cart management
 * - Gift recommendations
 *
 * @example
 * ```tsx
 * const { sendMessage } = useChatStream({ threadId, userId, token });
 * return <EmptyState onSend={sendMessage} />;
 * ```
 */
export function EmptyState({ onSend }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        {/* Greeting Section */}
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            👋 Hi! I'm your ProcureAI procurement assistant.
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm md:text-base leading-relaxed">
            I can help you find products, manage your cart,
            track orders, and handle returns.
          </p>
        </div>

        {/* Suggested Prompts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SuggestedPrompt
            icon="🎧"
            text="Headphones under ₹15,000"
            onClick={() => onSend('Show me wireless headphones under ₹15,000')}
          />
          <SuggestedPrompt
            icon="📦"
            text="Where's my last order?"
            onClick={() => onSend('Where is my order?')}
          />
          <SuggestedPrompt
            icon="🛒"
            text="Show my cart"
            onClick={() => onSend("What's in my cart?")}
          />
          <SuggestedPrompt
            icon="🎁"
            text="Gift ideas under ₹3,000"
            onClick={() => onSend('Show me gift ideas under ₹3,000')}
          />
        </div>
      </div>
    </div>
  );
}

export default EmptyState;
