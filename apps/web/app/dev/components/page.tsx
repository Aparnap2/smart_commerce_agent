'use client';

import React, { useState } from 'react';
import {
  CartCanvas,
  OrderCard,
  ProductGrid,
  AgentThinking,
  Message,
  ReturnCard,
  ActionConfirm,
} from '@/components/genui';
import {
  RevenueCard,
  MerchantBriefingCard,
  InventoryAlert,
  BulkActionConfirm,
} from '@/components/admin-genui';

const MOCK_PRODUCTS = [
  { id: 1, name: 'Sony WH-1000XM5', price: 349.99, stock: 45, category: 'headphones', brand: 'Sony', description: 'Premium noise-canceling headphones', rating: 4.8 },
  { id: 2, name: 'AirPods Pro 2', price: 249.99, stock: 120, category: 'earbuds', brand: 'Apple', description: 'Active noise cancellation earbuds', rating: 4.7 },
  { id: 3, name: 'MacBook Pro 14"', price: 1999.99, stock: 15, category: 'laptop', brand: 'Apple', description: 'M3 Pro chip, 18GB RAM', rating: 4.9 },
  { id: 4, name: 'iPhone 15 Pro', price: 999.99, stock: 8, category: 'phone', brand: 'Apple', description: 'A17 Pro chip, titanium design', rating: 4.8 },
];

const MOCK_CART_ITEMS = [
  { id: 'cart-1', productId: '1', name: 'Sony WH-1000XM5', price: 349.99, quantity: 1, maxQuantity: 5 },
  { id: 'cart-2', productId: '2', name: 'AirPods Pro 2', price: 249.99, quantity: 2, maxQuantity: 10 },
];

const MOCK_ORDER = {
  id: 'ORD-2024-001',
  items: [
    { id: '1', name: 'Sony WH-1000XM5', quantity: 1, price: 349.99 },
    { id: '2', name: 'AirPods Pro 2', quantity: 2, price: 249.99 },
  ],
  total: 849.97,
  status: 'SHIPPED' as const,
  orderDate: '2024-01-15',
  estimatedDelivery: '2024-01-20',
  trackingNumber: '1Z999AA10123456784',
};

const MOCK_RETURN_OPTIONS = [
  { method: 'refund' as const, label: 'Full Refund', description: 'Money back to original payment method', value: 119.99, eta: '5-7 business days' },
  { method: 'replacement' as const, label: 'Replacement', description: 'Get a new same item', value: 119.99, eta: '3-5 business days' },
  { method: 'store_credit' as const, label: 'Store Credit', description: '120% value as store credit', value: 143.99, eta: 'Instant' },
];

