import { configDefaults, defineConfig } from 'vitest/config'

/**
 * Unit and pipeline test configuration.
 *
 * Vitest's default glob would also collect `tests/e2e`, which imports `@playwright/test` and expects a
 * browser the unit runner does not provide, so the end-to-end suite is excluded here and run by its
 * own command instead.
 */
export default defineConfig({
  test: {
    env: {
      VITE_USE_DEMO_DATA: 'false',
    },
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
})
