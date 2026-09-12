import { interpolateNumber } from 'd3-interpolate'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection } from 'geojson'
import { getInterpolatedEffectsForDate } from '../../lib/dataManifest'
import type { ManifestDataset } from '../../lib/dataManifest'
import {
  classifyTrafficEffect,
  monitorRadiusFromZoomAndEffect,
  opacityFromConfidence,
  roadWidthFromEffect,
} from '../../lib/visualEncoding'
import type { CompareMode, CompareRenderMode, AppMode } from '../../state/appStore'
import type { EvidenceClassification } from '../../types/traffic'

const NYC_CENTER: [number, number] = [-73.9712, 40.715]

const NYC_BOUNDS: [[number, number], [number, number]] = [
  [-74.35, 40.45],
  [-73.55, 40.98],
]

const NYC_BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#0a0e10',
      },
      minzoom: 0,
      maxzoom: 22,
    },
    {
      id: 'openstreetmap-base',
      type: 'raster',
      source: 'openstreetmap',
      paint: {
        'raster-opacity': 0.52,
        'raster-saturation': -1,
        'raster-contrast': -0.32,
        'raster-brightness-min': 0.12,
        'raster-brightness-max': 0.7,
      },
    },
  ],
}

const NYC_REFERENCE_LABELS: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.98, 40.76] },
      properties: { name: 'Manhattan' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.95, 40.65] },
      properties: { name: 'Brooklyn' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.81, 40.73] },
      properties: { name: 'Queens' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.89, 40.85] },
      properties: { name: 'Bronx' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-74.14, 40.58] },
      properties: { name: 'Staten Island' },
    },
  ],
}

const CLASSIFICATION_COLORS: Record<EvidenceClassification, [number, number, number]> = {
  improved: [116, 198, 215],
  worsened: [216, 172, 88],
  no_material_change: [138, 145, 148],
  insufficient_evidence: [138, 145, 148],
}

interface OverlayState {
  dataset: ManifestDataset | null
  currentDateIso: string
  activeMode: AppMode
  compareMode: CompareMode
  focusedHotspotKey: string | null
}

interface MapShellProps {
  dataset: ManifestDataset | null
  currentDateIso: string
  activeMode: AppMode
  compareMode: CompareMode
  compareRenderMode: CompareRenderMode
  focusedHotspotId: string | null
  focusedHotspotKind: 'traffic' | 'monitor' | null
  dataError: boolean
}

type ScreenPoint = { x: number, y: number }
type EffectiveRenderMode = 'actual' | 'expected' | 'difference'

type NumericColor = [number, number, number]

type TrafficStyle = {
  color: NumericColor
  alpha: number
  width: number
}

type MonitorStyle = {
  color: NumericColor
  alpha: number
  radius: number
}

type HitTarget = {
  key: string
  kind: 'traffic' | 'monitor'
  id: string
  name: string
  effect: number
  observed: number
  expected: number
  confidence: number
  classification: string
  points?: ScreenPoint[]
  x?: number
  y?: number
  radius?: number
  hitWidth?: number
}

const timestampFromIso = (isoDate: string): number => {
  return Date.parse(`${isoDate}T00:00:00Z`)
}

const timelineStrength = (
  currentDateIso: string,
  policyStartDateIso: string,
  latestObservationDateIso: string,
): number => {
  const currentTs = timestampFromIso(currentDateIso)
  const policyTs = timestampFromIso(policyStartDateIso)
  const latestTs = timestampFromIso(latestObservationDateIso)

  if (!Number.isFinite(currentTs) || !Number.isFinite(policyTs) || !Number.isFinite(latestTs)) {
    return 1
  }

  if (latestTs <= policyTs) {
    return currentTs >= policyTs ? 1 : 0
  }

  if (currentTs <= policyTs) return 0
  if (currentTs >= latestTs) return 1

  const t = (currentTs - policyTs) / (latestTs - policyTs)
  const easedT = t * t * (3 - (2 * t))
  return interpolateNumber(0, 1)(easedT)
}

