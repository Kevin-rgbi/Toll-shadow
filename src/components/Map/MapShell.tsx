import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { RasterMap } from './RasterMap'
import { resolveRenderer } from '../../lib/mapPreference'
import type { MapPreference } from '../../lib/mapPreference'
import type { DevSyntheticDataset } from '../../lib/devSyntheticDataset'
import {
  focusOffsetForMode,
} from './mapConfig'
import {
  getTargetRenderMode,
} from './mapOverlay'
import { AirPointCardContent } from './AirPointCardContent'
import type { EffectiveRenderMode, HitTarget } from './mapOverlay'
import { drawOverlayFrame } from './mapOverlayDraw'
import { useMapInstance } from './useMapInstance'
import { useMapLayers } from './useMapLayers'
import type { OverlayState } from './mapOverlayDraw'
import type { CompareMode, CompareRenderMode, AppMode } from '../../state/appStore'

interface ReleasePointHit {
  id: string
  name: string
  borough: string
  period: string
  pm25: number | null
  coverage: string
  coverageStatus: string
  color: string
  fill: string
  stroke: string
  radius: number
  selected: boolean
  aboveScale: boolean
  latestAvailablePm25: number | null
  latestAvailablePeriod: string | null
  latestAvailableCoverage: string | null
}

interface MapShellProps {
  /** Published boundary geometry (EPSG:4326) from the validated release manifest, when available. */
  boundary: FeatureCollection | null
  /**
   * Published traffic-observation points for the current selection, already filtered by the module.
   * Coordinates come from the validated asset; the map never synthesizes a location.
   */
  releaseTraffic: FeatureCollection | null
  releaseFocus?: { id: string, coordinates: [number, number] } | null
  onReleaseSelect?: (id: string | null) => void
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


const releasePointHitFromFeature = (feature: { properties?: Record<string, unknown> }): ReleasePointHit | null => {
  const properties = feature.properties
  if (!properties || typeof properties.id !== 'string') return null
  const pm25 = typeof properties.pm25 === 'number' ? properties.pm25 : null
  return {
    id: properties.id,
    name: typeof properties.name === 'string' ? properties.name : properties.id,
    borough: typeof properties.borough === 'string' ? properties.borough : 'Borough unavailable',
    period: typeof properties.period === 'string' ? properties.period : 'Period unavailable',
    pm25,
    coverage: typeof properties.coverage === 'string' ? properties.coverage : 'Coverage unavailable',
    coverageStatus: typeof properties.coverageStatus === 'string' ? properties.coverageStatus : 'unknown',
    color: typeof properties.color === 'string' ? properties.color : '#85898f',
    fill: typeof properties.fill === 'string' ? properties.fill : '#fcfcfb',
    stroke: typeof properties.stroke === 'string' ? properties.stroke : '#85898f',
    radius: typeof properties.radius === 'number' ? properties.radius : 4,
    selected: properties.selected === true,
    aboveScale: properties.aboveScale === true,
    latestAvailablePm25: typeof properties.latestAvailablePm25 === 'number' ? properties.latestAvailablePm25 : null,
    latestAvailablePeriod: typeof properties.latestAvailablePeriod === 'string' ? properties.latestAvailablePeriod : null,
    latestAvailableCoverage: typeof properties.latestAvailableCoverage === 'string' ? properties.latestAvailableCoverage : null,
  }
}

export function MapShell({
  boundary,
  releaseTraffic,
  releaseFocus,
  onReleaseSelect,
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
  // How many published points MapLibre reports as actually rendered, written straight into the map
  // caption. "Is the data on screen?" becomes a number rather than an impression, on any machine.
  const pointsReadoutRef = useRef<HTMLSpanElement | null>(null)
  const [rendererDecision] = useState(() => resolveRenderer(mapPreference))
  const [mapFallbackMessage, setMapFallbackMessage] = useState<string | null>(rendererDecision.reason)
  const [hoveredTarget, setHoveredTarget] = useState<HitTarget | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<HitTarget | null>(null)
  const [hoveredReleasePoint, setHoveredReleasePoint] = useState<ReleasePointHit | null>(null)
  const [selectedReleasePoint, setSelectedReleasePoint] = useState<ReleasePointHit | null>(null)
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
    if (!map || !overlay) return

    const next = drawOverlayFrame({
      map,
      overlay,
      state: overlayStateRef.current,
      hoveredKey: hoveredKeyRef.current,
      selectedKey: selectedKeyRef.current,
      transition: renderModeTransitionRef.current,
      focusTarget: focusTargetRef.current,
      projectFocus: positionFocusIndicator,
    })

    // `null` means the frame left the previous targets alone; anything else replaces them.
    if (next !== null) hitTargetsRef.current = next

  }, [positionFocusIndicator])

