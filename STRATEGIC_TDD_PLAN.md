# FINAL STRATEGIC IMPLEMENTATION PLAN - TDD APPROACH

## Infrastructure Available

| Service | Status | Endpoint |
|---------|--------|----------|
| **Ollama** | ✅ Running | `http://localhost:11434` |
| **pgvector** | ✅ Available | Docker container `postgres-pgvector` |
| **Redis** | ✅ Available | Docker container `redis-local` |
| **Mockoon CLI** | Available | Can start for API mocking |

### Ollama Models Available
- `qwen2.5-coder:3b` - Main coding model
- `nomic-embed-text:latest` - Embeddings

---

## TDD Implementation Strategy

### Test-First Development Rules
1. **Write test first** - Define expected behavior before implementation
2. **Run tests** - Ensure new tests FAIL initially
3. **Implement** - Write minimal code to pass test
4. **Refactor** - Improve while keeping tests green
5. **Run full suite** - Ensure no regressions

---

## PHASE 1: Cart Tools (TDD) - Days 1-2

### Task 1.1: cart.update_quantity Tool

#### Step 1: Write Test First
```typescript
// tests/unit/cart-tools.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Cart Tools', () => {
  let mockPrisma: any;
  
  beforeEach(() => {
    mockPrisma = {
      cart: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      cartItem: {
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
  });

  describe('cart.update_quantity', () => {
    it('should increase quantity when positive number provided', async () => {
      // Arrange
      const tool = await import('@/lib/mcp/tools/cart');
      mockPrisma.cart.findUnique.mockResolvedValue({
        id: 'user-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
      });
      mockPrisma.cartItem.findFirst.mockResolvedValue({
        id: 'item-1',
        productId: 'prod-1',
        quantity: 1,
      });

      // Act
      const result = await tool.updateQuantity('user-1', 'prod-1', 3);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.quantity).toBe(3);
    });

    it('should remove item when quantity is 0', async () => {
      // Arrange - remove item on quantity 0
      mockPrisma.cartItem.delete.mockResolvedValue(true);

      // Act
      const result = await tool.updateQuantity('user-1', 'prod-1', 0);

      // Assert
      expect(mockPrisma.cartItem.delete).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should return error for negative quantity', async () => {
      // Act
      const result = await tool.updateQuantity('user-1', 'prod-1', -1);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('positive');
    });
  });
});
```

#### Step 2: Run Test → FAIL (expected)

#### Step 3: Implement
```typescript
// lib/mcp/tools/cart.ts
import { z } from 'zod';

export const UpdateQuantitySchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(0),
});

export async function updateQuantity(userId: string, productId: string, quantity: number) {
  if (quantity < 0) {
    return { success: false, error: 'Quantity must be non-negative' };
  }

  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { productId } });
  } else {
    await prisma.cartItem.update({
      where: { productId },
      data: { quantity },
    });
  }

  return { success: true, data: { quantity } };
}
```

### Task 1.2: cart.remove_item Tool

#### Test
```typescript
describe('cart.remove_item', () => {
  it('should remove item from cart', async () => {
    // Test removes item by productId
  });
  
  it('should return error if item not in cart', async () => {
    // Test handles missing item
  });
});
```

### Task 1.3: cart.apply_coupon Tool

#### Test
```typescript
describe('cart.apply_coupon', () => {
  it('should apply valid coupon', async () => {
    // Test applies discount
  });
  
  it('should reject expired coupon', async () => {
    // Test handles expired coupon
  });
  
  it('should reject invalid code', async () => {
    // Test handles invalid coupon
  });
});
```

---

## PHASE 2: Checkout Tool (TDD) - Days 3-4

### Task 2.1: payments.create_checkout_session

