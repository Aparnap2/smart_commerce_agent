# Protocol-First Agentic Commerce: Implementation Blueprint

## Executive Summary

This blueprint builds on the existing Smart Commerce Agent foundation to create a **production-grade, protocol-first agentic commerce platform**. The key differentiator: **every side effect happens through MCP tools**, and **UCP serves as the canonical commerce contract** between agent reasoning and UI rendering.

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SHADCN STOREFRONT (Next.js 15)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ /store     │  │ /checkout   │  │ /orders     │  │ Copilot Sidebar │  │
│  │ Catalog    │  │ Wizard      │  │ List/Detail │  │ (useCopilot)   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ GenUI Protocol
┌────────────────────────────────▼────────────────────────────────────────────┐
│                    LANGGRAPH SUPERVISOR AGENT                              │
│  Intent Classification → Plan → Tool Execution → Response Generation      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ MCP Tools
┌────────────────────────────────▼────────────────────────────────────────────┐
│                    MCP-TOOL LAYER (Zod-validated)                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────┐   │
│  │ commerce:    │ │ cart:        │ │ orders:      │ │ payments:     │   │
│  │ search       │ │ add/update   │ │ create/list  │ │ stripe_mcp    │   │
│  │ autocomplete │ │ remove/clear │ │ cancel/refund│ │ create_session│   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └───────────────┘   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ UCP Contract
┌────────────────────────────────▼────────────────────────────────────────────┐
│                    UCP PROTOCOL LAYER                                      │
│  UCPMessage { version, action, payload, timestamp, correlationId }       │
│  SEARCH_PRODUCTS | ADD_TO_CART | CREATE_CHECKOUT | CREATE_ORDER | REFUND  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐    ┌───────────────────┐    ┌──────────────────┐
│ PostgreSQL    │    │ Redis             │    │ Stripe          │
│ + pgvector   │    │ Cart Cache        │    │ (MCP-backed)    │
│ Orders/Products│    │ Rate Limits       │    │ Payments/Refunds│
└───────────────┘    └───────────────────┘    └──────────────────┘
```

---

## Phase 0: Product Demo Slice (Days 1-2)

### Goal
Ship one end-to-end "wow" demo: search → add to cart → checkout → order confirmation → order lookup/refund

### Deliverables

#### 1.1 Store Catalog Page (`app/(store)/store/page.tsx`)

```typescript
// app/(store)/store/page.tsx
import { ProductGrid } from '@/components/commerce/product-grid';
import { SearchBar } from '@/components/commerce/search-bar';
import { FilterSidebar } from '@/components/commerce/filter-sidebar';

