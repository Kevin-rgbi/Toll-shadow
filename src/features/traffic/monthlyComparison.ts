import type { FeatureCollection } from 'geojson'

export type TrafficLayer = 'boundary' | 'crz' | 'mta' | 'dot'
export type Period = 'All day' | 'Peak' | 'Overnight'
export interface ComparisonSelection {
  baseline: number
  comparison: number
  months: number[]
  period: Period
  layers: TrafficLayer[]
  search: string
}
export const DEFAULT_COMPARISON: ComparisonSelection = {
  baseline: 2025, comparison: 2026, months: [2, 3, 4, 5, 6, 7, 8], period: 'All day', layers: ['boundary', 'crz', 'mta'], search: '',
}
export const OBSERVATIONAL_LIMITATION = 'These are observational patterns, not evidence that congestion pricing caused changes or displaced traffic. DOT counts are sampled historical observations, not continuous citywide traffic measurements. No causal air-quality claims are supported.'
export interface MonthlyRow {
  layer: 'crz' | 'mta'
  id: string
  name: string
  year: number
  month: number
  period: Period
  total: number
  excluded: number
  all: number
  days: number
  complete: boolean
  coordinates: [number, number]
  vehicles: Record<string, number>
  details: Record<string, string | number | boolean | null>
}
export interface MonthlyAsset {
  layer: 'crz' | 'mta'
  rows: MonthlyRow[]
  latest: { month: string, coverage_days: number[], complete: boolean }
}
export interface LocationMetric {
  id: string
  name: string
  layer: 'crz' | 'mta'
  coordinates: [number, number]
  baseline: number | null
  comparison: number | null
  change: number | null
  baselineDays: number
  comparisonDays: number
  coverage: number
  matchedMonths: number[]
  rows: MonthlyRow[]
}
const record = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid monthly object')
  return input as Record<string, unknown>
}
export function parseMonthlyAsset(input: unknown): MonthlyAsset {
  const value = record(input)
  if (value.schema_version !== '2.0.0' || !['crz', 'mta'].includes(String(value.layer)) || !Array.isArray(value.rows) || !value.rows.length) throw new Error('Invalid monthly asset contract')
  const layer = value.layer as 'crz' | 'mta'
  const keys = new Set<string>()
  const rows = value.rows.map((input): MonthlyRow => {
    const raw = record(input)
    const number = (key: string, integer = true): number => {
      const v = raw[key]
      if (typeof v !== 'number' || !Number.isFinite(v) || (integer && (!Number.isSafeInteger(v) || v < 0))) throw new Error(`Invalid monthly ${key}`)
      return v
    }
    const text = (key: string): string => {
      if (typeof raw[key] !== 'string' || !raw[key]) throw new Error(`Invalid monthly ${key}`)
      return raw[key]
    }
    const year = number('year')
    const month = number('month')
    const days = number('coverage_days')
    const calendarDays = new Date(Date.UTC(year, month, 0)).getUTCDate()
    if (![2025, 2026].includes(year) || month < 1 || month > 12 || days < 1 || days > calendarDays || typeof raw.complete_month !== 'boolean' || (raw.complete_month && days !== calendarDays) || raw.month_start !== `${year}-${String(month).padStart(2, '0')}-01`) throw new Error('Invalid monthly coverage')
    const period = layer === 'crz' ? text('time_period') as Period : 'All day'
    if (layer === 'crz' && !['Peak', 'Overnight'].includes(period)) throw new Error('Invalid CRZ period')
    const id = `${layer}:${layer === 'crz' ? text('detection_group') : number('facility_id')}`
    const key = `${id}:${year}:${month}:${period}`
    if (keys.has(key)) throw new Error('Duplicate monthly row')
    keys.add(key)
    const total = number(layer === 'crz' ? 'crz_entries' : 'total_traffic')
    const excluded = layer === 'crz' ? number('excluded_roadway_entries') : 0
    const all = layer === 'crz' ? number('all_entries') : total
    const vehicles: Record<string, number> = layer === 'mta' ? Object.fromEntries(['car', 'truck', 'bus', 'motorcycle', 'other_vehicle'].map(key => [key.replace('_', ' '), number(`${key}_count`)])) : {}
    if (all !== total + excluded || (layer === 'mta' && Object.values(vehicles).reduce((sum, n) => sum + n, 0) !== total)) throw new Error('Inconsistent monthly totals')
    const coordinates: [number, number] = [number('longitude', false), number('latitude', false)]
    if (coordinates[0] < -75 || coordinates[0] > -72 || coordinates[1] < 40 || coordinates[1] > 42) throw new Error('Invalid monthly coordinates')
    text('source')
    text('coordinate_note')
    if (Object.values(raw).some(v => v !== null && !['string', 'number', 'boolean'].includes(typeof v))) throw new Error('Invalid CSV details')
    return { layer, id, name: text(layer === 'crz' ? 'detection_group' : 'facility_name'), year, month, period, total, excluded, all, days, complete: raw.complete_month, coordinates, vehicles, details: raw as MonthlyRow['details'] }
  })
  const latestMonth = rows.map(row => `${row.year}-${String(row.month).padStart(2, '0')}`).sort().at(-1)!
  const latestRows = rows.filter(row => `${row.year}-${String(row.month).padStart(2, '0')}` === latestMonth)
  return { layer, rows, latest: { month: latestMonth, coverage_days: [...new Set(latestRows.map(row => row.days))].sort((a, b) => a - b), complete: latestRows.every(row => row.complete) } }
}

