/**
 * OrderCard Component
 *
 * Displays order details in a card format for the e-commerce agent.
 * Supports streaming updates and hydration from agent state.
 *
 * @packageDocumentation
 */

'use client';

import React from 'react';
import {
  Package,
  MapPin,
  CreditCard,
  Calendar,
  ChevronRight,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Box,
} from 'lucide-react';

// Order status types
type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

// Order item interface
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  sku?: string;
}

// Shipping address interface
interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// Order data interface
export interface OrderData {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  createdAt: string;
  updatedAt: string;
  estimatedDelivery?: string;
  trackingNumber?: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  paymentMethod: string;
  refundAmount?: number;
  refundReason?: string;
}

// Status configuration
const statusConfig: Record<OrderStatus, { color: string; icon: React.ElementType; label: string }> = {
  pending: {
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    icon: Clock,
    label: 'Pending',
  },
  processing: {
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    icon: RefreshCw,
    label: 'Processing',
  },
  shipped: {
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    icon: Truck,
    label: 'Shipped',
  },
  delivered: {
    color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    icon: CheckCircle,
    label: 'Delivered',
  },
  cancelled: {
    color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    icon: XCircle,
    label: 'Cancelled',
  },
  refunded: {
    color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
    icon: RefreshCw,
    label: 'Refunded',
  },
};

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Format date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Order item row component
function OrderItemRow({ item }: { item: OrderItem }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
        <Box className="w-6 h-6 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {item.name}
        </p>
        {item.sku && (
          <p className="text-xs text-gray-500 dark:text-gray-400">SKU: {item.sku}</p>
        )}
      </div>
      <div className="text-right">
        <p className="text-sm text-gray-500 dark:text-gray-400">x{item.quantity}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {formatCurrency(item.price * item.quantity)}
        </p>
      </div>
    </div>
  );
}

// Order summary section
function OrderSummary({ order }: { order: OrderData }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
        <span className="text-gray-900 dark:text-white">{formatCurrency(order.subtotal)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">Shipping</span>
        <span className="text-gray-900 dark:text-white">{formatCurrency(order.shipping)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">Tax</span>
        <span className="text-gray-900 dark:text-white">{formatCurrency(order.tax)}</span>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
        <div className="flex justify-between font-medium">
          <span className="text-gray-900 dark:text-white">Total</span>
          <span className="text-gray-900 dark:text-white">{formatCurrency(order.total)}</span>
        </div>
      </div>
      {order.refundAmount && (
        <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
          <span>Refunded</span>
          <span>-{formatCurrency(order.refundAmount)}</span>
        </div>
      )}
    </div>
  );
}

// Shipping info section
function ShippingInfo({ order }: { order: OrderData }) {
  const { shippingAddress } = order;

  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
        <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {shippingAddress.street}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {shippingAddress.country}
        </p>
      </div>
    </div>
  );
}

// Tracking info section
function TrackingInfo({ order }: { order: OrderData }) {
  if (!order.trackingNumber && !order.estimatedDelivery) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
      {order.trackingNumber && (
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Tracking:</span>
          <span className="text-sm font-mono text-blue-700 dark:text-blue-300">
            {order.trackingNumber}
          </span>
        </div>
      )}
      {order.estimatedDelivery && (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Est. Delivery:</span>
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {new Date(order.estimatedDelivery).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
}

// Main OrderCard component
interface OrderCardProps {
  order: OrderData;
  onViewDetails?: (orderId: string) => void;
  onRefund?: (orderId: string) => void;
  onTrack?: (orderId: string) => void;
  className?: string;
}

export function OrderCard({
  order,
  onViewDetails,
  onRefund,
  onTrack,
  className = '',
}: OrderCardProps) {
  const status = statusConfig[order.status];
  const StatusIcon = status.icon;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-400" />
              <span className="font-semibold text-gray-900 dark:text-white">
                {order.orderNumber}
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}
            >
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Calendar className="w-4 h-4" />
            {formatDate(order.createdAt)}
          </div>
        </div>
      </div>

      {/* Customer info */}
      <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Customer:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {order.customerName}
            </span>
            <span className="text-xs text-gray-400">({order.customerEmail})</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <CreditCard className="w-4 h-4" />
            {order.paymentMethod}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="p-4">
        <div className="space-y-1">
          {order.items.map((item) => (
            <React.Fragment key={item.id}>
              <OrderItemRow item={item} />
            </React.Fragment>
          ))}
        </div>

        {/* Tracking */}
        {order.status === 'shipped' && <TrackingInfo order={order} />}

        {/* Shipping address */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <ShippingInfo order={order} />
        </div>

        {/* Summary */}
        <div className="mt-4">
          <OrderSummary order={order} />
        </div>

        {/* Refund info */}
        {order.refundReason && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Refund Reason:
            </p>
            <p className="text-sm text-red-600 dark:text-red-300">
              {order.refundReason}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-end gap-2">
          {onRefund && order.status !== 'refunded' && order.status !== 'cancelled' && (
            <button
              onClick={() => onRefund(order.id)}
              className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Request Refund
            </button>
          )}
          {onTrack && order.status === 'shipped' && (
            <button
              onClick={() => onTrack(order.id)}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              Track Package
            </button>
          )}
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(order.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              View Details
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// OrderCard skeleton for loading states
export function OrderCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-5 w-24 bg-gray-200 dark:bg-gray-600 rounded" />
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-600 rounded-full" />
          </div>
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded" />
        </div>
      </div>
      <div className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-600 rounded" />
              <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-600 rounded" />
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default OrderCard;