export default function StorePage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex gap-6">
        <aside className="w-64">
          <FilterSidebar />
        </aside>
        <main className="flex-1">
          <SearchBar />
          <ProductGrid />
        </main>
      </div>
    </div>
  );
}
```

#### 1.2 Cart Drawer Component

```typescript
// components/commerce/cart-drawer.tsx
import { useCart } from '@/hooks/use-cart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function CartDrawer() {
  const { items, total, updateQuantity, removeItem, isOpen, close } = useCart();
  
  return (
    <Drawer open={isOpen} onClose={close}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Shopping Cart ({items.length})</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 space-y-4">
          {items.map((item) => (
            <div key={item.productId} className="flex gap-4">
              <img src={item.image} className="w-20 h-20 object-cover rounded" />
              <div className="flex-1">
                <h4 className="font-medium">{item.name}</h4>
                <p className="text-muted-foreground">${item.price}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  >
                    -
                  </Button>
                  <span>{item.quantity}</span>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  >
                    +
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeItem(item.productId)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
          
          <div className="border-t pt-4">
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <Button className="w-full mt-4" asChild>
              <Link href="/checkout">Proceed to Checkout</Link>
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

#### 1.3 Checkout Wizard (`app/(store)/checkout/page.tsx`)

```typescript
// app/(store)/checkout/page.tsx
"use client";

import { useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STEPS = ['Cart Review', 'Shipping', 'Payment', 'Confirmation'];

export default function CheckoutPage() {
  const [step, setStep] = useState(0);
  const { items, total, clearCart } = useCart();
  const [shippingAddress, setShippingAddress] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('card');

  const handleCheckout = async () => {
    // Call MCP tool: orders.create_from_cart
    const result = await executeTool('orders.create_from_cart', {
      cartId: 'current',
      addressId: shippingAddress.id,
    });
    
    if (result.success) {
      setStep(3); // Confirmation
      clearCart();
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      {/* Progress Steps */}
      <div className="flex justify-between mb-8">
        {STEPS.map((s, i) => (
          <div 
            key={s} 
            className={`flex items-center ${i <= step ? 'text-primary' : 'text-muted'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              {i + 1}
            </div>
            <span className="ml-2">{s}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Main Content */}
        <div className="space-y-6">
          {step === 0 && (
            <Card>
              <CardHeader><CardTitle>Review Cart</CardTitle></CardHeader>
              <CardContent>
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between py-2">
                    <span>{item.name} x{item.quantity}</span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardHeader><CardTitle>Shipping Address</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Full Name" />
                <Input placeholder="Address Line 1" />
                <div className="grid grid-cols-2 gap-4">
                  <Input placeholder="City" />
                  <Input placeholder="ZIP Code" />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader><CardTitle>Payment Method</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  {['card', 'wallet', 'bnpl'].map((method) => (
                    <Button
                      key={method}
                      variant={paymentMethod === method ? 'default' : 'outline'}
                      onClick={() => setPaymentMethod(method)}
                    >
                      {method.toUpperCase()}
                    </Button>
                  ))}
                </div>
                {/* Stripe Elements would go here */}
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader><CardTitle>Order Confirmed!</CardTitle></CardHeader>
              <CardContent>
                <p>Your order has been placed successfully.</p>
                <p className="text-muted">Order #ORD-{Date.now()}</p>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < 3 && (
              <Button onClick={() => setStep(step + 1)}>
                {step === 2 ? 'Place Order' : 'Continue'}
              </Button>
            )}
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div>
          <Card className="sticky top-4">
            <CardHeader><CardTitle>Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${(total * 0.08).toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>${(total * 1.08).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

#### 1.4 Orders Page (`app/(store)/orders/page.tsx`)

```typescript
// app/(store)/orders/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { executeTool } from '@/lib/mcp/tool-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    executeTool('orders.list', { limit: 20 }).then((result) => {
      setOrders(result.data?.orders || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>Loading orders...</div>;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Your Orders</h1>
      <div className="space-y-4">
        {orders.map((order: any) => (
          <Card key={order.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Order #{order.id}</CardTitle>
              <Badge variant={
                order.status === 'delivered' ? 'default' :
                order.status === 'shipped' ? 'secondary' :
                'outline'
              }>
                {order.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                <div>
                  <p className="text-muted">{order.orderDate}</p>
                  <p className="font-medium">${order.total}</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/orders/${order.id}`}>View Details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

#### 1.5 Copilot Sidebar Integration

```typescript
// components/copilot/sidebar.tsx
"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { Sidebar } from "@copilotkit/react-ui";
import { useCopilotAction, CopilotKitProvider } from "@copilotkit/react-core";

// Wrap your app with CopilotKit
export function CommerceCopilotProvider({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit 
      publicApiKey={process.env.NEXT_PUBLIC_COPILOT_KEY}
      agent="commerce-assistant"
    >
      <CopilotKitProvider>
        {children}
      </CopilotKitProvider>
    </CopilotKit>
  );
}

// Define actions the agent can take
export function CommerceActions() {
  const { addToCart } = useCart();
  
  useCopilotAction({
    name: "addToCart",
    description: "Add a product to the shopping cart",
    parameters: z.object({
      productId: z.string(),
      quantity: z.number().default(1),
    }),
    handler: async ({ productId, quantity }) => {
      await executeTool('cart.add_item', { productId, quantity });
      addToCart(productId, quantity);
      return "Added to cart!";
    },
  });

  useCopilotAction({
    name: "checkout",
    description: "Proceed to checkout",
    handler: async () => {
      window.location.href = '/checkout';
      return "Redirecting to checkout...";
    },
  });

  useCopilotAction({
    name: "refundOrder",
    description: "Request a refund for an order",
    parameters: z.object({
      orderId: z.string(),
      reason: z.string(),
    }),
    handler: async ({ orderId, reason }) => {
      const result = await executeTool('orders.refund', { orderId, reason });
      return result.success ? "Refund initiated!" : result.error;
    },
  });

  useCopilotAction({
    name: "trackOrder",
    description: "Track an order by order ID",
    parameters: z.object({
      orderId: z.string().optional(),
    }),
    handler: async ({ orderId }) => {
      const result = await executeTool('orders.get', { orderId });
      if (result.success) {
        return `Order ${orderId}: ${result.data.status}`;
      }
      return "Order not found";
    },
  });

  return null;
}
```

---

## Phase 1: shadcn Storefront + GenUI Contract (Week 1)

### 1.1 GenUI Component Registry

```typescript
// lib/genui/registry.ts
import { z } from 'zod';

export const GENUI_COMPONENTS = {
  ProductGrid: z.object({
    products: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      image: z.string().optional(),
      category: z.string().optional(),
    })),
    columns: z.number().default(4),
  }),

  ProductCard: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    price: z.number(),
    image: z.string().optional(),
    rating: z.number().optional(),
    inStock: z.boolean(),
  }),

  CartDrawer: z.object({
    items: z.array(z.object({
      productId: z.string(),
      name: z.string(),
      price: z.number(),
      quantity: z.number(),
      image: z.string().optional(),
    })),
    total: z.number(),
    itemCount: z.number(),
  }),

  CheckoutWizard: z.object({
    step: z.enum(['cart', 'shipping', 'payment', 'confirmation']),
    cartTotal: z.number(),
    shippingAddress: z.object({
      name: z.string(),
      address: z.string(),
      city: z.string(),
      zip: z.string(),
    }).optional(),
  }),

  OrderConfirmation: z.object({
    orderId: z.string(),
    total: z.number(),
    status: z.string(),
    estimatedDelivery: z.string().optional(),
  }),

  OrderTracking: z.object({
    orderId: z.string(),
    status: z.string(),
    trackingNumber: z.string().optional(),
    events: z.array(z.object({
      timestamp: z.string(),
      status: z.string(),
      location: z.string().optional(),
    })),
  }),

  OrderHistoryGrid: z.object({
    orders: z.array(z.object({
      id: z.string(),
      date: z.string(),
      total: z.number(),
      status: z.string(),
      items: z.array(z.object({
        name: z.string(),
        quantity: z.number(),
      })),
    })),
  }),

  ReturnRequest: z.object({
    orderId: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number(),
    })),
    reason: z.string(),
  }),

  PriceAlertForm: z.object({
    productId: z.string(),
    targetPrice: z.number(),
    currentPrice: z.number(),
  }),

  RecommendationCarousel: z.object({
    title: z.string(),
    products: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      image: z.string().optional(),
      reason: z.string().optional(),
    })),
  }),
} as const;

export type GenUIComponentType = keyof typeof GENUI_COMPONENTS;
export type GenUIComponentProps<T extends GenUIComponentType> = z.infer<typeof GENUI_COMPONENTS[T]>;
```

### 1.2 Tool Output Adapter (MCP → GenUI)

```typescript
// lib/genui/adapter.ts
import { GENUI_COMPONENTS, type GenUIComponentType } from './registry';

interface UCPMessage {
  version: string;
  action: string;
  payload: unknown;
  timestamp: number;
  correlationId?: string;
}

interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  ucp?: UCPMessage;
  ui?: {
    component: GenUIComponentType;
    props: Record<string, unknown>;
  };
  sideEffects?: string[];
}

export function toGenUIResponse<T extends GenUIComponentType>(
  component: T,
  props: z.infer<typeof GENUI_COMPONENTS[T]>
): ToolResult {
  return {
    success: true,
    data: props,
    ui: {
      component,
      props,
    },
  };
}

export function renderGenUI(result: ToolResult): React.ReactNode {
  if (!result.ui) return null;

  const { component, props } = result.ui;
  
  switch (component) {
    case 'ProductGrid':
      return <ProductGrid {...(props as any)} />;
    case 'CartDrawer':
      return <CartDrawer {...(props as any)} />;
    case 'CheckoutWizard':
      return <CheckoutWizard {...(props as any)} />;
    case 'OrderConfirmation':
      return <OrderConfirmation {...(props as any)} />;
    case 'OrderTracking':
      return <OrderTracking {...(props as any)} />;
    // ... other components
    default:
      return null;
  }
}
```

---

## Phase 2: MCP-First Commerce Tool Suite (Week 2)

### 2.1 Cart Tools (Complete Set)

```typescript
// lib/mcp/tools/commerce.ts
import { z } from 'zod';
import { createTool } from '../server.js';
import { prisma } from '@/lib/prisma/client';
import { UCPMessage, UCPAction } from '@/lib/ucp/types';
import { toGenUIResponse } from '@/lib/genui/adapter';

// ============================================
// CART TOOLS
// ============================================

export const cartTools = new Map<string, ReturnType<typeof createTool>>();

// cart.get
cartTools.set('cart.get', createTool('cart.get', {
  title: 'Get Shopping Cart',
  description: 'Retrieve the current user\'s shopping cart with items and totals',
  parameters: z.object({
    cartId: z.string().optional().describe('Cart ID (defaults to user\'s current cart)'),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    const cart = await prisma.cart.findUnique({
      where: { id: args.cartId || userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart) {
      return toGenUIResponse('CartDrawer', {
        items: [],
        total: 0,
        itemCount: 0,
      });
    }

    const items = cart.items.map(item => ({
      productId: item.productId,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      image: item.product.image || undefined,
    }));

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      success: true,
      ucp: {
        version: '1.0',
        action: UCPAction.GET_CART,
        payload: { cartId: cart.id, items, total },
        timestamp: Date.now(),
      },
      ui: {
        component: 'CartDrawer',
        props: { items, total, itemCount: items.length },
      },
    };
  },
}));

// cart.add_item
cartTools.set('cart.add_item', createTool('cart.add_item', {
  title: 'Add Item to Cart',
  description: 'Add a product to the shopping cart with specified quantity',
  parameters: z.object({
    productId: z.string().describe('Product ID to add'),
    quantity: z.number().int().positive().default(1).describe('Quantity to add'),
    variantId: z.string().optional().describe('Product variant ID'),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    // Idempotency check
    const idempotencyKey = `${userId}:${args.productId}:${args.variantId || 'default'}`;
    
    // Verify product exists and has stock
    const product = await prisma.product.findUnique({
      where: { id: args.productId },
    });

    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    if (product.stock < args.quantity) {
      return { success: false, error: 'Insufficient stock' };
    }

    // Get or create cart
    let cart = await prisma.cart.findUnique({
      where: { id: userId },
      include: { items: true },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { id: userId, customerId: userId },
        include: { items: true },
      });
    }

    // Check if item already in cart
    const existingItem = cart.items.find(
      item => item.productId === args.productId && item.variantId === args.variantId
    );

    let updatedCart;
    if (existingItem) {
      // Update quantity
      updatedCart = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + args.quantity },
        include: { product: true },
      });
    } else {
      // Add new item
      updatedCart = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: args.productId,
          variantId: args.variantId,
          quantity: args.quantity,
        },
        include: { product: true },
      });
    }

    // Return updated cart
    const allItems = await prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: { product: true },
    });

    const items = allItems.map(item => ({
      productId: item.productId,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      image: item.product.image || undefined,
    }));

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      success: true,
      ucp: {
        version: '1.0',
        action: UCPAction.ADD_TO_CART,
        payload: { productId: args.productId, quantity: args.quantity },
        timestamp: Date.now(),
        correlationId: idempotencyKey,
      },
      ui: {
        component: 'CartDrawer',
        props: { items, total, itemCount: items.length },
      },
      sideEffects: ['cart:updated', 'inventory:checked'],
    };
  },
}));

// cart.update_quantity
cartTools.set('cart.update_quantity', createTool('cart.update_quantity', {
  title: 'Update Cart Item Quantity',
  description: 'Update the quantity of an item in the cart',
  parameters: z.object({
    productId: z.string().describe('Product ID to update'),
    quantity: z.number().int().min(0).describe('New quantity (0 removes item)'),
    variantId: z.string().optional().describe('Product variant ID'),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    const cart = await prisma.cart.findUnique({
      where: { id: userId },
      include: { items: true },
    });

    if (!cart) {
      return { success: false, error: 'Cart not found' };
    }

    const existingItem = cart.items.find(
      item => item.productId === args.productId && item.variantId === args.variantId
    );

    if (!existingItem) {
      return { success: false, error: 'Item not in cart' };
    }

    if (args.quantity === 0) {
      // Remove item
      await prisma.cartItem.delete({ where: { id: existingItem.id } });
    } else {
      // Update quantity
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: args.quantity },
      });
    }

    // Return updated cart (reuse cart.get logic)
    return cartTools.get('cart.get')!.execute({ cartId: userId }, userId);
  },
}));

// cart.remove_item
cartTools.set('cart.remove_item', createTool('cart.remove_item', {
  title: 'Remove Item from Cart',
  description: 'Remove a product from the shopping cart',
  parameters: z.object({
    productId: z.string().describe('Product ID to remove'),
    variantId: z.string().optional().describe('Product variant ID'),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    // Reuse update_quantity with 0
    return cartTools.get('cart.update_quantity')!.execute(
      { productId: args.productId, quantity: 0, variantId: args.variantId },
      userId
    );
  },
}));

// cart.apply_coupon
cartTools.set('cart.apply_coupon', createTool('cart.apply_coupon', {
  title: 'Apply Promo Code',
  description: 'Apply a promotional coupon code to the cart',
  parameters: z.object({
    code: z.string().describe('Promo code to apply'),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    const coupon = await prisma.coupon.findUnique({
      where: { code: args.code.toUpperCase() },
    });

    if (!coupon) {
      return { success: false, error: 'Invalid coupon code' };
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return { success: false, error: 'Coupon has expired' };
    }

    // Apply discount (implementation depends on coupon type)
    return {
      success: true,
      ucp: {
        version: '1.0',
        action: UCPAction.UPDATE_CART,
        payload: { coupon: coupon.code, discount: coupon.discountPercent },
        timestamp: Date.now(),
      },
    };
  },
}));

// cart.clear
cartTools.set('cart.clear', createTool('cart.clear', {
  title: 'Clear Cart',
  description: 'Remove all items from the shopping cart',
  parameters: z.object({}),
  requireUserId: true,
  execute: async (args, userId) => {
    await prisma.cartItem.deleteMany({
      where: { cart: { id: userId } },
    });

    return {
      success: true,
      ucp: {
        version: '1.0',
        action: UCPAction.UPDATE_CART,
        payload: { action: 'clear' },
        timestamp: Date.now(),
      },
      ui: {
        component: 'CartDrawer',
        props: { items: [], total: 0, itemCount: 0 },
      },
    };
  },
}));
```

### 2.2 Orders Tools (Complete Set)

```typescript
// lib/mcp/tools/orders.ts
import { z } from 'zod';
import { createTool } from '../server.js';
import { prisma } from '@/lib/prisma/client';
import { UCPMessage, UCPAction } from '@/lib/ucp/types';
import { toGenUIResponse } from '@/lib/genui/adapter';
import { stripe } from '@/lib/stripe/client';

export const orderTools = new Map<string, ReturnType<typeof createTool>>();

// orders.create_from_cart
orderTools.set('orders.create_from_cart', createTool('orders.create_from_cart', {
  title: 'Create Order from Cart',
  description: 'Create an order from the current cart items',
  parameters: z.object({
    cartId: z.string().optional(),
    addressId: z.string().describe('Shipping address ID'),
    paymentIntentId: z.string().optional().describe('Stripe payment intent ID'),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    // Get cart with items
    const cart = await prisma.cart.findUnique({
      where: { id: args.cartId || userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return { success: false, error: 'Cart is empty' };
    }

    // Verify payment
    if (args.paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(args.paymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        return { success: false, error: 'Payment not completed' };
      }
    }

    // Calculate totals
    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity, 0
    );
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    // Create order
    const order = await prisma.order.create({
      data: {
        customerId: userId,
        status: 'pending',
        paymentStatus: args.paymentIntentId ? 'paid' : 'pending',
        shippingAddressId: args.addressId,
        total,
        items: {
          create: cart.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            priceAtPurchase: item.product.price,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    // Clear cart
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    return {
      success: true,
      ucp: {
        version: '1.0',
        action: UCPAction.CREATE_ORDER,
        payload: { orderId: order.id, total: order.total },
        timestamp: Date.now(),
      },
      ui: {
        component: 'OrderConfirmation',
        props: {
          orderId: order.id,
          total: order.total,
          status: order.status,
          estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    };
  },
}));

// orders.get
orderTools.set('orders.get', createTool('orders.get', {
  title: 'Get Order Details',
  description: 'Retrieve detailed information about a specific order',
  parameters: z.object({
    orderId: z.string().describe('Order ID to retrieve'),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    const order = await prisma.order.findFirst({
      where: { id: args.orderId, customerId: userId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    return {
      success: true,
      ucp: {
        version: '1.0',
        action: UCPAction.ORDER_STATUS,
        payload: { orderId: order.id, status: order.status },
        timestamp: Date.now(),
      },
      ui: {
        component: 'OrderTracking',
        props: {
          orderId: order.id,
          status: order.status,
          trackingNumber: order.trackingNumber || undefined,
          events: [
            { timestamp: order.orderDate.toISOString(), status: 'Order placed', location: 'Online' },
            ...(order.status !== 'pending' ? [{ 
              timestamp: new Date().toISOString(), 
              status: 'Processing', 
              location: 'Warehouse' 
            }] : []),
          ],
        },
      },
    };
  },
}));

// orders.list
orderTools.set('orders.list', createTool('orders.list', {
  title: 'List User Orders',
  description: 'List all orders for the authenticated user',
  parameters: z.object({
    limit: z.number().int().positive().max(50).default(20),
    cursor: z.string().optional(),
    status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    const where: any = { customerId: userId };
    if (args.status) where.status = args.status;

    const orders = await prisma.order.findMany({
      where,
      take: args.limit + 1,
      cursor: args.cursor ? { id: args.cursor } : undefined,
      orderBy: { orderDate: 'desc' },
      include: { items: { include: { product: true } } },
    });

    const hasMore = orders.length > args.limit;
    const data = hasMore ? orders.slice(0, -1) : orders;

    return {
      success: true,
      data: {
        orders: data.map(order => ({
          id: order.id,
          orderDate: order.orderDate.toISOString(),
          total: order.total,
          status: order.status,
          items: order.items.map(item => ({
            name: item.product.name,
            quantity: item.quantity,
          })),
        })),
        nextCursor: hasMore ? data[data.length - 1].id : null,
      },
      ucp: {
        version: '1.0',
        action: UCPAction.ORDER_STATUS,
        payload: { count: data.length },
        timestamp: Date.now(),
      },
      ui: {
        component: 'OrderHistoryGrid',
        props: {
          orders: data.map(order => ({
            id: order.id,
            date: order.orderDate.toISOString(),
            total: order.total,
            status: order.status,
            items: order.items.map(item => ({
              name: item.product.name,
              quantity: item.quantity,
            })),
          })),
        },
      },
    };
  },
}));

// orders.cancel
orderTools.set('orders.cancel', createTool('orders.cancel', {
  title: 'Cancel Order',
  description: 'Cancel an order (only if status allows)',
  parameters: z.object({
    orderId: z.string().describe('Order ID to cancel'),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    const order = await prisma.order.findFirst({
      where: { id: args.orderId, customerId: userId },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
      return { success: false, error: 'Order cannot be cancelled' };
    }

    await prisma.order.update({
      where: { id: args.orderId },
      data: { status: 'cancelled' },
    });

    return {
      success: true,
      ucp: {
        version: '1.0',
        action: UCPAction.REFUND,
        payload: { orderId: args.orderId, action: 'cancelled' },
        timestamp: Date.now(),
      },
    };
  },
}));

// orders.refund
orderTools.set('orders.refund', createTool('orders.refund', {
  title: 'Request Refund',
  description: 'Request a refund for an order or specific items',
  parameters: z.object({
    orderId: z.string().describe('Order ID to refund'),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    })).optional().describe('Specific items to refund (defaults to full order)'),
    reason: z.string().min(10).describe('Reason for refund'),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    const order = await prisma.order.findFirst({
      where: { id: args.orderId, customerId: userId },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // Calculate refund amount
    let refundAmount = order.total;
    if (args.items && args.items.length > 0) {
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: args.orderId },
        include: { product: true },
      });
      refundAmount = args.items.reduce((sum, item) => {
        const orderItem = orderItems.find(oi => oi.productId === item.productId);
        return sum + (orderItem?.priceAtPurchase || 0) * item.quantity;
      }, 0);
    }

    // Process refund via Stripe
    if (order.paymentStatus === 'paid') {
      await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId || undefined,
        amount: Math.round(refundAmount * 100), // Stripe uses cents
      });
    }

    // Create refund record
    const refund = await prisma.refund.create({
      data: {
        orderId: order.id,
        amount: Math.round(refundAmount * 100),
        reason: args.reason,
        status: 'pending',
      },
    });

    return {
      success: true,
      ucp: {
        version: '1.0',
        action: UCPAction.REFUND,
        payload: { refundId: refund.id, amount: refundAmount },
        timestamp: Date.now(),
      },
      ui: {
        component: 'ReturnRequest',
        props: {
          orderId: order.id,
          items: args.items || [],
          reason: args.reason,
        },
      },
    };
  },
}));
```

### 2.3 Search Tools

```typescript
// lib/mcp/tools/search.ts
import { z } from 'zod';
import { createTool } from '../server.js';
import { hybridSearch, searchProducts } from '@/lib/search/hybrid';
import { toGenUIResponse } from '@/lib/genui/adapter';

export const searchTools = new Map<string, ReturnType<typeof createTool>>();

// catalog.search
searchTools.set('catalog.search', createTool('catalog.search', {
  title: 'Search Products',
  description: 'Search the product catalog using hybrid search (keyword + semantic)',
  parameters: z.object({
    query: z.string().min(1).describe('Search query'),
    category: z.string().optional().describe('Filter by category'),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().nonnegative().optional(),
    inStock: z.boolean().optional(),
    sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest']).default('relevance'),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(50).default(20),
  }),
  requireUserId: false,
  execute: async (args) => {
    const filters: Record<string, unknown> = {};
    if (args.category) filters.category = args.category;
    if (args.minPrice !== undefined || args.maxPrice !== undefined) {
      filters.price = {};
      if (args.minPrice !== undefined) (filters.price as any).gte = args.minPrice;
      if (args.maxPrice !== undefined) (filters.price as any).lte = args.maxPrice;
    }
    if (args.inStock !== undefined) filters.stock = args.inStock ? { gt: 0 } : 0;

    const result = await searchProducts(args.query, {
      limit: args.limit,
      offset: (args.page - 1) * args.limit,
    });

    const products = result.results.map(r => ({
      id: String(r.item.id),
      name: r.item.name as string,
      description: r.item.description as string | undefined,
      price: r.item.price as number,
      category: r.item.category as string | undefined,
      stock: r.item.stock as number,
      image: r.item.image as string | undefined,
      rating: r.item.rating as number | undefined,
      inStock: (r.item.stock as number) > 0,
    }));

    return {
      success: true,
      data: { products, total: result.total, page: args.page },
      ucp: {
        version: '1.0',
        action: 'SEARCH_PRODUCTS',
        payload: { query: args.query, count: products.length },
        timestamp: Date.now(),
      },
      ui: {
        component: 'ProductGrid',
        props: { products, columns: 4 },
      },
    };
  },
}));

// catalog.autocomplete
searchTools.set('catalog.autocomplete', createTool('catalog.autocomplete', {
  title: 'Autocomplete Suggestions',
  description: 'Get autocomplete suggestions as user types',
  parameters: z.object({
    prefix: z.string().min(1).describe('User input prefix'),
    limit: z.number().int().positive().max(10).default(5),
  }),
  requireUserId: false,
  execute: async (args) => {
    // This would use OpenSearch suggester in production
    // For now, use a simple prefix match
    const products = await prisma.product.findMany({
      where: { name: { contains: args.prefix, mode: 'insensitive' } },
      take: args.limit,
      select: { id: true, name: true, category: true },
    });

    return {
      success: true,
      data: {
        suggestions: products.map(p => ({
          productId: p.id,
          text: p.name,
          category: p.category,
        })),
      },
    };
  },
}));

// catalog.recommendations
searchTools.set('catalog.recommendations', createTool('catalog.recommendations', {
  title: 'Product Recommendations',
  description: 'Get personalized product recommendations',
  parameters: z.object({
    context: z.enum(['browse', 'cart', 'checkout', 'home']).default('home'),
    productId: z.string().optional().describe('Current product for "similar" recommendations'),
    limit: z.number().int().positive().max(10).default(5),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    let products;
    
    if (args.productId) {
      // Similar products
      const product = await prisma.product.findUnique({
        where: { id: args.productId },
      });
      if (product) {
        const result = await searchProducts(product.name, { limit: args.limit + 1 });
        products = result.results
          .filter(r => String(r.item.id) !== args.productId)
          .slice(0, args.limit)
          .map(r => ({
            id: String(r.item.id),
            name: r.item.name as string,
            price: r.item.price as number,
            image: r.item.image as string | undefined,
            reason: 'Similar to what you\'re viewing',
          }));
      }
    } else {
      // Personalized based on history
      const result = await searchWithPreferences('', userId, { limit: args.limit });
      products = result.results.map(r => ({
        id: String(r.item.id),
        name: r.item.name as string,
        price: r.item.price as number,
        image: r.item.image as string | undefined,
        reason: 'Recommended for you',
      }));
    }

    return {
      success: true,
      data: { products },
      ui: {
        component: 'RecommendationCarousel',
        props: {
          title: args.productId ? 'Similar Products' : 'Recommended for You',
          products: products || [],
        },
      },
    };
  },
}));
```

---

## Phase 3: UCP as Backbone (Week 3)

### 3.1 Real UCP Message Schema

```typescript
// lib/ucp/types.ts (Extended)

export type UCPAction = 
  | 'SEARCH_PRODUCTS'
  | 'SHOW_PRODUCT'
  | 'ADD_TO_CART'
  | 'UPDATE_CART'
  | 'REMOVE_FROM_CART'
  | 'CREATE_CHECKOUT'
  | 'CONFIRM_PAYMENT'
  | 'CREATE_ORDER'
  | 'ORDER_STATUS'
  | 'REFUND'
  | 'CANCEL_ORDER';

export interface UCPMessage {
  version: string;
  action: UCPAction;
  payload: Record<string, unknown>;
  timestamp: number;
  correlationId?: string;
  userId?: string;
}

// Action-specific payload types
export interface SearchProductsPayload {
  query: string;
  filters?: {
    category?: string;
    priceRange?: [number, number];
    inStock?: boolean;
  };
  pagination?: { page: number; limit: number };
}

export interface AddToCartPayload {
  productId: string;
  quantity: number;
  variantId?: string;
}

export interface CreateCheckoutPayload {
  cartId: string;
  shippingAddressId: string;
  paymentMethod: 'card' | 'wallet' | 'bnpl';
}

export interface CreateOrderPayload {
  cartId: string;
  addressId: string;
  paymentIntentId?: string;
}

export interface RefundPayload {
  orderId: string;
  items?: Array<{ productId: string; quantity: number }>;
  reason: string;
}
```

### 3.2 UCP Enforcer Middleware

```typescript
// lib/ucp/middleware.ts
import { UCPAction } from './types';

export function enforceUCPPayload(action: UCPAction, payload: unknown): void {
  const validators: Record<UCPAction, (p: unknown) => boolean> = {
    [UCPAction.SEARCH_PRODUCTS]: (p: any) => 
      typeof p.query === 'string' && p.query.length > 0,
    
    [UCPAction.ADD_TO_CART]: (p: any) =>
      typeof p.productId === 'string' && 
      typeof p.quantity === 'number' && p.quantity > 0,
    
    [UCPAction.CREATE_CHECKOUT]: (p: any) =>
      typeof p.cartId === 'string' &&
      typeof p.shippingAddressId === 'string',
    
    [UCPAction.CREATE_ORDER]: (p: any) =>
      typeof p.cartId === 'string' &&
      typeof p.addressId === 'string',
    
    [UCPAction.REFUND]: (p: any) =>
      typeof p.orderId === 'string' &&
      typeof p.reason === 'string' && p.reason.length >= 10,
    
    // Default: allow all
    [key: string]: () => true,
  };

  const validator = validators[action];
  if (validator && !validator(payload)) {
    throw new Error(`Invalid UCP payload for action: ${action}`);
  }
}

export function createUCPCorrelationId(action: UCPAction, userId: string): string {
  return `${action.toLowerCase()}:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}
```

---

## Phase 4: Stripe via MCP (Week 4)

### 4.1 Payments Facade Tool

```typescript
// lib/mcp/tools/payments.ts
import { z } from 'zod';
import { createTool } from '../server.js';
import { stripe } from '@/lib/stripe/client';
import { UCPAction } from '@/lib/ucp/types';

export const paymentTools = new Map<string, ReturnType<typeof createTool>>();

// payments.create_checkout_session
paymentTools.set('payments.create_checkout_session', createTool('payments.create_checkout_session', {
  title: 'Create Stripe Checkout Session',
  description: 'Create a Stripe checkout session for the current cart',
  parameters: z.object({
    cartId: z.string(),
    mode: z.enum(['payment', 'subscription']).default('payment'),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    // Get cart items
    const cart = await prisma.cart.findUnique({
      where: { id: args.cartId || userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return { success: false, error: 'Cart is empty' };
    }

    // Build line items
    const lineItems = cart.items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.product.name,
          description: item.product.description || undefined,
          images: item.product.image ? [item.product.image] : undefined,
        },
        unit_amount: Math.round(item.product.price * 100),
      },
      quantity: item.quantity,
    }));

    // Create session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: args.mode,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: {
        userId,
        cartId: cart.id,
      },
    });

    return {
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
      ucp: {
        version: '1.0',
        action: UCPAction.CREATE_CHECKOUT,
        payload: { sessionId: session.id, amount: session.amount_total },
        timestamp: Date.now(),
      },
    };
  },
}));

