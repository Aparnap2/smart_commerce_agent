/**
 * Playwright Configuration
 * 
 * Supports multiple authentication scenarios:
 * - setup: Creates authentication state files for reuse
 * - employee: Tests running as employee user
 * - manager: Tests running as manager user
 * 
 * Usage:
 *   npx playwright test --project=setup        # Create auth state files
 *   npx playwright test --project=employee      # Run tests as employee
 *   npx playwright test --project=manager        # Run tests as manager
 *   npx playwright test                         # Run all projects
 */

import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005'
const supabaseAuthURL = process.env.SUPABASE_AUTH_URL || 'http://localhost:9999/token?grant_type=password'

export default defineConfig({
  // Test directory
  testDir: './',

  // Fully parallelize tests within a project
  fullyParallel: true,

  // Fail build on CI if test fails
  forbidOnly: !!process.env.CI,

  // Retry failed tests (more on CI)
  retries: process.env.CI ? 2 : 0,

  // Workers (parallel processes)
  workers: process.env.CI ? 1 : undefined,

  // Reporter
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],

  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL,

    // Collect screenshots on failure
    screenshot: 'only-on-failure',

    // Collect videos on failure
    video: 'retain-on-failure',

    // Trace on failure
    trace: 'on-first-retry',

    // Navigation timeout
    navigationTimeout: 30000,

    // Action timeout
    actionTimeout: 10000,
  },

  // Configure projects with different auth scenarios
  projects: [
    {
      // Setup project: Creates auth state files
      name: 'setup',
      testDir: './playwright',
      testMatch: 'auth.setup.ts',
      use: {
        baseURL,
      },
      // Setup runs first, no dependencies
      dependencies: [],
    },

    {
      // Employee project: Uses pre-created employee auth state
      name: 'employee',
      testDir: './e2e',
      use: {
        baseURL,
        // Load authentication state from file
        storageState: path.join(__dirname, 'playwright/.auth/employee.json'),
      },
      // Depends on setup to ensure auth state exists
      dependencies: ['setup'],
    },

    {
      // Manager project: Uses pre-created manager auth state
      name: 'manager',
      testDir: './e2e',
      use: {
        baseURL,
        // Load authentication state from file
        storageState: path.join(__dirname, 'playwright/.auth/manager.json'),
      },
      // Depends on setup to ensure auth state exists
      dependencies: ['setup'],
    },

    // Dev mode: Run e2e tests without pre-auth (for development)
    {
      name: 'dev',
      testDir: './e2e',
      use: {
        baseURL,
        // No storage state - login via UI
      },
    },

    // Mobile simulation
    {
      name: 'mobile',
      testDir: './e2e',
      use: {
        baseURL,
        ...devices['iPhone 12'],
      },
    },
  ],
})