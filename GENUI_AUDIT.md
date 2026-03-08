# GenUI Codebase Audit

## Existing GenUI Components

### 1. ProductCard (`app/dashboard/components/genui/product-card.tsx`)
**Status: ✅ FULLY IMPLEMENTED (498 lines)**

| Feature | Status |
|---------|--------|
| Product display | ✅ |
| Quantity selector | ✅ |
| Add to cart button | ✅ |
| Stock indicator | ✅ |
| Rating display | ✅ |
| Price with discount | ✅ |
| Specifications | ✅ |
| Features list | ✅ |
| Tags | ✅ |
| Wishlist button | ✅ |
| Share button | ✅ |
| Skeleton loader | ✅ |

### 2. OrderCard (`app/dashboard/components/genui/order-card.tsx`)
**Status: ✅ FULLY IMPLEMENTED (406 lines)**

| Feature | Status |
|---------|--------|
| Order display | ✅ |
| Status badge | ✅ |
| Item list | ✅ |
| Order summary | ✅ |
| Shipping address | ✅ |
| Tracking info | ✅ |
| Refund request button | ✅ |
| Track package button | ✅ |
| View details button | ✅ |
| Skeleton loader | ✅ |

### 3. TicketStatus (`app/dashboard/components/genui/ticket-status.tsx`)
**Status: ✅ IMPLEMENTED**

| Feature | Status |
|---------|--------|
| Ticket display | ✅ |
| Status indicator | ✅ |
| Priority badge | ✅ |
| Message thread | ✅ |
| Resolution info | ✅ |

### 4. ProductGrid
**Status: ✅ FULLY IMPLEMENTED**

```typescript
// app/dashboard/components/genui/product-card.tsx:489
export function ProductGrid({ products, children, className = '' }: ProductGridProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}>
      {products.map((product, index) => children(product, index))}
    </div>
  );
}
```

---

## GenUI Data Types

### ProductData (`app/dashboard/components/genui/product-card.tsx:32`)
```typescript
export interface ProductData {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  currency: string;
  category: string;
  subcategory?: string;
  brand?: string;
  status: ProductStatus;  // 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued'
  stock: number;
  lowStockThreshold: number;
  rating: number;
  reviewCount: number;
  imageUrl?: string;
  images?: string[];
  tags?: string[];
  features?: string[];
  specifications?: Record<string, string>;
  weight?: number;
  dimensions?: {...};
  warranty?: string;
  returnable: boolean;
  returnWindow?: string;
  createdAt: string;
  updatedAt: string;
}
```

### OrderData (`app/dashboard/components/genui/order-card.tsx:56`)
```typescript
export interface OrderData {
  id: string;
  orderNumber: string;
  status: OrderStatus;  // 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
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
```

---

## What's Missing for Protocol-First GenUI

### 1. CartDrawer Component
**Status: ❌ NOT IMPLEMENTED**

Need to create:
- Slide-in drawer
- Cart items list with quantity controls
- Remove item button
- Promo code input
- Order summary
- Checkout button

### 2. CheckoutWizard Component
**Status: ❌ NOT IMPLEMENTED**

Need to create:
- Multi-step wizard
- Cart review step
- Shipping address form
- Payment method selection
- Order confirmation

### 3. OrderTracking Component
**Status: ⚠️ PARTIAL**

Existing `OrderCard` has basic tracking info, but need:
- Timeline of events
- Real-time status updates
- Carrier integration display

### 4. RecommendationCarousel
**Status: ❌ NOT IMPLEMENTED**

Need to create:
- Horizontal scrolling carousel
- "Complete the look" suggestions
- Personalized recommendations

### 5. GenUI Registry & Adapter
**Status: ❌ NOT IMPLEMENTED**

Need to create:
- `lib/genui/registry.ts` - Component type definitions
- `lib/genui/adapter.ts` - Tool output → GenUI mapper

---

## GenUI Integration with Tools

### Current Flow
```
Tool Result → JSON → Manual Component Rendering
```

### Desired Flow (Protocol-First)
```
Tool Result → UCP Message → ui: { component, props } → renderGenUI() → Component
```

### Example Tool Output (Current)
```typescript
// lib/mcp/tools.ts:129
return {
  success: true,
  results: products.map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    ...
  }))
};
```

### Example Tool Output (Protocol-First)
```typescript
return {
  success: true,
  ucp: {
    version: '1.0',
    action: 'SEARCH_PRODUCTS',
    payload: { query, count: products.length },
    timestamp: Date.now(),
  },
  ui: {
    component: 'ProductGrid',
    props: { products, columns: 4 },
  },
};
```

---

## Reuse Strategy

### For New Components, Reuse Existing Patterns:

1. **Use same styling** - Tailwind CSS with dark mode
2. **Use same type system** - Extend existing interfaces
3. **Use same structure** - Status config objects, format helpers
4. **Use same patterns** - Skeleton loaders, action buttons

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `components/commerce/cart-drawer.tsx` | CREATE | Cart drawer |
| `components/commerce/checkout-wizard.tsx` | CREATE | Checkout wizard |
| `components/commerce/order-tracking.tsx` | CREATE | Order tracking |
| `components/commerce/recommendation-carousel.tsx` | CREATE | Recommendations |
| `lib/genui/registry.ts` | CREATE | Type registry |
| `lib/genui/adapter.ts` | CREATE | Tool→UI mapper |
| `lib/genui/index.ts` | CREATE | Exports |

---

## Summary

| Component | Lines | Status | Reuse |
|-----------|-------|--------|-------|
| ProductCard | 498 | ✅ Ready | Direct |
| ProductGrid | 10 | ✅ Ready | Direct |
| OrderCard | 406 | ✅ Ready | Extend |
| TicketStatus | ~200 | ✅ Ready | Direct |
| CartDrawer | 0 | ❌ NEW | Build new |
| CheckoutWizard | 0 | ❌ NEW | Build new |
| OrderTracking | 0 | ⚠️ PARTIAL | Extend OrderCard |
| RecommendationCarousel | 0 | ❌ NEW | Build new |
| GenUI Registry | 0 | ❌ NEW | Build new |

**Total Existing GenUI: ~1,100 lines ready to use**

The main work is:
1. Creating CartDrawer, CheckoutWizard, RecommendationCarousel
2. Building the GenUI registry and adapter
3. Updating tools to return UCP + ui hints