// payments.create_payment_intent
paymentTools.set('payments.create_payment_intent', createTool('payments.create_payment_intent', {
  title: 'Create Payment Intent',
  description: 'Create a Stripe payment intent for custom checkout flow',
  parameters: z.object({
    amount: z.number().positive().describe('Amount in dollars'),
    currency: z.string().default('usd'),
    metadata: z.record(z.string()).optional(),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(args.amount * 100),
      currency: args.currency,
      metadata: {
        userId,
        ...args.metadata,
      },
    });

    return {
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
      ucp: {
        version: '1.0',
        action: UCPAction.CONFIRM_PAYMENT,
        payload: { paymentIntentId: paymentIntent.id },
        timestamp: Date.now(),
      },
    };
  },
}));

// payments.refund
paymentTools.set('payments.refund', createTool('payments.refund', {
  title: 'Process Refund',
  description: 'Process a refund via Stripe',
  parameters: z.object({
    paymentIntentId: z.string().describe('Payment intent or charge ID'),
    amount: z.number().positive().optional().describe('Amount to refund (full if not specified)'),
    reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
  }),
  requireUserId: true,
  execute: async (args) => {
    // Safety: only allow refunds in development or with explicit confirmation
    const refund = await stripe.refunds.create({
      payment_intent: args.paymentIntentId,
      amount: args.amount ? Math.round(args.amount * 100) : undefined,
      reason: args.reason,
    });

    return {
      success: true,
      data: {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
      },
      ucp: {
        version: '1.0',
        action: UCPAction.REFUND,
        payload: { refundId: refund.id },
        timestamp: Date.now(),
      },
    };
  },
}));

