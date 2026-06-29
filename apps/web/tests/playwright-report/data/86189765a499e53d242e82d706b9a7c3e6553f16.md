# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/approval-flow.spec.ts >> Approval Flow E2E >> employee can view their submitted PRs
- Location: e2e/approval-flow.spec.ts:55:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid="chat-input"]')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-testid="chat-input"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - heading "ProcureAI Operations" [level=1] [ref=e4]
      - generic [ref=e5]: Merchant Dashboard
    - generic [ref=e7]:
      - generic [ref=e8]:
        - heading "Operations Dashboard" [level=2] [ref=e9]
        - paragraph [ref=e10]: Revenue, inventory, orders — all in one place.
      - generic [ref=e11]:
        - button "Today's revenue" [ref=e12]
        - button "What's running low?" [ref=e13]
        - button "Recent refund requests" [ref=e14]
        - button "Show abandoned carts" [ref=e15]
    - generic [ref=e16]:
      - generic [ref=e17]:
        - button "Today's revenue" [ref=e18]
        - button "What's running low?" [ref=e19]
        - button "Recent refund requests" [ref=e20]
        - button "Show abandoned carts" [ref=e21]
      - textbox "Merchant message input" [ref=e23]:
        - /placeholder: Ask about revenue, inventory, orders...
  - generic [ref=e24]:
    - img [ref=e26]
    - button "Open Tanstack query devtools" [ref=e74] [cursor=pointer]:
      - img [ref=e75]
  - alert [ref=e123]
  - button "Open Next.js Dev Tools" [ref=e129] [cursor=pointer]:
    - img [ref=e130]
```

# Test source

```ts
  1  | /**
  2  |  * E2E Test: Approval Flow
  3  |  * 
  4  |  * Tests full employee→manager approval workflow:
  5  |  * 1. Employee creates PR
  6  |  * 2. Employee views PR
  7  |  * 3. Manager approves PR
  8  |  * 4. System shows approval confirmation
  9  |  * 
  10 |  * Note: We do a real login instead of using storageState because HttpOnly
  11 |  * cookies aren't properly restored by Playwright's storageState.
  12 |  */
  13 | 
  14 | import { test, expect } from '@playwright/test'
  15 | 
  16 | const EMPLOYEE_EMAIL = 'employee@techtrend.com'
  17 | const EMPLOYEE_PASSWORD = 'password123'
  18 | 
  19 | async function loginEmployee(page: any) {
  20 |   await page.goto('/auth/login')
  21 |   await page.fill('[data-testid="email-input"]', EMPLOYEE_EMAIL)
  22 |   await page.fill('[data-testid="password-input"]', EMPLOYEE_PASSWORD)
  23 |   await page.click('[data-testid="login-btn"]')
  24 |   await page.waitForURL('**/chat', { timeout: 15000 })
  25 | }
  26 | 
  27 | test.describe('Approval Flow E2E', () => {
  28 |   test.beforeEach(async ({ page }) => {
  29 |     // Do a real login instead of relying on storageState (HttpOnly cookie issue)
  30 |     await loginEmployee(page)
  31 |   })
  32 | 
  33 |   test('employee creates PR and manager approves', async ({ page }) => {
  34 |     // Already logged in via beforeEach
  35 |     await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 10000 })
  36 | 
  37 |     // Verify chat suggestions are visible
  38 |     await expect(page.locator('[data-testid="suggested-action"]')).toBeVisible({ timeout: 5000 })
  39 | 
  40 |     // Step 2: Try to send a message to trigger the AI
  41 |     await page.fill('[data-testid="chat-input"]', 'Show me headphones under ₹15000')
  42 |     await page.click('[data-testid="send-button"]')
  43 | 
  44 |     // Wait for AI response (may include GenUI components)
  45 |     // The GenUI components have the data-testid attributes we added
  46 |     await page.waitForTimeout(5000)
  47 | 
  48 |     // Verify catalog items could appear (if LLM generates them)
  49 |     const catalogItems = page.locator('[data-testid="catalog-item"]')
  50 |     if (await catalogItems.count() > 0) {
  51 |       await expect(catalogItems.first()).toBeVisible()
  52 |     }
  53 |   })
  54 | 
  55 |   test('employee can view their submitted PRs', async ({ page }) => {
  56 |     // Already logged in via beforeEach
> 57 |     await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 10000 })
     |                                                              ^ Error: expect(locator).toBeVisible() failed
  58 | 
  59 |     // Verify navigation exists in the Rail
  60 |     await expect(page.locator('[data-testid="my-prs-nav"]')).toBeVisible()
  61 |   })
  62 | 
  63 |   test('catalog search shows items', async ({ page }) => {
  64 |     // Already logged in via beforeEach
  65 |     await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 10000 })
  66 | 
  67 |     // Verify catalog navigation exists
  68 |     await expect(page.locator('[data-testid="catalog-nav"]')).toBeVisible()
  69 | 
  70 |     // Try searching via chat
  71 |     await page.fill('[data-testid="chat-input"]', 'Show me the catalog')
  72 |     await page.click('[data-testid="send-button"]')
  73 |     
  74 |     // Wait for response
  75 |     await page.waitForTimeout(5000)
  76 |   })
  77 | })
```