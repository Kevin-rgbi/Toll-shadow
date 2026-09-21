import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end configuration.
 *
 * The suite runs against the built site served by `vite preview`, not the dev server: the dev server
 * resolves modules differently, serves the manifest from the pipeline's working copy, and never
 * exercises the worker emission or the immutable-release paths that the acceptance criteria rest on.
 * CI sets E2E_BASE_URL to reuse a server it already started; locally the config starts one.
 */
const PORT = Number(process.env.E2E_PORT ?? 4178)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  // Failure artifacts are text-only by request: this project does not use screenshot capture.
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run preview -- --port ${PORT} --strictPort`,
        env: { ...process.env, VITE_USE_DEMO_DATA: 'false' },
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
