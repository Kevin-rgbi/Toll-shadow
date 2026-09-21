import type { FeatureCollection } from 'geojson'
import type {
  AirCoverageStatus,
  AirDailyDataset,
  AirDailyReading,
  AirDataset,
  AirHourlyDataset,
  AirHourlyReading,
  AirMapPoint,
  AirMonthlyComparisonSet,
  AirMonthlyMonthComparison,
  AirMonthlySiteComparison,
  AirStation,
} from '../../types/air'

export const AIR_DAILY_PATH = '/data/releases/2026-09-18.1/nyccas_pm25_daily.csv'
export const AIR_HOURLY_PATH = '/data/releases/2026-09-18.1/nyccas_pm25_hourly.csv'
export const AIR_ASSET_LABEL = 'Preliminary NYCCAS PM2.5 monitor measurements'
export const AIR_CLAIM_GUARDRAIL = 'Observed concentrations; not a causal estimate of congestion-pricing effects.'
export const AIR_UNITS = 'µg/m³'
export const AIR_SCALE_MAX = 50
export const AIR_SCALE_LABEL = `Fixed concentration scale · 0–${AIR_SCALE_MAX} ${AIR_UNITS} · above-scale extremes remain visible`

const AIR_SCALE = [
  { max: 5, color: '#e8f1f8' },
  { max: 10, color: '#b8d8e8' },
  { max: 15, color: '#74a9cf' },
  { max: 25, color: '#2b83ba' },
  { max: 35, color: '#fdae61' },
  { max: AIR_SCALE_MAX, color: '#d7191c' },
]

const ABOVE_SCALE_COLOR = '#7f0000'
const MISSING_COLOR = '#85898f'
const MISSING_FILL = '#fcfcfb'

type CsvRow = string[]

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const parseCsv = (text: string): CsvRow[] => {
  const rows: CsvRow[] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ''))
}

const rowObject = (row: CsvRow, headers: string[], label: string): Record<string, string> => {
  if (row.length !== headers.length) {
    throw new Error(`${label}: expected ${headers.length} CSV columns, received ${row.length}`)
  }

  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))
}

const required = (row: Record<string, string>, key: string, label: string): string => {
  const value = row[key]
  if (value === undefined || value.trim() === '') throw new Error(`${label}: ${key} is required`)
  return value.trim()
}

const optional = (row: Record<string, string>, key: string): string | null => {
  const value = row[key]
  if (value === undefined || value.trim() === '') return null
  return value.trim()
}

const numberValue = (value: string | null, label: string, allowZero = true): number => {
  if (value === null || value === '') throw new Error(`${label}: number is required`)
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || (!allowZero && parsed === 0)) {
    throw new Error(`${label}: invalid number ${value}`)
  }
  return parsed
}

