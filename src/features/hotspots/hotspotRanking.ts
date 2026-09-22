import type { TrafficObservation } from '../../types/releaseData'

export const HOTSPOT_RANKINGS = ['mean', 'maximum', 'coverage'] as const
export type HotspotRanking = (typeof HOTSPOT_RANKINGS)[number]

const valueForRanking = (observation: TrafficObservation, ranking: HotspotRanking): number => {
  if (ranking === 'maximum') return observation.maxObserved15MinVolume
  if (ranking === 'coverage') return observation.observationCount
  return observation.meanObserved15MinVolume
}

const compareIdentity = (left: TrafficObservation, right: TrafficObservation): number => {
  return left.segmentId - right.segmentId
    || left.direction.localeCompare(right.direction)
    || left.dayType.localeCompare(right.dayType)
    || left.timeBand.localeCompare(right.timeBand)
}

/** Rank only the published selection. The copied array keeps release data immutable. */
export function rankTrafficHotspots(
  observations: TrafficObservation[],
  ranking: HotspotRanking,
  limit = 12,
): TrafficObservation[] {
  if (!HOTSPOT_RANKINGS.includes(ranking) || !Number.isSafeInteger(limit) || limit < 0) return []
  return [...observations]
    .sort((left, right) => valueForRanking(right, ranking) - valueForRanking(left, ranking) || compareIdentity(left, right))
    .slice(0, limit)
}

export function trafficHotspotKey(observation: TrafficObservation): string {
  return [
    observation.segmentId,
    observation.direction,
    observation.dayType,
    observation.timeBand,
  ].join(':')
}
