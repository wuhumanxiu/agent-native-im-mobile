import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:19006',
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
    actionTimeout: 15000,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...{} } },
  ],
})
