import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: false,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    timeout: 30000,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'ui',
      testMatch: '**/*.spec.js',
    },
    {
      name: 'wallet',
      testMatch: '**/*.spec.mjs',
      use: {
        headless: false,
      },
    },
  ],
})