#### Test
```typescript
// tests/unit/payments.test.ts
describe('payments.create_checkout_session', () => {
  it('should create Stripe checkout session', async () => {
    // Mock Stripe
    const mockStripe = {
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com/pay/cs_test' }),
        },
      },
    };
    
    const result = await createCheckoutSession({
      cartId: 'cart-1',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });
    
    expect(result.success).toBe(true);
    expect(result.data.url).toContain('checkout.stripe.com');
  });
  
  it('should return error for empty cart', async () => {
    const result = await createCheckoutSession({
      cartId: 'empty-cart',
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('empty');
  });
});
```

### Task 2.2: orders.create_from_cart

#### Test
```typescript
describe('orders.create_from_cart', () => {
  it('should create order from cart items', async () => {
    const result = await createOrderFromCart({
      cartId: 'cart-1',
      addressId: 'addr-1',
    });
    
    expect(result.success).toBe(true);
    expect(result.data.orderId).toBeDefined();
    expect(result.data.total).toBeGreaterThan(0);
  });
  
  it('should clear cart after order', async () => {
    await createOrderFromCart({ cartId: 'cart-1' });
    expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalled();
  });
});
```

---

## PHASE 3: GenUI Integration (TDD) - Days 5-6

### Task 3.1: GenUI Registry & Adapter

#### Test
```typescript
// tests/unit/genui/adapter.test.ts
describe('GenUI Adapter', () => {
  it('should map cart tool result to CartDrawer component', () => {
    const result = {
      success: true,
      data: { items: [], total: 0 },
    };
    
    const ui = mapToGenUI(result, 'cart');
    
    expect(ui.component).toBe('CartDrawer');
    expect(ui.props.items).toEqual([]);
  });
  
  it('should map search result to ProductGrid', () => {
    const result = {
      success: true,
      data: { products: [{ id: '1', name: 'Test' }] },
    };
    
    const ui = mapToGenUI(result, 'search');
    
    expect(ui.component).toBe('ProductGrid');
  });
});
```

### Task 3.2: CartDrawer Component Test

```typescript
// tests/components/cart-drawer.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';

describe('CartDrawer', () => {
  it('should display cart items', () => {
    const items = [
      { productId: '1', name: 'Product 1', quantity: 2, price: 10 },
    ];
    
    render(<CartDrawer items={items} total={20} />);
    
    expect(screen.getByText('Product 1')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });
  
  it('should call updateQuantity when + button clicked', async () => {
    const updateQty = vi.fn();
    render(<CartDrawer items={[]} onUpdateQuantity={updateQty} />);
    
    fireEvent.click(screen.getByText('+'));
    
    expect(updateQty).toHaveBeenCalled();
  });
});
```

---

## PHASE 4: UCP Contract (TDD) - Days 7-8

### Task 4.1: UCP Message Types

#### Test
```typescript
// tests/unit/ucp/actions.test.ts
import { UCPAction, validateUCPAction } from '@/lib/ucp/actions';

describe('UCP Actions', () => {
  it('should validate ADD_TO_CART payload', () => {
    const payload = {
      productId: 'prod-1',
      quantity: 2,
    };
    
    const result = validateUCPAction('ADD_TO_CART', payload);
    expect(result.valid).toBe(true);
  });
  
  it('should reject invalid payload', () => {
    const payload = {
      // missing productId
      quantity: 2,
    };
    
    const result = validateUCPAction('ADD_TO_CART', payload);
    expect(result.valid).toBe(false);
  });
  
  it('should generate correlation ID', () => {
    const id = generateUCPCorrelationId('ADD_TO_CART', 'user-1');
    expect(id).toMatch(/^add_to_cart:user-1:/);
  });
});
```

---

## PHASE 5: Integration E2E (TDD) - Days 9-10

### Task 5.1: Full Flow Test

