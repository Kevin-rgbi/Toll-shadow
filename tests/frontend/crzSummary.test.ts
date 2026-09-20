import { describe, expect, it } from 'vitest'
import { crzMonthBounds, summarizeCrzByGroup, summarizeCrzWindow } from '../../src/features/crz/crzSummary'
import type { CrzEntrySummary } from '../../src/types/releaseData'

const entry = (overrides: Partial<CrzEntrySummary> = {}): CrzEntrySummary => ({
  sourceId: 'mta_crz_entries_archive_20260920',
  measureId: 'crz_monthly_detection_group_entries',
  detectionGroup: 'Brooklyn Bridge',
  detectionRegion: 'Brooklyn',
  month: '2025-01',
  crzEntries: 100,
  excludedRoadwayEntries: 20,
  totalEntries: 120,
  ...overrides,
})

describe('CRZ summary', () => {
  it('reports no bounds for an empty selection', () => {
    expect(crzMonthBounds([])).toBeNull()
    expect(summarizeCrzWindow([])).toBeNull()
  })

  it('takes the window from the earliest and latest published months', () => {
    const rows = [entry({ month: '2025-03' }), entry({ month: '2025-01' })]

    expect(crzMonthBounds(rows)).toEqual({ start: '2025-01', end: '2025-03' })
  })

  it('sums the published monthly sums and counts what it covered', () => {
    const window = summarizeCrzWindow([entry(), entry({ month: '2025-02' }), entry({ detectionGroup: 'Queensboro Bridge' })])

    expect(window?.publishedMonths).toBe(2)
    expect(window?.groupCount).toBe(2)
    expect(window?.crzEntries).toBe(300)
    expect(window?.excludedRoadwayEntries).toBe(60)
    expect(window?.totalEntries).toBe(360)
  })

  it('groups by detection group and orders by CRZ entries', () => {
    const summaries = summarizeCrzByGroup([
      entry({ detectionGroup: 'Queensboro Bridge', crzEntries: 10, excludedRoadwayEntries: 0, totalEntries: 10 }),
      entry({ detectionGroup: 'Brooklyn Bridge', crzEntries: 500, excludedRoadwayEntries: 0, totalEntries: 500 }),
    ])

    expect(summaries.map((summary) => summary.detectionGroup)).toEqual(['Brooklyn Bridge', 'Queensboro Bridge'])
    expect(summaries[0].publishedMonths).toBe(1)
  })
})
