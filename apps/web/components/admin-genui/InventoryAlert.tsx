'use client';

import React from 'react';

export type AlertSeverity = 'warning' | 'critical' | 'info';

export interface InventoryItem {
  productId: string;
  name: string;
  currentStock: number;
  threshold: number;
}

export interface InventoryAlertProps {
  items: InventoryItem[];
  severity?: AlertSeverity;
  onRestock?: (productId: string) => void;
  onViewAll?: () => void;
  className?: string;
}

const SEVERITY_CONFIG = {
  warning: {
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    label: 'Low Stock',
  },
  critical: {
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-600 dark:text-red-400',
    label: 'Critical Stock',
  },
  info: {
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: 'Stock Alert',
  },
};

export const InventoryAlert: React.FC<InventoryAlertProps> = ({
  items,
  severity = 'warning',
  onRestock,
  onViewAll,
  className = '',
}) => {
  const config = SEVERITY_CONFIG[severity];

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4 ${className}`}
      role="alert"
      aria-label={`${config.label} alert`}
      data-testid="inventory-alert"
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${config.iconColor}`}>
          <svg
            className="w-5 h-5"
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
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {config.label}
          </h4>
          <ul className="mt-2 space-y-1" role="list" data-testid="inventory-alert-items">
            {items.slice(0, 3).map((item) => (
              <li key={item.productId} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">{item.name}</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {item.currentStock} left
                </span>
              </li>
            ))}
            {items.length > 3 && (
              <li className="text-sm text-gray-500 dark:text-gray-400">
                +{items.length - 3} more items
              </li>
            )}
          </ul>
          <div className="mt-3 flex gap-2" data-testid="inventory-alert-actions">
            {onRestock && items.length === 1 && (
              <button
                onClick={() => onRestock(items[0].productId)}
                className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white underline"
                type="button"
                data-testid="inventory-alert-restock"
              >
                Restock now
              </button>
            )}
            {onViewAll && (
              <button
                onClick={onViewAll}
                className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white underline"
                type="button"
                data-testid="inventory-alert-view-all"
              >
                View all
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryAlert;
