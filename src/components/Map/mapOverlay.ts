import { interpolateNumber } from 'd3-interpolate'
import type * as maplibregl from 'maplibre-gl'
import type { InterpolatedMonitorEffect, InterpolatedTrafficEffect } from '../../lib/devSyntheticDataset'
import {
  classifyTrafficEffect,
  monitorRadiusFromZoomAndEffect,
  opacityFromConfidence,
  roadWidthFromEffect,
} from '../../lib/visualEncoding'
import type { CompareMode, CompareRenderMode } from '../../state/appStore'
import type { EvidenceClassification } from '../../types/traffic'

const CLASSIFICATION_COLORS: Record<EvidenceClassification, [number, number, number]> = {
  improved: [116, 198, 215],
  worsened: [216, 172, 88],
  no_material_change: [138, 145, 148],
  insufficient_evidence: [138, 145, 148],
}

export type ScreenPoint = { x: number, y: number }
export type EffectiveRenderMode = 'actual' | 'expected' | 'difference'
export type NumericColor = [number, number, number]

export type TrafficStyle = {
  color: NumericColor
  alpha: number
  width: number
}

export type MonitorStyle = {
  color: NumericColor
  alpha: number
  radius: number
}

export type HitTarget = {
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

export const timelineStrength = (
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

export const toRgba = (color: [number, number, number], alpha: number): string => {
  const safeAlpha = Math.max(0, Math.min(1, alpha))
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${safeAlpha})`
}

const monitorColor = (classification: string): [number, number, number] => {
  if (classification === 'worsened') return [216, 172, 88]
  if (classification === 'improved') return [116, 198, 215]
  return [138, 145, 148]
}

export const blendNumber = (from: number, to: number, progress: number): number => {
  return from + ((to - from) * progress)
}

export const blendColor = (from: NumericColor, to: NumericColor, progress: number): NumericColor => {
  return [
    blendNumber(from[0], to[0], progress),
    blendNumber(from[1], to[1], progress),
    blendNumber(from[2], to[2], progress),
  ]
}

const effectClassColor = (classification: EvidenceClassification): NumericColor => {
  return CLASSIFICATION_COLORS[classification]
}

export const getTargetRenderMode = (
  compareMode: CompareMode,
  compareRenderMode: CompareRenderMode,
): EffectiveRenderMode => {
  if (compareMode === 'off') return 'difference'
  return compareRenderMode
}

export const getTrafficStyleForMode = (
  corridor: InterpolatedTrafficEffect,
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

export const getMonitorStyleForMode = (
  monitor: InterpolatedMonitorEffect,
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

export const findHitTarget = (
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

export const syncOverlayCanvas = (
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