  // Stable identities: the refs come from `useRef` and the setters from `useState`, so holding them in
  // memoised objects keeps the map's lifecycle effect from re-running on every render.
  const mapRefs = useMemo(
    () => ({ containerRef, mapRef, overlayRef, hitTargetsRef, transitionAnimationFrameRef, focusIndicatorTimeoutRef }),
    [],
  )
  const mapHandlers = useMemo(
    () => ({ drawOverlay, setMapReady, setMapFallbackMessage, setHoveredTarget, setSelectedTarget }),
    [drawOverlay],
  )

  useMapInstance(mapRefs, mapHandlers, mapFallbackMessage)


  /**
   * Keep the map caption's point count honest. This runs independently of the data effect: that one
   * returns early when it only needs to push new data into an existing source, which would otherwise
   * drop the listeners and freeze the readout on a stale number.
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const countRendered = () => {
      const readout = pointsReadoutRef.current
      if (!readout) return
      if (!map.getLayer('release-traffic-circles')) {
        readout.textContent = activeMode === 'AIR' || activeMode === 'STORY' ? 'air layer not added' : 'traffic layer not added'
        return
      }
      const drawn = map.queryRenderedFeatures({ layers: ['release-traffic-circles'] }).length
      const loaded = map.querySourceFeatures('release-traffic').length
      const styleState = map.isStyleLoaded() ? 'style ok' : 'style pending'
      const sourceState = map.isSourceLoaded('release-traffic') ? 'source ok' : 'source pending'
      readout.textContent = `${styleState}, ${sourceState} · ${drawn} of ${loaded} points in view`
    }

    map.on('sourcedata', countRendered)
    map.on('idle', countRendered)
    const firstFrame = window.requestAnimationFrame(countRendered)
    const settles = [1200, 3500, 7000].map((delay) => window.setTimeout(countRendered, delay))

    return () => {
      map.off('sourcedata', countRendered)
      map.off('idle', countRendered)
      window.cancelAnimationFrame(firstFrame)
      for (const timer of settles) window.clearTimeout(timer)
    }
  }, [activeMode, mapReady])

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
    const map = mapRef.current
    if (!map || !mapReady || (activeMode !== 'AIR' && activeMode !== 'STORY')) return

    const pointAt = (event: maplibregl.MapMouseEvent) => {
      if (!map.getLayer('release-traffic-circles')) return null
      const feature = map.queryRenderedFeatures(event.point, { layers: ['release-traffic-circles'] })
        .find((candidate) => typeof candidate.properties?.id === 'string')
      return feature ? releasePointHitFromFeature(feature) : null
    }

    const move = (event: maplibregl.MapMouseEvent) => {
      const hit = pointAt(event)
      setHoveredReleasePoint(hit)
      map.getCanvas().style.cursor = hit ? 'pointer' : ''
    }

    const out = () => {
      setHoveredReleasePoint(null)
      map.getCanvas().style.cursor = ''
    }

    const click = (event: maplibregl.MapMouseEvent) => {
      const hit = pointAt(event)
      if (!hit) {
        setSelectedReleasePoint(null)
        onReleaseSelect?.(null)
        return
      }
      setSelectedReleasePoint((current) => current?.id === hit.id ? null : hit)
      onReleaseSelect?.(hit.id)
    }

    map.on('mousemove', move)
    map.on('mouseout', out)
    map.on('click', click)
    return () => {
      map.off('mousemove', move)
      map.off('mouseout', out)
      map.off('click', click)
    }
  }, [activeMode, mapReady, onReleaseSelect])

  useEffect(() => {
    const map = mapRef.current
    const indicator = focusIndicatorRef.current
    if (!map || !mapReady || !indicator) return

    let focusKey: string | null = null
    let center: [number, number] | null = null
    let offset: [number, number] | undefined
    let zoom: number | undefined

    if (releaseFocus) {
      focusKey = `release:${releaseFocus.id}`
      center = releaseFocus.coordinates
      zoom = Math.max(map.getZoom(), 13)
    } else if (syntheticDataset && focusedHotspotId && focusedHotspotKind) {
      focusKey = `hotspot:${focusedHotspotKind}:${focusedHotspotId}`

      if (focusedHotspotKind === 'traffic') {
        const corridor = syntheticDataset.effects.traffic.find((item) => item.locationId === focusedHotspotId)
        if (corridor && corridor.coordinates.length > 0) {
          center = corridor.coordinates[Math.floor(corridor.coordinates.length / 2)]
        }
      }

      if (focusedHotspotKind === 'monitor') {
        const monitor = syntheticDataset.effects.monitors.find((item) => item.monitorId === focusedHotspotId)
        if (monitor) center = monitor.coordinates
      }

      offset = focusOffsetForMode(activeMode)
    }

    if (!focusKey || !center) {
      lastCenteredHotspotKeyRef.current = null
      focusTargetRef.current = null
      indicator.classList.remove('is-active')
      return
    }

    if (lastCenteredHotspotKeyRef.current === focusKey) return

    focusTargetRef.current = center
    triggerFocusIndicator(center)

    map.easeTo({
      center,
      ...(offset ? { offset } : {}),
      ...(zoom === undefined ? {} : { zoom }),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 780,
      essential: true,
    })
    lastCenteredHotspotKeyRef.current = focusKey
  }, [
    activeMode,
    focusedHotspotId,
    focusedHotspotKind,
    mapReady,
    releaseFocus,
    syntheticDataset,
    triggerFocusIndicator,
  ])

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
    hoveredKeyRef.current = hoveredTarget?.key ?? null
    selectedKeyRef.current = selectedTarget?.key ?? null
    drawOverlay()
  }, [hoveredTarget, selectedTarget, drawOverlay])

  const layerRefs = useMemo(() => ({ mapRef, pointsReadoutRef }), [])
  const layerInputs = useMemo(() => ({ mapReady, boundary, releaseTraffic }), [boundary, mapReady, releaseTraffic])

  useMapLayers(layerRefs, layerInputs)


  return (
    <>
      {mapFallbackMessage ? (
        <RasterMap
          boundary={boundary}
          traffic={releaseTraffic}
          focus={releaseFocus}
          onSelect={onReleaseSelect}
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
          {'GPU map · '}
          <span ref={pointsReadoutRef}>checking what is on screen…</span>
          {rendererDecision.renderer ? ` · ${rendererDecision.renderer}` : ''}
        </p>
      )}
      <div className="map-focus-indicator" ref={focusIndicatorRef} aria-hidden="true" />
      {dataError && (
        <div className="data-error" role="alert">
          The published data release could not be loaded. Only the base map is shown.
        </div>
      )}
      {(activeMode === 'AIR' || activeMode === 'STORY') && (hoveredReleasePoint ?? selectedReleasePoint) && !mapFallbackMessage && (
        <aside className="map-selection-card" aria-live="polite">
          <AirPointCardContent point={(hoveredReleasePoint ?? selectedReleasePoint) as ReleasePointHit} />
        </aside>
      )}
      {selectedTarget && activeMode !== 'AIR' && activeMode !== 'STORY' && !mapFallbackMessage && (
        <aside
          className={[
            'map-selection-card',
            (activeMode === 'CONFIDENCE' || activeMode === 'EQUITY' || activeMode === 'HOTSPOTS')
              ? 'map-selection-card-left'
              : '',
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
