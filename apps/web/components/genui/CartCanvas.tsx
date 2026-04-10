'use client';

import React, { useState, useCallback, useMemo } from 'react';

/**
 * CartCanvas Component
 * 
 * Inline cart management component for chat stream rendering.
 * Features:
 * - Qty controls (+/- buttons)
 * - Remove button
 * - Coupon code input
 * - Subtotal/discount/total breakdown
 * - Checkout button
 * - Price change indicators
 * - Dark mode support
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Touch-friendly (44px minimum tap targets)
 */

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  image?: string;
  maxQuantity?: number;
}

export interface CartCanvasProps {
  items: CartItem[];
  onQuantityChange?: (itemId: string, quantity: number) => void;
  onRemove?: (itemId: string) => void;
  onCheckout?: () => void;
  onApplyCoupon?: (code: string) => void;
  isLoading?: boolean;
  className?: string;
  /** Compact summary for AIState (~50 tokens) */
  summary?: string;
}

interface CouponState {
  code: string;
  applied: boolean;
  discountPercent: number;
  error?: string;
}

export const CartCanvas: React.FC<CartCanvasProps> = ({
  items,
  onQuantityChange,
  onRemove,
  onCheckout,
  onApplyCoupon,
  isLoading = false,
  className = '',
  summary,
}) => {
  const [coupon, setCoupon] = useState<CouponState>({
    code: '',
    applied: false,
    discountPercent: 0,
  });
  const [couponInput, setCouponInput] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const originalTotal = items.reduce(
      (sum, item) => sum + (item.originalPrice || item.price) * item.quantity,
      0
    );
    const priceReductions = originalTotal - subtotal;
    const couponDiscount = coupon.applied ? subtotal * (coupon.discountPercent / 100) : 0;
    const total = subtotal - couponDiscount;

    return {
      subtotal,
      originalTotal,
      priceReductions,
      couponDiscount,
      total: Math.max(0, total),
    };
  }, [items, coupon]);

  // Handle coupon application
  const handleApplyCoupon = useCallback(async () => {
    if (!couponInput.trim() || isApplyingCoupon) return;

    setIsApplyingCoupon(true);
    try {
      // Simulate coupon validation - in real app, call API
      if (onApplyCoupon) {
        await onApplyCoupon(couponInput);
      }
      
      // Mock coupon validation
      if (couponInput.toUpperCase() === 'SAVE10') {
        setCoupon({
          code: couponInput,
          applied: true,
          discountPercent: 10,
        });
      } else if (couponInput.toUpperCase() === 'SAVE20') {
        setCoupon({
          code: couponInput,
          applied: true,
          discountPercent: 20,
        });
      } else {
        setCoupon((prev) => ({ ...prev, error: 'Invalid coupon code' }));
      }
    } catch (error) {
      setCoupon((prev) => ({ ...prev, error: 'Failed to apply coupon' }));
    } finally {
      setIsApplyingCoupon(false);
    }
  }, [couponInput, isApplyingCoupon, onApplyCoupon]);

  // Handle quantity change
  const handleQuantityChange = useCallback(
    (itemId: string, newQuantity: number) => {
      if (newQuantity < 1 || !onQuantityChange) return;
      onQuantityChange(itemId, newQuantity);
    },
    [onQuantityChange]
  );

  // Handle remove item
  const handleRemove = useCallback(
    (itemId: string) => {
      if (onRemove) {
        onRemove(itemId);
      }
    },
    [onRemove]
  );

  // Handle checkout
  const handleCheckout = useCallback(() => {
    if (!isLoading && onCheckout) {
      onCheckout();
    }
  }, [isLoading, onCheckout]);

  // Empty cart state
  if (!items || items.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center ${className}`}
        role="region"
        aria-label="Shopping cart"
        data-testid="cart-canvas-empty"
      >
        <svg
          className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
        <p className="text-gray-500 dark:text-gray-400 text-lg">Your cart is empty</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
          Add items to get started
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${className}`}
      role="region"
      aria-label="Shopping cart"
      data-testid="cart-canvas"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600" data-testid="cart-header">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Your Cart ({items.length} {items.length === 1 ? 'item' : 'items'})
        </h2>
      </div>

      {/* Cart Items */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
        {items.map((item) => (
          <CartItemRow
            key={item.id}
            item={item}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemove}
            disabled={isLoading}
          />
        ))}
      </div>

      {/* Coupon Section */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-b border-gray-200 dark:border-gray-600" data-testid="cart-coupon-section">
        <div className="flex gap-2">
          <input
            type="text"
            value={couponInput}
            onChange={(e) => {
              setCouponInput(e.target.value);
              setCoupon((prev) => ({ ...prev, error: undefined }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApplyCoupon();
              }
            }}
            placeholder="Enter coupon code"
            disabled={coupon.applied || isApplyingCoupon || isLoading}
            className="flex-1 min-h-[44px] px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            aria-label="Coupon code input"
            aria-invalid={!!coupon.error}
            aria-describedby={coupon.error ? 'coupon-error' : undefined}
            data-testid="cart-coupon-input"
          />
          <button
            onClick={handleApplyCoupon}
            disabled={!couponInput.trim() || coupon.applied || isApplyingCoupon || isLoading}
            className="min-h-[44px] min-w-[44px] px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-600 rounded-md hover:bg-gray-800 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Apply coupon code"
            type="button"
            data-testid="cart-coupon-apply"
          >
            {isApplyingCoupon ? 'Applying...' : coupon.applied ? 'Applied' : 'Apply'}
          </button>
        </div>
        {coupon.error && (
          <p id="coupon-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
            {coupon.error}
          </p>
        )}
        {coupon.applied && (
          <p className="mt-1 text-sm text-green-600 dark:text-green-400" role="status">
            Coupon "{coupon.code}" applied! ({coupon.discountPercent}% off)
          </p>
        )}
      </div>

      {/* Price Breakdown */}
      <div className="px-4 py-3 space-y-2" data-testid="cart-price-breakdown">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
          <span>Subtotal</span>
          <span data-testid="cart-subtotal">${totals.subtotal.toFixed(2)}</span>
        </div>
        {totals.priceReductions > 0 && (
          <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
            <span>Price reductions</span>
            <span data-testid="cart-price-reductions">-${totals.priceReductions.toFixed(2)}</span>
          </div>
        )}
        {coupon.applied && totals.couponDiscount > 0 && (
          <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
            <span>Coupon discount</span>
            <span data-testid="cart-coupon-discount">-${totals.couponDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-semibold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-600 pt-2">
          <span>Total</span>
          <span data-testid="cart-total">${totals.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Checkout Button */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600" data-testid="cart-checkout-section">
        <button
          onClick={handleCheckout}
          disabled={isLoading || items.length === 0}
          className="w-full min-h-[44px] px-4 py-3 text-base font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Proceed to checkout"
          type="button"
          data-testid="cart-checkout-button"
        >
          {isLoading ? 'Processing...' : `Checkout - $${totals.total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

interface CartItemRowProps {
  item: CartItem;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  disabled: boolean;
}

const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  onQuantityChange,
  onRemove,
  disabled,
}) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const hasPriceChange = item.originalPrice && item.originalPrice > item.price;

  const handleIncrement = useCallback(() => {
    const maxQty = item.maxQuantity ?? 99;
    if (item.quantity < maxQty) {
      onQuantityChange(item.id, item.quantity + 1);
    }
  }, [item, onQuantityChange]);

  const handleDecrement = useCallback(() => {
    if (item.quantity > 1) {
      onQuantityChange(item.id, item.quantity - 1);
    }
  }, [item, onQuantityChange]);

  const handleRemove = useCallback(async () => {
    setIsRemoving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      onRemove(item.id);
    } finally {
      setIsRemoving(false);
    }
  }, [item.id, onRemove]);

  if (isRemoving) {
    return (
      <div className="px-4 py-3 animate-pulse bg-gray-100 dark:bg-gray-700" aria-busy="true">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 flex gap-3" data-testid={`cart-item-${item.id}`}>
      {/* Product Image */}
      {item.image ? (
        <img
          src={item.image}
          alt={item.name}
          className="w-16 h-16 object-cover rounded flex-shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400"
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

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 dark:text-white truncate" data-testid={`cart-item-name-${item.id}`}>{item.name}</h3>
        <div className="flex items-center gap-2 mt-1">
          {hasPriceChange ? (
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-gray-900 dark:text-white" data-testid={`cart-item-price-${item.id}`}>
                ${item.price.toFixed(2)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 line-through">
                ${item.originalPrice!.toFixed(2)}
              </span>
              <span className="text-xs text-green-600 dark:text-green-400">
                {Math.round(((item.originalPrice! - item.price) / item.originalPrice!) * 100)}% off
              </span>
            </div>
          ) : (
            <span className="text-sm font-semibold text-gray-900 dark:text-white" data-testid={`cart-item-price-${item.id}`}>
              ${item.price.toFixed(2)}
            </span>
          )}
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleDecrement}
            disabled={disabled || item.quantity <= 1}
            className="w-8 h-8 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Decrease quantity of ${item.name}`}
            type="button"
            data-testid={`cart-item-decrement-${item.id}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span
            className="w-10 text-center font-medium text-gray-900 dark:text-white"
            aria-live="polite"
            data-testid={`cart-item-quantity-${item.id}`}
          >
            {item.quantity}
          </span>
          <button
            onClick={handleIncrement}
            disabled={disabled || item.quantity >= (item.maxQuantity ?? 99)}
            className="w-8 h-8 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Increase quantity of ${item.name}`}
            type="button"
            data-testid={`cart-item-increment-${item.id}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={handleRemove}
        disabled={disabled}
        className="self-start min-h-[44px] min-w-[44px] flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={`Remove ${item.name} from cart`}
        type="button"
        data-testid={`cart-item-remove-${item.id}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
};

export default CartCanvas;
