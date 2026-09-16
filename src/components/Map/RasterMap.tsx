import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FeatureCollection, Geometry, Position } from 'geojson'
import { NYC_BOUNDS, NYC_CENTER } from './mapConfig'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_SIZE,
  clampCenter,
  clampZoom,
  lngLatToWorld,
  projectToScreen,
  tileRangeFor,
  worldToLngLat,
} from './webMercator'

interface RasterMapProps {
  boundary: FeatureCollection | null
  traffic: FeatureCollection | null
  /** Shown when the interactive GPU map could not start, explaining what this is instead. */
  notice?: string | null
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const KEYBOARD_PAN_PX = 80
const INITIAL_ZOOM = 11

/**
 * Tiles rendered beyond the viewport. During a drag the committed view is frozen and the whole layer
 * is translated, so the extra ring is what keeps the edges from going blank mid-drag.
 */
const PAD_TILES = 2

const radiusForVolume = (value: unknown): number => {
  const volume = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return 3 + (Math.max(0, Math.min(volume, 150)) / 150) * 5
}

const opacityForVolume = (value: unknown): number => {
  const volume = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return 0.35 + (Math.max(0, Math.min(volume, 150)) / 150) * 0.5
}

/**
 * WebGL-free map. Raster tiles are positioned with plain CSS and published geometry is drawn as SVG,
 * so a browser without a WebGL2 context still gets a map it can pan and zoom.
 *
 * Dragging does not touch React state. The committed view stays fixed, the whole tile layer is moved
 * with a single transform, and the new centre is committed once on pointer-up. Re-rendering several
 * hundred publication points on every pointer move is what made the earlier version stick.
 */
export function RasterMap({ boundary, traffic, notice }: RasterMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [center, setCenter] = useState<{ lng: number, lat: number }>({
    lng: NYC_CENTER[0],
    lat: NYC_CENTER[1],
  })
  const [zoom, setZoom] = useState(INITIAL_ZOOM)
  const [isDragging, setIsDragging] = useState(false)

  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
  } | null>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const measure = () => {
      const rect = element.getBoundingClientRect()
      setViewport({ width: Math.round(rect.width), height: Math.round(rect.height) })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const applyCenter = useCallback((lng: number, lat: number) => {
    setCenter(clampCenter(lng, lat, NYC_BOUNDS))
  }, [])

  const resetView = useCallback(() => {
    if (layerRef.current) layerRef.current.style.transform = ''
    dragRef.current = null
    setIsDragging(false)
    setCenter({ lng: NYC_CENTER[0], lat: NYC_CENTER[1] })
    setZoom(INITIAL_ZOOM)
  }, [])

  const zoomBy = useCallback((delta: number, anchorX?: number, anchorY?: number) => {
    const nextZoom = clampZoom(zoom + delta)
    if (nextZoom === zoom) return

    const element = containerRef.current
    if (!element || anchorX === undefined || anchorY === undefined) {
      setZoom(nextZoom)
      return
    }

    // Keep the lng/lat under the cursor fixed while the zoom changes. World units equal screen
    // pixels at a given zoom, so the cursor offset is the world offset.
    const rect = element.getBoundingClientRect()
    const offsetX = anchorX - rect.left - rect.width / 2
    const offsetY = anchorY - rect.top - rect.height / 2

    const currentWorld = lngLatToWorld(center.lng, center.lat, zoom)
    const anchorLngLat = worldToLngLat(currentWorld.x + offsetX, currentWorld.y + offsetY, zoom)
    const anchorWorldNext = lngLatToWorld(anchorLngLat.lng, anchorLngLat.lat, nextZoom)
    const nextCenter = worldToLngLat(anchorWorldNext.x - offsetX, anchorWorldNext.y - offsetY, nextZoom)

    applyCenter(nextCenter.lng, nextCenter.lat)
    setZoom(nextZoom)
  }, [applyCenter, center.lat, center.lng, zoom])

  // Wheel zoom is throttled to one committed change per frame; raw wheel events arrive faster than
  // the map can re-render.
  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    let pending: { delta: number, x: number, y: number } | null = null
    let frame = 0

    const flush = () => {
      frame = 0
      if (!pending) return
      const { delta, x, y } = pending
      pending = null
      zoomBy(delta, x, y)
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      pending = {
        delta: (pending?.delta ?? 0) + (event.deltaY < 0 ? 1 : -1),
        x: event.clientX,
        y: event.clientY,
      }
      if (frame === 0) frame = window.requestAnimationFrame(flush)
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', onWheel)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [zoomBy])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
    }
    setIsDragging(true)
  }

