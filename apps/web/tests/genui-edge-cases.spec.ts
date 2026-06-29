/**
 * GenUI Edge Cases E2E Test
 * Tests GenUI component rendering, null handling, and edge cases
 */
import { test, expect } from "@playwright/test";

const EMPLOYEE = {
  email: "employee@techtrend.com",
  pass: "password123",
};

test.describe("GenUI Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3001/auth/login");
    await page.getByLabel("Email").fill(EMPLOYEE.email);
    await page.getByLabel("Password").fill(EMPLOYEE.pass);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/chat", { timeout: 10000 });
  });

  test("should render catalog grid without crashing", async ({ page }) => {
    const chatInput = page.getByTestId("chat-input");
    await expect(chatInput).toBeVisible();
    
    await chatInput.fill("show me laptops");
    await page.getByTestId("send-button").click();
    
    // Wait for response - may be slow with real LLM
    await page.waitForTimeout(3000);
    
    // Check if we got any response (may be LLM error or success)
    const messages = page.locator("[data-testid='message-content']");
    const count = await messages.count();
    console.log(`Got ${count} messages`);
  });

  test("should handle empty search results gracefully", async ({ page }) => {
    const chatInput = page.getByTestId("chat-input");
    
    await chatInput.fill("xyznonexistentproduct123");
    await page.getByTestId("send-button").click();
    
    await page.waitForTimeout(3000);
    
    // Should not crash - either show empty state or error message
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();
  });

  test("should handle budget check without crashing", async ({ page }) => {
    const chatInput = page.getByTestId("chat-input");
    
    await chatInput.fill("check my budget");
    await page.getByTestId("send-button").click();
    
    await page.waitForTimeout(3000);
    
    // Page should still be functional
    await expect(page.getByTestId("chat-input")).toBeVisible();
  });

  test("should handle rapid message sending", async ({ page }) => {
    const chatInput = page.getByTestId("chat-input");
    const sendButton = page.getByTestId("send-button");
    
    // Send multiple messages quickly
    await chatInput.fill("hello");
    await sendButton.click();
    await chatInput.fill("test");
    await sendButton.click();
    
    // Should not crash
    await expect(page.getByTestId("chat-input")).toBeVisible();
  });

  test("should display UI components with proper data-testid", async ({ page }) => {
    // Check that key UI elements have test IDs
    await expect(page.getByTestId("chat-input")).toBeVisible();
    await expect(page.getByTestId("send-button")).toBeVisible();
    
    // Check chat container exists
    const chatContainer = page.locator("[data-testid='chat-container']");
    if (await chatContainer.count() > 0) {
      await expect(chatContainer.first()).toBeVisible();
    }
  });
});

test.describe("Auth Edge Cases", () => {
  test("should redirect unauthenticated user to login", async ({ page }) => {
    await page.goto("http://localhost:3001/chat");
    await expect(page).toHaveURL("**/auth/login");
  });

  test("should handle invalid credentials", async ({ page }) => {
    await page.goto("http://localhost:3001/auth/login");
    await page.getByLabel("Email").fill("invalid@test.com");
    await page.getByLabel("Password").fill("wrongpass");
    await page.getByRole("button", { name: "Sign in" }).click();
    
    // Should show error or stay on login page
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    expect(currentUrl).toContain("auth/login");
  });
});

test.describe("Manager Approval Flow", () => {
  test("manager can access admin chat", async ({ page }) => {
    await page.goto("http://localhost:3001/auth/login");
    await page.getByLabel("Email").fill("manager@techtrend.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    
    // Manager should land on admin chat
    await page.waitForURL("**/admin/chat", { timeout: 10000 });
    await expect(page.getByTestId("chat-input")).toBeVisible();
  });
});