const optionalNumber = (value: string | null, label: string): number | null => {
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${label}: invalid number ${value}`)
  return parsed
}

const coordinate = (row: Record<string, string>, label: string): [number, number] => {
  const latitude = numberValue(optional(row, 'latitude'), `${label} latitude`, false)
  const longitude = numberValue(optional(row, 'longitude'), `${label} longitude`, false)
  if (latitude < 40 || latitude > 42 || longitude < -75 || longitude > -72) {
    throw new Error(`${label}: coordinate outside the NYC envelope`)
  }
  return [longitude, latitude]
}

const coverageStatus = (
  pm25: number | null,
  validHours: number,
  sourceStatus: string,
): AirCoverageStatus => {
  if (pm25 === null || validHours < 18 || sourceStatus.toLowerCase().includes('no data')) {
    return pm25 === null && validHours === 0 ? 'no_data' : 'insufficient_hours'
  }
  return 'qualifying'
}

const stationFromRow = (
  row: Record<string, string>,
  label: string,
  existing?: AirStation,
): AirStation => {
  const id = required(row, 'site_id', label)
  const name = required(row, 'site_name', label)
  const borough = required(row, 'borough', label)
  const coordinates = coordinate(row, label)

  if (existing && (existing.name !== name || existing.borough !== borough || existing.coordinates[0] !== coordinates[0] || existing.coordinates[1] !== coordinates[1])) {
    throw new Error(`${label}: station metadata changed for ${id}`)
  }

  return existing ?? {
    id,
    name,
    borough,
    coordinates,
    locationNote: null,
    locationHistoryFlag: name === 'Midtown West',
  }
}

const timestampValue = (value: string | null, label: string): number => {
  if (value === null) throw new Error(`${label}: timestamp is required`)
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error(`${label}: invalid timestamp ${value}`)
  return timestamp
}

export const parseAirDailyCsv = (text: string, sourceFile = AIR_DAILY_PATH): AirDailyDataset => {
  const parsed = parseCsv(text)
  if (parsed.length < 2) throw new Error(`${sourceFile}: no daily readings`)
  const headers = parsed[0]
  const requiredHeaders = [
    'timestamp_utc',
    'date_utc',
    'site_id',
    'site_name',
    'borough',
    'latitude',
    'longitude',
    'pm25_daily_mean_ugm3',
    'valid_hours',
    'coverage_pct',
    'coverage_status',
    'quality_status',
  ]
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) throw new Error(`${sourceFile}: missing ${header}`)
  }

  const stations = new Map<string, AirStation>()
  const byDate = new Map<string, Map<string, AirDailyReading>>()
  const dates = new Set<string>()
  let qualifying = 0
  let noData = 0
  let insufficientHours = 0
  let nullValues = 0
  let minPct: number | null = null
  let maxPct: number | null = null

  for (let index = 1; index < parsed.length; index += 1) {
    const label = `${sourceFile} row ${index + 1}`
    const row = rowObject(parsed[index], headers, label)
    const siteId = required(row, 'site_id', label)
    const date = required(row, 'date_utc', label)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))) {
      throw new Error(`${label}: invalid date ${date}`)
    }

    const station = stationFromRow(row, label, stations.get(siteId))
    stations.set(siteId, station)
    const timestampMs = timestampValue(optional(row, 'timestamp_utc'), label)
    if (new Date(timestampMs).toISOString().slice(0, 10) !== date) {
      throw new Error(`${label}: timestamp does not match date_utc`)
    }

    const rawPm25 = optional(row, 'pm25_daily_mean_ugm3')
    const pm25 = optionalNumber(rawPm25, label)
    if (pm25 !== null && pm25 < 0) throw new Error(`${label}: PM2.5 must not be negative`)
    if (pm25 === null) nullValues += 1

    const validHours = optionalNumber(optional(row, 'valid_hours'), label) ?? 0
    const coveragePct = optionalNumber(optional(row, 'coverage_pct'), label)
    if (coveragePct !== null) {
      minPct = minPct === null ? coveragePct : Math.min(minPct, coveragePct)
      maxPct = maxPct === null ? coveragePct : Math.max(maxPct, coveragePct)
    }

    const status = coverageStatus(pm25, validHours, required(row, 'coverage_status', label))
    if (status === 'qualifying') qualifying += 1
    if (status === 'no_data') noData += 1
    if (status === 'insufficient_hours') insufficientHours += 1

    const reading: AirDailyReading = {
      timestampMs,
      date,
      siteId,
      siteName: station.name,
      borough: station.borough,
      coordinates: station.coordinates,
      pm25,
      coverageHours: validHours,
      coveragePct,
      coverageStatus: status,
      qualityStatus: optional(row, 'quality_status'),
    }

    const dateRows = byDate.get(date) ?? new Map<string, AirDailyReading>()
    if (dateRows.has(siteId)) throw new Error(`${label}: duplicate daily site reading`)
    dateRows.set(siteId, reading)
    byDate.set(date, dateRows)
    dates.add(date)
  }

  const sortedDates = [...dates].sort()
  const latestCompleteDate = [...sortedDates].reverse().find((date) => {
    const rows = byDate.get(date) ?? new Map<string, AirDailyReading>()
    return [...rows.values()].some((reading) => reading.coverageStatus === 'qualifying')
  }) ?? null

  return {
    stations: [...stations.values()],
    stationById: stations,
    dates: sortedDates,
    byDate,
    minDate: sortedDates[0],
    maxDate: sortedDates.at(-1) ?? '',
    latestCompleteDate,
    row: {
      total: sortedDates.length * stations.size,
      qualifying,
      noData,
      insufficientHours,
      nullValues,
    },
    coverage: { minPct, maxPct },
  }
}

export const parseAirHourlyCsv = (
  text: string,
  dailyStations: readonly AirStation[],
  sourceFile = AIR_HOURLY_PATH,
): AirHourlyDataset => {
  const parsed = parseCsv(text)
  if (parsed.length < 2) throw new Error(`${sourceFile}: no hourly readings`)
  const headers = parsed[0]
  const requiredHeaders = [
    'timestamp_utc',
    'timestamp_nyc',
    'site_id',
    'site_name',
    'borough',
    'latitude',
    'longitude',
    'pm25_ugm3',
    'quality_status',
    'location_note',
  ]
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) throw new Error(`${sourceFile}: missing ${header}`)
  }

  const stationById = new Map(dailyStations.map((station) => [station.id, station]))
  const byTimestamp = new Map<number, Map<string, AirHourlyReading>>()
  const timestamps = new Set<number>()
  let nullValues = 0

  for (let index = 1; index < parsed.length; index += 1) {
    const label = `${sourceFile} row ${index + 1}`
    const row = rowObject(parsed[index], headers, label)
    const siteId = required(row, 'site_id', label)
    const station = stationById.get(siteId)
    if (!station) throw new Error(`${label}: unknown hourly station ${siteId}`)
    stationFromRow(row, label, station)

    const timestampMs = timestampValue(optional(row, 'timestamp_utc'), label)
    const rawPm25 = optional(row, 'pm25_ugm3')
    const pm25 = optionalNumber(rawPm25, label)
    if (pm25 !== null && pm25 < 0) throw new Error(`${label}: PM2.5 must not be negative`)
    if (pm25 === null) nullValues += 1

    const reading: AirHourlyReading = {
      timestampMs,
      timestampUtc: required(row, 'timestamp_utc', label),
      timestampNyc: optional(row, 'timestamp_nyc'),
      siteId,
      siteName: station.name,
      borough: station.borough,
      coordinates: station.coordinates,
      pm25,
      qualityStatus: optional(row, 'quality_status'),
      locationNote: optional(row, 'location_note'),
    }

    const timestampRows = byTimestamp.get(timestampMs) ?? new Map<string, AirHourlyReading>()
    if (timestampRows.has(siteId)) throw new Error(`${label}: duplicate hourly site reading`)
    timestampRows.set(siteId, reading)
    byTimestamp.set(timestampMs, timestampRows)
    timestamps.add(timestampMs)
  }

  const sortedTimestamps = [...timestamps].sort((a, b) => a - b)
  const totalExpected = sortedTimestamps.length * dailyStations.length
  return {
    stations: [...dailyStations],
    stationById,
    timestamps: sortedTimestamps,
    byTimestamp,
    minTimestamp: sortedTimestamps[0] ?? 0,
    maxTimestamp: sortedTimestamps.at(-1) ?? 0,
    row: {
      total: totalExpected,
      present: parsed.length - 1,
      missing: Math.max(0, totalExpected - (parsed.length - 1)),
      nullValues,
    },
  }
}

export const parseAirDataset = (
  dailyText: string,
  hourlyText: string | null,
): AirDataset => {
  const daily = parseAirDailyCsv(dailyText)
  return {
    daily,
    hourly: hourlyText === null ? null : parseAirHourlyCsv(hourlyText, daily.stations),
    dailyBytes: new TextEncoder().encode(dailyText).length,
    hourlyBytes: hourlyText === null ? null : new TextEncoder().encode(hourlyText).length,
    sourceFiles: [AIR_DAILY_PATH, ...(hourlyText === null ? [] : [AIR_HOURLY_PATH])],
  }
}

export const airTimelineSteps = (
  dataset: AirDataset | null,
  granularity: 'daily' | 'hourly',
  windowStart: number | null,
  windowEnd: number | null,
): number[] => {
  if (!dataset) return []
  const source = granularity === 'daily' ? dataset.daily.dates.map((date) => Date.parse(`${date}T00:00:00Z`)) : dataset.hourly?.timestamps ?? []
  return source.filter((timestamp) => (windowStart === null || timestamp >= windowStart) && (windowEnd === null || timestamp <= windowEnd))
}

export const nearestAirStep = (steps: readonly number[], timestamp: number): number => {
  if (steps.length === 0) return timestamp
  let low = 0
  let high = steps.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (steps[middle] < timestamp) low = middle + 1
    else high = middle
  }
  const after = steps[low]
  const before = low > 0 ? steps[low - 1] : null
  if (before === null) return after
  return Math.abs(after - timestamp) < Math.abs(timestamp - before) ? after : before
}

export const airReadingAt = (
  dataset: AirDataset | null,
  granularity: 'daily' | 'hourly',
  timestamp: number,
) => {
  if (!dataset) return null
  if (granularity === 'daily') {
    const date = new Date(timestamp).toISOString().slice(0, 10)
    return dataset.daily.byDate.get(date) ?? new Map<string, AirDailyReading>()
  }
  return dataset.hourly?.byTimestamp.get(timestamp) ?? new Map<string, AirHourlyReading>()
}

export const airValueColor = (value: number | null): { color: string, aboveScale: boolean } => {
  if (value === null) return { color: MISSING_COLOR, aboveScale: false }
  if (value > AIR_SCALE_MAX) return { color: ABOVE_SCALE_COLOR, aboveScale: true }
  const stop = AIR_SCALE.find((entry) => value <= entry.max)
  return { color: stop?.color ?? ABOVE_SCALE_COLOR, aboveScale: false }
}

export const buildAirMapPoints = (
  dataset: AirDataset | null,
  granularity: 'daily' | 'hourly',
  timestamp: number,
  options: {
    borough: string | null
    siteFilter: string
    selectedSiteId: string | null
  },
): FeatureCollection => {
  if (!dataset) return { type: 'FeatureCollection', features: [] }
  const readings = airReadingAt(dataset, granularity, timestamp) ?? new Map<string, AirDailyReading>()
  const stations = dataset.daily.stations.filter((station) => {
    if (options.borough && station.borough !== options.borough) return false
    if (options.siteFilter === 'south-bronx') return ['36005NY11534', '36005NY11790', '36005NY12387'].includes(station.id)
    if (options.siteFilter !== 'all' && station.id !== options.siteFilter) return false
    return true
  })

  return {
    type: 'FeatureCollection',
    features: stations.map((station) => {
      const reading = readings.get(station.id)
      const pm25 = reading ? ('pm25' in reading ? reading.pm25 : null) : null
      const isDaily = granularity === 'daily'
      const coverageStatus: AirCoverageStatus = reading
        ? isDaily
          ? (reading as AirDailyReading).coverageStatus
          : (reading.pm25 === null ? 'insufficient_hours' : 'qualifying')
        : 'no_data'
      const missing = coverageStatus !== 'qualifying' || pm25 === null
      const color = airValueColor(pm25)
      const point: AirMapPoint = {
        id: station.id,
        name: station.name,
        borough: station.borough,
        coordinates: station.coordinates,
        period: formatAirPeriod(timestamp, granularity),
        pm25,
        coverage: isDaily && reading
          ? `${(reading as AirDailyReading).coverageHours}/24 h · ${((reading as AirDailyReading).coveragePct ?? 0).toFixed(0)}%`
          : reading
            ? '1 hourly record'
            : 'No record',
        coverageStatus,
        color: missing ? MISSING_COLOR : color.color,
        fill: missing ? MISSING_FILL : color.color,
        stroke: missing ? MISSING_COLOR : '#fcfcfb',
        radius: options.selectedSiteId === station.id ? 7 : 4,
        selected: options.selectedSiteId === station.id,
        aboveScale: !missing && color.aboveScale,
      }

      return {
        type: 'Feature',
        id: station.id,
        geometry: { type: 'Point', coordinates: station.coordinates },
        properties: {
          id: point.id,
          name: point.name,
          borough: point.borough,
          period: point.period,
          pm25: point.pm25,
          coverage: point.coverage,
          coverageStatus: point.coverageStatus,
          color: point.color,
          fill: point.fill,
          stroke: point.stroke,
          radius: point.radius,
          selected: point.selected,
          aboveScale: point.aboveScale,
          missing,
        },
      }
    }),
  }
}

export const formatAirPeriod = (timestamp: number, granularity: 'daily' | 'hourly'): string => {
  if (granularity === 'daily') {
    return `${new Date(timestamp).toISOString().slice(0, 10)} UTC day`
  }

  const utc = new Date(timestamp)
  const local = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  }).format(utc)
  return `${local} · ${utc.toISOString().replace('T', ' ').slice(0, 16)} UTC`
}

export const formatAirValue = (value: number | null, aboveScale = false): string => {
  if (value === null) return 'No data'
  return `${value.toFixed(2)} ${AIR_UNITS}${aboveScale ? ' · above scale' : ''}`
}

export const buildAirCoverageSummary = (dataset: AirDataset | null) => {
  if (!dataset) return null
  return {
    daily: {
      startDate: dataset.daily.minDate,
      endDate: dataset.daily.maxDate,
      days: dataset.daily.dates.length,
      monitors: dataset.daily.stations.length,
      qualifyingSiteDays: dataset.daily.row.qualifying,
      noDataSiteDays: dataset.daily.row.noData,
      insufficientHoursSiteDays: dataset.daily.row.insufficientHours,
      latestCompleteDate: dataset.daily.latestCompleteDate,
    },
    hourly: dataset.hourly ? {
      startDate: new Date(dataset.hourly.minTimestamp).toISOString().slice(0, 10),
      endDate: new Date(dataset.hourly.maxTimestamp).toISOString().slice(0, 10),
      hours: dataset.hourly.timestamps.length,
      monitors: dataset.hourly.stations.length,
      presentRecords: dataset.hourly.row.present,
      missingRecords: dataset.hourly.row.missing,
    } : null,
  }
}

const calendarDays = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate()

const monthKey = (year: number, month: number): string => `${year}-${String(month).padStart(2, '0')}`

const monthIsComplete = (dataset: AirDailyDataset, year: number, month: number): boolean => {
  const expected = calendarDays(year, month)
  const actual = dataset.dates.filter((date) => date.startsWith(monthKey(year, month))).length
  return actual === expected
}

const mean = (values: readonly number[]): number | null => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

export const buildAirMonthlyComparison = (
  dataset: AirDailyDataset,
  baselineYear: number,
  comparisonYear: number,
  selectedMonths: readonly number[] | null,
  includePartial: boolean,
): AirMonthlyComparisonSet => {
  const years = [baselineYear, comparisonYear]
  const candidateMonths = [...new Set(dataset.dates.flatMap((date) => {
    const parsed = date.split('-')
    return Number(parsed[0]) === baselineYear || Number(parsed[0]) === comparisonYear ? [Number(parsed[1])] : []
  }))].sort((a, b) => a - b)
  const selected = selectedMonths ?? candidateMonths
  const monthsToUse = includePartial ? selected : selected.filter((month) => years.every((year) => monthIsComplete(dataset, year, month)))
  const partialMonths = candidateMonths.filter((month) => !years.every((year) => monthIsComplete(dataset, year, month))).map((month) => monthKey(comparisonYear, month))

  const monthComparisons: AirMonthlyMonthComparison[] = monthsToUse.map((month) => {
    const baselineRows = dataset.dates.filter((date) => date.startsWith(monthKey(baselineYear, month))).flatMap((date) => [...(dataset.byDate.get(date) ?? new Map<string, AirDailyReading>()).values()].filter((reading) => reading.coverageStatus === 'qualifying' && reading.pm25 !== null))
    const comparisonRows = dataset.dates.filter((date) => date.startsWith(monthKey(comparisonYear, month))).flatMap((date) => [...(dataset.byDate.get(date) ?? new Map<string, AirDailyReading>()).values()].filter((reading) => reading.coverageStatus === 'qualifying' && reading.pm25 !== null))
    const baselineCoverage = baselineRows.length / (calendarDays(baselineYear, month) * dataset.stations.length) * 100
    const comparisonCoverage = comparisonRows.length / (calendarDays(comparisonYear, month) * dataset.stations.length) * 100
    return {
      month,
      label: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(comparisonYear, month - 1, 1))),
      completeCalendarMonth: years.every((year) => monthIsComplete(dataset, year, month)),
      baselineCoverage,
      comparisonCoverage,
      baselineMean: mean(baselineRows.map((reading) => reading.pm25 as number)),
      comparisonMean: mean(comparisonRows.map((reading) => reading.pm25 as number)),
    }
  })

  const sites: AirMonthlySiteComparison[] = dataset.stations.map((station) => {
    const siteRows = (year: number, month: number) => dataset.dates
      .filter((date) => date.startsWith(monthKey(year, month)))
      .flatMap((date) => {
        const reading = dataset.byDate.get(date)?.get(station.id)
        return reading && reading.coverageStatus === 'qualifying' && reading.pm25 !== null ? [reading.pm25] : []
      })
    const baselineValues = monthsToUse.flatMap((month) => siteRows(baselineYear, month))
    const comparisonValues = monthsToUse.flatMap((month) => siteRows(comparisonYear, month))
    const baselineDays = baselineValues.length
    const comparisonDays = comparisonValues.length
    const baselineCalendarDays = monthsToUse.reduce((sum, month) => sum + calendarDays(baselineYear, month), 0)
    const comparisonCalendarDays = monthsToUse.reduce((sum, month) => sum + calendarDays(comparisonYear, month), 0)
    const baselineMean = mean(baselineValues)
    const comparisonMean = mean(comparisonValues)
    return {
      siteId: station.id,
      siteName: station.name,
      borough: station.borough,
      coordinates: station.coordinates,
      locationHistoryFlag: station.locationHistoryFlag,
      baselineMean,
      comparisonMean,
      changePct: baselineMean === null || comparisonMean === null || baselineMean === 0 ? null : (comparisonMean - baselineMean) / baselineMean * 100,
      baselineCoverage: baselineCalendarDays === 0 ? 0 : baselineDays / baselineCalendarDays * 100,
      comparisonCoverage: comparisonCalendarDays === 0 ? 0 : comparisonDays / comparisonCalendarDays * 100,
      baselineDays,
      comparisonDays,
      baselineCalendarDays,
      comparisonCalendarDays,
    }
  })

  return {
    baselineYear,
    comparisonYear,
    months: monthComparisons,
    sites,
    partialMonths,
  }
}

export const isRecordGuard = isRecord
