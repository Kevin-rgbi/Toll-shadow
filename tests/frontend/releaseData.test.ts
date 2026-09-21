import { describe, expect, it } from 'vitest'
import { parseCrzEntries, parseFacilityCrossings, parseTrafficObservations } from '../../src/lib/releaseData'

const trafficFeature = (overrides: Record<string, unknown> = {}, geometry: unknown = { type: 'Point', coordinates: [-73.93, 40.714] }) => ({
  type: 'Feature',
  geometry,
  properties: {
    source_id: 'dot_automated_traffic_counts_archive_20260915',
    measure_id: 'dot_monthly_sampled_traffic_volume',
    segment_id: 152523,
    borough: 'Brooklyn',
    direction: 'WB',
    month: '2024-01',
    day_type: 'Weekday',
    time_band: 'AM peak (06-09)',
    mean_observed_15_min_volume: 42.885417,
    max_observed_15_min_volume: 146,
    observation_count: 864,
    observed_days: 9,
    count_sessions: 1,
    street: 'METROPOLITAN AVENUE',
    from_street: 'Dead end',
    to_street: 'Varick Avenue',
    ...overrides,
  },
})

const trafficCollection = (features: unknown[]) => ({ type: 'FeatureCollection', features })

const crossingRecord = (overrides: Record<string, unknown> = {}) => ({
  source_id: 'mta_daily_bridge_tunnel_traffic_archive_20260915',
  measure_id: 'mta_daily_facility_crossings',
  observed_on: '2024-01-01',
  plaza_id: 21,
  facility_code: 'TBX',
  facility_name: 'Robert F. Kennedy Bridge (Bronx and Queens plazas)',
  direction: 'I',
  ezpass_vehicles: 93274,
  vtoll_vehicles: 18784,
  total_vehicles: 112058,
  ezpass_share_pct: 83.237252,
  ...overrides,
})

const crossingsPayload = (records: unknown[]) => ({ records })

/**
 * These tests protect the boundary that keeps an unvalidated number out of the UI. Each failure
 * case is a defect that would otherwise render as a plausible figure.
 */
describe('parseTrafficObservations', () => {
  it('maps a published feature into the canonical observation model', () => {
    const [observation] = parseTrafficObservations(trafficCollection([trafficFeature()]))

    expect(observation.segmentId).toBe(152523)
    expect(observation.month).toBe('2024-01')
    expect(observation.meanObserved15MinVolume).toBeCloseTo(42.885417, 6)
    expect(observation.coordinates).toEqual([-73.93, 40.714])
    expect(observation.sourceId).toBe('dot_automated_traffic_counts_archive_20260915')
  })

  it('keeps a blank street label null instead of inferring one', () => {
    const [observation] = parseTrafficObservations(
      trafficCollection([trafficFeature({ street: '   ', from_street: null })]),
    )

    expect(observation.street).toBeNull()
    expect(observation.fromStreet).toBeNull()
  })

  it('rejects an empty feature collection rather than rendering an empty module', () => {
    expect(() => parseTrafficObservations(trafficCollection([]))).toThrow(/must not be empty/)
  })

  it('rejects an axis-swapped coordinate', () => {
    const swapped = { type: 'Point', coordinates: [40.714, -73.93] }
    expect(() => parseTrafficObservations(trafficCollection([trafficFeature({}, swapped)])))
      .toThrow(/longitude .* outside the NYC envelope/)
  })

  it('rejects a negative mean volume', () => {
    expect(() => parseTrafficObservations(
      trafficCollection([trafficFeature({ mean_observed_15_min_volume: -1 })]),
    )).toThrow(/must not be negative/)
  })

  it('rejects a non-integer observation count', () => {
    expect(() => parseTrafficObservations(
      trafficCollection([trafficFeature({ observation_count: 12.5 })]),
    )).toThrow(/must be a whole count/)
  })

  it('rejects a malformed month', () => {
    expect(() => parseTrafficObservations(
      trafficCollection([trafficFeature({ month: '2024-1' })]),
    )).toThrow(/must be a YYYY-MM month/)
  })

  it('rejects a feature without a source id', () => {
    expect(() => parseTrafficObservations(
      trafficCollection([trafficFeature({ source_id: '' })]),
    )).toThrow(/source_id must be a non-empty string/)
  })

  it('maps the day type and time band dimensions', () => {
    const [observation] = parseTrafficObservations(trafficCollection([
      trafficFeature({ day_type: 'Weekend', time_band: 'Overnight (22-06)' }),
    ]))

    expect(observation.dayType).toBe('Weekend')
    expect(observation.timeBand).toBe('Overnight (22-06)')
  })

  it('rejects a day type outside the contract instead of offering it as a filter', () => {
    expect(() => parseTrafficObservations(
      trafficCollection([trafficFeature({ day_type: 'Holiday' })]),
    )).toThrow(/day_type must be one of Weekday, Weekend/)
  })

  it('rejects a time band outside the contract', () => {
    expect(() => parseTrafficObservations(
      trafficCollection([trafficFeature({ time_band: 'Morning' })]),
    )).toThrow(/time_band must be one of/)
  })

  it('rejects a non-point geometry', () => {
    const line = { type: 'LineString', coordinates: [[-73.9, 40.7], [-73.8, 40.8]] }
    expect(() => parseTrafficObservations(trafficCollection([trafficFeature({}, line)])))
      .toThrow(/geometry.type must be "Point"/)
  })
})