  /**
   * Drag listeners live on the window, not the element, so a fast drag that leaves the map still
   * tracks and still commits. This also avoids pointer capture, which throws for pointers the
   * browser no longer considers active.
   */
  useEffect(() => {
    if (!isDragging) return

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      drag.lastX = event.clientX
      drag.lastY = event.clientY
      // Move the layer directly. No state change, no re-render.
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      if (layerRef.current) layerRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
    }

    const onUp = () => {
      const drag = dragRef.current
      dragRef.current = null
      setIsDragging(false)
      if (layerRef.current) layerRef.current.style.transform = ''
      if (!drag) return

      const dx = drag.lastX - drag.startX
      const dy = drag.lastY - drag.startY
      if (dx === 0 && dy === 0) return

      const world = lngLatToWorld(center.lng, center.lat, zoom)
      const next = worldToLngLat(world.x - dx, world.y - dy, zoom)
      applyCenter(next.lng, next.lat)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [applyCenter, center.lat, center.lng, isDragging, zoom])

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const pan = (dx: number, dy: number) => {
      event.preventDefault()
      const world = lngLatToWorld(center.lng, center.lat, zoom)
      const next = worldToLngLat(world.x + dx, world.y + dy, zoom)
      applyCenter(next.lng, next.lat)
    }

    switch (event.key) {
      case 'ArrowLeft': pan(-KEYBOARD_PAN_PX, 0); break
      case 'ArrowRight': pan(KEYBOARD_PAN_PX, 0); break
      case 'ArrowUp': pan(0, -KEYBOARD_PAN_PX); break
      case 'ArrowDown': pan(0, KEYBOARD_PAN_PX); break
      case '+':
      case '=': event.preventDefault(); zoomBy(1); break
      case '-':
      case '_': event.preventDefault(); zoomBy(-1); break
      case 'Home': event.preventDefault(); resetView(); break
      default: break
    }
  }

  const tileGrid = useMemo(() => {
    if (viewport.width === 0 || viewport.height === 0) return null
    return tileRangeFor(
      center.lng,
      center.lat,
      zoom,
      viewport.width + PAD_TILES * TILE_SIZE * 2,
      viewport.height + PAD_TILES * TILE_SIZE * 2,
    )
  }, [center.lat, center.lng, viewport.height, viewport.width, zoom])

  const tileElements = useMemo(() => {
    if (!tileGrid) return []
    const tiles: Array<{ key: string, src: string, left: number, top: number }> = []

    for (let x = tileGrid.minX; x <= tileGrid.maxX; x += 1) {
      for (let y = tileGrid.minY; y <= tileGrid.maxY; y += 1) {
        const wrappedX = ((x % tileGrid.scale) + tileGrid.scale) % tileGrid.scale
        const tileNorthWest = worldToLngLat(x * TILE_SIZE, y * TILE_SIZE, zoom)
        const position = projectToScreen(
          tileNorthWest.lng,
          tileNorthWest.lat,
          center.lng,
          center.lat,
          zoom,
          viewport.width,
          viewport.height,
        )
        tiles.push({
          key: `${zoom}/${x}/${y}`,
          src: TILE_URL.replace('{z}', String(zoom)).replace('{x}', String(wrappedX)).replace('{y}', String(y)),
          left: position.x,
          top: position.y,
        })
      }
    }

    return tiles
  }, [center.lat, center.lng, tileGrid, viewport.height, viewport.width, zoom])

