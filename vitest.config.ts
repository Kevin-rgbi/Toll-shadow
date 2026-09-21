import { configDefaults, defineConfig } from 'vitest/config'

/**
 * Unit and pipeline test configuration.
 *
 * Vitest's default glob would also collect `tests/e2e`, which imports `@playwright/test` and expects a
 * browser the unit runner does not provide, so the end-to-end suite is excluded here and run by its
 * own command instead.
 */
export default defineConfig({
  // The JSX runtime is set here so a test can render a component the way the application does.
  // Standalone, this config does not inherit the app's Vite plugins, so JSX in a `.tsx` test compiled
  // to the classic runtime and failed with "React is not defined" - an error that names the wrong
  // problem and sends the reader looking at React rather than at this file.
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  test: {
    env: {
      VITE_USE_DEMO_DATA: 'false',
    },
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
})
