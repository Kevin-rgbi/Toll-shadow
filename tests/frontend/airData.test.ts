import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AIR_DAILY_PATH,
  buildAirCoverageSummary,
  buildAirMapPoints,
  buildAirMonthlyComparison,
  nearestAirStep,
  parseAirDailyCsv,
  parseAirHourlyCsv,
} from '../../src/features/air/airData'
import type { AirDataset } from '../../src/types/air'

const dailyText = readFileSync(new URL('../../data/reference-legacy/NYCCAS_PM25_Daily_2025_2026_Kepler.csv', import.meta.url), 'utf8')
const daily = parseAirDailyCsv(dailyText)
const dataset: AirDataset = {
  daily,
  hourly: null,
  dailyBytes: new TextEncoder().encode(dailyText).length,
  hourlyBytes: null,
  sourceFiles: [AIR_DAILY_PATH],
}

describe('AIR reference data', () => {
  it('parses the supplied daily grid without converting gaps to zero', () => {
    expect(daily.stations).toHaveLength(15)
    expect(daily.dates).toHaveLength(625)
    expect(daily.row).toEqual({
      total: 9375,
      qualifying: 8187,
      noData: 1111,
      insufficientHours: 77,
      nullValues: 1188,
    })
    expect(daily.dates.at(-1)).toBe('2026-09-17')
    expect(daily.latestCompleteDate).toBe('2026-09-16')
    expect(daily.byDate.get('2026-09-17')?.values().next().value?.pm25).toBeNull()
  })

  it('keeps missing and low-coverage readings visibly separate on the map', () => {
    const points = buildAirMapPoints(dataset, 'daily', Date.parse('2026-09-17T00:00:00Z'), {
      borough: null,
      siteFilter: 'all',
      selectedSiteId: null,
    })
    expect(points.features).toHaveLength(15)
    expect(points.features.every((feature) => feature.geometry.type === 'Point')).toBe(true)
    expect(points.features.every((feature) => feature.properties?.missing === true)).toBe(true)
    expect(points.features.every((feature) => feature.properties?.fill === '#fcfcfb')).toBe(true)
  })

  it('carries the latest qualifying monitor reading into a current gap', () => {
    const compactDaily = parseAirDailyCsv([
      'timestamp_utc,date_nyc,year,month,site_id,site_name,borough,latitude,longitude,pm25_daily_mean_ugm3,pm25_observed_mean_ugm3,pm25_hourly_max_ugm3,valid_hours,expected_hours,coverage_pct,coverage_status,quality_status,location_note',
      '2026-01-01T05:00:00Z,2026-01-01,2026,1,site-a,Site A,Queens,40.7,-73.9,7.25,7.25,10,24,24,100,qualifying,Preliminary,',
      '2026-01-02T05:00:00Z,2026-01-02,2026,1,site-a,Site A,Queens,40.7,-73.9,,,,0,24,0,no_data,Preliminary,',
    ].join('\n'))
    const compactDataset: AirDataset = {
      daily: compactDaily,
      hourly: null,
      dailyBytes: 0,
      hourlyBytes: null,
      sourceFiles: [],
    }

    const [point] = buildAirMapPoints(compactDataset, 'daily', Date.parse('2026-01-02T00:00:00Z'), {
      borough: null,
      siteFilter: 'all',
      selectedSiteId: null,
    }).features

    expect(point.properties).toMatchObject({
      missing: true,
      latestAvailablePm25: 7.25,
      latestAvailablePeriod: '2026-01-01 New York day',
      latestAvailableCoverage: '24/24 h · 100%',
    })
  })

  it('derives coverage summaries and excludes partial months by default', () => {
    const summary = buildAirCoverageSummary(dataset)
    expect(summary?.daily.monitors).toBe(15)
    expect(summary?.daily.qualifyingSiteDays).toBe(8187)
    const comparison = buildAirMonthlyComparison(daily, 2025, 2026, [2, 3, 4, 5, 6, 7, 8], false)
    expect(comparison.months).toHaveLength(7)
    expect(buildAirMonthlyComparison(daily, 2025, 2026, [9], false).months).toEqual([])
    expect(comparison.partialMonths).toContain('2026-09')
    expect(comparison.months.every((month) => month.completeCalendarMonth)).toBe(true)
  })

  it('parses hourly records and derives missing site-hours from the daily station grid', () => {
    const station = daily.stations[0]
    const hourlyText = [
      'timestamp_utc,timestamp_nyc,site_id,site_name,borough,latitude,longitude,pm25_ugm3,quality_status,location_note',
      `2026-09-16T00:00:00Z,2026-09-15 20:00:00,${station.id},${station.name},${station.borough},${station.coordinates[1]},${station.coordinates[0]},7.2,,`,
    ].join('\n')
    const hourly = parseAirHourlyCsv(hourlyText, daily.stations)
    expect(hourly.timestamps).toEqual([Date.parse('2026-09-16T00:00:00Z')])
    expect(hourly.row.present).toBe(1)
    expect(hourly.row.missing).toBe(14)
  })

  it('snaps playback and map lookups to the nearest recorded step', () => {
    const steps = [Date.parse('2026-09-15T00:00:00Z'), Date.parse('2026-09-16T00:00:00Z')]
    expect(nearestAirStep(steps, Date.parse('2026-09-15T18:00:00Z'))).toBe(steps[1])
    expect(nearestAirStep(steps, Date.parse('2026-09-14T00:00:00Z'))).toBe(steps[0])
  })
})
