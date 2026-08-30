import { defineConfig, devices } from '@playwright/test';

/**
 * WCO Frontend — Playwright E2E configuration.
 *
 * The suite is self-contained: critical API calls are intercepted via
 * `page.route` in `tests/e2e/helpers.ts`, so tests run without a live backend.
 * Point `E2E_BASE_URL` at the built app (default http://localhost:3000).
 *
 * Run:
 *   yarn --cwd apps/frontend test:e2e
 *   npx playwright test --project=chromium
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Speed up: all specs run against the mock-API harness.
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start -p 3000',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
