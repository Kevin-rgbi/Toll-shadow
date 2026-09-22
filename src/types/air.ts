export type AirGranularity = 'daily' | 'hourly'

export type AirCoverageStatus = 'qualifying' | 'no_data' | 'insufficient_hours' | 'monitor_relocated'

export interface AirStation {
  id: string
  name: string
  borough: string
  coordinates: [number, number]
  locationNote: string | null
  locationHistoryFlag: boolean
}

export interface AirDailyReading {
  timestampMs: number
  date: string
  siteId: string
  siteName: string
  borough: string
  coordinates: [number, number]
  pm25: number | null
  coverageHours: number
  expectedHours: number
  coveragePct: number | null
  coverageStatus: AirCoverageStatus
  qualityStatus: string | null
}

export interface AirHourlyReading {
  timestampMs: number
  timestampUtc: string
  timestampNyc: string | null
  siteId: string
  siteName: string
  borough: string
  coordinates: [number, number]
  pm25: number | null
  qualityStatus: string | null
  locationNote: string | null
}

export interface AirDailyDataset {
  stations: AirStation[]
  stationById: ReadonlyMap<string, AirStation>
  dates: string[]
  byDate: ReadonlyMap<string, ReadonlyMap<string, AirDailyReading>>
  minDate: string
  maxDate: string
  latestCompleteDate: string | null
  row: {
    total: number
    qualifying: number
    noData: number
    insufficientHours: number
    nullValues: number
  }
  coverage: {
    minPct: number | null
    maxPct: number | null
  }
}

export interface AirHourlyDataset {
  stations: AirStation[]
  stationById: ReadonlyMap<string, AirStation>
  timestamps: number[]
  byTimestamp: ReadonlyMap<number, ReadonlyMap<string, AirHourlyReading>>
  minTimestamp: number
  maxTimestamp: number
  row: {
    total: number
    present: number
    missing: number
    nullValues: number
  }
}

export interface AirDataset {
  daily: AirDailyDataset
  hourly: AirHourlyDataset | null
  dailyBytes: number
  hourlyBytes: number | null
  sourceFiles: string[]
}

export interface AirLoadState {
  status: 'loading' | 'ready' | 'error' | 'unavailable'
  dataset: AirDataset | null
  reason: string | null
  granularity: AirGranularity
}

export interface AirMapPoint {
  id: string
  name: string
  borough: string
  coordinates: [number, number]
  period: string
  pm25: number | null
  coverage: string
  coverageStatus: AirCoverageStatus
  color: string
  fill: string
  stroke: string
  radius: number
  selected: boolean
  aboveScale: boolean
}

export interface AirMonthlySiteComparison {
  siteId: string
  siteName: string
  borough: string
  coordinates: [number, number]
  locationHistoryFlag: boolean
  baselineMean: number | null
  comparisonMean: number | null
  changePct: number | null
  baselineCoverage: number
  comparisonCoverage: number
  baselineDays: number
  comparisonDays: number
  baselineCalendarDays: number
  comparisonCalendarDays: number
}

export interface AirMonthlyMonthComparison {
  month: number
  label: string
  completeCalendarMonth: boolean
  baselineCoverage: number
  comparisonCoverage: number
  baselineMean: number | null
  comparisonMean: number | null
}

export interface AirMonthlyComparisonSet {
  baselineYear: number
  comparisonYear: number
  months: AirMonthlyMonthComparison[]
  sites: AirMonthlySiteComparison[]
  partialMonths: string[]
}

export interface AirCoverageSummary {
  daily: {
    startDate: string
    endDate: string
    days: number
    monitors: number
    qualifyingSiteDays: number
    noDataSiteDays: number
    insufficientHoursSiteDays: number
    latestCompleteDate: string | null
  }
  hourly: {
    startDate: string | null
    endDate: string | null
    hours: number
    monitors: number
    presentRecords: number
    missingRecords: number
  } | null
}

export interface MonitorEffect {
  monitorId: string
  name: string
  period: string
  observedPm25: number
  expectedPm25: number
  effect: number
  confidence: number
  classification: string
  coordinates: [number, number]
}
