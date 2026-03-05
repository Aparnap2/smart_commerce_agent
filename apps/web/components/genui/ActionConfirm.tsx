'use client';

import React, { useState, useCallback, useEffect } from 'react';

/**
 * ActionConfirm Component
 * 
 * Confirm/cancel dialog for actions in chat stream.
 * Features:
 * - Title + lines (label/value pairs)
 * - Confirm/Cancel buttons
 * - Loading state during async action
 * - Success state after completion
 * - Error state with message
 * - Danger variant for destructive actions
 * - Dark mode support
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Touch-friendly (44px minimum tap targets)
 */

export interface ConfirmLine {
  label: string;
  value: string | React.ReactNode;
}

export interface ActionConfirmProps {
  title: string;
  lines: ConfirmLine[];
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  initialError?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

type ActionState = 'idle' | 'loading' | 'success' | 'error';

export const ActionConfirm: React.FC<ActionConfirmProps> = ({
  title,
  lines,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = false,
  isLoading: externalLoading = false,
  initialError,
  onConfirm,
  onCancel,
  onSuccess,
  onError,
  className = '',
  disabled = false,
}) => {
  const [state, setState] = useState<ActionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>(initialError);

  // Update error state when initialError changes
  useEffect(() => {
    if (initialError) {
      setErrorMessage(initialError);
      setState('error');
    }
  }, [initialError]);

  // Handle confirm action
  const handleConfirm = useCallback(async () => {
    setState('loading');
    setErrorMessage(undefined);

    try {
      await onConfirm();
      setState('success');
      if (onSuccess) {
        // Delay success callback to show success state
        setTimeout(onSuccess, 1000);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred';
      setState('error');
      setErrorMessage(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [onConfirm, onSuccess, onError]);

  // Handle cancel action
  const handleCancel = useCallback(() => {
    if (state !== 'loading') {
      onCancel();
    }
  }, [state, onCancel]);

  // Determine button styles based on danger variant
  const confirmButtonStyles = isDanger
    ? 'text-white bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-red-400 dark:disabled:bg-red-600'
    : 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-400 dark:disabled:bg-blue-600';

  // Success state
  if (state === 'success') {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center ${className}`}
        role="alert"
        aria-live="polite"
      >
        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-green-600 dark:text-green-400">
          Successfully completed!
        </p>
      </div>
    );
  }

  // Error state with retry
  const isActionable = state !== 'loading' && state !== 'success';

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-confirm-title"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-3">
          {isDanger && state !== 'success' && (
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          )}
          <h2
            id="action-confirm-title"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            {title}
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {state === 'error' && errorMessage && (
          <div
            className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
            role="alert"
          >
            <div className="flex items-start gap-2">
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
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Lines */}
        <dl className="space-y-3">
          {lines.map((line, index) => (
            <div
              key={index}
              className="flex justify-between items-start gap-4 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">
                {line.label}
              </dt>
              <dd className="text-sm text-gray-900 dark:text-white text-right flex-grow">
                {typeof line.value === 'string' ? (
                  <span className="break-words">{line.value}</span>
                ) : (
                  line.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex gap-3">
        <button
          onClick={handleCancel}
          disabled={!isActionable || disabled}
          className="flex-1 min-h-[44px] px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={cancelLabel}
          type="button"
        >
          {cancelLabel}
        </button>
        <button
          onClick={handleConfirm}
          disabled={!isActionable || disabled || state === 'loading'}
          className={`flex-1 min-h-[44px] px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmButtonStyles}`}
          aria-label={confirmLabel}
          type="button"
        >
          {state === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </span>
          ) : state === 'error' ? (
            'Retry'
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </div>
  );
};

export default ActionConfirm;
