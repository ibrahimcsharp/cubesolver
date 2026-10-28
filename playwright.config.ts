import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
/** Fake-webcam tests: the app analyzes ~15 frames a second, which keeps a CPU core busy. */
const CAMERA = /(webcam-scan|webcam-robust|dim-scan|live-guide)\.spec\.ts$/
/** Video encoding/decoding: very CPU-hungry. */
const HEAVY = /(export|video-upload)\.spec\.ts$/

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Several of the tests are timing-sensitive (animations, "hold still" checks);
  // running only 2 browsers at a time keeps them from starving each other.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  // Run in three groups, one after the other: ordinary tests, then camera
  // tests, then video tests.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [CAMERA, HEAVY],
    },
    {
      name: 'camera',
      use: { ...devices['Desktop Chrome'] },
      testMatch: CAMERA,
      dependencies: ['chromium'],
    },
    {
      name: 'heavy',
      use: { ...devices['Desktop Chrome'] },
      testMatch: HEAVY,
      dependencies: ['camera'],
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
