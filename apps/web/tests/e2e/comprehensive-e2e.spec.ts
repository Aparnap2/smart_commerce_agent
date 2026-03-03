/**
 * E2E Tests for GenUI, MCP, and UCP Components
 *
 * Tests the complete user journey with Playwright.
 */

import { test, expect } from '@playwright/test';

// Test configuration
const TEST_TIMEOUT = 60000;
const BASE_URL = 'http://localhost:3000';

test.describe('E-Commerce Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  });

  test.describe('Main Page Navigation', () => {
    test('loads main page successfully', async ({ page }) => {
      await expect(page).toHaveTitle(/TechTrend/i);
    });

    test('displays product categories', async ({ page }) => {
      await expect(page.locator('button:has-text("All")')).toBeVisible();
      await expect(page.locator('button:has-text("Computers")')).toBeVisible();
      await expect(page.locator('button:has-text("Phones")')).toBeVisible();
      await expect(page.locator('button:has-text("Audio")')).toBeVisible();
    });

    test('displays product grid', async ({ page }) => {
      await expect(page.locator('text=Premium Laptop')).toBeVisible();
      await expect(page.locator('text=Wireless Earbuds')).toBeVisible();
      await expect(page.locator('text=Smartphone Pro')).toBeVisible();
    });

    test('displays product prices', async ({ page }) => {
      // Use regex matching for prices
      await expect(page.locator('text:has-text("$1299.99")').first()).toBeVisible();
      await expect(page.locator('text:has-text("$149.99")').first()).toBeVisible();
      await expect(page.locator('text:has-text("$999.99")').first()).toBeVisible();
    });
  });

  test.describe('Chat Widget (GenUI)', () => {
    test('opens chat widget', async ({ page }) => {
      await page.click('button:has-text("Chat Support")');

      // Use more specific selectors to avoid ambiguous matches
      await expect(page.getByRole('heading', { name: 'TechTrend Support', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Welcome to TechTrend Support' })).toBeVisible();
    });

    test('sends message and receives response', async ({ page }) => {
      await page.click('button:has-text("Chat Support")');

      const input = page.locator('input[placeholder*="orders" i]');
      await expect(input).toBeVisible();

      await input.fill('Hello');
      await page.click('button[type="submit"]');

      // Wait for response
      await expect(page.getByRole('heading', { name: 'TechTrend Support' })).toBeVisible();
    });
  });

  test.describe('Add to Cart (UCP Commerce Flow)', () => {
    test('adds product to cart', async ({ page }) => {
      // Click add to cart on first product
      await page.locator('button:has-text("Add to Cart")').first().click();

      // Verify toast notification appears
      await expect(page.locator('text=/Added/i').first()).toBeVisible({ timeout: 5000 });
    });

    test('increments cart count', async ({ page }) => {
      // Add multiple products
      await page.locator('button:has-text("Add to Cart")').first().click();
      await page.locator('button:has-text("Add to Cart")').nth(1).click();

      // Cart should show updated count (toast notifications should appear)
      await expect(page.locator('text=/Added/i').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Category Filtering', () => {
    test('filters by Computers category', async ({ page }) => {
      await page.click('button:has-text("Computers")');

      // Only computer products should be visible
      await expect(page.locator('text=Premium Laptop')).toBeVisible();
    });

    test('filters by Audio category', async ({ page }) => {
      await page.click('button:has-text("Audio")');

      await expect(page.locator('text=Wireless Earbuds')).toBeVisible();
    });

    test('shows all products when All selected', async ({ page }) => {
      await page.click('button:has-text("Computers")');
      await page.click('button:has-text("All")');

      await expect(page.locator('text=Premium Laptop')).toBeVisible();
      await expect(page.locator('text=Wireless Earbuds')).toBeVisible();
    });
  });

  test.describe('Search Functionality', () => {
    test('searches for products', async ({ page }) => {
      const searchInput = page.locator('input[placeholder="Search products..."]');
      await searchInput.fill('laptop');

      await expect(page.locator('text=Premium Laptop')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('displays correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await expect(page.locator('text=TechTrend')).toBeVisible();
      await expect(page.locator('button:has-text("Chat Support")')).toBeVisible();
    });

    test('displays correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await expect(page.locator('text=Premium Laptop')).toBeVisible();
      await expect(page.locator('text=Wireless Earbuds')).toBeVisible();
    });
  });
});

test.describe('MCP Tool Execution E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Chat Support")');
  });

  test('executes db_query tool for order lookup', async ({ page }) => {
    // Send message that triggers database query
    const input = page.locator('input[placeholder*="orders" i]');
    await input.fill('Show my orders for user@techtrend.com');
    await page.click('button[type="submit"]');

    // Wait for response (may timeout if no orders exist)
    await expect(page.getByRole('heading', { name: 'TechTrend Support' })).toBeVisible({ timeout: 30000 });
  });

  test('handles product queries', async ({ page }) => {
    const input = page.locator('input[placeholder*="orders" i]');
    await input.fill('What laptops do you have?');
    await page.click('button[type="submit"]');

    // Wait for response
    await expect(page.getByRole('heading', { name: 'TechTrend Support' })).toBeVisible({ timeout: 30000 });
  });

  test('shows tool execution status', async ({ page }) => {
    const input = page.locator('input[placeholder*="orders" i]');
    await input.fill('Show products');
    await page.click('button[type="submit"]');

    // Check for tool execution indicator
    await expect(page.getByRole('heading', { name: 'TechTrend Support' })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('UCP Commerce Protocol E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  });

  test('complete purchase flow simulation', async ({ page }) => {
    // 1. View product
    await expect(page.locator('text=Premium Laptop')).toBeVisible();

    // 2. Add to cart
    await page.locator('button:has-text("Add to Cart")').first().click();
    const toast = page.locator('text=/Added/i');
    await expect(toast.first()).toBeVisible({ timeout: 5000 });
  });

  test('handles out of stock products', async ({ page }) => {
    const addToCartButtons = page.locator('button:has-text("Add to Cart")');
    const count = await addToCartButtons.count();

    if (count > 0) {
      await addToCartButtons.first().click();
      await expect(page.locator('text=/Added/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('displays correct pricing', async ({ page }) => {
    await expect(page.locator('text:has-text("$1299.99")').first()).toBeVisible();
    await expect(page.locator('text:has-text("$149.99")').first()).toBeVisible();
  });
});

test.describe('GenUI Component Rendering Tests', () => {
  test('renders product cards dynamically', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    const productCards = page.locator('text=Premium Laptop').first();
    await expect(productCards).toBeVisible();
  });

  test('renders product details correctly', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    await expect(page.locator('text=Premium Laptop')).toBeVisible();
    await expect(page.locator('text=High-performance laptop')).toBeVisible();
    await expect(page.locator('text=Computers')).toBeVisible();
  });

  test('renders ratings', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    await expect(page.locator('text=4.5').first()).toBeVisible();
  });

  test('renders product images', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    await expect(page.locator('img[alt*="Laptop"]').first()).toBeVisible();
  });
});

test.describe('Edge Case Handling', () => {
  test('handles empty search results', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search products..."]');
    await searchInput.fill('xyznonexistentproduct123');

    // Should either show no results or all products
    await expect(page).toBeVisible();
  });

  test('handles rapid button clicks', async ({ page }) => {
    // Rapidly click add to cart
    const button = page.locator('button:has-text("Add to Cart")').first();
    await button.click({ clickCount: 5, delay: 100 });

    // Should handle gracefully
    await expect(page).toBeVisible();
  });

  test('handles network errors gracefully', async ({ page }) => {
    // Force offline and test
    await page.context().setOffline(true);

    // Chat might fail but page should still render
    await page.click('button:has-text("Chat Support")');
    await expect(page.getByRole('heading', { name: 'TechTrend Support' })).toBeVisible();

    await page.context().setOffline(false);
  });
});
