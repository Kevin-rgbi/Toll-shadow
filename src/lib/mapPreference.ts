/**
 * Renderer choice, carried in the URL.
 *
 * `?map=software` forces the WebGL-free raster map, `?map=gpu` forces the attempt to start
 * MapLibre, and anything else leaves the automatic choice alone. It lives in `lib` rather than in the
 * map component because it is view state: the URL writer has to preserve it, and a lazy-loaded
 * component must not be the only thing that reads it (by the time it mounts, the address bar has
 * already been rewritten).
 */

export type MapPreference = 'software' | 'gpu'

/**
 * MapLibre GL v6 needs a WebGL2 context. A browser with hardware acceleration switched off cannot
 * provide one and, unlike headless Chrome, does not fall back to software WebGL, so this probe is the
 * difference between the GPU map and the raster map.
 */
export const hasWebGL2Support = (): boolean => {
  try {
    const canvas = document.createElement('canvas')
    return canvas.getContext('webgl2') !== null
  } catch {
    return false
  }
}

export const isMapPreference = (value: string | null): value is MapPreference => {
  return value === 'software' || value === 'gpu'
}

export const readMapPreference = (search: string): MapPreference | null => {
  const value = new URLSearchParams(search).get('map')
  return isMapPreference(value) ? value : null
}

export const readMapPreferenceFromLocation = (): MapPreference | null => {
  if (typeof window === 'undefined') return null
  return readMapPreference(window.location.search)
}
