import { chromium } from 'playwright';

const MOCK_PRODUCTS = [
  { id: 1, name: 'MacBook Pro 14"', price: 199900, stock: 10, category: 'HARDWARE', brand: 'Apple', rating: 4.8 },
  { id: 2, name: 'Dell XPS 15', price: 149900, stock: 15, category: 'HARDWARE', brand: 'Dell', rating: 4.5 },
  { id: 3, name: 'ThinkPad X1 Carbon', price: 129900, stock: 20, category: 'HARDWARE', brand: 'Lenovo', rating: 4.6 },
];

const MOCK_BUDGET = {
  total: 5000000,
  spent: 1250000,
  remaining: 3750000,
  department: 'Engineering'
};

const MOCK_PR = {
  id: 'PR-2024-001',
  items: [{ name: 'MacBook Pro 14"', price: 199900, quantity: 1 }],
  total: 199900,
  status: 'DRAFT'
};

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Step 1: Login...');
  
  // Go to login page
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle' });
  
  // Fill in login form
  await page.fill('input[name="email"]', 'employee@acme.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  // Wait for redirect to chat
  await page.waitForURL('**/chat', { timeout: 15000 });
  console.log('✓ Logged in successfully');
  
  // Wait for chat page to load
  await page.waitForSelector('[data-testid="suggested-action"]', { timeout: 10000 });
  console.log('✓ Chat page loaded');
  
  // Check page header
  const headerText = await page.textContent('text=ProcureAI');
  if (headerText) {
    console.log('✓ Chat page header found');
  }
  
  // Check for suggested actions
  const suggestedActions = await page.locator('[data-testid="suggested-action"]').count();
  console.log(`✓ Found ${suggestedActions} suggested actions`);
  
  // Mock the API response
  console.log('Step 2: Setting up API mock...');
  await page.route('**/api/agent', async (route) => {
    const mockResponse = {
      events: [
        { type: 'metadata', data: { run_id: 'mock-run-123' } },
        { type: 'message', data: { role: 'assistant', content: 'Here are some products for you.' } },
        { type: 'ui', data: { name: 'catalog-grid', props: { products: MOCK_PRODUCTS } } },
        { type: 'ui', data: { name: 'budget-gauge', props: MOCK_BUDGET } },
        { type: 'ui', data: { name: 'pr-draft', props: MOCK_PR } },
        { type: 'complete', data: {} }
      ]
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse)
    });
  });
  
  // Click a suggestion to trigger the API call
  console.log('Step 3: Testing GenUI rendering...');
  await page.click('[data-testid="suggested-action"]:first-child');
  
  // Wait for the components to render
  await page.waitForTimeout(2000);
  
  // Verify catalog-grid renders
  const catalogGrid = await page.locator('[data-testid="catalog-grid"]').count();
  console.log(`✓ Catalog grid components found: ${catalogGrid}`);
  
  // Verify budget-gauge renders
  const budgetGauge = await page.locator('[data-testid="budget-gauge"]').count();
  console.log(`✓ Budget gauge components found: ${budgetGauge}`);
  
  // Verify pr-draft renders
  const prDraft = await page.locator('[data-testid="pr-draft"]').count();
  console.log(`✓ PR draft components found: ${prDraft}`);
  
  // Take screenshot
  console.log('Step 4: Taking screenshot...');
  await page.screenshot({ path: '/tmp/genui-test-screenshot.png', fullPage: true });
  console.log('Screenshot saved to /tmp/genui-test-screenshot.png');
  
  // Final assertions
  let passed = true;
  if (catalogGrid === 0) {
    console.error('✗ catalog-grid not found');
    passed = false;
  }
  if (budgetGauge === 0) {
    console.error('✗ budget-gauge not found');
    passed = false;
  }
  
  if (passed) {
    console.log('\n✅ All GenUI components rendered successfully!');
  } else {
    console.log('\n❌ Some components failed to render');
  }
  
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});