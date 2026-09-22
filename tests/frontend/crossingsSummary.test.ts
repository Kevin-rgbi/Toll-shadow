import { describe, expect, it } from 'vitest'
import {
  crossingsDateBounds,
  directionLabel,
  filterCrossingsByDateRange,
  summarizeCrossingsByDirection,
  summarizeCrossingsByPlaza,
  summarizeCrossingsWindow,
} from '../../src/features/crossings/crossingsSummary'
import type { FacilityCrossing } from '../../src/types/releaseData'

const crossing = (overrides: Partial<FacilityCrossing> = {}): FacilityCrossing => ({
  sourceId: 'mta_daily_bridge_tunnel_traffic_archive_20260915',
  measureId: 'mta_daily_facility_crossings',
  observedOn: '2024-01-01',
  plazaId: 21,
  facilityCode: 'TBX',
  facilityName: 'Robert F. Kennedy Bridge (Bronx and Queens plazas)',
  direction: 'I',
  ezpassVehicles: 90,
  tollsByMailVehicles: 10,
  totalVehicles: 100,
  ezpassSharePct: 90,
  paymentCoverageComplete: true,
  ...overrides,
})

describe('crossings summary', () => {
  it('reports no bounds for an empty selection', () => {
    expect(crossingsDateBounds([])).toBeNull()
    expect(summarizeCrossingsWindow([])).toBeNull()
  })

  it('takes bounds from the earliest and latest published dates', () => {
    const rows = [crossing({ observedOn: '2024-05-02' }), crossing({ observedOn: '2024-01-01' })]

    expect(crossingsDateBounds(rows)).toEqual({ start: '2024-01-01', end: '2024-05-02' })
  })

  it('treats the date range as inclusive on both ends', () => {
    const rows = [
      crossing({ observedOn: '2024-01-01' }),
      crossing({ observedOn: '2024-01-02' }),
      crossing({ observedOn: '2024-01-03' }),
    ]

    expect(filterCrossingsByDateRange(rows, '2024-01-01', '2024-01-03')).toHaveLength(3)
    expect(filterCrossingsByDateRange(rows, '2024-01-02', '2024-01-02')).toHaveLength(1)
    expect(filterCrossingsByDateRange(rows, '2024-01-03', '2024-01-03')).toHaveLength(1)
  })

  it('summarizes the counted window without inventing a rate', () => {
    const window = summarizeCrossingsWindow([
      crossing({ totalVehicles: 100, plazaId: 21 }),
      crossing({ totalVehicles: 250, plazaId: 22 }),
    ])

    expect(window?.totalVehicles).toBe(350)
    expect(window?.publishedDays).toBe(2)
    expect(window?.plazaCount).toBe(2)
  })

  it('recomputes the E-ZPass share from summed components rather than averaging daily shares', () => {
    const [summary] = summarizeCrossingsByPlaza([
      crossing({ ezpassVehicles: 90, tollsByMailVehicles: 10, totalVehicles: 100, ezpassSharePct: 90 }),
      crossing({ ezpassVehicles: 10, tollsByMailVehicles: 90, totalVehicles: 100, ezpassSharePct: 10 }),
    ])

    expect(summary.totalVehicles).toBe(200)
    expect(summary.ezpassVehicles).toBe(100)
    expect(summary.ezpassSharePct).toBe(50)
  })

  it('orders plazas by counted vehicles and groups them separately', () => {
    const summaries = summarizeCrossingsByPlaza([
      crossing({ plazaId: 22, totalVehicles: 500, ezpassVehicles: 500, tollsByMailVehicles: 0, ezpassSharePct: 100 }),
      crossing({ plazaId: 21, totalVehicles: 100, ezpassVehicles: 100, tollsByMailVehicles: 0, ezpassSharePct: 100 }),
    ])

    expect(summaries.map((summary) => summary.plazaId)).toEqual([22, 21])
    expect(summaries[0].publishedDays).toBe(1)
  })

  it('splits directions and omits a direction with no published rows', () => {
    const summaries = summarizeCrossingsByDirection([
      crossing({ direction: 'I' }),
      crossing({ direction: 'I' }),
    ])

    expect(summaries).toHaveLength(1)
    expect(summaries[0].direction).toBe('I')
    expect(summaries[0].totalVehicles).toBe(200)
  })

  it('labels directions without asserting a facility meaning', () => {
    expect(directionLabel('I')).toBe('Inbound (I)')
    expect(directionLabel('O')).toBe('Outbound (O)')
  })
})
