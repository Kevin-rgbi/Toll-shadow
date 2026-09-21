import { lazy } from 'react'

/**
 * The development-only panels, loaded behind a flag the bundler can follow.
 *
 * These render only when a synthetic dataset is loaded, which a production build never does, so they
 * must not reach the production bundle. A plain `import()` does not achieve that: Vite resolves every
 * dynamic import it can see and emits a chunk for it whether or not the branch holding it is
 * reachable, which made the bundle larger rather than smaller when it was tried.
 *
 * `@vite-ignore` leaves the specifier alone, so each call is an ordinary expression inside a branch
 * that constant-folds to `false` in a production build, and the bundler drops the whole thing. The
 * plugin lives here rather than in `App.tsx` so the application component does not carry the
 * development surface, and so this file can be read on its own when that behaviour is in question.
 */

const devPanel = <T,>(specifier: string, exportName: string): T | null => {
  if (!import.meta.env.DEV) return null
  return lazy(async () => {
    const loaded = (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>
    return { default: loaded[exportName] as never }
  }) as unknown as T
}

export const DevConfidencePanel = devPanel<typeof import('../components/Detail/ConfidencePanel').ConfidencePanel>(
  '../components/Detail/ConfidencePanel', 'ConfidencePanel',
)

export const DevHotspotStack = devPanel<typeof import('./DevHotspotStack').DevHotspotStack>(
  './DevHotspotStack', 'DevHotspotStack',
)
