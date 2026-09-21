/**
 * Build identity.
 *
 * A browser can keep serving an old bundle long after a deploy, and the running app has no way to
 * know that from the inside. Stamping the build into the page makes it visible: the stamp is what
 * the reviewer's browser actually executed, so comparing it with a shared link's `?v=` value answers
 * "is my browser cache the problem?" directly.
 */

declare const __BUILD_ID__: string

export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' && __BUILD_ID__ !== ''
  ? __BUILD_ID__
  : 'unversioned'

export const BUILD_PARAM = 'v'

/** The build a shared link was generated from, or null when the link carries no version. */
export const readExpectedBuildId = (search: string): string | null => {
  const value = new URLSearchParams(search).get(BUILD_PARAM)
  if (!value) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export const isStaleBuild = (expectedBuildId: string | null): boolean => {
  return expectedBuildId !== null && expectedBuildId !== BUILD_ID
}

export const readExpectedBuildIdFromLocation = (): string | null => {
  if (typeof window === 'undefined') return null
  return readExpectedBuildId(window.location.search)
}

declare const __MAPLIBRE_WORKER_URL__: string

/**
 * Where this build's MapLibre worker lives. Empty in development, where the library resolves its
 * worker from node_modules. Production builds place it under a build-stamped path so a client that
 * cached a failing request for an older build cannot break a newer one.
 */
export const MAPLIBRE_WORKER_URL = typeof __MAPLIBRE_WORKER_URL__ === 'string' ? __MAPLIBRE_WORKER_URL__ : ''