```typescript
// tests/e2e/commerce-flow.test.ts
import { test, expect } from '@playwright/test';

test.describe('Commerce Flow', () => {
  test('complete purchase flow', async ({ page }) => {
    // 1. Search for product
    await page.goto('/store');
    await page.fill('[data-testid=search]', 'headphones');
    await page.click('[data-testid=search-button]');
    
    // 2. Add to cart
    await page.click('[data-testid=add-to-cart-1]');
    
    // 3. Open cart
    await page.click('[data-testid=cart-button]');
    expect(page.locator('[data-testid=cart-item]')).toHaveCount(1);
    
    // 4. Checkout
    await page.click('[data-testid=checkout-button]');
    await page.fill('[data-testid=address]', '123 Main St');
    await page.click('[data-testid=place-order]');
    
    // 5. Verify confirmation
    await expect(page.locator('[data-testid=order-confirmation]')).toBeVisible();
  });
});
```

---

## TODO: Implementation Checklist

### PHASE 1: Cart Tools (Days 1-2)
- [ ] **1.1** Write test: `tests/unit/cart-tools.test.ts` for `update_quantity`
- [ ] **1.2** Run test → FAIL
- [ ] **1.3** Implement: `lib/mcp/tools/cart.ts` - `updateQuantity()`
- [ ] **1.4** Run test → PASS
- [ ] **1.5** Write test: `remove_item` 
- [ ] **1.6** Implement: `removeItem()`
- [ ] **1.7** Write test: `apply_coupon`
- [ ] **1.8** Implement: `applyCoupon()`
- [ ] **1.9** Run full test suite → ensure no regressions

### PHASE 2: Checkout (Days 3-4)
- [ ] **2.1** Write test: `tests/unit/payments.test.ts` - checkout session
- [ ] **2.2** Implement: `lib/mcp/tools/payments.ts` - create checkout
- [ ] **2.3** Write test: orders.create_from_cart
- [ ] **2.4** Implement: create from cart flow

### PHASE 3: GenUI (Days 5-6)
- [ ] **3.1** Write test: GenUI adapter mapping
- [ ] **3.2** Implement: `lib/genui/adapter.ts`
- [ ] **3.3** Write test: CartDrawer component
- [ ] **3.4** Implement: `components/commerce/cart-drawer.tsx`
- [ ] **3.5** Integration test: tool → GenUI render

### PHASE 4: UCP (Days 7-8)
- [ ] **4.1** Write test: UCP action validation
- [ ] **4.2** Implement: `lib/ucp/actions.ts` - real actions
- [ ] **4.3** Update tools to return UCP format
- [ ] **4.4** Run full test suite

### PHASE 5: E2E (Days 9-10)
- [ ] **5.1** Write E2E test: full commerce flow
- [ ] **5.2** Run E2E test → FAIL
- [ ] **5.3** Fix any integration issues
- [ ] **5.4** Run E2E test → PASS
- [ ] **5.5** Final regression test

---

## Running Tests

### Unit Tests
```bash
# Run unit tests
npm test -- tests/unit/

# Run specific test file
npm test -- tests/unit/cart-tools.test.ts

# Run with coverage
npm test -- --coverage
```

### Component Tests
```bash
# Run component tests
npm test -- tests/components/

# Run with vitest UI
npm test -- --ui
```

### E2E Tests
```bash
# Run E2E tests
npm run test:e2e

# Run specific E2E test
npm run test:e2e -- tests/e2e/commerce-flow.test.ts

# Run in headed mode (see browser)
npm run test:e2e -- --headed
```

### All Tests
```bash
# Run full test suite
npm test && npm run test:e2e
```

---

## Key Commands Reference

| Command | Description |
|---------|-------------|
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |

---

## Expected Outcomes

By following this TDD plan:

1. **No regressions** - Every change verified by tests
2. **Documented behavior** - Tests serve as spec
3. **Confidence** - Green tests = working features
4. **Faster debugging** - Failed tests pinpoint issues
5. **Portfolio ready** - Demonstrates TDD competency

---

## Final Verification

After completing all phases:

```bash
# Run full test suite
npm test

# Run E2E tests  
npm run test:e2e

# Check coverage
npm test -- --coverage

# Start dev server for manual testing
npm run dev
```

**Success Criteria:**
- ✅ All unit tests passing
- ✅ All E2E tests passing  
- ✅ No regressions in existing tests
- ✅ Full commerce flow working end-to-end
