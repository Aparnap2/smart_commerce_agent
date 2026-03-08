'use client';

import { useTransition, useState, useEffect } from 'react';

interface Props {
  content: string;
  isStreaming: boolean;
}

/**
 * StreamingMessage component displays streaming text with smooth transitions
 * and a typing cursor indicator during active streaming.
 *
 * Features:
 * - Smooth content updates using useTransition
 * - Pulsing cursor during streaming (animate-pulse)
 * - Whitespace preservation (whitespace-pre-wrap)
 * - Word breaking for long content (break-words)
 * - Accessibility: aria-live for screen readers
 *
 * @example
 * ```tsx
 * <StreamingMessage content="Hello world" isStreaming={true} />
 * ```
 */
export function StreamingMessage({ content, isStreaming }: Props) {
  const [displayed, setDisplayed] = useState(content);
  const startTransition = useTransition();

  useEffect(() => {
    if (typeof startTransition === 'function') {
      startTransition(() => {
        setDisplayed(content);
      });
    } else {
      setDisplayed(content);
    }
  }, [content]);

  return (
    <p
      className="text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100"
      aria-live="polite"
      aria-atomic="false"
    >
      {displayed}
      {isStreaming && (
        <span
          className="inline-block w-[2px] h-[1em] ml-[1px] bg-current align-text-bottom animate-pulse"
          aria-hidden="true"
        />
      )}
    </p>
  );
}
