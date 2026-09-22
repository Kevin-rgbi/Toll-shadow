/**
 * Canonical domain models for published release assets.
 *
 * These are the only shapes an evidence module may read. They are intentionally decoupled from the
 * pipeline's column names: a published asset field rename must be handled in `lib/releaseData.ts`,
 * not by reaching into a view and reading a raw `mean_observed_15_min_volume` key directly
 * (see `docs/ARCHITECTURE.md`, "Domain adapters").
 */

/** One segment/borough/direction/calendar-month aggregate of sampled DOT 15-minute observations. */
export interface TrafficObservation {
  sourceId: string
  measureId: string
  segmentId: number
  borough: string
  direction: string
  /** Observation month as `YYYY-MM`. */
  month: string
  /** `Weekday` or `Weekend`, derived from the observation date by the pipeline. */
  dayType: TrafficDayType
  /** Reporting band of the observation hour. See `TRAFFIC_TIME_BANDS`. */
  timeBand: string
  meanObserved15MinVolume: number
  maxObserved15MinVolume: number
  observationCount: number
  observedDays: number
  countSessions: number
  /** Null when the source left the label blank; never inferred or filled in. */
  street: string | null
  fromStreet: string | null
  toStreet: string | null
  /** `[longitude, latitude]` in EPSG:4326, as published. */
  coordinates: [number, number]
}

export type TrafficDayType = 'Weekday' | 'Weekend'

/**
 * Reporting bands, as declared by the pipeline measure spec and the traffic contract. Every hour
 * falls in exactly one band, and the labels match the legacy Kepler table so the two can be
 * compared. An asset carrying a band outside this list is rejected rather than rendered.
 */
export const TRAFFIC_TIME_BANDS = [
  'Overnight (22-06)',
  'AM peak (06-09)',
  'Midday (09-16)',
  'PM peak (16-19)',
  'Evening (19-22)',
] as const

export const TRAFFIC_DAY_TYPES: TrafficDayType[] = ['Weekday', 'Weekend']

/** One calendar-day, toll-plaza, and direction aggregate as supplied by MTA. */
export interface FacilityCrossing {
  sourceId: string
  measureId: string
  /** Observation date as `YYYY-MM-DD`. */
  observedOn: string
  plazaId: number
  /** Register facility code, e.g. TBX. Resolved by the pipeline from the source register. */
  facilityCode: string
  /** Register facility name. A crossing the register cannot name is never published. */
  facilityName: string
  /** Full official direction label in current releases; I/O only in retained legacy releases. */
  direction: string
  ezpassVehicles: number | null
  tollsByMailVehicles: number | null
  totalVehicles: number
  ezpassSharePct: number | null
  paymentCoverageComplete: boolean
}

/**
 * One calendar-month aggregate of CRZ vehicle entries for a detection group.
 *
 * Detection groups are areas around the Central Business District, not detector points, and the
 * published grain is monthly: neither an hourly view nor a precise location follows from this record.
 */
export interface CrzEntrySummary {
  sourceId: string
  measureId: string
  detectionGroup: string
  detectionRegion: string
  /** Observation month as `YYYY-MM`. */
  month: string
  crzEntries: number
  excludedRoadwayEntries: number
  totalEntries: number
}

/**
 * Modelled historical air surface, published as a relative field.
 *
 * The pollutant and period labels are inferred from the source filename and absolute units are not
 * established in the archive, so nothing here carries a concentration. Values are relative within the
 * surface only.
 */
export interface AirContextSurface {
  pollutantLabel: string
  periodLabel: string
  valuesNote: string
  aggregation: string
  /** `[west, south, east, north]` in EPSG:4326. */
  bounds: [number, number, number, number]
  width: number
  height: number
  /** Row-major relative values, null where the source had no data. */
  grid: Array<Array<number | null>>
}

/** One historical health record: a rolling period for a county, which in NYC is a borough. */
export interface HealthContextRecord {
  indicator: string
  county: string
  borough: string
  period: string
  ageAdjustedRatePer10000: number | null
  events: number | null
  dailyMeanEvents: number | null
}

export interface HealthContext {
  source: string
  geographyLabel: string
  periodLabel: string
  records: HealthContextRecord[]
}

/** One archived disadvantaged-communities tract. */
export interface EquityContextFeature {
  geoid: string
  county: string
  population: number | null
  vulnerabilityPercentile: number | null
  geometry: { type: 'Polygon' | 'MultiPolygon', coordinates: unknown }
}

export interface EquityContext {
  vintage: string
  geographyLabel: string
  features: EquityContextFeature[]
}
