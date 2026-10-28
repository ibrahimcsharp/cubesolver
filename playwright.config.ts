import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const HEAVY = /(export|video-upload)\.spec\.ts$/

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: HEAVY,
    },
    {
      // Video encoding/decoding uses a lot of CPU; run these after the rest so
      // the timing-sensitive tests (animations, live checks) aren't starved.
      name: 'heavy',
      use: { ...devices['Desktop Chrome'] },
      testMatch: HEAVY,
      dependencies: ['chromium'],
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