// Optional: Stripe MCP adapter (for portfolio showcase)
async function callStripeMCP(action: string, params: Record<string, unknown>) {
  // This would call Stripe's MCP server in production
  // For now, use direct SDK as fallback
  console.log(`[StripeMCP] Would call: ${action}`, params);
  return null;
}
```

---

## Phase 5: OpenSearch + Analytics (Week 5)

### 5.1 OpenSearch Index Setup

```typescript
// lib/search/opensearch.ts
import { Client } from '@opensearch-project/opensearch';

const client = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200',
  auth: process.env.OPENSEARCH_AUTH ? {
    username: process.env.OPENSEARCH_USERNAME,
    password: process.env.OPENSEARCH_PASSWORD,
  } : undefined,
});

export const SEARCH_INDEX = 'products';

export async function initializeOpenSearch() {
  // Create index with mappings
  const exists = await client.indices.exists({ index: SEARCH_INDEX });
  
  if (!exists) {
    await client.indices.create({
      index: SEARCH_INDEX,
      body: {
        settings: {
          analysis: {
            analyzer: {
              product_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding', 'product_synonyms'],
              },
            },
            filter: {
              product_synonyms: {
                type: 'synonym',
                synonyms: [
                  'running shoes, trainers, sneakers',
                  'laptop, notebook, computer',
                  'headphones, earbuds, earphones',
                ],
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text', analyzer: 'product_analyzer' },
            description: { type: 'text', analyzer: 'product_analyzer' },
            category: { type: 'keyword' },
            price: { type: 'float' },
            stock: { type: 'integer' },
            rating: { type: 'float' },
            embedding: { type: 'knn_vector', dimension: 384 },
            search_vector: { type: 'text' },
          },
        },
      },
    });
  }
}

export async function indexProduct(product: any) {
  await client.index({
    index: SEARCH_INDEX,
    id: String(product.id),
    body: {
      ...product,
      search_vector: `${product.name} ${product.description} ${product.category}`,
    },
  });
}

export async function searchWithFacets(params: {
  query: string;
  facets?: string[];
  page?: number;
  size?: number;
}) {
  const { query, facets = ['category'], page = 1, size = 20 } = params;
  
  const response = await client.search({
    index: SEARCH_INDEX,
    body: {
      from: (page - 1) * size,
      size,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['name^3', 'description', 'category'],
              },
            },
          ],
          filter: [{ term: { stock: { gt: 0 } } }],
        },
      },
      aggs: {
        categories: { terms: { field: 'category', size: 20 } },
        price_ranges: {
          range: {
            field: 'price',
            ranges: [
              { key: '0-25', from: 0, to: 25 },
              { key: '25-50', from: 25, to: 50 },
              { key: '50-100', from: 50, to: 100 },
              { key: '100+', from: 100 },
            ],
          },
        },
      },
    },
  });

  return {
    hits: response.body.hits.hits.map(h => ({ id: h._id, ...h._source })),
    total: response.body.hits.total.value,
    facets: {
      categories: response.body.aggregations.categories.buckets,
      priceRanges: response.body.aggregations.price_ranges.buckets,
    },
  };
}
```

---

## Summary: Implementation Priority

| Priority | Task | Estimated Effort | Existing Code |
|----------|------|------------------|---------------|
| 1 | shadcn storefront pages | 2 days | None (new) |
| 2 | Complete cart MCP tools | 2 days | Partial (lib/mcp/tools.ts) |
| 3 | Checkout MCP + UCP | 2 days | UCP mock exists |
| 4 | Orders MCP tools | 2 days | Partial |
| 5 | Search MCP tools | 1 day | hybrid.ts exists |
| 6 | Payments (Stripe MCP) | 2 days | Stripe SDK exists |
| 7 | OpenSearch + analytics | 3 days | Gap |

**Total: ~2 weeks**

This blueprint transforms Smart Commerce into a **protocol-first, production-grade agentic commerce showcase** that demonstrates:
- Deep understanding of MCP tool design with Zod validation
- UCP as a canonical contract between agent and UI
- Stripe integration best practices
- Modern shadcn-based storefront
- End-to-end type safety
