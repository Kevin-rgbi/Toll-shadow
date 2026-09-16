/**
 * Development-only prototype analysis over the synthetic visualization dataset.
 *
 * Every export here is named `synthetic` on purpose: these rankings and confidence buckets are
 * derived from the dev demo effects, they are not published measures, and they must never be
 * presented as release evidence. Release-backed measures require an approved method specification
 * (plan step A3) before any equivalent release view can be built.
 */

import { getInterpolatedEffectsForDate } from './devSyntheticDataset'
import type { DevSyntheticDataset } from './devSyntheticDataset'

type SyntheticHotspotKind = 'traffic' | 'monitor'

export interface SyntheticHotspotItem {
  id: string
  kind: SyntheticHotspotKind
  name: string
  borough: string
  effect: number
  confidence: number
  score: number
  direction: 'improved' | 'worsened' | 'neutral'
}

export interface SyntheticConfidenceSummary {
  highConfidenceCount: number
  mediumConfidenceCount: number
  lowConfidenceCount: number
  averageConfidence: number
}

const inferMonitorBorough = (name: string): string => {
  const normalized = name.toLowerCase()
  if (normalized.includes('bronx') || normalized.includes('mott haven')) return 'Bronx'
  if (normalized.includes('brooklyn')) return 'Brooklyn'
  if (normalized.includes('queens')) return 'Queens'
  if (normalized.includes('staten')) return 'StatenIsland'
  return 'Manhattan'
}

const directionFromEffect = (effect: number): 'improved' | 'worsened' | 'neutral' => {
  if (effect > 0.01) return 'worsened'
  if (effect < -0.01) return 'improved'
  return 'neutral'
}

export const buildSyntheticHotspotRankings = (
  dataset: DevSyntheticDataset,
  currentDateIso: string,
): SyntheticHotspotItem[] => {
  const interpolated = getInterpolatedEffectsForDate(dataset, currentDateIso)

  const traffic: SyntheticHotspotItem[] = interpolated.traffic.map((corridor) => {
    const magnitude = Math.abs(corridor.effectPct) * 100
    const score = magnitude * corridor.confidence
    return {
      id: corridor.locationId,
      kind: 'traffic',
      name: corridor.name,
      borough: corridor.borough,
      effect: corridor.effectPct,
      confidence: corridor.confidence,
      score,
      direction: directionFromEffect(corridor.effectPct),
    }
  })

  const monitors: SyntheticHotspotItem[] = interpolated.monitors.map((monitor) => {
    const magnitude = Math.abs(monitor.effect) * 18
    const score = magnitude * monitor.confidence
    return {
      id: monitor.monitorId,
      kind: 'monitor',
      name: monitor.name,
      borough: inferMonitorBorough(monitor.name),
      effect: monitor.effect,
      confidence: monitor.confidence,
      score,
      direction: directionFromEffect(monitor.effect),
    }
  })

  return [...traffic, ...monitors].sort((left, right) => right.score - left.score)
}

export const summarizeSyntheticConfidence = (
  hotspots: SyntheticHotspotItem[],
): SyntheticConfidenceSummary => {
  if (hotspots.length === 0) {
    return {
      highConfidenceCount: 0,
      mediumConfidenceCount: 0,
      lowConfidenceCount: 0,
      averageConfidence: 0,
    }
  }

  let highConfidenceCount = 0
  let mediumConfidenceCount = 0
  let lowConfidenceCount = 0
  let totalConfidence = 0

  for (const hotspot of hotspots) {
    totalConfidence += hotspot.confidence
    if (hotspot.confidence >= 0.75) {
      highConfidenceCount += 1
    } else if (hotspot.confidence >= 0.5) {
      mediumConfidenceCount += 1
    } else {
      lowConfidenceCount += 1
    }
  }

  return {
    highConfidenceCount,
    mediumConfidenceCount,
    lowConfidenceCount,
    averageConfidence: totalConfidence / hotspots.length,
  }
}
