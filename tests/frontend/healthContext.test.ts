import { describe, expect, it } from 'vitest'
import { parseAirContext, parseEquityContext, parseHealthContext } from '../../src/lib/releaseData'

/**
 * Coverage for the historical health context and the equity geography.
 *
 * These two parsers shipped without any unit test, and both then rejected the real published asset
 * in production: a rate per 10,000 head and a vulnerability percentile are fractions, and both were
 * validated as whole counts. The fixtures below therefore carry the fractional values the sources
 * actually publish, which is the property a count-shaped value would hide.
 */

const healthRecord = (overrides: Record<string, unknown> = {}) => ({
  indicator: 'ED Visits',
  county: 'Bronx',
  borough: 'Bronx',
  period: '2005-2007',
  age_adjusted_rate_per_10000: 780.65,
  annual_age_adjusted_rate_per_10000: 260.218,
  events: 107326,
  daily_mean_events: 98.015,
  ...overrides,
})

const healthAsset = (records: unknown[]) => ({
  source: 'New York State Department of Health, asthma hospitalisations and ED visits (archived extract)',
  geography_label: 'county, which for New York City is the borough',
  period_label: 'rolling multi-year periods ending 2019 or earlier',
  records,
})

const equityFeature = (overrides: Record<string, unknown> = {}) => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[[-73.9, 40.8], [-73.8, 40.8], [-73.8, 40.9], [-73.9, 40.8]]] },
  properties: {
    GEOID: '36005000100',
    County: 'Bronx',
    Pop_Cnt: 4215,
    Vulner_Pct: 92.35,
    ...overrides,
  },
})

const equityAsset = (features: unknown[]) => ({
  vintage: '2023 disadvantaged-communities criteria (archived layer)',
  geography_label: 'census tract polygons clipped to New York City',
  features,
})

describe('parseHealthContext', () => {
  it('accepts the fractional rates and daily means the source publishes', () => {
    const parsed = parseHealthContext(healthAsset([healthRecord()]))

    expect(parsed.records).toHaveLength(1)
    expect(parsed.records[0].ageAdjustedRatePer10000).toBe(780.65)
    expect(parsed.records[0].dailyMeanEvents).toBe(98.015)
    // Events is a count, so it stays a whole number.
    expect(parsed.records[0].events).toBe(107326)
  })

  it('keeps an absent figure null instead of reading it as zero', () => {
    const parsed = parseHealthContext(
      healthAsset([healthRecord({ age_adjusted_rate_per_10000: null, daily_mean_events: null })]),
    )

    expect(parsed.records[0].ageAdjustedRatePer10000).toBeNull()
    expect(parsed.records[0].dailyMeanEvents).toBeNull()
  })

  it('rejects a fractional event count', () => {
    expect(() => parseHealthContext(healthAsset([healthRecord({ events: 107326.5 })]))).toThrow(
      /must be a whole count/,
    )
  })

  it('rejects a period that is not a year range', () => {
    expect(() => parseHealthContext(healthAsset([healthRecord({ period: '2005' })]))).toThrow(/period/)
  })

  it('rejects an empty record set rather than rendering an empty panel', () => {
    expect(() => parseHealthContext(healthAsset([]))).toThrow(/non-empty/)
  })
})

describe('parseEquityContext', () => {
  it('accepts the fractional vulnerability percentile the source publishes', () => {
    const parsed = parseEquityContext(equityAsset([equityFeature()]))

    expect(parsed.features).toHaveLength(1)
    expect(parsed.features[0].vulnerabilityPercentile).toBe(92.35)
    expect(parsed.features[0].population).toBe(4215)
  })

  it('rejects a tract with no identifier', () => {
    expect(() => parseEquityContext(equityAsset([equityFeature({ GEOID: '' })]))).toThrow(/GEOID/)
  })

  it('rejects coordinates that are not rings, which would throw while drawing', () => {
    const bad = { ...equityFeature(), geometry: { type: 'Polygon', coordinates: ['bad'] } }
    expect(() => parseEquityContext(equityAsset([bad]))).toThrow(/ring of at least 3 positions/)
  })

  it('rejects a position that is not a coordinate pair', () => {
    const short = { ...equityFeature(), geometry: { type: 'Polygon', coordinates: [[[-73.9], [-73.8, 40.8], [-73.8, 40.9]]] } }
    expect(() => parseEquityContext(equityAsset([short]))).toThrow(/must be a \[lng, lat\] pair/)
  })

  it('rejects a coordinate that is not a number', () => {
    const bad = { ...equityFeature(), geometry: { type: 'Polygon', coordinates: [[[-73.9, 'x'], [-73.8, 40.8], [-73.8, 40.9]]] } }
    expect(() => parseEquityContext(equityAsset([bad]))).toThrow(/must be a finite number/)
  })

  it('rejects a point where the contract promises a tract polygon', () => {
    expect(() =>
      parseEquityContext(
        equityAsset([
          { ...equityFeature(), geometry: { type: 'Point', coordinates: [-73.9, 40.8] } },
        ]),
      ),
    ).toThrow(/Polygon/)
  })
})

describe('parseAirContext', () => {
  const airAsset = (overrides: Record<string, unknown> = {}) => ({
    pollutant_label: 'black carbon, annual average (label inferred)',
    period_label: '2016 (inferred from the filename; not verified)',
    values: 'relative 0-1 within this surface; absolute units are not established',
    aggregation: '2x2 mean of the 300 m source cells, nodata masked',
    bounds: [-74.26, 40.49, -73.69, 40.92],
    width: 2,
    height: 2,
    grid: [[0.1, 0.9], [null, 0.5]],
    ...overrides,
  })

  it('keeps a nodata cell null rather than reading it as a zero value', () => {
    const parsed = parseAirContext(airAsset())

    expect(parsed.grid[1][0]).toBeNull()
    expect(parsed.grid[0][1]).toBe(0.9)
  })

  it('rejects a grid whose rows do not match its declared height', () => {
    expect(() => parseAirContext(airAsset({ grid: [[0.1, 0.9]] }))).toThrow(/must have 2 rows/)
  })
})