describe('parseFacilityCrossings', () => {
  it('maps a published record into the canonical crossing model', () => {
    const [crossing] = parseFacilityCrossings(crossingsPayload([crossingRecord()]))

    expect(crossing.plazaId).toBe(21)
    expect(crossing.direction).toBe('I')
    expect(crossing.totalVehicles).toBe(112058)
    expect(crossing.ezpassSharePct).toBeCloseTo(83.237252, 6)
  })

  it('rejects a total that does not equal its own components', () => {
    expect(() => parseFacilityCrossings(
      crossingsPayload([crossingRecord({ total_vehicles: 112059 })]),
    )).toThrow(/must equal ezpass_vehicles \+ vtoll_vehicles/)
  })

  it('rejects a share that does not reproduce its numerator and denominator', () => {
    expect(() => parseFacilityCrossings(
      crossingsPayload([crossingRecord({ ezpass_share_pct: 91 })]),
    )).toThrow(/does not match its numerator and denominator/)
  })

  it('allows a zero-denominator row without inventing a share check', () => {
    const [crossing] = parseFacilityCrossings(crossingsPayload([
      crossingRecord({ ezpass_vehicles: 0, vtoll_vehicles: 0, total_vehicles: 0, ezpass_share_pct: 0 }),
    ]))

    expect(crossing.totalVehicles).toBe(0)
  })

  it('rejects an unknown direction', () => {
    expect(() => parseFacilityCrossings(
      crossingsPayload([crossingRecord({ direction: 'X' })]),
    )).toThrow(/direction must be "I" or "O"/)
  })

  it('rejects a plaza id of zero', () => {
    expect(() => parseFacilityCrossings(
      crossingsPayload([crossingRecord({ plaza_id: 0 })]),
    )).toThrow(/must be a positive plaza identifier/)
  })

  it('rejects a payload without a records array', () => {
    expect(() => parseFacilityCrossings({ data: [] })).toThrow(/records must be an array/)
  })
})

describe('parseCrzEntries', () => {
  const crzRecord = (overrides: Record<string, unknown> = {}) => ({
    source_id: 'mta_crz_entries_archive_20260920',
    measure_id: 'crz_monthly_detection_group_entries',
    detection_group: 'Brooklyn Bridge',
    detection_region: 'Brooklyn',
    month: '2025-01',
    crz_entries: 769760,
    excluded_roadway_entries: 539089,
    total_entries: 1308849,
    ...overrides,
  })

  it('maps a published aggregate row into the canonical model', () => {
    const [entry] = parseCrzEntries({ records: [crzRecord()] })

    expect(entry.detectionGroup).toBe('Brooklyn Bridge')
    expect(entry.month).toBe('2025-01')
    expect(entry.totalEntries).toBe(1308849)
  })

  it('normalizes the 2026-09-18.1 legacy CRZ rows to monthly detection-group entries', () => {
    const entries = parseCrzEntries({
      rows: [
        {
          month_start: '2025-01-01',
          year: 2025,
          month: 1,
          detection_group: 'Brooklyn Bridge',
          detection_region: 'Brooklyn',
          time_period: 'Overnight',
          crz_entries: 223176,
          excluded_roadway_entries: 137936,
          all_entries: 361112,
        },
        {
          month_start: '2025-01-01',
          year: 2025,
          month: 1,
          detection_group: 'Brooklyn Bridge',
          detection_region: 'Brooklyn',
          time_period: 'Peak',
          crz_entries: 546584,
          excluded_roadway_entries: 401153,
          all_entries: 947737,
        },
      ],
    })

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      detectionGroup: 'Brooklyn Bridge',
      month: '2025-01',
      crzEntries: 769760,
      excludedRoadwayEntries: 539089,
      totalEntries: 1308849,
    })
  })

  it('rejects a total that does not equal its own components', () => {
    expect(() => parseCrzEntries({ records: [crzRecord({ total_entries: 1 })] }))
      .toThrow(/must equal crz_entries \+ excluded_roadway_entries/)
  })

  it('rejects a negative entry count', () => {
    expect(() => parseCrzEntries({ records: [crzRecord({ crz_entries: -5, total_entries: 539084 })] }))
      .toThrow(/must not be negative/)
  })

  it('rejects a malformed month', () => {
    expect(() => parseCrzEntries({ records: [crzRecord({ month: '2025-1' })] }))
      .toThrow(/must be a YYYY-MM month/)
  })

  it('rejects an empty payload rather than rendering an empty module', () => {
    expect(() => parseCrzEntries({ records: [] })).toThrow(/must not be empty/)
  })
})
