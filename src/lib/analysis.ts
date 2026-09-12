import { getInterpolatedEffectsForDate } from './dataManifest'
import type { ManifestDataset } from './dataManifest'

type HotspotKind = 'traffic' | 'monitor'

export interface HotspotItem {
  id: string
  kind: HotspotKind
  name: string
  borough: string
  effect: number
  confidence: number
  score: number
  direction: 'improved' | 'worsened' | 'neutral'
}

export interface ConfidenceSummary {
  highConfidenceCount: number
  mediumConfidenceCount: number
  lowConfidenceCount: number
  averageConfidence: number
}

export interface EquitySignal {
  borough: string
  vulnerability: number
  worsenedScore: number
  improvedScore: number
  netBurden: number
}

const BOROUGH_VULNERABILITY: Record<string, number> = {
  Bronx: 0.9,
  Brooklyn: 0.76,
  Queens: 0.63,
  Manhattan: 0.5,
  StatenIsland: 0.44,
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

export const buildHotspotRankings = (
  dataset: ManifestDataset,
  currentDateIso: string,
): HotspotItem[] => {
  const interpolated = getInterpolatedEffectsForDate(dataset, currentDateIso)

  const traffic: HotspotItem[] = interpolated.traffic.map((corridor) => {
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

  const monitors: HotspotItem[] = interpolated.monitors.map((monitor) => {
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

export const summarizeConfidence = (hotspots: HotspotItem[]): ConfidenceSummary => {
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

export const buildEquitySignals = (hotspots: HotspotItem[]): EquitySignal[] => {
  const grouped = new Map<string, EquitySignal>()

  for (const hotspot of hotspots) {
    const borough = hotspot.borough
    const vulnerability = BOROUGH_VULNERABILITY[borough] ?? 0.5
    const weighted = hotspot.score * vulnerability
    const current = grouped.get(borough) ?? {
      borough,
      vulnerability,
      worsenedScore: 0,
      improvedScore: 0,
      netBurden: 0,
    }

    if (hotspot.direction === 'worsened') {
      current.worsenedScore += weighted
    }

    if (hotspot.direction === 'improved') {
      current.improvedScore += weighted
    }

    current.netBurden = current.worsenedScore - current.improvedScore
    grouped.set(borough, current)
  }

  return [...grouped.values()].sort((left, right) => right.netBurden - left.netBurden)
}
