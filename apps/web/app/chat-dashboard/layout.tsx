/**
 * Chat Dashboard Layout
 *
 * Provides AI context provider wrapper for all chat dashboard child components.
 * Enables useActions() hook usage in client components within this route segment.
 *
 * @see https://sdk.vercel.ai/docs/ai-sdk-rsc/generative-ui
 * @file app/chat-dashboard/layout.tsx
 */

import { AI } from "./actions";
import type { ReactNode } from "react";

/**
 * Chat Dashboard Layout Component
 *
 * Wraps all child components in the chat-dashboard route segment
 * with the AI provider, enabling access to server actions via
 * the useActions() hook from @ai-sdk/rsc.
 *
 * @param children - React child components to wrap
 * @returns AI provider-wrapped children
 *
 * @example
 * ```tsx
 * // Child component can now use:
 * import { useActions } from '@ai-sdk/rsc'
 * const { sendMessage } = useActions<typeof AI>()
 * ```
 */
export default function ChatDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AI>{children}</AI>;
}
