'use client'

import React, { type FC } from 'react'

type OrderItem = {
  productId: number
  name: string
  price: number
  quantity: number
}

type Order = {
  id: string
  status: string
  total: number
  orderDate: string
  items: OrderItem[]
  trackingNumber?: string | null
  estimatedDelivery?: string | null
}

type Props = {
  order: Order
  onTrack?: () => void
  onCancel?: () => void
  onReorder?: () => void
}

const OrderCard: FC<Props> = ({ order, onTrack, onCancel, onReorder }) => {
  const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PAID: 'bg-blue-100 text-blue-800',
    SHIPPED: 'bg-purple-100 text-purple-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    REFUNDED: 'bg-gray-100 text-gray-800',
  }

  return (
    <div data-testid="order-card" className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500 font-mono">#{order.id.slice(-8)}</span>
        <span
          data-testid="order-status-badge"
          className={`text-xs px-2 py-1 rounded-full font-medium
            ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'}`}>
          {order.status}
        </span>
      </div>

      <div className="space-y-2">
        {order.items.slice(0, 2).map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-gray-700">{item.name} × {item.quantity}</span>
            <span className="font-medium text-gray-900">
              ₹{(item.price * item.quantity).toLocaleString('en-IN')}
            </span>
          </div>
        ))}
        {order.items.length > 2 && (
          <p className="text-xs text-gray-500">+{order.items.length - 2} more items</p>
        )}
      </div>

      <div className="border-t pt-2 flex justify-between items-center font-semibold">
        <span>Total</span>
        <span className="text-indigo-600">₹{order.total.toLocaleString('en-IN')}</span>
      </div>

      {order.trackingNumber && (
        <div className="text-xs text-gray-500">Tracking: {order.trackingNumber}</div>
      )}

      {order.estimatedDelivery && (
        <div className="text-xs text-gray-500">Est. delivery: {order.estimatedDelivery}</div>
      )}

      <div className="flex gap-2 pt-2">
        {order.status === 'SHIPPED' && onTrack && (
          <button
            data-testid="track-order-button"
            onClick={onTrack}
            className="flex-1 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg
              hover:bg-indigo-700 transition-colors">
            Track Order
          </button>
        )}
        {order.status === 'DELIVERED' && onReorder && (
          <button
            data-testid="reorder-button"
            onClick={onReorder}
            className="flex-1 py-1.5 text-xs font-medium border border-indigo-600 text-indigo-600
              rounded-lg hover:bg-indigo-50 transition-colors">
            Reorder
          </button>
        )}
        {['PENDING', 'PAID'].includes(order.status) && onCancel && (
          <button
            data-testid="cancel-order-button"
            onClick={onCancel}
            className="flex-1 py-1.5 text-xs font-medium border border-red-600 text-red-600
              rounded-lg hover:bg-red-50 transition-colors">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

export default OrderCard
