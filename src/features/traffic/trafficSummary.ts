/**
 * Descriptive summaries over the published traffic-observation asset.
 *
 * Every figure here is a description of what the release published, never an estimate of what
 * traffic "would have been". The measure spec (`pipeline/methods/release-1.yaml`) defines the
 * published fields as sums and counts over sampled DOT 15-minute observations, so the UI copy that
 * consumes these values must stay inside that same descriptive boundary.
 */

import type { FeatureCollection } from 'geojson'
import { TRAFFIC_DAY_TYPES, TRAFFIC_TIME_BANDS } from '../../types/releaseData'
import type { TrafficDayType, TrafficObservation } from '../../types/releaseData'

export interface TrafficMonthSummary {
  month: string
  /** Published segment/month aggregates in the selection. */
  publishedSegments: number
  /** Total validated source observations behind those aggregates. */
  totalObservations: number
  /**
   * Mean of the published per-segment means. This is a descriptive statistic across published
   * aggregates, not an average traffic volume for the location or the period.
   */
  meanOfPublishedSegmentMeans: number
  /** Largest single published per-segment mean in the selection. */
  highestPublishedSegmentMean: number
  /** Largest single observed 15-minute volume anywhere in the selection. */
  largestObserved15MinVolume: number
  observedDayMin: number
  observedDayMax: number
  boroughs: string[]
}

/** `YYYY-MM` for an ISO date. Blank input yields a blank month so no month is silently invented. */
export const monthFromIsoDate = (isoDate: string): string => isoDate.slice(0, 7)

export const filterTrafficByMonth = (
  observations: TrafficObservation[],
  month: string,
): TrafficObservation[] => {
  return observations.filter((observation) => observation.month === month)
}

export const filterTrafficByBorough = (
  observations: TrafficObservation[],
  borough: string | null,
): TrafficObservation[] => {
  if (!borough) return observations
  return observations.filter((observation) => observation.borough === borough)
}

export const filterTrafficByDayType = (
  observations: TrafficObservation[],
  dayType: TrafficDayType | null,
): TrafficObservation[] => {
  if (!dayType) return observations
  return observations.filter((observation) => observation.dayType === dayType)
}

export const filterTrafficByTimeBand = (
  observations: TrafficObservation[],
  timeBand: string | null,
): TrafficObservation[] => {
  if (!timeBand) return observations
  return observations.filter((observation) => observation.timeBand === timeBand)
}

export const listBoroughs = (observations: TrafficObservation[]): string[] => {
  return [...new Set(observations.map((observation) => observation.borough))].sort()
}

/** Every month the release published for, oldest first, so a window can be chosen from the rail. */
export const listTrafficMonths = (observations: TrafficObservation[]): string[] => {
  return [...new Set(observations.map((observation) => observation.month))].sort()
}

/** Day types present in the selection, in the contract's declared order. */
export const listDayTypes = (observations: TrafficObservation[]): TrafficDayType[] => {
  return TRAFFIC_DAY_TYPES.filter((dayType) =>
    observations.some((observation) => observation.dayType === dayType),
  )
}

/** Time bands present in the selection, in reading order rather than alphabetical order. */
export const listTimeBands = (observations: TrafficObservation[]): string[] => {
  return TRAFFIC_TIME_BANDS.filter((band) =>
    observations.some((observation) => observation.timeBand === band),
  )
}

/** Returns null for an empty selection so a view must state that nothing was published. */
export const summarizeTrafficMonth = (
  observations: TrafficObservation[],
): TrafficMonthSummary | null => {
  if (observations.length === 0) return null

  const means = observations.map((observation) => observation.meanObserved15MinVolume)
  const observedDays = observations.map((observation) => observation.observedDays)
  const sum = means.reduce((total, value) => total + value, 0)

  return {
    month: observations[0].month,
    publishedSegments: observations.length,
    totalObservations: observations.reduce((total, observation) => total + observation.observationCount, 0),
    meanOfPublishedSegmentMeans: sum / observations.length,
    highestPublishedSegmentMean: Math.max(...means),
    largestObserved15MinVolume: Math.max(
      ...observations.map((observation) => observation.maxObserved15MinVolume),
    ),
    observedDayMin: Math.min(...observedDays),
    observedDayMax: Math.max(...observedDays),
    boroughs: listBoroughs(observations),
  }
}

export const topSegmentsByPublishedMean = (
  observations: TrafficObservation[],
  limit: number,
): TrafficObservation[] => {
  return [...observations]
    .sort((left, right) => right.meanObserved15MinVolume - left.meanObserved15MinVolume)
    .slice(0, limit)
}

export const describeSegment = (observation: TrafficObservation): string => {
  const street = observation.street ?? 'Unlabeled segment'
  const bounds = [observation.fromStreet, observation.toStreet].filter(Boolean).join(' → ')
  return bounds ? `${street} (${bounds})` : street
}

/**
 * Map payload for the published points. Coordinates come from the validated asset unchanged, so the
 * map cannot place a point the release did not publish.
 */
export const toTrafficFeatureCollection = (
  observations: TrafficObservation[],
): FeatureCollection => {
  return {
    type: 'FeatureCollection',
    features: observations.map((observation) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: observation.coordinates },
      properties: {
        segmentId: observation.segmentId,
        borough: observation.borough,
        direction: observation.direction,
        meanVolume: observation.meanObserved15MinVolume,
      },
    })),
  }
}
