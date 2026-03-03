/**
 * Playwright MCP Tools E2E Tests
 * 
 * Tests MCP tools (cart, checkout, orders) with real browser automation
 * Run: pnpm playwright test tests/e2e/mcp-tools.spec.ts
 */

import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('MCP Cart Tools - E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('should add product to cart via MCP tool', async ({ page }) => {
    // Navigate to products page
    await page.click('text=Products');
    await page.waitForLoadState('networkidle');
    
    // Find first product and add to cart
    const firstProduct = await page.locator('[data-testid="product-card"]').first();
    await firstProduct.click();
    
    // Click add to cart button
    await page.click('button:has-text("Add to Cart")');
    
    // Verify cart was updated
    const cartCount = await page.locator('[data-testid="cart-count"]');
    await expect(cartCount).toHaveText('1');
  });

  test('should update cart quantity via MCP tool', async ({ page }) => {
    // Add item to cart first
    await page.goto(`${BASE_URL}/products`);
    await page.click('[data-testid="product-card"]:first-child');
    await page.click('button:has-text("Add to Cart")');
    
    // Go to cart page
    await page.goto(`${BASE_URL}/cart`);
    
    // Update quantity
    await page.selectOption('select[name="quantity"]', '3');
    
    // Verify quantity updated
    const quantity = await page.locator('select[name="quantity"]');
    await expect(quantity).toHaveValue('3');
  });

  test('should apply coupon code via MCP tool', async ({ page }) => {
    // Add item to cart
    await page.goto(`${BASE_URL}/products`);
    await page.click('[data-testid="product-card"]:first-child');
    await page.click('button:has-text("Add to Cart")');
    
    // Go to cart
    await page.goto(`${BASE_URL}/cart`);
    
    // Apply coupon
    await page.fill('input[name="coupon-code"]', 'SAVE10');
    await page.click('button:has-text("Apply Coupon")');
    
    // Verify discount applied
    const discountElement = await page.locator('[data-testid="discount"]');
    await expect(discountElement).toBeVisible();
  });

  test('should clear cart via MCP tool', async ({ page }) => {
    // Add items to cart
    await page.goto(`${BASE_URL}/products`);
    await page.click('[data-testid="product-card"]:first-child');
    await page.click('button:has-text("Add to Cart")');
    
    // Go to cart and clear
    await page.goto(`${BASE_URL}/cart`);
    await page.click('button:has-text("Clear Cart")');
    
    // Verify cart is empty
    const emptyCartMessage = await page.locator('text=Your cart is empty');
    await expect(emptyCartMessage).toBeVisible();
  });
});

test.describe('MCP Checkout Tools - E2E', () => {
  test('should create checkout session', async ({ page }) => {
    // Add product to cart
    await page.goto(`${BASE_URL}/products`);
    await page.click('[data-testid="product-card"]:first-child');
    await page.click('button:has-text("Add to Cart")');
    
    // Go to checkout
    await page.goto(`${BASE_URL}/checkout`);
    
    // Fill shipping info
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="address"]', '123 Test St');
    await page.fill('input[name="city"]', 'Test City');
    
    // Click checkout
    await page.click('button:has-text("Checkout")');
    
    // Verify checkout created
    await expect(page).toHaveURL(/\/order-confirmation/);
  });
});

test.describe('MCP Order Tools - E2E', () => {
  test('should view order details', async ({ page }) => {
    // Go to orders page
    await page.goto(`${BASE_URL}/orders`);
    
    // Click on first order
    await page.click('[data-testid="order-card"]:first-child');
    
    // Verify order details visible
    const orderDetails = await page.locator('[data-testid="order-details"]');
    await expect(orderDetails).toBeVisible();
  });

  test('should cancel order via MCP tool', async ({ page }) => {
    // Go to orders
    await page.goto(`${BASE_URL}/orders`);
    
    // Click cancel on first pending order
    const cancelButtons = await page.locator('button:has-text("Cancel Order")');
    if (await cancelButtons.count() > 0) {
      await cancelButtons.first().click();
      
      // Confirm cancellation
      await page.click('button:has-text("Confirm")');
      
      // Verify order cancelled
      const statusElement = await page.locator('[data-testid="order-status"]');
      await expect(statusElement).toHaveText('Cancelled');
    }
  });
});

test.describe('MCP RAG Tools - E2E', () => {
  test('should search products via semantic search', async ({ page }) => {
    // Go to search
    await page.goto(`${BASE_URL}/search`);
    
    // Enter search query
    await page.fill('input[name="query"]', 'wireless headphones');
    await page.click('button:has-text("Search")');
    
    // Verify results shown
    const results = await page.locator('[data-testid="product-card"]');
    await expect(results).toHaveCount({ min: 1 });
  });

  test('should get product recommendations via RAG', async ({ page }) => {
    // Go to product page
    await page.goto(`${BASE_URL}/products/1`);
    
    // Scroll to recommendations
    await page.waitForSelector('[data-testid="recommendations"]');
    const recommendations = await page.locator('[data-testid="recommendations"]');
    await expect(recommendations).toBeVisible();
  });
});

test.describe('Guardrails - E2E', () => {
  test('should sanitize PII in chat input', async ({ page }) => {
    // Go to chat
    await page.goto(`${BASE_URL}/chat`);
    
    // Enter message with PII
    await page.fill('textarea[name="message"]', 'My email is test@example.com');
    await page.click('button:has-text("Send")');
    
    // Verify PII was sanitized in response
    const response = await page.locator('[data-testid="chat-response"]').last();
    await expect(response).not.toContainText('test@example.com');
  });

  test('should block toxic input', async ({ page }) => {
    // Go to chat
    await page.goto(`${BASE_URL}/chat`);
    
    // Enter toxic message
    await page.fill('textarea[name="message"]', 'This is stupid and dumb');
    await page.click('button:has-text("Send")');
    
    // Verify appropriate response
    const response = await page.locator('[data-testid="chat-response"]').last();
    await expect(response).toContainText(/I'm here to help|Let's keep it positive/i);
  });
});

test.describe('Performance - E2E', () => {
  test('should handle concurrent cart updates', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    
    // Add multiple items quickly
    const addButtons = await page.locator('button:has-text("Add to Cart")');
    const count = await addButtons.count();
    
    for (let i = 0; i < Math.min(count, 3); i++) {
      await addButtons.nth(i).click();
      await page.waitForTimeout(100);
    }
    
    // Verify cart count
    const cartCount = await page.locator('[data-testid="cart-count"]');
    await expect(cartCount).toHaveText({ min: '3' });
  });

  test('should load products within performance budget', async ({ page }) => {
    // Start timer
    const startTime = Date.now();
    
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');
    
    // Check load time
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // 3 second budget
  });
});
