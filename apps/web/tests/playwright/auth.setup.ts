/**
 * Playwright Authentication Setup
 * 
 * Uses UI login to properly set all Supabase cookies (not just localStorage).
 * This ensures middleware sees the session.
 */

import { test as setup } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const AUTH_DIR     = path.join(__dirname, '.auth')
const EMPLOYEE_FILE = path.join(AUTH_DIR, 'employee.json')
const MANAGER_FILE  = path.join(AUTH_DIR, 'manager.json')

fs.mkdirSync(AUTH_DIR, { recursive: true })

setup('authenticate employee', async ({ page, baseURL }) => {
  console.log('\n=== Authenticating Employee via UI ===')
  await page.goto(`${baseURL}/auth/login`)
  await page.fill('[data-testid="email-input"]',    'employee@techtrend.com')
  await page.fill('[data-testid="password-input"]', 'password123')
  await page.click('[data-testid="login-btn"]')
  await page.waitForURL('**/chat', { timeout: 15000 })
  await page.context().storageState({ path: EMPLOYEE_FILE })
  console.log('✓ Employee authenticated')
})

setup('authenticate manager', async ({ page, baseURL }) => {
  console.log('\n=== Authenticating Manager via UI ===')
  await page.goto(`${baseURL}/auth/login`)
  await page.fill('[data-testid="email-input"]',    'manager@techtrend.com')
  await page.fill('[data-testid="password-input"]', 'password123')
  await page.click('[data-testid="login-btn"]')
  await page.waitForURL('**/chat', { timeout: 15000 })
  await page.context().storageState({ path: MANAGER_FILE })
  console.log('✓ Manager authenticated')
})