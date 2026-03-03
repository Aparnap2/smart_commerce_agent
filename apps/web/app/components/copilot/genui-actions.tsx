/**
 * Commerce GenUI Actions Component
 *
 * Defines CopilotKit actions that render dynamic UI components (ProductCard, OrderCard).
 * These actions allow the LLM to display generative UI in response to user queries.
 *
 * @file components/copilot/genui-actions.tsx
 */

'use client';

import { useCopilotAction } from '@copilotkit/react-core';
import { ProductCard, OrderCard, type ProductData, type OrderData } from '@/app/dashboard/components/genui';
import { toast } from 'sonner';

interface GenUIActionsProps {
  onAddToCart?: (productId: string, quantity: number) => void;
  onViewDetails?: (id: string) => void;
  onTrackOrder?: (id: string) => void;
  onCheckout?: () => void;
}

export function CommerceGenUIActions({
  onAddToCart,
  onViewDetails,
  onTrackOrder,
  onCheckout,
}: GenUIActionsProps) {
  useCopilotAction({
    name: 'showProductGrid',
    description: 'Display a grid of products with details, pricing, and add-to-cart options',
    parameters: [
      {
        name: 'products',
        type: 'object[]' as const,
        description: 'Array of products to display in the grid',
        required: true,
      },
    ],
    render: ({ args }) => {
      const products = args.products as ProductData[];
      if (!products || products.length === 0) {
        return (
          <div className="p-4 text-gray-500 dark:text-gray-400">
            No products available to display.
          </div>
        );
      }

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={(id) => {
                toast.success(`Added ${product.name} to cart!`);
                onAddToCart?.(id, 1);
              }}
              onViewDetails={(id) => {
                onViewDetails?.(id);
              }}
            />
          ))}
        </div>
      );
    },
  });

  useCopilotAction({
    name: 'showOrderDetails',
    description: 'Display detailed information about a specific order including status, items, and tracking',
    parameters: [
      {
        name: 'order',
        type: 'object',
        description: 'Order data object containing all order details',
        required: true,
      },
    ],
    render: ({ args }) => {
      const order = args.order as OrderData;
      if (!order) {
        return (
          <div className="p-4 text-gray-500 dark:text-gray-400">
            No order data available.
          </div>
        );
      }

      return (
        <div className="max-w-2xl p-4">
          <OrderCard
            order={order}
            onViewDetails={(id) => toast.info(`Viewing order ${id}`)}
            onTrack={(id) => {
              toast.info(`Tracking order ${id}`);
              onTrackOrder?.(id);
            }}
            onRefund={(id) => toast.warning(`Refund requested for ${id}`)}
          />
        </div>
      );
    },
  });

  useCopilotAction({
    name: 'showCart',
    description: 'Display the shopping cart with items, quantities, and totals',
    parameters: [
      {
        name: 'items',
        type: 'object[]' as const,
        description: 'Array of cart items',
        required: true,
      },
      {
        name: 'total',
        type: 'number',
        description: 'Cart total amount',
        required: true,
      },
    ],
    render: ({ args }) => {
      const items = args.items || [];
      const total = args.total || 0;

      return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md max-w-md">
          <h3 className="text-lg font-semibold mb-4">Shopping Cart</h3>
          {items.length === 0 ? (
            <p className="text-gray-500">Your cart is empty.</p>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {items.map((item: { id: string; name: string; quantity: number; price: number }) => (
                  <div key={item.id} className="flex justify-between items-center">
                    <span className="text-sm">
                      {item.name} x{item.quantity}
                    </span>
                    <span className="font-medium">${item.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 flex justify-between items-center">
                <span className="font-semibold">Total:</span>
                <span className="text-xl font-bold text-blue-600">${total.toFixed(2)}</span>
              </div>
              <button
                onClick={() => {
                  toast.success('Proceeding to checkout...');
                  onCheckout?.();
                }}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition"
              >
                Checkout
              </button>
            </>
          )}
        </div>
      );
    },
  });

  useCopilotAction({
    name: 'addToCart',
    description: 'Add a product to the shopping cart',
    parameters: [
      {
        name: 'productId',
        type: 'string',
        description: 'The unique identifier of the product to add',
        required: true,
      },
      {
        name: 'quantity',
        type: 'number',
        description: 'Quantity of the product to add',
        required: false,
      },
    ],
    render: ({ args }) => {
      const productId = args.productId as string;
      const quantity = (args.quantity as number) || 1;

      return (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-green-700 dark:text-green-400">
            Added {quantity} item(s) to cart!
          </p>
        </div>
      );
    },
  });

  useCopilotAction({
    name: 'trackOrder',
    description: 'Track the status of an order by order ID',
    parameters: [
      {
        name: 'orderId',
        type: 'string',
        description: 'The order ID or order number to track',
        required: true,
      },
    ],
    render: ({ args }) => {
      const orderId = args.orderId as string;

      return (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-blue-700 dark:text-blue-400">
            Tracking order: {orderId}
          </p>
        </div>
      );
    },
  });

  useCopilotAction({
    name: 'checkout',
    description: 'Proceed to checkout with the current cart',
    parameters: [],
    render: () => {
      return (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-green-700 dark:text-green-400 font-medium">
            Redirecting to checkout...
          </p>
        </div>
      );
    },
  });

  return null;
}
