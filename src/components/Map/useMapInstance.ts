import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import * as maplibregl from 'maplibre-gl'
import { MAPLIBRE_WORKER_URL } from '../../lib/buildInfo'
import {
  GPU_RENDER_WATCHDOG_MS,
  MAP_CONTEXT_LOST_MESSAGE,
  MAP_NO_TILES_MESSAGE,
  MAP_START_FAILURE_PREFIX,
  NYC_BASEMAP_STYLE,
  NYC_BOUNDS,
  NYC_CENTER,
} from './mapConfig'
import { findHitTarget } from './mapOverlay'
import type { HitTarget } from './mapOverlay'

/**
 * The map's lifecycle: construction, the render watchdog, event wiring, and teardown.
 *
 * Everything here is about the MapLibre instance itself, not about what is drawn on it, which is why
 * it is separable from the component. The watchdog is the part worth keeping honest: a GPU map can
 * accept a context, load its style, report itself loaded, and still paint nothing, and the only signal
 * is whether background tiles actually arrived.
 */

export interface MapInstanceRefs {
  containerRef: MutableRefObject<HTMLDivElement | null>
  mapRef: MutableRefObject<maplibregl.Map | null>
  overlayRef: MutableRefObject<HTMLCanvasElement | null>
  hitTargetsRef: MutableRefObject<HitTarget[]>
  transitionAnimationFrameRef: MutableRefObject<number | null>
  focusIndicatorTimeoutRef: MutableRefObject<number | null>
}

export interface MapInstanceHandlers {
  /** Draws a frame of the prototype overlay and refreshes its hit targets. */
  drawOverlay: () => void
  setMapReady: Dispatch<SetStateAction<boolean>>
  setMapFallbackMessage: Dispatch<SetStateAction<string | null>>
  setHoveredTarget: Dispatch<SetStateAction<HitTarget | null>>
  setSelectedTarget: Dispatch<SetStateAction<HitTarget | null>>
}

export const useMapInstance = (
  refs: MapInstanceRefs,
  handlers: MapInstanceHandlers,
  mapFallbackMessage: string | null,
): void => {
  useEffect(() => {
    const {
      containerRef,
      mapRef,
      overlayRef,
      hitTargetsRef,
      transitionAnimationFrameRef,
      focusIndicatorTimeoutRef,
    } = refs
    const { drawOverlay, setMapReady, setMapFallbackMessage, setHoveredTarget, setSelectedTarget } = handlers

    if (!containerRef.current || mapFallbackMessage) {
      return
    }

    let map: maplibregl.Map

    // Point MapLibre at this build's worker before the map is constructed. Without it the library
    // resolves a fixed sibling path that can carry a cached failure across builds.
    if (MAPLIBRE_WORKER_URL) {
      maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL)
    }

    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: NYC_BASEMAP_STYLE,
        center: NYC_CENTER,
        zoom: 10,
        minZoom: 8.8,
        maxZoom: 16,
        maxBounds: NYC_BOUNDS,
        attributionControl: { compact: true },
      })
    } catch (error) {
      // Report the real reason. Conflating "no WebGL2" with "the library threw" sends anyone
      // debugging this to the wrong place.
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      window.requestAnimationFrame(() => {
        setMapFallbackMessage(`${MAP_START_FAILURE_PREFIX}${reason}`)
      })
      return
    }

    mapRef.current = map

    if (import.meta.env.DEV) {
      // Development-only handle for inspecting sources, layers and paint at runtime. Guarded so it
      // never reaches a production bundle.
      ;(window as unknown as { __maplibre?: maplibregl.Map }).__maplibre = map
    }

    // A GPU map can accept a context and still paint nothing: the style loads, the map reports
    // loaded, and the canvas stays blank. Nothing throws, so the only way to catch it is to check
    // whether background tiles actually arrived.
    const watchdog = window.setTimeout(() => {
      if (mapRef.current !== map) return
      if (!map.areTilesLoaded() || !map.isSourceLoaded('openstreetmap')) {
        setMapFallbackMessage(MAP_NO_TILES_MESSAGE)
      }
    }, GPU_RENDER_WATCHDOG_MS)

    const clearWatchdog = () => {
      window.clearTimeout(watchdog)
    }

    map.once('idle', clearWatchdog)

    const canvas = map.getCanvas()
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      clearWatchdog()
      setMapFallbackMessage(MAP_CONTEXT_LOST_MESSAGE)
    }
    canvas.addEventListener('webglcontextlost', handleContextLost)

    const overlay = document.createElement('canvas')
    overlay.className = 'map-road-overlay'
    map.getCanvasContainer().appendChild(overlay)
    overlayRef.current = overlay

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'bottom-right',
    )

    const redraw = () => {
      drawOverlay()
    }

    const markMapReady = () => {
      setMapReady(true)
      redraw()
    }

    if (map.isStyleLoaded()) {
      markMapReady()
    } else {
      map.once('load', markMapReady)
    }

    map.on('move', redraw)
    map.on('zoom', redraw)
    map.on('rotate', redraw)
    map.on('pitch', redraw)
    map.on('resize', redraw)

    const handlePointerMove = (event: maplibregl.MapMouseEvent) => {
      const hit = findHitTarget(hitTargetsRef.current, { x: event.point.x, y: event.point.y }, 'strict')
      setHoveredTarget((current) => {
        if (current?.key === hit?.key) return current
        return hit
      })
      map.getCanvas().style.cursor = hit ? 'pointer' : ''
    }

    const handlePointerOut = () => {
      setHoveredTarget(null)
      map.getCanvas().style.cursor = ''
    }

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      const hit = findHitTarget(hitTargetsRef.current, { x: event.point.x, y: event.point.y }, 'nearest')
      if (!hit) {
        setSelectedTarget(null)
        return
      }

      setSelectedTarget((current) => {
        if (current?.key === hit.key) return null
        return hit
      })
    }

    map.on('mousemove', handlePointerMove)
    map.on('mouseout', handlePointerOut)
    map.on('click', handleClick)

    return () => {
      // These two ids are read at cleanup time on purpose: both are assigned after the effect has run,
      // so capturing them during setup would cancel the wrong frame. The lint rule cannot see that, and
      // its suggested fix would introduce the bug it exists to prevent.
      const transitionFrame = transitionAnimationFrameRef.current
      if (transitionFrame !== null) {
        window.cancelAnimationFrame(transitionFrame)
      }
      const focusTimeout = focusIndicatorTimeoutRef.current
      if (focusTimeout !== null) {
        window.clearTimeout(focusTimeout)
      }
      clearWatchdog()
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      map.off('move', redraw)
      map.off('zoom', redraw)
      map.off('rotate', redraw)
      map.off('pitch', redraw)
      map.off('resize', redraw)
      map.off('mousemove', handlePointerMove)
      map.off('mouseout', handlePointerOut)
      map.off('click', handleClick)
      overlay.remove()
      overlayRef.current = null
      mapRef.current = null
      map.remove()
    }
    // `refs` and `handlers` are stable objects (see the caller), so this re-runs exactly when the
    // fallback decision changes -- the condition it ran under before the extraction, with no extra
    // rebuilds of the map. `handlers.drawOverlay` changes identity only when the drawing callback does.
  }, [refs, handlers, mapFallbackMessage])
}