import { describe, expect, it } from 'vitest'
import {
  rankTrafficHotspots,
  type HotspotRanking,
} from '../../src/features/hotspots/hotspotRanking'
import type { TrafficObservation } from '../../src/types/releaseData'

const observation = (overrides: Partial<TrafficObservation> = {}): TrafficObservation => ({
  sourceId: 'dot_automated_traffic_counts_archive_20260915',
  measureId: 'dot_monthly_sampled_traffic_volume',
  segmentId: 1,
  borough: 'Bronx',
  direction: 'NB',
  month: '2026-09',
  dayType: 'Weekday',
  timeBand: 'AM peak (06-09)',
  meanObserved15MinVolume: 20,
  maxObserved15MinVolume: 80,
  observationCount: 100,
  observedDays: 5,
  countSessions: 2,
  street: 'WESTCHESTER AVENUE',
  fromStreet: 'A',
  toStreet: 'B',
  coordinates: [-73.84, 40.84],
  ...overrides,
})

const rows = [
  observation({ segmentId: 2, meanObserved15MinVolume: 30, maxObserved15MinVolume: 70, observationCount: 90 }),
  observation({ segmentId: 1, meanObserved15MinVolume: 30, maxObserved15MinVolume: 90, observationCount: 80 }),
  observation({ segmentId: 3, meanObserved15MinVolume: 10, maxObserved15MinVolume: 100, observationCount: 120 }),
]

describe('observed traffic hotspot ranking', () => {
  it.each([
    ['mean', [1, 2, 3]],
    ['maximum', [3, 1, 2]],
    ['coverage', [3, 2, 1]],
  ] satisfies Array<[HotspotRanking, number[]]>)('ranks by %s with stable segment tie-breaking', (ranking, expected) => {
    expect(rankTrafficHotspots(rows, ranking).map((row) => row.segmentId)).toEqual(expected)
  })

  it('limits the ranking without mutating the published observations', () => {
    const before = rows.map((row) => row.segmentId)

    expect(rankTrafficHotspots(rows, 'maximum', 2)).toHaveLength(2)
    expect(rows.map((row) => row.segmentId)).toEqual(before)
  })

  it('uses direction, day type, and time band to make equal segment IDs deterministic', () => {
    const equal = [
      observation({ direction: 'SB', dayType: 'Weekend', timeBand: 'Midday (09-16)' }),
      observation({ direction: 'NB', dayType: 'Weekday', timeBand: 'AM peak (06-09)' }),
    ]

    expect(rankTrafficHotspots(equal, 'mean').map((row) => `${row.direction}:${row.dayType}:${row.timeBand}`))
      .toEqual(['NB:Weekday:AM peak (06-09)', 'SB:Weekend:Midday (09-16)'])
  })
})
