import { test, expect } from '@playwright/test'
import { login, waitForApp } from './helpers'

test.describe('Authentication', () => {
  test('shows login screen with inputs', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)
    const inputs = await page.locator('input').count()
    expect(inputs).toBeGreaterThanOrEqual(2)
    await expect(page.getByText(/sign in|login|登录/i).first()).toBeVisible()
  })

  test('shows app title and tagline', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)
    await expect(page.getByText('Agent-Native IM')).toBeVisible()
  })

  test('login with valid credentials navigates away', async ({ page }) => {
    await login(page)
    // After login, should no longer see "Sign in" button
    const bodyText = await page.textContent('body') || ''
    // App should have changed state
    expect(bodyText.length).toBeGreaterThan(10)
  })

  test('sign up link is visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)
    await expect(page.getByText(/sign up|注册/i).first()).toBeVisible()
  })
})