  const overlayPath = useMemo(() => {
    if (!boundary) return ''
    return boundary.features.map((feature) => geometryToScreenPath(feature.geometry, {
      centerLng: center.lng,
      centerLat: center.lat,
      zoom,
      width: viewport.width,
      height: viewport.height,
    })).join(' ')
  }, [boundary, center.lat, center.lng, viewport.height, viewport.width, zoom])

  const pointElements = useMemo(() => {
    if (!traffic) return []
    return traffic.features.flatMap((feature) => {
      if (feature.geometry.type !== 'Point') return []
      const [lng, lat] = feature.geometry.coordinates
      const screen = projectToScreen(lng, lat, center.lng, center.lat, zoom, viewport.width, viewport.height)
      return [{
        x: screen.x,
        y: screen.y,
        r: radiusForVolume(feature.properties?.meanVolume),
        opacity: opacityForVolume(feature.properties?.meanVolume),
      }]
    })
  }, [center.lat, center.lng, traffic, viewport.height, viewport.width, zoom])

  const pointCount = pointElements.length
  const isAtHome = zoom === INITIAL_ZOOM
    && Math.abs(center.lng - NYC_CENTER[0]) < 0.0005
    && Math.abs(center.lat - NYC_CENTER[1]) < 0.0005

  return (
    <div className="raster-map-wrap">
      <div
        ref={containerRef}
        className={isDragging ? 'raster-map is-dragging' : 'raster-map'}
        role="region"
        aria-label={`Map of New York City drawn from raster tiles. ${pointCount} published traffic points in the current selection. Drag or use the arrow keys to pan, the buttons to zoom, Home to recentre.`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      >
        <div className="raster-map-layer" ref={layerRef}>
          {tileElements.map((tile) => (
            <img
              key={tile.key}
              className="raster-map-tile"
              src={tile.src}
              alt=""
              aria-hidden="true"
              decoding="async"
              draggable={false}
              style={{ left: `${tile.left}px`, top: `${tile.top}px` }}
            />
          ))}

          <svg className="raster-map-overlay" width={viewport.width} height={viewport.height} aria-hidden="true">
            {overlayPath && <path className="raster-map-boundary" d={overlayPath} />}
            {pointElements.map((point, index) => (
              <circle
                key={`point-${index}`}
                className="raster-map-point"
                cx={point.x}
                cy={point.y}
                r={point.r}
                fillOpacity={point.opacity}
              />
            ))}
          </svg>
        </div>

        <div className="raster-map-controls">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomBy(1)}
            disabled={zoom >= MAX_ZOOM}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomBy(-1)}
            disabled={zoom <= MIN_ZOOM}
          >
            -
          </button>
          <button
            type="button"
            aria-label="Recentre on New York City"
            title="Recentre (Home)"
            onClick={resetView}
            disabled={isAtHome}
          >
            ⌖
          </button>
        </div>

        <p className="raster-map-attribution">
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            © OpenStreetMap contributors
          </a>
        </p>
      </div>

      {notice && (
        <p className="raster-map-notice">
          <span className="raster-map-notice-label">Software map</span>
          {notice}
        </p>
      )}
    </div>
  )
}

interface ScreenProjection {
  centerLng: number
  centerLat: number
  zoom: number
  width: number
  height: number
}

function geometryToScreenPath(geometry: Geometry, projection: ScreenProjection): string {
  const ring = (positions: Position[]): string => positions
    .map((position, index) => {
      const [lng, lat] = position
      const screen = projectToScreen(
        lng, lat, projection.centerLng, projection.centerLat, projection.zoom, projection.width, projection.height,
      )
      return `${index === 0 ? 'M' : 'L'}${screen.x.toFixed(1)} ${screen.y.toFixed(1)}`
    })
    .join(' ') + ' Z'

  if (geometry.type === 'Polygon') return geometry.coordinates.map(ring).join(' ')
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flatMap((polygon) => polygon.map(ring)).join(' ')
  return ''
}