export default function ComponentsPage() {
  const [cartItems, setCartItems] = useState(MOCK_CART_ITEMS);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [selectedReturnOption, setSelectedReturnOption] = useState<typeof MOCK_RETURN_OPTIONS[0] | null>(null);
  const [bulkSelected, setBulkSelected] = useState(['item-1', 'item-3']);

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setCartItems(items => items.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    ));
  };

  const handleRemove = (itemId: string) => {
    setCartItems(items => items.filter(item => item.id !== itemId));
  };

  const handleAddToCart = (productId: number) => {
    console.log('Add to cart:', productId);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">GenUI Components Preview</h1>

        {/* CartCanvas */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">CartCanvas</h2>
          <div className="max-w-md">
            <CartCanvas
              items={cartItems}
              onQuantityChange={handleQuantityChange}
              onRemove={handleRemove}
              onCheckout={() => console.log('Checkout')}
              onApplyCoupon={(code) => console.log('Apply coupon:', code)}
            />
          </div>
        </section>

        {/* OrderCard */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">OrderCard</h2>
          <div className="max-w-md">
            <OrderCard
              orderId={MOCK_ORDER.id}
              status={MOCK_ORDER.status}
              items={MOCK_ORDER.items}
              total={MOCK_ORDER.total}
              orderDate={MOCK_ORDER.orderDate}
              estimatedDelivery={MOCK_ORDER.estimatedDelivery}
              trackingNumber={MOCK_ORDER.trackingNumber}
              onTrack={(id) => console.log('Track:', id)}
              onCancel={(id) => console.log('Cancel:', id)}
              onReorder={(id) => console.log('Reorder:', id)}
            />
          </div>
        </section>

        {/* ProductGrid */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">ProductGrid</h2>
          <ProductGrid products={MOCK_PRODUCTS} onAddToCart={handleAddToCart} />
        </section>

        {/* AgentThinking & Message */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">AgentThinking & Message</h2>
          <div className="space-y-4 max-w-md">
            <AgentThinking toolName="Searching products..." />
            <Message role="user" content="I want to buy headphones" />
            <Message role="assistant" content="Here are some great headphone options for you!" />
          </div>
        </section>

        {/* ReturnCard */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">ReturnCard</h2>
          <div className="max-w-md">
            <ReturnCard
              order={{ id: 'ORD-123', total: 11999, items: [{ name: 'Sony WH-1000XM5' }] }}
              options={MOCK_RETURN_OPTIONS}
              autoApproved={true}
              reason="defective"
              items={[{ productId: 'prod_123', quantity: 1 }]}
            />
          </div>
        </section>

        {/* ActionConfirm */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">ActionConfirm</h2>
          <div className="max-w-md">
            <ActionConfirm
              title="Confirm Delete"
              lines={[
                { label: 'Item', value: 'Sony WH-1000XM5' },
                { label: 'Action', value: 'Delete forever' },
              ]}
              confirmLabel="Delete"
              isDanger={true}
              onConfirm={() => console.log('Confirmed')}
              onCancel={() => console.log('Cancelled')}
            />
          </div>
        </section>

        {/* Admin Components */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">RevenueCard</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RevenueCard
              title="Total Revenue"
              revenue={125430.50}
              previousRevenue={112000.00}
              period="vs last month"
            />
            <RevenueCard
              title="Today's Revenue"
              revenue={4520.00}
              previousRevenue={3800.00}
              period="vs yesterday"
            />
            <RevenueCard
              title="This Week"
              revenue={28750.00}
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">MerchantBriefingCard</h2>
          <div className="max-w-lg">
            <MerchantBriefingCard
              title="Today's Overview"
              metrics={[
                { label: 'Orders', value: 47, change: 12, changeLabel: 'vs yesterday' },
                { label: 'Revenue', value: '$12,540', change: 8, changeLabel: 'vs yesterday' },
                { label: 'Customers', value: 32, change: -3, changeLabel: 'vs yesterday' },
                { label: 'Avg Order', value: '$267', change: 15, changeLabel: 'vs yesterday' },
              ]}
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">InventoryAlert</h2>
          <div className="space-y-4 max-w-lg">
            <InventoryAlert
              items={[
                { productId: '1', name: 'Sony WH-1000XM5', currentStock: 5, threshold: 10 },
                { productId: '2', name: 'AirPods Pro 2', currentStock: 3, threshold: 15 },
                { productId: '3', name: 'MacBook Pro 14"', currentStock: 2, threshold: 5 },
              ]}
              severity="critical"
              onRestock={(id) => console.log('Restock:', id)}
              onViewAll={() => console.log('View all')}
            />
            <InventoryAlert
              items={[
                { productId: '4', name: 'iPhone 15 Pro', currentStock: 8, threshold: 10 },
              ]}
              severity="warning"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">BulkActionConfirm</h2>
          <div className="max-w-lg">
            <BulkActionConfirm
              title="Update Inventory"
              description="Select products to update their stock levels"
              items={[
                { id: 'item-1', label: 'Sony WH-1000XM5', selected: true },
                { id: 'item-2', label: 'AirPods Pro 2', selected: false },
                { id: 'item-3', label: 'MacBook Pro 14"', selected: true },
                { id: 'item-4', label: 'iPhone 15 Pro', selected: false },
              ]}
              actionLabel="Update Stock"
              isDanger={false}
              onConfirm={(ids) => console.log('Confirm:', ids)}
              onCancel={() => console.log('Cancel')}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