export function readComparison(params: URLSearchParams): ComparisonSelection {
  const year = (key: string, fallback: number) => [2025, 2026].includes(Number(params.get(key))) ? Number(params.get(key)) : fallback
  const months = [...new Set((params.get('months') ?? '').split(',').filter(v => /^\d{1,2}$/.test(v)).map(Number).filter(v => v >= 1 && v <= 12))].sort((a, b) => a - b)
  const layers = params.has('layers') ? [...new Set((params.get('layers') ?? '').split(',').filter((v): v is TrafficLayer => ['boundary', 'crz', 'mta', 'dot'].includes(v)))] : [...DEFAULT_COMPARISON.layers]
  const period = params.get('period')
  return { baseline: year('baseline', 2025), comparison: year('comparison', 2026), months: months.length ? months : [...DEFAULT_COMPARISON.months], period: period === 'Peak' || period === 'Overnight' ? period : 'All day', layers, search: params.get('search')?.slice(0, 200) ?? '' }
}
export function writeComparison(params: URLSearchParams, state: ComparisonSelection) {
  params.set('baseline', String(state.baseline))
  params.set('comparison', String(state.comparison))
  params.set('months', state.months.join(','))
  params.set('period', state.period)
  params.set('layers', state.layers.join(','))
  if (state.search) params.set('search', state.search)
  else params.delete('search')
  params.delete('crossingsFrom')
  params.delete('crossingsTo')
}

export function dailyMeasure(rows: MonthlyRow[], field: 'total' | 'excluded' | 'all' = 'total'): { daily: number | null, total: number, days: number } {
  if (!rows.length) return { daily: null, total: 0, days: 0 }
  if (new Set(rows.map(row => row.id)).size !== 1) throw new Error('Daily denominator requires one location')
  const months = new Map<string, number>()
  for (const row of rows) {
    const key = `${row.year}:${row.month}`
    if (months.has(key) && months.get(key) !== row.days) throw new Error('Inconsistent period coverage; cannot combine daily denominators')
    months.set(key, row.days)
  }
  const days = [...months.values()].reduce((sum, n) => sum + n, 0)
  const total = rows.reduce((sum, row) => sum + row[field], 0)
  return { daily: total / days, total, days }
}
export const percentChange = (baseline: number | null, comparison: number | null): number | null => baseline === null || comparison === null || baseline === 0 ? null : (comparison - baseline) / baseline * 100

