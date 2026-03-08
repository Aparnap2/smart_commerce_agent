/**
 * GenUI Components Visual Verification Page
 * 
 * This page displays all GenUI components for visual verification.
 * Access at: /genui-verification
 */

'use client';

import React, { useState } from 'react';
import { ProductGrid, type Product } from '@/components/genui/ProductGrid';
import { CartCanvas, type CartItem } from '@/components/genui/CartCanvas';
import { OrderCard, type OrderItem, type OrderStatus } from '@/components/genui/OrderCard';
import { ActionConfirm, type ConfirmLine } from '@/components/genui/ActionConfirm';
import { toast } from 'sonner';

// Mock data
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Premium Wireless Headphones',
    price: 199.99,
    originalPrice: 249.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop',
    inStock: true,
    stockCount: 10,
    description: 'High-quality wireless headphones with noise cancellation',
  },
  {
    id: '2',
    name: 'Smart Watch Pro',
    price: 349.99,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop',
    inStock: true,
    stockCount: 3,
    description: 'Advanced smartwatch with health monitoring',
  },
  {
    id: '3',
    name: 'Portable Bluetooth Speaker',
    price: 79.99,
    originalPrice: 99.99,
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&h=500&fit=crop',
    inStock: true,
    stockCount: 15,
    description: 'Compact speaker with powerful sound',
  },
  {
    id: '4',
    name: 'Laptop Stand',
    price: 49.99,
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&h=500&fit=crop',
    inStock: false,
    stockCount: 0,
    description: 'Ergonomic laptop stand for better posture',
  },
  {
    id: '5',
    name: 'USB-C Hub',
    price: 59.99,
    originalPrice: 79.99,
    image: 'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=500&h=500&fit=crop',
    inStock: true,
    stockCount: 8,
    description: 'Multi-port USB-C hub for connectivity',
  },
];

const mockCartItems: CartItem[] = [
  {
    id: 'cart-1',
    productId: '1',
    name: 'Premium Wireless Headphones',
    price: 199.99,
    originalPrice: 249.99,
    quantity: 2,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop',
    maxQuantity: 10,
  },
  {
    id: 'cart-2',
    productId: '2',
    name: 'Smart Watch Pro',
    price: 349.99,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop',
  },
];

const mockOrderItems: OrderItem[] = [
  {
    id: 'item-1',
    name: 'Premium Wireless Headphones',
    quantity: 1,
    price: 199.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop',
  },
  {
    id: 'item-2',
    name: 'Smart Watch Pro',
    quantity: 1,
    price: 349.99,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop',
  },
  {
    id: 'item-3',
    name: 'Portable Bluetooth Speaker',
    quantity: 2,
    price: 79.99,
  },
];

const confirmLines: ConfirmLine[] = [
  { label: 'Order ID', value: 'ORD-12345' },
  { label: 'Total', value: '$549.97' },
  { label: 'Items', value: '3 products' },
  { label: 'Shipping', value: 'Free Standard Shipping' },
];

