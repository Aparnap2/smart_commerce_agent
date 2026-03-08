'use client'
import React from 'react'
import type { Cart } from '@smart-commerce/types'

interface Props {
  cart:     Cart
  onClose?: () => void
  onCheckout?: () => void
}

export function CartDrawer({ cart, onClose, onCheckout }: Props) {
  const subtotal  = cart.items.reduce((s, i) => s + (i.priceAt || 0) * i.quantity, 0)
  const total     = subtotal - (cart.discount ?? 0)
  const hasPriceChange = cart.items.some(i => i.priceChanged)

  return (
    <div
      data-testid="cart-drawer"
      className="fixed inset-y-0 right-0 w-96 z-50 bg-white shadow-2xl
                 flex flex-col border-l border-gray-100"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h2 className="font-semibold text-lg">
          Your Cart
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({cart.items.length} {cart.items.length === 1 ? 'item' : 'items'})
          </span>
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Price change warning */}
      {hasPriceChange && (
        <div
          data-testid="price-change-warning"
          className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200
                     rounded-lg text-amber-700 text-xs"
        >
          ⚠️ Some item prices have changed since you added them
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {cart.items.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">
            Your cart is empty
          </p>
        ) : (
          cart.items.map(item => (
            <div
              key={item.id}
              data-testid={`cart-item-${item.productId}`}
              className="flex items-start justify-between gap-3 py-2
                         border-b border-gray-50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {item.product?.name ?? item.productId}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Qty: {item.quantity}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium">
                  ₹{((item.priceAt || 0) * item.quantity).toLocaleString('en-IN')}
                </p>
                {item.priceChanged && (
                  <span
                    data-testid={`price-changed-badge-${item.productId}`}
                    className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded"
                  >
                    Price updated
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t space-y-3">
        {cart.couponCode && (
          <div className="flex justify-between text-sm">
            <span className="text-green-600">🏷 {cart.couponCode}</span>
            <span className="text-green-600">
              −₹{(cart.discount ?? 0).toLocaleString('en-IN')}
            </span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-base">
          <span>Total</span>
          <span>₹{total.toLocaleString('en-IN')}</span>
        </div>
        <button
          data-testid="checkout-btn"
          onClick={onCheckout}
          className="w-full bg-black text-white py-2.5 rounded-xl
                     font-medium hover:bg-gray-800 transition-colors"
        >
          Checkout
        </button>
      </div>
    </div>
  )
}