export function compareLocations(rows: MonthlyRow[], selection: ComparisonSelection): LocationMetric[] {
  const selected = rows.filter(row => selection.layers.includes(row.layer) && selection.months.includes(row.month) && [selection.baseline, selection.comparison].includes(row.year) && (row.layer === 'mta' || selection.period === 'All day' || row.period === selection.period) && `${row.name} ${Object.values(row.details).join(' ')}`.toLowerCase().includes(selection.search.toLowerCase()))
  const groups = new Map<string, MonthlyRow[]>()
  for (const row of selected) groups.set(row.id, [...(groups.get(row.id) ?? []), row])
  return [...groups.values()].map(group => {
    const validMonth = (year: number, month: number) => {
      const subset = group.filter(row => row.year === year && row.month === month)
      return subset.length === (group[0].layer === 'crz' && selection.period === 'All day' ? 2 : 1) && subset.every(row => row.complete)
    }
    const matchedMonths = selection.months.filter(month => validMonth(selection.baseline, month) && validMonth(selection.comparison, month))
    const before = group.filter(row => row.year === selection.baseline && matchedMonths.includes(row.month))
    const after = group.filter(row => row.year === selection.comparison && matchedMonths.includes(row.month))
    const baseline = dailyMeasure(before)
    const comparison = dailyMeasure(after)
    return { id: group[0].id, name: group[0].name, layer: group[0].layer, coordinates: group[0].coordinates, baseline: baseline.daily, comparison: comparison.daily, change: percentChange(baseline.daily, comparison.daily), baselineDays: baseline.days, comparisonDays: comparison.days, coverage: matchedMonths.length / selection.months.length * 100, matchedMonths, rows: group }
  })
}
export function networkMetric(locations: LocationMetric[], layer: 'crz' | 'mta', selection: ComparisonSelection, field: 'total' | 'excluded' | 'all' = 'total') {
  const groups = locations.filter(item => item.layer === layer)
  const months = selection.months.filter(month => groups.length && groups.every(item => item.matchedMonths.includes(month)))
  const sum = (year: number) => groups.reduce((total, item) => total + (dailyMeasure(item.rows.filter(row => row.year === year && months.includes(row.month)), field).daily ?? 0), 0)
  const baseline = months.length ? sum(selection.baseline) : null
  const comparison = months.length ? sum(selection.comparison) : null
  return { baseline, comparison, change: percentChange(baseline, comparison), months, locations: groups.length }
}
export type Ranking = 'increase' | 'decrease' | 'volume' | 'coverage'
export function rankLocations(locations: LocationMetric[], ranking: Ranking) {
  const filtered = locations.filter(item => ranking === 'increase' ? item.change !== null && item.change > 0 : ranking === 'decrease' ? item.change !== null && item.change < 0 : ranking === 'volume' ? item.comparison !== null : true)
  return [...filtered].sort((a, b) => (ranking === 'increase' ? (b.change ?? 0) - (a.change ?? 0) : ranking === 'decrease' ? (a.change ?? 0) - (b.change ?? 0) : ranking === 'volume' ? (b.comparison ?? 0) - (a.comparison ?? 0) : b.coverage - a.coverage) || a.name.localeCompare(b.name))
}
export const changeColor = (value: number | null): string => value === null ? '#85898f' : value < -5 ? '#1f4bd8' : value <= 5 ? '#85898f' : value <= 10 ? '#df7b22' : '#bf3038'
export function monthlyFeatures(locations: LocationMetric[], selectedId: string | null): FeatureCollection {
  return { type: 'FeatureCollection', features: locations.map(item => ({ type: 'Feature', id: item.id, geometry: { type: 'Point', coordinates: item.coordinates }, properties: { id: item.id, name: item.name, layer: item.layer, color: changeColor(item.change), radius: item.id === selectedId ? 13 : 6 + Math.min(5, Math.sqrt(item.comparison ?? 0) / 120), selected: item.id === selectedId, baseline: item.baseline, comparison: item.comparison, change: item.change } })) }
}
