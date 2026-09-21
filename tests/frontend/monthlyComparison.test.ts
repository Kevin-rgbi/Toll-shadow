import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ComparisonModule } from '../../src/features/traffic/ComparisonModule'
import { DEFAULT_COMPARISON, changeColor, compareLocations, dailyMeasure, monthlyFeatures, networkMetric, parseMonthlyAsset, percentChange, rankLocations, readComparison, writeComparison } from '../../src/features/traffic/monthlyComparison'
import { buildViewStateQuery, EMPTY_VIEW_STATE, readViewState } from '../../src/lib/viewState'
import { parseReleaseBoundary } from '../../src/hooks/useReleaseBoundary'

const load = (name: string) => JSON.parse(readFileSync(new URL(`../../public/data/releases/2026-09-18.1/${name}`, import.meta.url), 'utf8'))
const crz = parseMonthlyAsset(load('crz_entries.json'))
const mta = parseMonthlyAsset(load('facility_crossings.json'))
const selection = DEFAULT_COMPARISON
const rows = [...crz.rows, ...mta.rows]
const locations = compareLocations(rows, selection)

describe('monthly traffic release', () => {
  it('retains supplied locations, rows and exact official polygons', () => {
    expect(crz.rows).toHaveLength(504)
    expect(mta.rows).toHaveLength(210)
    expect(locations.filter(item => item.layer === 'crz')).toHaveLength(12)
    expect(locations.filter(item => item.layer === 'mta')).toHaveLength(10)
    expect(parseReleaseBoundary(load('boundary_zone.geojson')).features).toHaveLength(7)
    expect(locations.some(item => item.name === 'Bronx-Whitestone Bridge')).toBe(true)
  })

  it('matches Feb–Aug with one denominator for Peak plus Overnight', () => {
    const location = locations.find(item => item.name === 'Brooklyn Bridge')!
    const before = location.rows.filter(row => row.year === 2025)
    const measure = dailyMeasure(before)
    expect(measure.days).toBe(212)
    expect(measure.total).toBe(before.reduce((sum, row) => sum + row.total, 0))
    expect(location.baseline).toBe(measure.total / 212)
    expect(location.matchedMonths).toEqual([2, 3, 4, 5, 6, 7, 8])
    expect(location.rows.every(row => row.month !== 1)).toBe(true)
    const peak = dailyMeasure(before.filter(row => row.period === 'Peak'))
    const overnight = dailyMeasure(before.filter(row => row.period === 'Overnight'))
    expect(measure.daily).toBeCloseTo(peak.daily! + overnight.daily!, 8)
    expect(() => dailyMeasure([...before, mta.rows[0]])).toThrow(/one location/)
    expect(() => dailyMeasure([before[0], { ...before[1], days: 1 }])).toThrow(/coverage/)
  })

  it('weights totals by days instead of averaging monthly daily values', () => {
    const base = mta.rows[0]
    const result = dailyMeasure([{ ...base, month: 2, days: 28, total: 280 }, { ...base, month: 3, days: 31, total: 620 }])
    expect(result.daily).toBe(900 / 59)
    expect(result.daily).not.toBe(15)
    for (const [layer, asset] of [['crz', crz], ['mta', mta]] as const) {
      const metric = networkMetric(locations, layer, selection)
      const total = (year: number) => asset.rows.filter(row => row.year === year && selection.months.includes(row.month)).reduce((sum, row) => sum + row.total, 0)
      expect(metric.baseline).toBeCloseTo(total(2025) / 212, 8)
      expect(metric.comparison).toBeCloseTo(total(2026) / 212, 8)
      expect(metric.change).toBeCloseTo((total(2026) / total(2025) - 1) * 100, 8)
    }
    expect(percentChange(0, 1)).toBeNull()
    expect(percentChange(null, 1)).toBeNull()
  })

  it('excludes partial September and missing year pairs without zero filling', () => {
    expect(crz.latest).toEqual({ month: '2026-09', coverage_days: [5], complete: false })
    expect(mta.latest).toEqual({ month: '2026-09', coverage_days: [1], complete: false })
    const september = compareLocations(rows, { ...selection, months: [9] })
    expect(september.every(item => item.change === null && item.coverage === 0)).toBe(true)
    expect(networkMetric(september, 'crz', { ...selection, months: [9] }).comparison).toBeNull()
    const missing = rows.filter(row => !(row.name === 'Brooklyn Bridge' && row.year === 2026 && row.month === 2))
    const result = compareLocations(missing, selection)
    expect(result.find(item => item.name === 'Brooklyn Bridge')?.matchedMonths).toEqual([3, 4, 5, 6, 7, 8])
    expect(networkMetric(result, 'crz', selection).months).toEqual([3, 4, 5, 6, 7, 8])
  })

  it('keeps MTA all-day and supports period, reversal, search and layer controls', () => {
    const peak = compareLocations(rows, { ...selection, period: 'Peak' })
    expect(networkMetric(peak, 'crz', selection).comparison).toBeLessThan(networkMetric(locations, 'crz', selection).comparison!)
    expect(networkMetric(peak, 'mta', selection).comparison).toBe(networkMetric(locations, 'mta', selection).comparison)
    const reverse = compareLocations(rows, { ...selection, baseline: 2026, comparison: 2025 })
    expect(reverse[0].baseline).toBe(locations[0].comparison)
    expect(reverse[0].change).toBeGreaterThan(0)
    expect(compareLocations(rows, { ...selection, search: 'Bronx-Whitestone' })).toHaveLength(1)
    expect(compareLocations(rows, { ...selection, layers: [] })).toEqual([])
    expect(compareLocations(rows, { ...selection, search: 'not a location' })).toEqual([])
  })

  it('uses explicit bins, ranks both signs and preserves map highlighting', () => {
    expect([-6, -5, 5, 5.1, 10, 10.1, null].map(changeColor)).toEqual(['#1f4bd8', '#85898f', '#85898f', '#df7b22', '#df7b22', '#bf3038', '#85898f'])
    expect(rankLocations(locations, 'increase')).toEqual([])
    expect(rankLocations(locations, 'decrease')[0].name).toBe('Lincoln Tunnel')
    const ranking = rankLocations(locations, 'volume')
    expect(ranking[0].comparison).toBeGreaterThanOrEqual(ranking[1].comparison!)
    expect(rankLocations(locations, 'coverage').every(item => item.coverage === 100)).toBe(true)
    const features = monthlyFeatures(locations, locations[0].id)
    expect(features.features[0].properties?.selected).toBe(true)
    expect(features.features[0].properties?.radius).toBe(13)
    expect(features.features[0].geometry).toEqual({ type: 'Point', coordinates: locations[0].coordinates })
  })

  it('round-trips monthly URLs and retires old crossing date defaults', () => {
    const state = { ...selection, baseline: 2026, comparison: 2025, months: [3, 5], layers: [], search: 'East 60th St', period: 'Overnight' as const }
    const params = new URLSearchParams('crossingsFrom=2024-01-01&crossingsTo=2025-04-12')
    writeComparison(params, state)
    expect(params.has('crossingsFrom')).toBe(false)
    expect(params.has('crossingsTo')).toBe(false)
    expect(readComparison(params)).toEqual(state)
    writeComparison(params, { ...state, search: '' })
    expect(params.has('search')).toBe(false)
    const query = buildViewStateQuery({ ...EMPTY_VIEW_STATE, mode: 'CROSSINGS', comparisonSelection: state })
    expect(readViewState(query).comparisonSelection).toEqual(state)
    expect(readComparison(new URLSearchParams('months=0,13,no&baseline=2024&period=bad'))).toEqual(selection)
  })

  it('rejects corrupt totals, coordinates, duplicate records and invalid boundaries', () => {
    const payload = load('crz_entries.json')
    payload.rows[0].crz_entries = -1
    expect(() => parseMonthlyAsset(payload)).toThrow()
    const duplicate = load('facility_crossings.json')
    duplicate.rows.push(duplicate.rows[0])
    expect(() => parseMonthlyAsset(duplicate)).toThrow(/Duplicate/)
    const coordinates = load('facility_crossings.json')
    coordinates.rows[0].latitude = 0
    expect(() => parseMonthlyAsset(coordinates)).toThrow(/coordinates/)
    expect(() => parseReleaseBoundary({ type: 'FeatureCollection', features: [] })).toThrow()
  })

  it('renders source details, trends, vehicle mix, limitations and load failures', () => {
    const props = { mode: 'CROSSINGS' as const, selection, onChange: () => undefined, locations, selectedId: mta.rows[0].id, onSelect: () => undefined, crz: { status: 'ready' as const, data: crz }, mta: { status: 'ready' as const, data: mta }, release: null }
    const markup = renderToStaticMarkup(createElement(ComparisonModule, props))
    expect(markup).toContain('Monthly trends')
    expect(markup).toContain('Vehicle breakdown')
    expect(markup).toContain('source facility name')
    expect(markup).toContain('partial month; excluded')
    expect(markup).toContain('not evidence that congestion pricing caused changes or displaced traffic')
    expect(markup).not.toContain('crossingsFrom')
    const failed = renderToStaticMarkup(createElement(ComparisonModule, { ...props, locations: [], mta: { status: 'error', reason: 'checksum mismatch' } }))
    expect(failed).toContain('checksum mismatch')
    expect(failed).toContain('No locations match')
  })
})
