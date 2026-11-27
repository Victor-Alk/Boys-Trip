import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build (vite preview) in demo mode, i.e. the real
 * Apps Script source executed in the browser emulator — no Google account involved.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:4174/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'npx vite build && npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174/',
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
