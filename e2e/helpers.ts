import { type Page, expect } from '@playwright/test'

const E2E_USERNAME = process.env.E2E_USERNAME || 'chris'
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'Admin@123456'

export async function login(page: Page, username?: string, password?: string) {
  await page.goto('/')
  await page.waitForTimeout(3000)
  // RN web renders TextInput as <input> in the static export
  const inputs = page.locator('input')
  await expect(inputs.first()).toBeVisible({ timeout: 10000 })
  await inputs.nth(0).fill(username || E2E_USERNAME)
  await inputs.nth(1).fill(password || E2E_PASSWORD)
  // Click sign in button
  const signInBtn = page.getByText(/sign in|login|登录/i).first()
  await signInBtn.click()
  await page.waitForTimeout(4000)
}

export async function waitForApp(page: Page) {
  await page.waitForTimeout(2000)
}
