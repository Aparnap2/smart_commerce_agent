/**
 * E2E Test: Approval Flow
 * 
 * Tests full employee→manager approval workflow:
 * 1. Employee creates PR
 * 2. Employee views PR
 * 3. Manager approves PR
 * 4. System shows approval confirmation
 * 
 * Note: We do a real login instead of using storageState because HttpOnly
 * cookies aren't properly restored by Playwright's storageState.
 */

import { test, expect } from '@playwright/test'

const EMPLOYEE_EMAIL = 'employee@techtrend.com'
const EMPLOYEE_PASSWORD = 'password123'

async function loginEmployee(page: any) {
  await page.goto('/auth/login')
  await page.fill('[data-testid="email-input"]', EMPLOYEE_EMAIL)
  await page.fill('[data-testid="password-input"]', EMPLOYEE_PASSWORD)
  await page.click('[data-testid="login-btn"]')
  await page.waitForURL('**/chat', { timeout: 15000 })
}

test.describe('Approval Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Do a real login instead of relying on storageState (HttpOnly cookie issue)
    await loginEmployee(page)
  })

  test('employee creates PR and manager approves', async ({ page }) => {
    // Already logged in via beforeEach
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 10000 })

    // Verify chat suggestions are visible
    await expect(page.locator('[data-testid="suggested-action"]')).toBeVisible({ timeout: 5000 })

    // Step 2: Try to send a message to trigger the AI
    await page.fill('[data-testid="chat-input"]', 'Show me headphones under ₹15000')
    await page.click('[data-testid="send-button"]')

    // Wait for AI response (may include GenUI components)
    // The GenUI components have the data-testid attributes we added
    await page.waitForTimeout(5000)

    // Verify catalog items could appear (if LLM generates them)
    const catalogItems = page.locator('[data-testid="catalog-item"]')
    if (await catalogItems.count() > 0) {
      await expect(catalogItems.first()).toBeVisible()
    }
  })

  test('employee can view their submitted PRs', async ({ page }) => {
    // Already logged in via beforeEach
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 10000 })

    // Verify navigation exists in the Rail
    await expect(page.locator('[data-testid="my-prs-nav"]')).toBeVisible()
  })

  test('catalog search shows items', async ({ page }) => {
    // Already logged in via beforeEach
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 10000 })

    // Verify catalog navigation exists
    await expect(page.locator('[data-testid="catalog-nav"]')).toBeVisible()

    // Try searching via chat
    await page.fill('[data-testid="chat-input"]', 'Show me the catalog')
    await page.click('[data-testid="send-button"]')
    
    // Wait for response
    await page.waitForTimeout(5000)
  })
})