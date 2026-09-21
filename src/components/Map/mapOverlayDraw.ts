import type * as maplibregl from 'maplibre-gl'
import { getInterpolatedEffectsForDate } from '../../lib/devSyntheticDataset'
import type { DevSyntheticDataset } from '../../lib/devSyntheticDataset'
import type { AppMode, CompareMode } from '../../state/appStore'
import {
  blendColor,
  blendNumber,
  getMonitorStyleForMode,
  getTrafficStyleForMode,
  syncOverlayCanvas,
  timelineStrength,
  toRgba,
} from './mapOverlay'
import type { EffectiveRenderMode, HitTarget } from './mapOverlay'

/**
 * Drawing the synthetic overlay and collecting its hit targets.
 *
 * This is the prototype overlay: it draws corridors and monitors from a synthetic dataset, and a
 * production build never loads one, so in release mode it clears the canvas and returns no targets.
 * It lives here rather than inside `MapShell` because it is a self-contained drawing routine over
 * whatever the map currently shows, while the component around it is about the map's lifecycle.
 */

export interface OverlayState {
  syntheticDataset: DevSyntheticDataset | null
  currentDateIso: string
  activeMode: AppMode
  compareMode: CompareMode
  focusedHotspotKey: string | null
}

export interface OverlayDrawContext {
  map: maplibregl.Map
  overlay: HTMLCanvasElement
  state: OverlayState
  hoveredKey: string | null
  selectedKey: string | null
  transition: { from: EffectiveRenderMode, to: EffectiveRenderMode, progress: number }
  focusTarget: [number, number] | null
  projectFocus: (lngLat: [number, number]) => void
}

/**
 * Draw one frame.
 *
 * Returns the hit targets the frame produced, `[]` when there is nothing to draw, or `null` when the
 * frame must leave the previous targets alone. That distinction is load-bearing: a strength of zero
 * means the timeline sits outside the drawn window, not that the map has no targets.
 */
export const drawOverlayFrame = (context: OverlayDrawContext): HitTarget[] | null => {
  const { map, overlay, state } = context


    if (!map || !overlay) return null

    if (context.focusTarget) {
  context.projectFocus(context.focusTarget)
    }

    const ctx = overlay.getContext('2d')
    if (!ctx) return null

    const { width, height } = syncOverlayCanvas(map, overlay, ctx)
    ctx.clearRect(0, 0, width, height)

    // Release mode draws no estimated effects: only published assets may reach the map overlay.
    if (!state.syntheticDataset) {
  return []
    }

    const strength = timelineStrength(
  state.currentDateIso,
  state.syntheticDataset.manifest.policy_start_date,
  state.syntheticDataset.manifest.latest_observation_date,
    )

    if (strength <= 0) return null

    const interpolatedEffects = getInterpolatedEffectsForDate(state.syntheticDataset, state.currentDateIso)
    const nextHitTargets: HitTarget[] = []
  const modeTransition = context.transition
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
    const isActive = context.hoveredKey === key
      || context.selectedKey === key
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
    const isActive = context.hoveredKey === key
      || context.selectedKey === key
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

    return nextHitTargets
}