const toRgba = (color: [number, number, number], alpha: number): string => {
  const safeAlpha = Math.max(0, Math.min(1, alpha))
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${safeAlpha})`
}

const monitorColor = (classification: string): [number, number, number] => {
  if (classification === 'worsened') return [216, 172, 88]
  if (classification === 'improved') return [116, 198, 215]
  return [138, 145, 148]
}

const MAP_FALLBACK_MESSAGE = 'Enable WebGL2 and hardware acceleration to use map interactions. Timeline and analysis panels remain available.'

const hasWebGL2Support = (): boolean => {
  try {
    const canvas = document.createElement('canvas')
    return canvas.getContext('webgl2') !== null
  } catch {
    return false
  }
}

const focusOffsetForMode = (mode: AppMode): [number, number] => {
  if (window.innerWidth <= 720) {
    return [0, -118]
  }

  if (mode === 'HOTSPOTS' || mode === 'CONFIDENCE' || mode === 'EQUITY') {
    return [-170, -16]
  }

  if (mode === 'STORY') {
    return [136, -16]
  }

  return [0, -16]
}

const blendNumber = (from: number, to: number, progress: number): number => {
  return from + ((to - from) * progress)
}

const blendColor = (from: NumericColor, to: NumericColor, progress: number): NumericColor => {
  return [
    blendNumber(from[0], to[0], progress),
    blendNumber(from[1], to[1], progress),
    blendNumber(from[2], to[2], progress),
  ]
}

const effectClassColor = (classification: EvidenceClassification): NumericColor => {
  return CLASSIFICATION_COLORS[classification]
}

const getTargetRenderMode = (
  compareMode: CompareMode,
  compareRenderMode: CompareRenderMode,
): EffectiveRenderMode => {
  if (compareMode === 'off') return 'difference'
  return compareRenderMode
}

const getTrafficStyleForMode = (
  corridor: (ReturnType<typeof getInterpolatedEffectsForDate>)['traffic'][number],
  renderMode: EffectiveRenderMode,
  strength: number,
): TrafficStyle => {
  const confidence = Math.max(0, Math.min(1, corridor.confidence))

  if (renderMode === 'expected') {
    const baselineMagnitude = Math.min(0.15, Math.max(0.015, corridor.expected / 700))
    return {
      color: [165, 171, 168],
      alpha: blendNumber(0.2, 0.55, strength),
      width: roadWidthFromEffect(baselineMagnitude, blendNumber(0.45, 0.85, strength)),
    }
  }

  const rawObservedDelta = (corridor.observed / Math.max(1, corridor.expected)) - 1
  const effect = renderMode === 'actual' ? rawObservedDelta : corridor.effectPct
  const classification = classifyTrafficEffect(effect)
  const intensity = blendNumber(0.15, 1, strength)

  return {
    color: effectClassColor(classification),
    alpha: opacityFromConfidence(confidence) * strength,
    width: roadWidthFromEffect(Math.abs(effect), intensity),
  }
}

const getMonitorStyleForMode = (
  monitor: (ReturnType<typeof getInterpolatedEffectsForDate>)['monitors'][number],
  renderMode: EffectiveRenderMode,
  zoom: number,
  strength: number,
): MonitorStyle => {
  const confidence = Math.max(0, Math.min(1, monitor.confidence))

  if (renderMode === 'expected') {
    return {
      color: [165, 171, 168],
      alpha: blendNumber(0.24, 0.5, strength),
      radius: monitorRadiusFromZoomAndEffect(zoom, 0.08, strength * 0.7),
    }
  }

  const actualEffect = monitor.observedPm25 - monitor.expectedPm25
  const effect = renderMode === 'actual' ? actualEffect : monitor.effect
  return {
    color: monitorColor(effect > 0.01 ? 'worsened' : effect < -0.01 ? 'improved' : 'no_change'),
    alpha: opacityFromConfidence(confidence) * strength,
    radius: monitorRadiusFromZoomAndEffect(zoom, Math.abs(effect), strength),
  }
}

const distToSegment = (point: ScreenPoint, start: ScreenPoint, end: ScreenPoint): number => {
  const dx = end.x - start.x
  const dy = end.y - start.y

  if (dx === 0 && dy === 0) {
    const px = point.x - start.x
    const py = point.y - start.y
    return Math.sqrt((px * px) + (py * py))
  }

  const t = Math.max(0, Math.min(1, (((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / ((dx * dx) + (dy * dy))))
  const projX = start.x + (t * dx)
  const projY = start.y + (t * dy)
  const px = point.x - projX
  const py = point.y - projY
  return Math.sqrt((px * px) + (py * py))
}

const findHitTarget = (
  targets: HitTarget[],
  point: ScreenPoint,
  mode: 'strict' | 'nearest' = 'strict',
): HitTarget | null => {
  let closest: HitTarget | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  const nearestLimit = mode === 'nearest' ? 140 : Number.POSITIVE_INFINITY

  for (const target of targets) {
    if (target.kind === 'monitor' && target.x !== undefined && target.y !== undefined && target.radius !== undefined) {
      const dx = point.x - target.x
      const dy = point.y - target.y
      const distance = Math.sqrt((dx * dx) + (dy * dy))
      const threshold = Math.max(8, target.radius + 4)

      if (distance <= threshold && distance < closestDistance) {
        closest = target
        closestDistance = distance
      }

      if (mode === 'nearest' && distance < closestDistance) {
        closest = target
        closestDistance = distance
      }
      continue
    }

    if (target.kind === 'traffic' && target.points && target.points.length > 1) {
      for (let index = 0; index < target.points.length - 1; index += 1) {
        const distance = distToSegment(point, target.points[index], target.points[index + 1])
        const threshold = Math.max(8, (target.hitWidth ?? 8) + 3)
        if (distance <= threshold && distance < closestDistance) {
          closest = target
          closestDistance = distance
        }

        if (mode === 'nearest' && distance < closestDistance) {
          closest = target
          closestDistance = distance
        }
      }
    }
  }

  if (mode === 'nearest' && closestDistance > nearestLimit) {
    return null
  }

  return closest
}

const syncOverlayCanvas = (
  map: maplibregl.Map,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): { width: number, height: number } => {
  const width = map.getCanvas().clientWidth
  const height = map.getCanvas().clientHeight
  const pixelRatio = window.devicePixelRatio || 1

  const nextWidth = Math.round(width * pixelRatio)
  const nextHeight = Math.round(height * pixelRatio)

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth
    canvas.height = nextHeight
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  return { width, height }
}

export function MapShell({
  dataset,
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
    dataset: null,
    currentDateIso: '2025-01-05',
    activeMode: 'STORY',
    compareMode: 'off',
    focusedHotspotKey: null,
  })
  const [mapReady, setMapReady] = useState(false)
  const [mapFallbackMessage, setMapFallbackMessage] = useState<string | null>(() => (
    hasWebGL2Support() ? null : MAP_FALLBACK_MESSAGE
  ))
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

    if (!state.dataset) {
      hitTargetsRef.current = []
      return
    }

    const strength = timelineStrength(
      state.currentDateIso,
      state.dataset.manifest.policy_start_date,
      state.dataset.manifest.latest_observation_date,
    )

    if (strength <= 0) return

    const interpolatedEffects = getInterpolatedEffectsForDate(state.dataset, state.currentDateIso)
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
    } catch {
      window.requestAnimationFrame(() => {
        setMapFallbackMessage(MAP_FALLBACK_MESSAGE)
      })
      return
    }

    mapRef.current = map

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
      dataset,
      currentDateIso,
      activeMode,
      compareMode,
      focusedHotspotKey,
    }
    drawOverlay()
  }, [activeMode, compareMode, currentDateIso, dataset, drawOverlay, focusedHotspotId, focusedHotspotKind])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !dataset || !focusedHotspotId || !focusedHotspotKind) {
      lastCenteredHotspotKeyRef.current = null
      focusTargetRef.current = null
      focusIndicatorRef.current?.classList.remove('is-active')
      return
    }

    const hotspotKey = `${focusedHotspotKind}:${focusedHotspotId}`
    if (lastCenteredHotspotKeyRef.current === hotspotKey) return

    let center: [number, number] | null = null

    if (focusedHotspotKind === 'traffic') {
      const corridor = dataset.effects.traffic.find((item) => item.locationId === focusedHotspotId)
      if (corridor && corridor.coordinates.length > 0) {
        center = corridor.coordinates[Math.floor(corridor.coordinates.length / 2)]
      }
    }

    if (focusedHotspotKind === 'monitor') {
      const monitor = dataset.effects.monitors.find((item) => item.monitorId === focusedHotspotId)
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
  }, [activeMode, dataset, focusedHotspotId, focusedHotspotKind, mapReady, triggerFocusIndicator])

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
        'text-letter-spacing': 0.12,
        'text-font': ['Open Sans Semibold'],
      },
      paint: {
        'text-color': 'rgba(188, 194, 190, 0.32)',
        'text-halo-color': 'rgba(10, 14, 16, 0.78)',
        'text-halo-width': 1.2,
      },
    })
  }, [mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !dataset) return

    if (dataset.manhattan) {
      if (map.getSource('manhattan-boundary')) {
        const source = map.getSource('manhattan-boundary') as maplibregl.GeoJSONSource
        source.setData(dataset.manhattan as FeatureCollection)
      } else {
        map.addSource('manhattan-boundary', { type: 'geojson', data: dataset.manhattan as never })
        map.addLayer({
          id: 'manhattan-fill',
          type: 'fill',
          source: 'manhattan-boundary',
          paint: {
            'fill-color': '#8ab7c7',
            'fill-opacity': 0.03,
          },
        })
        map.addLayer({
          id: 'manhattan-line',
          type: 'line',
          source: 'manhattan-boundary',
          paint: {
            'line-color': '#d8edf4',
            'line-opacity': 0.18,
            'line-width': 0.8,
          },
        })
      }
    }

    if (map.getSource('demo-zone')) {
      const source = map.getSource('demo-zone') as maplibregl.GeoJSONSource
      source.setData(dataset.zone as FeatureCollection)
      return
    }

    map.addSource('demo-zone', { type: 'geojson', data: dataset.zone as never })
    map.addLayer({
      id: 'demo-zone-fill',
      type: 'fill',
      source: 'demo-zone',
      paint: { 'fill-color': '#d7a648', 'fill-opacity': 0.02 },
    })
    map.addLayer({
      id: 'demo-zone-line',
      type: 'line',
      source: 'demo-zone',
      paint: {
        'line-color': '#d7a648',
        'line-opacity': 0.2,
        'line-width': 0.8,
        'line-dasharray': [2, 2],
      },
    })
  }, [dataset, mapReady])

  return (
    <>
      <div
        ref={containerRef}
        className="map-shell"
        role="region"
        aria-label="Interactive map of New York City"
      />
      <div className="map-focus-indicator" ref={focusIndicatorRef} aria-hidden="true" />
      {mapFallbackMessage && (
        <aside className="map-fallback-panel" role="status" aria-live="polite">
          <p className="map-fallback-kicker">MAP UNAVAILABLE</p>
          <h3>Interactive map requires WebGL2.</h3>
          <p>{mapFallbackMessage}</p>
        </aside>
      )}
      {dataError && (
        <div className="data-error" role="alert">
          Map estimates could not be loaded. Try refreshing the page.
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
                BASELINE EXPECTED · {selectedTarget.kind === 'traffic' ? `INDEX ${selectedTarget.expected.toFixed(1)}` : `${selectedTarget.expected.toFixed(2)} ug/m3`}
              </>
            )}
            {getTargetRenderMode(compareMode, compareRenderMode) === 'actual' && (
              <>
                OBSERVED · {selectedTarget.kind === 'traffic' ? `INDEX ${selectedTarget.observed.toFixed(1)}` : `${selectedTarget.observed.toFixed(2)} ug/m3`}
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