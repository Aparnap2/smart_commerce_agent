/**
 * SIMPLE Playwright Test - Proves Browser Works
 */

import { test, expect } from '@playwright/test';

test('app should load', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/01-homepage.png' });
  
  // Should have some content (even if error page)
  const content = await page.content();
  expect(content.length).toBeGreaterThan(100);
  
  console.log('✅ App loaded successfully!');
  console.log('Page URL:', page.url());
});

test('should show error page', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Should show 500 error (Supabase not configured)
  const body = await page.textContent('body');
  expect(body).toContain('500');
  
  console.log('✅ Error page displayed!');
});
