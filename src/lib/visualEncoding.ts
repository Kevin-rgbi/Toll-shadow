import { scaleLinear, scaleSqrt } from 'd3-scale'
import type { EvidenceClassification } from '../types/traffic'

const ROAD_WIDTH_SCALE = scaleLinear<number, number>().domain([0, 0.15]).range([1.8, 8.2]).clamp(true)
const CONFIDENCE_ALPHA_SCALE = scaleLinear<number, number>().domain([0, 1]).range([0.2, 0.95]).clamp(true)
const MONITOR_RADIUS_SCALE = scaleLinear<number, number>().domain([9, 15]).range([4, 12]).clamp(true)
const MONITOR_EFFECT_SCALE = scaleSqrt<number, number>().domain([0, 0.5]).range([0, 7]).clamp(true)

export const classifyTrafficEffect = (effectPct: number): EvidenceClassification => {
  if (effectPct <= -0.01) return 'improved'
  if (effectPct >= 0.01) return 'worsened'
  return 'no_material_change'
}

export const roadWidthFromEffect = (effectPctAbs: number, timelineIntensity: number): number => {
  return ROAD_WIDTH_SCALE(effectPctAbs) * timelineIntensity
}

export const opacityFromConfidence = (confidence: number): number => {
  return CONFIDENCE_ALPHA_SCALE(confidence)
}

export const monitorRadiusFromZoomAndEffect = (
  zoom: number,
  effectAbs: number,
  timelineStrength: number,
): number => {
  return MONITOR_RADIUS_SCALE(zoom) + (MONITOR_EFFECT_SCALE(effectAbs) * timelineStrength)
}
