import { describe, expect, it } from 'vitest'
import {
  filterTrafficByBorough,
  filterTrafficByMonth,
  listBoroughs,
  monthFromIsoDate,
  summarizeTrafficMonth,
  toTrafficFeatureCollection,
  topSegmentsByPublishedMean,
} from '../../src/features/traffic/trafficSummary'
import type { TrafficObservation } from '../../src/types/releaseData'

const observation = (overrides: Partial<TrafficObservation> = {}): TrafficObservation => ({
  sourceId: 'dot_automated_traffic_counts_archive_20260915',
  measureId: 'dot_monthly_sampled_traffic_volume',
  segmentId: 1,
  borough: 'Brooklyn',
  direction: 'WB',
  month: '2024-01',
  meanObserved15MinVolume: 10,
  maxObserved15MinVolume: 40,
  observationCount: 100,
  observedDays: 5,
  countSessions: 1,
  street: 'METROPOLITAN AVENUE',
  fromStreet: 'A',
  toStreet: 'B',
  coordinates: [-73.93, 40.714],
  ...overrides,
})

describe('traffic summary', () => {
  it('derives the month from the timeline date', () => {
    expect(monthFromIsoDate('2025-12-31')).toBe('2025-12')
    expect(monthFromIsoDate('')).toBe('')
  })

  it('selects only the requested month', () => {
    const rows = [observation(), observation({ month: '2024-02' }), observation({ segmentId: 2 })]

    expect(filterTrafficByMonth(rows, '2024-01')).toHaveLength(2)
    expect(filterTrafficByMonth(rows, '2024-08')).toHaveLength(0)
  })

  it('narrows by borough only when one is chosen', () => {
    const rows = [observation(), observation({ borough: 'Queens', segmentId: 2 })]

    expect(filterTrafficByBorough(rows, null)).toHaveLength(2)
    expect(filterTrafficByBorough(rows, 'Queens')).toHaveLength(1)
  })

  it('lists boroughs in a stable order', () => {
    const rows = [observation({ borough: 'Queens' }), observation({ borough: 'Bronx' })]

    expect(listBoroughs(rows)).toEqual(['Bronx', 'Queens'])
  })

  it('returns null for an empty selection so the view must state it', () => {
    expect(summarizeTrafficMonth([])).toBeNull()
  })

  it('reports the descriptive means and observation totals it was given', () => {
    const summary = summarizeTrafficMonth([
      observation({ meanObserved15MinVolume: 10, maxObserved15MinVolume: 40, observationCount: 100, observedDays: 5 }),
      observation({ segmentId: 2, meanObserved15MinVolume: 30, maxObserved15MinVolume: 90, observationCount: 300, observedDays: 12 }),
    ])

    expect(summary).not.toBeNull()
    expect(summary?.publishedSegments).toBe(2)
    expect(summary?.totalObservations).toBe(400)
    expect(summary?.meanOfPublishedSegmentMeans).toBe(20)
    expect(summary?.highestPublishedSegmentMean).toBe(30)
    expect(summary?.largestObserved15MinVolume).toBe(90)
    expect(summary?.observedDayMin).toBe(5)
    expect(summary?.observedDayMax).toBe(12)
  })

  it('orders the top segments by published mean without mutating the input', () => {
    const rows = [observation({ segmentId: 1, meanObserved15MinVolume: 5 }), observation({ segmentId: 2, meanObserved15MinVolume: 50 })]
    const top = topSegmentsByPublishedMean(rows, 1)

    expect(top.map((row) => row.segmentId)).toEqual([2])
    expect(rows.map((row) => row.segmentId)).toEqual([1, 2])
  })

  it('maps published coordinates onto map features unchanged', () => {
    const collection = toTrafficFeatureCollection([observation({ coordinates: [-73.95, 40.8] })])

    expect(collection.features).toHaveLength(1)
    expect(collection.features[0].geometry.coordinates).toEqual([-73.95, 40.8])
    expect(collection.features[0].properties.meanVolume).toBe(10)
  })

  it('produces an empty feature collection for an empty selection', () => {
    expect(toTrafficFeatureCollection([]).features).toHaveLength(0)
  })
})
