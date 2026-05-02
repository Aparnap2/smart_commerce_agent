'use client';

import React, { useState, useCallback } from 'react';

export interface BulkItem {
  id: string;
  label: string;
  selected: boolean;
}

export interface BulkActionConfirmProps {
  title: string;
  description?: string;
  items: BulkItem[];
  actionLabel: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: (selectedIds: string[]) => Promise<void> | void;
  onCancel?: () => void;
  className?: string;
}

export const BulkActionConfirm: React.FC<BulkActionConfirmProps> = ({
  title,
  description,
  items,
  actionLabel,
  cancelLabel = 'Cancel',
  isDanger = false,
  onConfirm,
  onCancel,
  className = '',
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(items.filter((item) => item.selected).map((item) => item.id))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      await onConfirm(Array.from(selectedIds));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [selectedIds, onConfirm]);

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  const selectedCount = selectedIds.size;
  const totalCount = items.length;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 ${
        isDanger ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
      } ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-action-title"
      data-testid="bulk-action-confirm"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600" data-testid="bulk-action-header">
        <h2 id="bulk-action-title" className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4 max-h-64 overflow-y-auto" data-testid="bulk-action-items">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          Select items to proceed ({selectedCount} of {totalCount} selected)
        </p>
        <ul className="space-y-2" role="listbox" aria-label="Selectable items">
          {items.map((item) => (
            <li key={item.id}>
              <label
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                data-testid={`bulk-action-item-${item.id}`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  aria-label={item.label}
                />
                <span className="text-sm text-gray-900 dark:text-white">{item.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pb-2">
          <p className="text-sm text-red-600 dark:text-red-400" role="alert" data-testid="bulk-action-error">
            {error}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex gap-3" data-testid="bulk-action-buttons">
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className="flex-1 min-h-[44px] px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50"
          type="button"
          data-testid="bulk-action-cancel"
        >
          {cancelLabel}
        </button>
        <button
          onClick={handleConfirm}
          disabled={selectedCount === 0 || isLoading}
          className={`flex-1 min-h-[44px] px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
            isDanger
              ? 'text-white bg-red-600 hover:bg-red-700 focus:ring-red-500'
              : 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
          }`}
          type="button"
          data-testid="bulk-action-confirm"
        >
          {isLoading ? 'Processing...' : `${actionLabel} (${selectedCount})`}
        </button>
      </div>
    </div>
  );
};

export default BulkActionConfirm;
