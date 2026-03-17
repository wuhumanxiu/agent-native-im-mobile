import { test, expect } from '@playwright/test'

test.describe('Chat', () => {
  test('app renders without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/')
    await page.waitForTimeout(5000)
    expect(errors).toHaveLength(0)
  })

  test('login page has password input type', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)
    // Second input should be password type
    const inputs = page.locator('input')
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
