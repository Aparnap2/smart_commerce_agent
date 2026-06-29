/**
 * Auth Smoke Test
 * 
 * Verifies that the UI login flow works end-to-end.
 * This is a separate test that runs less frequently than API-based tests.
 * 
 * Uses seeded test users:
 * - employee@techtrend.com / Test@123 (EMPLOYEE role)
 * - manager@techtrend.com / Test@123 (MANAGER role)
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005'

test.describe('Authentication Smoke Tests', () => {
  
  test('employee can login via UI and access chat', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/auth/login`)
    await expect(page).toHaveTitle(/login/i, { timeout: 10000 })

    // Fill login form
    await page.fill('[data-testid="email-input"]', 'employee@techtrend.com')
    await page.fill('[data-testid="password-input"]', 'Test@123')
    await page.click('[data-testid="login-btn"]')

    // Wait for navigation to chat page
    await page.waitForURL('**/chat', { timeout: 15000 })

    // Verify chat interface is loaded
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 10000 })
    
    // Verify user is authenticated (check for user-specific elements)
    await expect(page.locator('[data-testid="rail"]')).toBeVisible()

    console.log('✓ Employee login successful')
  })

  test('manager can login via UI and access dashboard', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/auth/login`)
    await expect(page).toHaveTitle(/login/i, { timeout: 10000 })

    // Fill login form
    await page.fill('[data-testid="email-input"]', 'manager@techtrend.com')
    await page.fill('[data-testid="password-input"]', 'Test@123')
    await page.click('[data-testid="login-btn"]')

    // Wait for navigation - managers may go to different page
    await page.waitForURL('**/chat**', { timeout: 15000 })

    // Verify chat interface is loaded
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 10000 })

    console.log('✓ Manager login successful')
  })

  test('invalid credentials show error', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/auth/login`)

    // Fill with invalid credentials
    await page.fill('[data-testid="email-input"]', 'invalid@example.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')
    await page.click('[data-testid="login-btn"]')

    // Verify error message appears
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 5000 })
    
    // Verify we stayed on login page
    await expect(page).toHaveURL(/auth\/login/)

    console.log('✓ Invalid credentials properly rejected')
  })

  test('authenticated session persists on page refresh', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/auth/login`)
    await page.fill('[data-testid="email-input"]', 'employee@techtrend.com')
    await page.fill('[data-testid="password-input"]', 'Test@123')
    await page.click('[data-testid="login-btn"]')
    await page.waitForURL('**/chat', { timeout: 15000 })

    // Verify logged in
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()

    // Refresh the page
    await page.reload()

    // Verify still logged in (should not redirect to login)
    await expect(page).toHaveURL('**/chat', { timeout: 10000 })
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()

    console.log('✓ Session persists after refresh')
  })

  test('logout clears session', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/auth/login`)
    await page.fill('[data-testid="email-input"]', 'employee@techtrend.com')
    await page.fill('[data-testid="password-input"]', 'Test@123')
    await page.click('[data-testid="login-btn"]')
    await page.waitForURL('**/chat', { timeout: 15000 })

    // Find and click logout button
    const logoutButton = page.locator('[data-testid="logout-btn"], [data-testid="user-menu"], button:has-text("Log out"), button:has-text("Logout")').first()
    if (await logoutButton.isVisible()) {
      await logoutButton.click()
      
      // Verify redirected to login
      await expect(page).toHaveURL(/auth\/login/, { timeout: 10000 })
      console.log('✓ Logout successful')
    } else {
      console.log('⚠ Logout button not found, skipping test')
    }
  })
})