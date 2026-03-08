'use client'
import React from 'react'
import type { Order } from '@smart-commerce/types'

const STEPS = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] as const

const STEP_META: Record<string, { label: string; icon: string }> = {
  PENDING:   { label: 'Order Placed',    icon: '📋' },
  CONFIRMED: { label: 'Confirmed',       icon: '✅' },
  SHIPPED:   { label: 'Shipped',         icon: '📦' },
  DELIVERED: { label: 'Delivered',       icon: '🏠' },
  CANCELLED: { label: 'Cancelled',       icon: '❌' },
  RETURNED:  { label: 'Returned',        icon: '↩️'  },
}

interface Props { order: Order }

export function OrderTimeline({ order }: Props) {
  const isCancelled = ['CANCELLED','RETURNED'].includes(order.status)
  const activeIdx   = isCancelled ? -1 : STEPS.indexOf(order.status as typeof STEPS[number])

  return (
    <div data-testid="order-timeline" className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <p className="font-semibold text-sm">
          Order #{order.id.slice(-8).toUpperCase()}
        </p>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${isCancelled
              ? 'bg-red-100 text-red-700'
              : 'bg-green-100 text-green-700'
            }`}
        >
          {order.status}
        </span>
      </div>

      <div className="relative">
        {/* Progress line */}
        {!isCancelled && activeIdx > 0 && (
          <div
            className="absolute left-4 top-4 bottom-4 w-0.5 bg-black"
            style={{ height: `${(activeIdx / (STEPS.length - 1)) * 100}%` }}
          />
        )}

        {STEPS.map((step, i) => {
          const done    = !isCancelled && i <= activeIdx
          const current = !isCancelled && i === activeIdx
          const meta    = STEP_META[step]
          return (
            <div
              key={step}
              data-testid={`timeline-step-${step.toLowerCase()}`}
              className="flex items-center gap-3 mb-4 relative"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center
                            text-sm z-10 shrink-0
                  ${done
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-400'
                  }
                  ${current ? 'ring-2 ring-black ring-offset-2' : ''}
                `}
              >
                {i < activeIdx ? '✓' : meta.icon}
              </div>
              <div>
                <p className={`text-sm ${current ? 'font-semibold' : 'text-gray-500'}`}>
                  {meta.label}
                </p>
                {current && (
                  <p className="text-xs text-gray-400 mt-0.5">Current status</p>
                )}
              </div>
            </div>
          )
        })}

        {isCancelled && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 text-red-600
                            flex items-center justify-center text-sm">
              {STEP_META[order.status]?.icon ?? '❌'}
            </div>
            <p className="text-sm text-red-600 font-medium">
              {STEP_META[order.status]?.label ?? order.status}
            </p>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 border-t pt-2">
        Total: ₹{order.total.toLocaleString('en-IN')} ·
        Placed: {new Date(order.createdAt).toLocaleDateString('en-IN')}
      </div>
    </div>
  )
}
