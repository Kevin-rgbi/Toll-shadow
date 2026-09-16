import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FeatureCollection, Geometry, Position } from 'geojson'
import { NYC_BOUNDS, NYC_CENTER } from './mapConfig'
import {
  type ScreenPoint,
  type View,
  centreAfterDrag,
  INERTIA_FRICTION,
  INERTIA_MIN_SPEED,
  isInertiaWorthStarting,
  pinchResult,
  sampleVelocity,
} from './mapGestures'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_SIZE,
  clampCenter,
  clampZoom,
  lngLatToWorld,
  tileLevelFor,
  tileScaleFactorFor,
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

/** Phones get one ring of padding instead of two: fewer images to decode and composite while panning. */
const PAD_TILES_SMALL = 1
const SMALL_VIEWPORT_PX = 900

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
  const [isGesturing, setGesturing] = useState(false)

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

  const gestureRef = useRef<{
    pointers: Map<number, ScreenPoint>
    startMid: ScreenPoint
    startDistance: number
    startView: View
    lastSample: { x: number, y: number, t: number }
    velocity: ScreenPoint
    scale: number
    currentMid: ScreenPoint
    offset: ScreenPoint
    mode: 'drag' | 'pinch'
  } | null>(null)
  const inertiaRef = useRef<number | null>(null)

  const resetView = useCallback(() => {
    const layer = layerRef.current
    if (layer) {
      layer.style.transform = ''
      layer.style.transformOrigin = ''
    }
    gestureRef.current = null
    setGesturing(false)
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


  const containerRect = () => {
    const rect = containerRef.current?.getBoundingClientRect()
    return rect ?? { left: 0, top: 0, width: 0, height: 0 }
  }

  /** Move the tile layer with one transform. No state change, so no re-render while a finger moves. */
  const previewTransform = (offset: ScreenPoint, scale: number, origin: ScreenPoint) => {
    const layer = layerRef.current
    if (!layer) return
    layer.style.transformOrigin = `${origin.x}px ${origin.y}px`
    layer.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`
  }

  const clearPreview = () => {
    const layer = layerRef.current
    if (!layer) return
    layer.style.transform = ''
    layer.style.transformOrigin = ''
  }

  const stopInertia = () => {
    if (inertiaRef.current !== null) {
      window.cancelAnimationFrame(inertiaRef.current)
      inertiaRef.current = null
    }
  }

  const midpoint = (points: ScreenPoint[]): ScreenPoint => ({
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  })

  const distance = (points: ScreenPoint[]): number => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    stopInertia()

    const rect = containerRect()
    const point: ScreenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const existing = gestureRef.current
    const pointers = existing?.pointers ?? new Map<number, ScreenPoint>()
    pointers.set(event.pointerId, point)

    const view: View = { lng: center.lng, lat: center.lat, zoom }
    const list = [...pointers.values()]

    gestureRef.current = {
      pointers,
      mode: pointers.size >= 2 ? 'pinch' : 'drag',
      startMid: pointers.size >= 2 ? midpoint(list) : point,
      startDistance: pointers.size >= 2 ? Math.max(1, distance(list)) : 1,
      startView: view,
      lastSample: { x: point.x, y: point.y, t: event.timeStamp },
      velocity: { x: 0, y: 0 },
      scale: 1,
      currentMid: point,
      offset: { x: 0, y: 0 },
    }

    setGesturing(true)
    clearPreview()
  }

  /**
   * Gesture listeners live on the window so a fast drag that leaves the map keeps tracking and still
   * commits. Pointer capture is deliberately not used: it throws for pointers the browser no longer
   * considers active, and it is unnecessary when the listeners are global.
   */
  useEffect(() => {
    if (!isGesturing) return

    const onMove = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || !gesture.pointers.has(event.pointerId)) return

      const rect = containerRect()
      gesture.pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top })
      const list = [...gesture.pointers.values()]

      if (list.length >= 2) {
        // A second finger arrived: restart the gesture as a pinch from here.
        if (gesture.mode !== 'pinch') {
          gesture.mode = 'pinch'
          gesture.startMid = midpoint(list)
          gesture.startDistance = Math.max(1, distance(list))
          gesture.startView = { lng: center.lng, lat: center.lat, zoom }
          gesture.offset = { x: 0, y: 0 }
          gesture.scale = 1
        }
        const mid = midpoint(list)
        gesture.scale = distance(list) / gesture.startDistance
        gesture.currentMid = mid
        gesture.offset = { x: mid.x - gesture.startMid.x, y: mid.y - gesture.startMid.y }
        previewTransform(gesture.offset, gesture.scale, gesture.startMid)
      } else {
        const point = list[0]
        gesture.offset = { x: point.x - gesture.startMid.x, y: point.y - gesture.startMid.y }
        previewTransform(gesture.offset, 1, gesture.startMid)
      }

      const samplePoint = gesture.mode === 'pinch' ? gesture.currentMid : list[0]
      gesture.velocity = sampleVelocity(gesture.lastSample, { ...samplePoint, t: event.timeStamp })
      gesture.lastSample = { ...samplePoint, t: event.timeStamp }
    }

    const finish = () => {
      const gesture = gestureRef.current
      gestureRef.current = null
      setGesturing(false)
      clearPreview()
      if (!gesture) return

      if (gesture.mode === 'pinch') {
        const result = pinchResult({
          view: gesture.startView,
          viewport: { width: viewport.width, height: viewport.height },
          startMid: gesture.startMid,
          currentMid: gesture.currentMid,
          scale: gesture.scale,
        })
        applyCenter(result.lng, result.lat)
        setZoom(result.zoom)
        return
      }

      if (!isInertiaWorthStarting(gesture.velocity)) {
        if (gesture.offset.x !== 0 || gesture.offset.y !== 0) {
          const next = centreAfterDrag(gesture.startView, gesture.offset.x, gesture.offset.y)
          applyCenter(next.lng, next.lat)
        }
        return
      }

      // Let the map coast to a stop instead of halting dead, unless the reader asked for less motion.
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduceMotion) {
        const next = centreAfterDrag(gesture.startView, gesture.offset.x, gesture.offset.y)
        applyCenter(next.lng, next.lat)
        return
      }

      const startView = gesture.startView
      let offsetX = gesture.offset.x
      let offsetY = gesture.offset.y
      const velocity = { ...gesture.velocity }
      let previous = performance.now()

      const step = (now: number) => {
        const dt = now - previous
        previous = now
        const frames = dt / 16.7
        velocity.x *= INERTIA_FRICTION ** frames
        velocity.y *= INERTIA_FRICTION ** frames
        offsetX += velocity.x * dt
        offsetY += velocity.y * dt
        previewTransform({ x: offsetX, y: offsetY }, 1, { x: 0, y: 0 })

        if (Math.hypot(velocity.x, velocity.y) < INERTIA_MIN_SPEED) {
          inertiaRef.current = null
          clearPreview()
          const next = centreAfterDrag(startView, offsetX, offsetY)
          applyCenter(next.lng, next.lat)
          return
        }
        inertiaRef.current = window.requestAnimationFrame(step)
      }

      inertiaRef.current = window.requestAnimationFrame(step)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [applyCenter, center.lat, center.lng, isGesturing, viewport.height, viewport.width, zoom])

  useEffect(() => stopInertia, [])

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

  /**
   * Tiles exist at integer zoom levels only. A pinch produces a fractional zoom, so the tile level is
   * floored and the tiles are drawn at 2^(zoom - level) times their base size, which is how every
   * slippy map handles it. Requesting a fractional tile path would 404 against the tile server.
   */
  const tileZoom = tileLevelFor(zoom)
  const tileScaleFactor = tileScaleFactorFor(zoom)

  const padTiles = viewport.width > 0 && viewport.width <= SMALL_VIEWPORT_PX ? PAD_TILES_SMALL : PAD_TILES

  const tileGrid = useMemo(() => {
    if (viewport.width === 0 || viewport.height === 0) return null
    return tileRangeFor(
      center.lng,
      center.lat,
      tileZoom,
      viewport.width + padTiles * TILE_SIZE * 2,
      viewport.height + padTiles * TILE_SIZE * 2,
    )
  }, [center.lat, center.lng, padTiles, tileZoom, viewport.height, viewport.width])

  const tileElements = useMemo(() => {
    if (!tileGrid) return []
    const tiles: Array<{ key: string, src: string, left: number, top: number, size: number }> = []

    for (let x = tileGrid.minX; x <= tileGrid.maxX; x += 1) {
      for (let y = tileGrid.minY; y <= tileGrid.maxY; y += 1) {
        const wrappedX = ((x % tileGrid.scale) + tileGrid.scale) % tileGrid.scale
        const tileNorthWest = worldToLngLat(x * TILE_SIZE, y * TILE_SIZE, tileZoom)
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
          key: `${tileZoom}/${x}/${y}`,
          src: TILE_URL.replace('{z}', String(tileZoom)).replace('{x}', String(wrappedX)).replace('{y}', String(y)),
          left: position.x,
          top: position.y,
          size: TILE_SIZE * tileScaleFactor,
        })
      }
    }

    return tiles
  }, [center.lat, center.lng, tileGrid, tileScaleFactor, tileZoom, viewport.height, viewport.width, zoom])

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
        className={isGesturing ? 'raster-map is-dragging' : 'raster-map'}
        role="region"
        aria-label={`Map of New York City drawn from raster tiles. ${pointCount} published traffic points in the current selection. Drag or use the arrow keys to pan, the buttons to zoom, Home to recentre.`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      >
        <div className="raster-map-layer" ref={layerRef}>
          <div className="raster-map-tiles">
            {tileElements.map((tile) => (
              <img
                key={tile.key}
                className="raster-map-tile"
                src={tile.src}
                alt=""
                aria-hidden="true"
                decoding="async"
                draggable={false}
                style={{ left: `${tile.left}px`, top: `${tile.top}px`, width: `${tile.size}px`, height: `${tile.size}px` }}
              />
            ))}
          </div>

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
