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

/**
 * Which WebGL implementation the browser actually handed us, as reported by the driver. Returns null
 * when the context or the debug extension is unavailable.
 *
 * This matters because a context existing is not the same as a context drawing: a software
 * rasterizer can hand out a WebGL2 context and then paint nothing, which leaves a blank map with no
 * error anywhere.
 */
export const readWebGLRenderer = (): string | null => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return null
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER)
    return typeof renderer === 'string' && renderer.trim() !== '' ? renderer.trim() : null
  } catch {
    return null
  }
}

/** Software rasterizers: they give a context, but a GPU renderer is not what is behind it. */
const SOFTWARE_RENDERER_PATTERN = /swiftshader|llvmpipe|software|basic render|microsoft basic|mesa offscreen|lavapipe/i

export const isSoftwareRenderer = (renderer: string | null): boolean => {
  return renderer !== null && SOFTWARE_RENDERER_PATTERN.test(renderer)
}

export interface RendererDecision {
  /** Which map to start with. */
  path: 'gpu' | 'software'
  /** Why the software map was chosen, phrased for the reader. Null when the GPU map is used. */
  reason: string | null
  /** The WebGL renderer string, when one could be read. */
  renderer: string | null
}

/**
 * Decide the starting renderer. An explicit URL preference always wins; otherwise the GPU map is used
 * only when there is a WebGL2 context behind a real driver, because a software context can produce a
 * blank canvas rather than an error.
 */
export const resolveRenderer = (preference: MapPreference | null): RendererDecision => {
  const renderer = readWebGLRenderer()

  if (preference === 'software') {
    return { path: 'software', reason: 'Software map requested with ?map=software.', renderer }
  }

  if (!hasWebGL2Support()) {
    return {
      path: 'software',
      reason: 'This browser could not provide a WebGL2 context. chrome://gpu reports why.',
      renderer,
    }
  }

  if (preference !== 'gpu' && isSoftwareRenderer(renderer)) {
    return {
      path: 'software',
      reason: `This browser is rendering WebGL in software (${renderer ?? 'unknown renderer'}), which draws an empty map. Enable hardware acceleration in chrome://settings/system to use the GPU map.`,
      renderer,
    }
  }

  return { path: 'gpu', reason: null, renderer }
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
