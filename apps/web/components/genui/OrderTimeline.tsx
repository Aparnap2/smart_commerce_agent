'use client';

import React from 'react';

/**
 * OrderTimeline Component
 *
 * Order status timeline for chat stream rendering.
 * Features:
 * - Vertical timeline with status steps
 * - Status badges with color coding
 * - Timestamp display
 * - Location information (when available)
 * - Dark mode support
 * - Accessibility (ARIA labels)
 */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderTimelineEvent {
  status: OrderStatus;
  timestamp: Date;
  description: string;
  location?: string;
}

export interface OrderTimelineProps {
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    items: OrderItem[];
    total: number;
    shippingAddress?: ShippingAddress;
    trackingNumber?: string;
    createdAt: Date;
    updatedAt: Date;
    timeline: OrderTimelineEvent[];
    /** Compact summary for AIState (~50 tokens) */
    summary?: string;
  };
  className?: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  confirmed: { label: 'Confirmed', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  processing: { label: 'Processing', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30' },
  shipped: { label: 'Shipped', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  delivered: { label: 'Delivered', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  cancelled: { label: 'Cancelled', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  refunded: { label: 'Refunded', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-900/30' },
};

export const OrderTimeline: React.FC<OrderTimelineProps> = ({ order, className = '' }) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const currentStatus = order.status;
  const currentStatusConfig = STATUS_CONFIG[currentStatus];

  return (
    <div className={`w-full max-w-2xl ${className}`}>
      {/* Order Header */}
      <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Order {order.orderNumber}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Placed on {formatDate(order.createdAt)}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${currentStatusConfig.bgColor} ${currentStatusConfig.color}`}
          >
            {currentStatusConfig.label}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

        {/* Timeline events */}
        <div className="space-y-6">
          {order.timeline.map((event, index) => {
            const statusConfig = STATUS_CONFIG[event.status];
            const isCompleted =
              index < order.timeline.findIndex((e) => e.status === currentStatus) ||
              event.status === currentStatus;

            return (
              <div key={index} className="relative flex items-start gap-4">
                {/* Status dot */}
                <div
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    isCompleted
                      ? `${statusConfig.bgColor} ${statusConfig.color} border-current`
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                  )}
                </div>

                {/* Event content */}
                <div className="flex-1 pt-1">
                  <p
                    className={`font-medium ${
                      isCompleted
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {event.description}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatDate(event.timestamp)}
                  </p>
                  {event.location && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      📍 {event.location}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Summary */}
      <div className="mt-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
          Order Summary
        </h4>
        <div className="space-y-2">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {item.name} × {item.quantity}
              </span>
              <span className="text-gray-900 dark:text-gray-100">
                ₹{(item.price * item.quantity).toLocaleString('en-IN')}
              </span>
            </div>
          ))}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2 flex justify-between font-medium">
            <span className="text-gray-900 dark:text-gray-100">Total</span>
            <span className="text-gray-900 dark:text-gray-100">
              ₹{order.total.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {order.trackingNumber && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tracking: <span className="font-mono">{order.trackingNumber}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTimeline;
