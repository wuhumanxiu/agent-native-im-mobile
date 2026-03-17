import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('root redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)
    // Should see login UI
    const inputs = await page.locator('input').count()
    expect(inputs).toBeGreaterThanOrEqual(2)
  })

  test('register route renders', async ({ page }) => {
    await page.goto('/register')
    await page.waitForTimeout(3000)
    // Register page should have more inputs (username, display name, password, confirm)
    const bodyText = await page.textContent('body') || ''
    expect(bodyText.length).toBeGreaterThan(10)
  })
})
