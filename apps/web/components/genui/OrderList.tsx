'use client'

import React, { type FC } from 'react'

type Order = {
  id: string
  status: string
  total: number
  orderDate: string
  trackingNumber?: string | null
}

type Props = {
  orders: Order[]
  loading?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
}

const OrderList: FC<Props> = ({ orders, loading }) => {
  if (loading) {
    return (
      <div data-testid="order-list-loading" className="p-4 space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-20" />
        ))}
      </div>
    )
  }

  return (
    <div data-testid="order-list" className="space-y-3 p-4">
      {orders.length === 0 ? (
        <p className="text-gray-500 text-sm">No orders found.</p>
      ) : (
        orders.map(order => (
          <div key={order.id} data-testid="order-card"
            className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 font-mono">#{order.id.slice(-8)}</span>
              <span
                data-testid="order-status-badge"
                className={`text-xs px-2 py-1 rounded-full font-medium
                  ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'}`}>
                {order.status}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                {new Date(order.orderDate).toLocaleDateString('en-IN')}
              </span>
              <span className="font-semibold text-gray-900">
                ₹{order.total.toLocaleString('en-IN')}
              </span>
            </div>

            {order.trackingNumber && (
              <div className="text-xs text-gray-500">Tracking: {order.trackingNumber}</div>
            )}

          </div>
        ))
      )}
    </div>
  )
}

export default OrderList
