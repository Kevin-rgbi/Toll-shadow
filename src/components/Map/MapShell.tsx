import { useCallback, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { RasterMap } from './RasterMap'
import { resolveRenderer } from '../../lib/mapPreference'
import type { MapPreference } from '../../lib/mapPreference'
import { getInterpolatedEffectsForDate } from '../../lib/devSyntheticDataset'
import type { DevSyntheticDataset } from '../../lib/devSyntheticDataset'
import {
  GPU_RENDER_WATCHDOG_MS,
  MAP_CONTEXT_LOST_MESSAGE,
  MAP_NO_TILES_MESSAGE,
  MAP_START_FAILURE_PREFIX,
  NYC_BASEMAP_STYLE,
  NYC_BOUNDS,
  NYC_CENTER,
  NYC_REFERENCE_LABELS,
  focusOffsetForMode,
} from './mapConfig'
import {
  blendColor,
  blendNumber,
  findHitTarget,
  getMonitorStyleForMode,
  getTargetRenderMode,
  getTrafficStyleForMode,
  syncOverlayCanvas,
  timelineStrength,
  toRgba,
} from './mapOverlay'
import type { EffectiveRenderMode, HitTarget } from './mapOverlay'
import type { CompareMode, CompareRenderMode, AppMode } from '../../state/appStore'

interface OverlayState {
  syntheticDataset: DevSyntheticDataset | null
  currentDateIso: string
  activeMode: AppMode
  compareMode: CompareMode
  focusedHotspotKey: string | null
}

interface MapShellProps {
  /** Published boundary geometry (EPSG:4326) from the validated release manifest, when available. */
  boundary: FeatureCollection | null
  /**
   * Published traffic-observation points for the current selection, already filtered by the module.
   * Coordinates come from the validated asset; the map never synthesizes a location.
   */
  releaseTraffic: FeatureCollection | null
  /** `software` forces the WebGL-free map, `gpu` forces the attempt, null decides automatically. */
  mapPreference: MapPreference | null
  /** Synthetic prototype effects. Non-null only when the development demo flag is enabled. */
  syntheticDataset: DevSyntheticDataset | null
  currentDateIso: string
  activeMode: AppMode
  compareMode: CompareMode
  compareRenderMode: CompareRenderMode
  focusedHotspotId: string | null
  focusedHotspotKind: 'traffic' | 'monitor' | null
  dataError: boolean
}

const RELEASE_BOUNDARY_SOURCE = 'release-boundary'
const RELEASE_TRAFFIC_SOURCE = 'release-traffic'

export function MapShell({
  boundary,
  releaseTraffic,
  mapPreference,
  syntheticDataset,
  currentDateIso,
  activeMode,
  compareMode,
  compareRenderMode,
  focusedHotspotId,
  focusedHotspotKind,
  dataError,
}: MapShellProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const focusIndicatorRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const overlayStateRef = useRef<OverlayState>({
    syntheticDataset: null,
    currentDateIso: '2025-01-05',
    activeMode: 'STORY',
    compareMode: 'off',
    focusedHotspotKey: null,
  })
  const [mapReady, setMapReady] = useState(false)
  const [rendererDecision] = useState(() => resolveRenderer(mapPreference))
  const [mapFallbackMessage, setMapFallbackMessage] = useState<string | null>(rendererDecision.reason)
  const [hoveredTarget, setHoveredTarget] = useState<HitTarget | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<HitTarget | null>(null)
  const hoveredKeyRef = useRef<string | null>(null)
  const selectedKeyRef = useRef<string | null>(null)
  const renderModeTransitionRef = useRef<{ from: EffectiveRenderMode, to: EffectiveRenderMode, progress: number }>({
    from: 'difference',
    to: 'difference',
    progress: 1,
  })
  const transitionAnimationFrameRef = useRef<number | null>(null)
  const focusIndicatorTimeoutRef = useRef<number | null>(null)
  const focusTargetRef = useRef<[number, number] | null>(null)
  const lastCenteredHotspotKeyRef = useRef<string | null>(null)
  const hitTargetsRef = useRef<HitTarget[]>([])

  const positionFocusIndicator = useCallback((lngLat: [number, number]) => {
    const map = mapRef.current
    const indicator = focusIndicatorRef.current
    if (!map || !indicator) return

    const point = map.project(lngLat)
    indicator.style.left = `${point.x}px`
    indicator.style.top = `${point.y}px`
  }, [])

  const triggerFocusIndicator = useCallback((lngLat: [number, number]) => {
    const indicator = focusIndicatorRef.current
    if (!indicator) return

    positionFocusIndicator(lngLat)
    indicator.classList.remove('is-active')
    // Force reflow so repeated selections can replay the animation.
    void indicator.offsetWidth
    indicator.classList.add('is-active')

    if (focusIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(focusIndicatorTimeoutRef.current)
    }

    focusIndicatorTimeoutRef.current = window.setTimeout(() => {
      indicator.classList.remove('is-active')
      focusIndicatorTimeoutRef.current = null
    }, 1400)
  }, [positionFocusIndicator])

  const drawOverlay = useCallback(() => {
    const map = mapRef.current
    const overlay = overlayRef.current
    const state = overlayStateRef.current

    if (!map || !overlay) return

    if (focusTargetRef.current) {
      positionFocusIndicator(focusTargetRef.current)
    }

    const ctx = overlay.getContext('2d')
    if (!ctx) return

    const { width, height } = syncOverlayCanvas(map, overlay, ctx)
    ctx.clearRect(0, 0, width, height)

    // Release mode draws no estimated effects: only published assets may reach the map overlay.
    if (!state.syntheticDataset) {
      hitTargetsRef.current = []
      return
    }

    const strength = timelineStrength(
      state.currentDateIso,
      state.syntheticDataset.manifest.policy_start_date,
      state.syntheticDataset.manifest.latest_observation_date,
    )

    if (strength <= 0) return

    const interpolatedEffects = getInterpolatedEffectsForDate(state.syntheticDataset, state.currentDateIso)
    const nextHitTargets: HitTarget[] = []
    const modeTransition = renderModeTransitionRef.current
    const modeProgress = modeTransition.progress
    const showTraffic = state.activeMode !== 'AIR'
    const showMonitors = state.activeMode !== 'TRAFFIC'

    if (showTraffic) {
      for (const corridor of interpolatedEffects.traffic) {
        const points = corridor.coordinates.map(([lng, lat]) => map.project([lng, lat]))

        if (points.length < 2) continue

        const screenPoints = points.map((point) => ({ x: point.x, y: point.y }))

        const confidence = Math.max(0, Math.min(1, corridor.confidence))
        const fromStyle = getTrafficStyleForMode(corridor, modeTransition.from, strength)
        const toStyle = getTrafficStyleForMode(corridor, modeTransition.to, strength)
        const widthPx = blendNumber(fromStyle.width, toStyle.width, modeProgress)
        const alpha = blendNumber(fromStyle.alpha, toStyle.alpha, modeProgress)
        const color = blendColor(fromStyle.color, toStyle.color, modeProgress)
        const key = `traffic:${corridor.locationId}`
        const isActive = hoveredKeyRef.current === key
          || selectedKeyRef.current === key
          || state.focusedHotspotKey === key
        const displayAlpha = isActive ? Math.min(alpha, 0.68) : Math.min(alpha, 0.34)

        if (state.compareMode === 'on') {
          ctx.beginPath()
          ctx.moveTo(points[0].x, points[0].y)
          for (let index = 1; index < points.length; index += 1) {
            ctx.lineTo(points[index].x, points[index].y)
          }
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.lineWidth = Math.max(1.2, widthPx * 0.88)
          ctx.strokeStyle = 'rgba(198, 204, 201, 0.08)'
          ctx.stroke()
        }

        if (isActive) {
          ctx.beginPath()
          ctx.moveTo(points[0].x, points[0].y)
          for (let index = 1; index < points.length; index += 1) {
            ctx.lineTo(points[index].x, points[index].y)
          }
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.lineWidth = widthPx + 4
          ctx.strokeStyle = 'rgba(243, 241, 234, 0.2)'
          ctx.stroke()
        }

        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let index = 1; index < points.length; index += 1) {
          ctx.lineTo(points[index].x, points[index].y)
        }
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = isActive ? widthPx + 1 : widthPx
        ctx.strokeStyle = toRgba(color, displayAlpha)
        ctx.stroke()

        nextHitTargets.push({
          key,
          kind: 'traffic',
          id: corridor.locationId,
          name: corridor.name,
          effect: corridor.effectPct,
          observed: corridor.observed,
          expected: corridor.expected,
          confidence,
          classification: corridor.classification,
          points: screenPoints,
          hitWidth: widthPx,
        })
      }
    }

    if (showMonitors) {
      const zoom = map.getZoom()

      for (const monitor of interpolatedEffects.monitors) {
        const [lng, lat] = monitor.coordinates
        const point = map.project([lng, lat])

        const confidence = Math.max(0, Math.min(1, monitor.confidence))
        const fromStyle = getMonitorStyleForMode(monitor, modeTransition.from, zoom, strength)
        const toStyle = getMonitorStyleForMode(monitor, modeTransition.to, zoom, strength)
        const alpha = blendNumber(fromStyle.alpha, toStyle.alpha, modeProgress)
        const color = blendColor(fromStyle.color, toStyle.color, modeProgress)
        const radius = blendNumber(fromStyle.radius, toStyle.radius, modeProgress)
        const key = `monitor:${monitor.monitorId}`
        const isActive = hoveredKeyRef.current === key
          || selectedKeyRef.current === key
          || state.focusedHotspotKey === key
        const displayAlpha = isActive ? Math.min(alpha, 0.76) : Math.min(alpha, 0.36)
        const activeRadius = isActive ? radius + 1.5 : radius

        if (state.compareMode === 'on') {
          ctx.beginPath()
          ctx.arc(point.x, point.y, Math.max(2, radius * 0.45), 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(198, 204, 201, 0.08)'
          ctx.fill()
        }

        if (isActive) {
          ctx.beginPath()
          ctx.arc(point.x, point.y, activeRadius + 3, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(243, 241, 234, 0.08)'
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(point.x, point.y, activeRadius, 0, Math.PI * 2)
        ctx.fillStyle = toRgba(color, displayAlpha)
        ctx.fill()

        ctx.beginPath()
        ctx.arc(point.x, point.y, activeRadius, 0, Math.PI * 2)
        ctx.strokeStyle = toRgba([243, 241, 234], displayAlpha * 0.5)
        ctx.lineWidth = 1
        ctx.stroke()

        nextHitTargets.push({
          key,
          kind: 'monitor',
          id: monitor.monitorId,
          name: monitor.name,
          effect: monitor.effect,
          observed: monitor.observedPm25,
          expected: monitor.expectedPm25,
          confidence,
          classification: monitor.classification,
          x: point.x,
          y: point.y,
          radius: activeRadius,
        })
      }
    }

    hitTargetsRef.current = nextHitTargets
  }, [positionFocusIndicator])

  useEffect(() => {
    if (!containerRef.current || mapFallbackMessage) {
      return
    }

    let map: maplibregl.Map

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
      if (transitionAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(transitionAnimationFrameRef.current)
      }
      if (focusIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(focusIndicatorTimeoutRef.current)
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
  }, [drawOverlay, mapFallbackMessage])

  useEffect(() => {
    const targetMode = getTargetRenderMode(compareMode, compareRenderMode)
    const transitionState = renderModeTransitionRef.current
    if (transitionState.to === targetMode && transitionState.progress === 1) return

    if (transitionAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(transitionAnimationFrameRef.current)
    }

    const fromMode = transitionState.to
    renderModeTransitionRef.current = {
      from: fromMode,
      to: targetMode,
      progress: 0,
    }

    const start = performance.now()
    const run = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / 420)
      renderModeTransitionRef.current.progress = progress
      drawOverlay()

      if (progress < 1) {
        transitionAnimationFrameRef.current = window.requestAnimationFrame(run)
      } else {
        transitionAnimationFrameRef.current = null
      }
    }

    transitionAnimationFrameRef.current = window.requestAnimationFrame(run)

    return () => {
      if (transitionAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(transitionAnimationFrameRef.current)
        transitionAnimationFrameRef.current = null
      }
    }
  }, [compareMode, compareRenderMode, drawOverlay])

  useEffect(() => {
    const focusedHotspotKey = focusedHotspotId && focusedHotspotKind
      ? `${focusedHotspotKind}:${focusedHotspotId}`
      : null

    overlayStateRef.current = {
      syntheticDataset,
      currentDateIso,
      activeMode,
      compareMode,
      focusedHotspotKey,
    }
    drawOverlay()
  }, [activeMode, compareMode, currentDateIso, drawOverlay, focusedHotspotId, focusedHotspotKind, syntheticDataset])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !syntheticDataset || !focusedHotspotId || !focusedHotspotKind) {
      lastCenteredHotspotKeyRef.current = null
      focusTargetRef.current = null
      focusIndicatorRef.current?.classList.remove('is-active')
      return
    }

    const hotspotKey = `${focusedHotspotKind}:${focusedHotspotId}`
    if (lastCenteredHotspotKeyRef.current === hotspotKey) return

    let center: [number, number] | null = null

    if (focusedHotspotKind === 'traffic') {
      const corridor = syntheticDataset.effects.traffic.find((item) => item.locationId === focusedHotspotId)
      if (corridor && corridor.coordinates.length > 0) {
        center = corridor.coordinates[Math.floor(corridor.coordinates.length / 2)]
      }
    }

    if (focusedHotspotKind === 'monitor') {
      const monitor = syntheticDataset.effects.monitors.find((item) => item.monitorId === focusedHotspotId)
      if (monitor) {
        center = monitor.coordinates
      }
    }

    if (!center) return

    focusTargetRef.current = center
    triggerFocusIndicator(center)

    const focusOffset = focusOffsetForMode(activeMode)

    map.easeTo({
      center,
      offset: focusOffset,
      duration: 780,
      essential: true,
    })
    lastCenteredHotspotKeyRef.current = hotspotKey
  }, [activeMode, focusedHotspotId, focusedHotspotKind, mapReady, syntheticDataset, triggerFocusIndicator])

  useEffect(() => {
    hoveredKeyRef.current = hoveredTarget?.key ?? null
    selectedKeyRef.current = selectedTarget?.key ?? null
    drawOverlay()
  }, [hoveredTarget, selectedTarget, drawOverlay])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (map.getSource('nyc-reference-labels')) return

    map.addSource('nyc-reference-labels', {
      type: 'geojson',
      data: NYC_REFERENCE_LABELS as never,
    })

    map.addLayer({
      id: 'nyc-reference-labels-layer',
      type: 'symbol',
      source: 'nyc-reference-labels',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-letter-spacing': 0.1,
        'text-font': ['Open Sans Semibold'],
      },
      paint: {
        'text-color': 'rgba(88, 94, 102, 0.85)',
        'text-halo-color': 'rgba(252, 252, 251, 0.9)',
        'text-halo-width': 1.2,
      },
    })
  }, [mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (!boundary) return

    if (map.getSource(RELEASE_BOUNDARY_SOURCE)) {
      const source = map.getSource(RELEASE_BOUNDARY_SOURCE) as maplibregl.GeoJSONSource
      source.setData(boundary as never)
      return
    }

    map.addSource(RELEASE_BOUNDARY_SOURCE, { type: 'geojson', data: boundary as never })
    map.addLayer({
      id: 'release-boundary-fill',
      type: 'fill',
      source: RELEASE_BOUNDARY_SOURCE,
      paint: { 'fill-color': '#1f4bd8', 'fill-opacity': 0.04 },
    })
    map.addLayer({
      id: 'release-boundary-line',
      type: 'line',
      source: RELEASE_BOUNDARY_SOURCE,
      paint: {
        'line-color': '#1f4bd8',
        'line-opacity': 0.5,
        'line-width': 1,
        'line-dasharray': [3, 2],
      },
    })
  }, [boundary, mapReady])

  /**
   * Published traffic points render as a native MapLibre layer rather than on the canvas overlay,
   * so the release path stays independent of the synthetic prototype renderer. Colour and radius
   * encode the published per-segment mean only; the layer draws nothing when the selection is empty
   * and is removed entirely when the release publishes no traffic asset.
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const removeLayer = (layerId: string) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
    }

    if (!releaseTraffic) {
      removeLayer('release-traffic-circles')
      if (map.getSource(RELEASE_TRAFFIC_SOURCE)) map.removeSource(RELEASE_TRAFFIC_SOURCE)
      return
    }

    if (map.getSource(RELEASE_TRAFFIC_SOURCE)) {
      const source = map.getSource(RELEASE_TRAFFIC_SOURCE) as maplibregl.GeoJSONSource
      source.setData(releaseTraffic as never)
      return
    }

    map.addSource(RELEASE_TRAFFIC_SOURCE, { type: 'geojson', data: releaseTraffic as never })
    map.addLayer({
      id: 'release-traffic-circles',
      type: 'circle',
      source: RELEASE_TRAFFIC_SOURCE,
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['get', 'meanVolume'],
          0, 3,
          50, 5,
          150, 9,
        ] as never,
        'circle-color': [
          'interpolate', ['linear'], ['get', 'meanVolume'],
          0, 'rgba(31, 75, 216, 0.30)',
          50, 'rgba(31, 75, 216, 0.68)',
          150, '#0f2a86',
        ] as never,
        'circle-opacity': 0.85,
        'circle-stroke-color': 'rgba(252, 252, 251, 0.9)',
        'circle-stroke-width': 0.8,
      },
    })
  }, [mapReady, releaseTraffic])

  return (
    <>
      {mapFallbackMessage ? (
        <RasterMap
          boundary={boundary}
          traffic={releaseTraffic}
          notice={mapFallbackMessage}
        />
      ) : (
        <div
          ref={containerRef}
          className="map-shell"
          role="region"
          aria-label="Interactive map of New York City"
        />
      )}
      {!mapFallbackMessage && (
        <p className="map-renderer-note">
          {`GPU map${rendererDecision.renderer ? ` · ${rendererDecision.renderer}` : ''}`}
        </p>
      )}
      <div className="map-focus-indicator" ref={focusIndicatorRef} aria-hidden="true" />
      {dataError && (
        <div className="data-error" role="alert">
          The published data release could not be loaded. Only the base map is shown.
        </div>
      )}
      {selectedTarget && !mapFallbackMessage && (
        <aside
          className={[
            'map-selection-card',
            (activeMode === 'CONFIDENCE' || activeMode === 'EQUITY' || activeMode === 'HOTSPOTS')
              ? 'map-selection-card-left'
              : '',
            activeMode === 'STORY' ? 'map-selection-card-story' : '',
          ].filter(Boolean).join(' ')}
          aria-live="polite"
        >
          <p className="map-selection-kicker">{selectedTarget.kind === 'traffic' ? 'CORRIDOR' : 'MONITOR'}</p>
          <h3>{selectedTarget.name}</h3>
          <p>
            {getTargetRenderMode(compareMode, compareRenderMode) === 'expected' && (
              <>
                SYNTHETIC DEV BASELINE · {selectedTarget.kind === 'traffic' ? `INDEX ${selectedTarget.expected.toFixed(1)}` : `${selectedTarget.expected.toFixed(2)} ug/m3`}
              </>
            )}
            {getTargetRenderMode(compareMode, compareRenderMode) === 'actual' && (
              <>
                SYNTHETIC DEV OBSERVED · {selectedTarget.kind === 'traffic' ? `INDEX ${selectedTarget.observed.toFixed(1)}` : `${selectedTarget.observed.toFixed(2)} ug/m3`}
              </>
            )}
            {getTargetRenderMode(compareMode, compareRenderMode) === 'difference' && (
              <>
                {selectedTarget.classification.toUpperCase().replaceAll('_', ' ')} · EFFECT {selectedTarget.effect >= 0 ? '+' : ''}
                {(selectedTarget.effect * (selectedTarget.kind === 'traffic' ? 100 : 1)).toFixed(selectedTarget.kind === 'traffic' ? 1 : 2)}
                {selectedTarget.kind === 'traffic' ? '%' : ' ug/m3'}
              </>
            )}
          </p>
        </aside>
      )}
    </>
  )
}
