'use client';

import React, { useCallback, useMemo } from 'react';

/**
 * OrderCard Component
 * 
 * Order tracking component with progress bar for chat stream rendering.
 * Features:
 * - Status badge with color coding
 * - Progress bar (4 steps: PENDING → CONFIRMED → SHIPPED → DELIVERED)
 * - Items list (show first 2, "+X more")
 * - Track/Cancel/Reorder buttons based on status
 * - Cancelled orders skip progress bar
 * - Dark mode support
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Touch-friendly (44px minimum tap targets)
 */

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface OrderCardProps {
  orderId: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  orderDate?: string;
  estimatedDelivery?: string;
  trackingNumber?: string;
  onTrack?: (orderId: string) => void;
  onCancel?: (orderId: string) => void;
  onReorder?: (orderId: string) => void;
  isLoading?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: 'Pending', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  CONFIRMED: { label: 'Confirmed', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  SHIPPED: { label: 'Shipped', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  DELIVERED: { label: 'Delivered', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
};

const PROGRESS_STEPS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

export const OrderCard: React.FC<OrderCardProps> = ({
  orderId,
  status,
  items,
  total,
  orderDate,
  estimatedDelivery,
  trackingNumber,
  onTrack,
  onCancel,
  onReorder,
  isLoading = false,
  className = '',
}) => {
  const statusConfig = STATUS_CONFIG[status];
  const isCancelled = status === 'CANCELLED';
  const isDelivered = status === 'DELIVERED';

  // Calculate progress
  const progress = useMemo(() => {
    if (isCancelled) return -1;
    const currentIndex = PROGRESS_STEPS.indexOf(status);
    return currentIndex >= 0 ? (currentIndex / (PROGRESS_STEPS.length - 1)) * 100 : 0;
  }, [status, isCancelled]);

  // Get visible items (first 2)
  const visibleItems = items.slice(0, 2);
  const remainingCount = items.length - 2;

  // Action buttons based on status
  const showTrackButton = !isCancelled && !isDelivered && trackingNumber;
  const showCancelButton = status === 'PENDING' || status === 'CONFIRMED';
  const showReorderButton = isDelivered || isCancelled;

  const handleTrack = useCallback(() => {
    if (!isLoading && onTrack) {
      onTrack(orderId);
    }
  }, [orderId, onTrack, isLoading]);

  const handleCancel = useCallback(() => {
    if (!isLoading && onCancel) {
      onCancel(orderId);
    }
  }, [orderId, onCancel, isLoading]);

  const handleReorder = useCallback(() => {
    if (!isLoading && onReorder) {
      onReorder(orderId);
    }
  }, [orderId, onReorder, isLoading]);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${className}`}
      role="region"
      aria-label={`Order ${orderId}`}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Order #{orderId}
          </h2>
          {orderDate && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Placed on {orderDate}
            </p>
          )}
        </div>
        <span
          className={`px-3 py-1 text-sm font-medium rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}
          role="status"
          aria-label={`Order status: ${statusConfig.label}`}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Progress Bar (skip for cancelled orders) */}
      {!isCancelled && (
        <div className="px-4 py-4">
          <div className="relative">
            {/* Progress Track */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-600 -translate-y-1/2 rounded-full" />
            
            {/* Progress Fill */}
            <div
              className="absolute top-1/2 left-0 h-1 bg-blue-600 -translate-y-1/2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
              aria-hidden="true"
            />
            
            {/* Progress Steps */}
            <div className="relative flex justify-between">
              {PROGRESS_STEPS.map((step, index) => {
                const stepIndex = PROGRESS_STEPS.indexOf(status);
                const isComplete = index <= stepIndex;
                const isCurrent = index === stepIndex;
                
                return (
                  <div key={step} className="flex flex-col items-center">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isComplete
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                      } ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800' : ''}`}
                      aria-current={isCurrent ? 'step' : undefined}
                      aria-label={`${STATUS_CONFIG[step].label} ${isComplete ? 'completed' : 'pending'}`}
                    >
                      {isComplete && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`text-xs mt-1 font-medium ${
                        isComplete
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {STATUS_CONFIG[step].label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Info */}
          {estimatedDelivery && !isDelivered && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 text-center">
              Estimated delivery: <span className="font-medium">{estimatedDelivery}</span>
            </p>
          )}

          {/* Tracking Number */}
          {trackingNumber && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 text-center">
              Tracking: <span className="font-mono font-medium">{trackingNumber}</span>
            </p>
          )}
        </div>
      )}

      {/* Cancelled Message */}
      {isCancelled && (
        <div className="px-4 py-6 text-center">
          <svg
            className="w-12 h-12 mx-auto text-red-400 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-gray-600 dark:text-gray-300">
            This order has been cancelled
          </p>
        </div>
      )}

      {/* Items List */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-600">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          Items ({items.length})
        </h3>
        <ul className="space-y-2" role="list">
          {visibleItems.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-10 h-10 object-cover rounded flex-shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {item.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Qty: {item.quantity} · ${item.price.toFixed(2)}
                </p>
              </div>
            </li>
          ))}
          {remainingCount > 0 && (
            <li className="text-sm text-gray-500 dark:text-gray-400 pl-13">
              +{remainingCount} more {remainingCount === 1 ? 'item' : 'items'}
            </li>
          )}
        </ul>
      </div>

      {/* Total */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Total</span>
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          ${total.toFixed(2)}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 flex gap-2">
        {showTrackButton && (
          <button
            onClick={handleTrack}
            disabled={isLoading}
            className="flex-1 min-h-[44px] px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Track order ${orderId}`}
            type="button"
          >
            Track Order
          </button>
        )}
        {showCancelButton && (
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="flex-1 min-h-[44px] px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Cancel order ${orderId}`}
            type="button"
          >
            Cancel Order
          </button>
        )}
        {showReorderButton && (
          <button
            onClick={handleReorder}
            disabled={isLoading}
            className="flex-1 min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Reorder order ${orderId}`}
            type="button"
          >
            Reorder
          </button>
        )}
        {!showTrackButton && !showCancelButton && !showReorderButton && (
          <div className="flex-1 text-center text-sm text-gray-500 dark:text-gray-400 py-2">
            No actions available
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderCard;