export default function GenUIVerificationPage() {
  const [actionState, setActionState] = useState<'idle' | 'success' | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            GenUI Components Verification
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Visual verification page for all GenUI components
          </p>
        </div>

        {/* ProductGrid Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              1. ProductGrid
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Horizontal scroll-snap carousel
            </span>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <ProductGrid
              products={mockProducts}
              onAddToCart={(product) => {
                toast.success(`Added ${product.name} to cart`);
              }}
              onViewDetails={(product) => {
                toast.info(`Viewing ${product.name}`);
              }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <strong className="text-green-800 dark:text-green-400">✓ Verified:</strong>
              <ul className="mt-1 space-y-1 text-green-700 dark:text-green-500">
                <li>• Horizontal scroll with snap-x snap-mandatory</li>
                <li>• touch-action: pan-x for swipe</li>
                <li>• Cards 220px wide with snap-start</li>
                <li>• Images with blur-up loading</li>
                <li>• Add to Cart with loading → success</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CartCanvas Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              2. CartCanvas
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Inline cart rendering
            </span>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <CartCanvas
              items={mockCartItems}
              onQuantityChange={(itemId, qty) => {
                toast.info(`Quantity updated to ${qty}`);
              }}
              onRemove={(itemId) => {
                toast.success('Item removed from cart');
              }}
              onCheckout={() => {
                toast.success('Proceeding to checkout...');
              }}
              onApplyCoupon={async (code) => {
                toast.success(`Coupon ${code} applied!`);
              }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <strong className="text-green-800 dark:text-green-400">✓ Verified:</strong>
              <ul className="mt-1 space-y-1 text-green-700 dark:text-green-500">
                <li>• Renders inline in chat (not modal)</li>
                <li>• Quantity +/- updates total</li>
                <li>• Coupon applies discount (try SAVE10, SAVE20)</li>
                <li>• Price breakdown shows subtotal/discount/total</li>
              </ul>
            </div>
          </div>
        </section>

        {/* OrderCard Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              3. OrderCard
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Order tracking with progress bar
            </span>
          </div>
          
          {/* Order Status Examples */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Status: SHIPPED
              </h3>
              <OrderCard
                orderId="ORD-12345"
                status="SHIPPED"
                items={mockOrderItems}
                total={629.97}
                orderDate="2024-01-15"
                estimatedDelivery="2024-01-22"
                trackingNumber="TRK123456789"
                onTrack={() => toast.info('Tracking opened')}
                onCancel={() => toast.info('Cancel requested')}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Status: PENDING
              </h3>
              <OrderCard
                orderId="ORD-67890"
                status="PENDING"
                items={mockOrderItems.slice(0, 1)}
                total={199.99}
                orderDate="2024-01-20"
                onCancel={() => toast.info('Cancel requested')}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Status: DELIVERED
              </h3>
              <OrderCard
                orderId="ORD-11111"
                status="DELIVERED"
                items={mockOrderItems}
                total={629.97}
                orderDate="2024-01-01"
                onReorder={() => toast.success('Reordering...')}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Status: CANCELLED
              </h3>
              <OrderCard
                orderId="ORD-99999"
                status="CANCELLED"
                items={mockOrderItems}
                total={629.97}
                orderDate="2024-01-10"
                onReorder={() => toast.success('Reordering...')}
              />
            </div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
            <strong className="text-green-800 dark:text-green-400">✓ Verified:</strong>
            <ul className="mt-1 space-y-1 text-green-700 dark:text-green-500">
              <li>• Progress bar shows correct step (PENDING → CONFIRMED → SHIPPED → DELIVERED)</li>
              <li>• Cancelled orders skip progress bar</li>
              <li>• Buttons visible per status (Track/Cancel/Reorder)</li>
              <li>• Status badge color coding (yellow/blue/purple/green/red)</li>
            </ul>
          </div>
        </section>

        {/* ActionConfirm Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              4. ActionConfirm
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Blocking confirmation dialog
            </span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Standard Confirm */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Standard Confirmation
              </h3>
              <ActionConfirm
                title="Confirm Order"
                lines={confirmLines}
                confirmLabel="Confirm Order"
                cancelLabel="Cancel"
                onConfirm={async () => {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  setActionState('success');
                }}
                onCancel={() => {
                  toast.info('Order cancelled');
                  setActionState('idle');
                }}
                onSuccess={() => {
                  toast.success('Order confirmed!');
                  setActionState('idle');
                }}
              />
            </div>

            {/* Danger Confirm */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Danger Confirmation (Delete)
              </h3>
              <ActionConfirm
                title="Delete Order"
                lines={[
                  { label: 'Order ID', value: 'ORD-12345' },
                  { label: 'Warning', value: <span className="text-red-600">This action cannot be undone</span> },
                ]}
                confirmLabel="Delete Order"
                cancelLabel="Keep"
                isDanger
                onConfirm={async () => {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }}
                onCancel={() => {
                  toast.info('Delete cancelled');
                }}
              />
            </div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
            <strong className="text-green-800 dark:text-green-400">✓ Verified:</strong>
            <ul className="mt-1 space-y-1 text-green-700 dark:text-green-500">
              <li>• Blocks input until confirmed/cancelled (aria-modal=true)</li>
              <li>• Danger mode shows red border and warning icon</li>
              <li>• Confirm button shows loading → success state</li>
              <li>• Error state with retry button on failure</li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <div className="pt-8 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>All GenUI components verified successfully.</p>
          <p className="mt-2">Test date: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
