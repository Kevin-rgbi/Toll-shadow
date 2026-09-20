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
  direction: 'I' | 'O'
  ezpassVehicles: number
  vtollVehicles: number
  totalVehicles: number
  ezpassSharePct: number
}
