/**
 * Release-asset parsers: published asset payload -> canonical domain model.
 *
 * Every rule here is a claim-safety gate, not a convenience. A malformed, incomplete, or
 * out-of-bounds published asset must raise, because the alternative is a view that renders a
 * plausible-looking number the release never actually published (`U-29`: no silent fallback).
 * Nothing in this module substitutes a default, coerces a missing value to zero, or drops a bad
 * record quietly.
 *
 * Bounds are deliberately wide: they are there to catch a coordinate-axis swap or a unit blow-up,
 * not to re-police the pipeline's own coverage window.
 */

import { ReleaseManifestError } from './releaseManifest'
import { TRAFFIC_DAY_TYPES, TRAFFIC_TIME_BANDS } from '../types/releaseData'
import type {
  AirContextSurface,
  CrzEntrySummary,
  EquityContext,
  EquityContextFeature,
  FacilityCrossing,
  HealthContext,
  HealthContextRecord,
  TrafficDayType,
  TrafficObservation,
} from '../types/releaseData'

const MONTH = /^\d{4}-\d{2}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Generous NYC envelope. A longitude/latitude swap lands outside it. */
const LNG_MIN = -74.5
const LNG_MAX = -73.5
const LAT_MIN = 40.4
const LAT_MAX = 41.0

/** Published E-ZPass share must reproduce the documented numerator/denominator to this tolerance. */
const SHARE_TOLERANCE_PCT = 0.01

// Declared as a function so TypeScript narrows `unknown` inputs after a guard call; an arrow
// function assigned to a const does not narrow the caller.
function malformed(assetLabel: string, detail: string): never {
  throw new ReleaseManifestError('ASSET_MALFORMED', `${assetLabel}: ${detail}`)
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const requireRecord = (value: unknown, assetLabel: string, field: string): Record<string, unknown> => {
  if (!isRecord(value)) malformed(assetLabel, `${field} must be an object`)
  return value
}

const requireString = (value: unknown, assetLabel: string, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    malformed(assetLabel, `${field} must be a non-empty string`)
  }
  return value
}

/** Optional text metadata: absent or blank becomes null, and is never inferred. */
const optionalString = (value: unknown, assetLabel: string, field: string): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') malformed(assetLabel, `${field} must be a string or null`)
  return value.trim() === '' ? null : value
}

const requireNumber = (value: unknown, assetLabel: string, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    malformed(assetLabel, `${field} must be a finite number`)
  }
  return value
}

const requireNonNegativeNumber = (value: unknown, assetLabel: string, field: string): number => {
  const parsed = requireNumber(value, assetLabel, field)
  if (parsed < 0) malformed(assetLabel, `${field} must not be negative (got ${parsed})`)
  return parsed
}

const requireCount = (value: unknown, assetLabel: string, field: string): number => {
  const parsed = requireNonNegativeNumber(value, assetLabel, field)
  if (!Number.isInteger(parsed)) malformed(assetLabel, `${field} must be a whole count (got ${parsed})`)
  return parsed
}

const requireMatch = (value: unknown, pattern: RegExp, assetLabel: string, field: string, expected: string): string => {
  const text = requireString(value, assetLabel, field)
  if (!pattern.test(text)) malformed(assetLabel, `${field} must be ${expected} (got "${text}")`)
  return text
}

/**
 * Dimension values are checked against the declared domains. A band outside the contract would
 * otherwise become a filter option that no published row can satisfy.
 */
const requireDayType = (value: unknown, assetLabel: string, field: string): TrafficDayType => {
  const text = requireString(value, assetLabel, field)
  if (!TRAFFIC_DAY_TYPES.includes(text as TrafficDayType)) {
    malformed(assetLabel, `${field} must be one of ${TRAFFIC_DAY_TYPES.join(', ')} (got "${text}")`)
  }
  return text as TrafficDayType
}

const requireTimeBand = (value: unknown, assetLabel: string, field: string): string => {
  const text = requireString(value, assetLabel, field)
  if (!(TRAFFIC_TIME_BANDS as readonly string[]).includes(text)) {
    malformed(assetLabel, `${field} must be one of ${TRAFFIC_TIME_BANDS.join(', ')} (got "${text}")`)
  }
  return text
}

const requireCoordinates = (value: unknown, assetLabel: string, field: string): [number, number] => {
  if (!Array.isArray(value) || value.length !== 2) {
    malformed(assetLabel, `${field} must be a [longitude, latitude] pair`)
  }
  const [lng, lat] = value
  const longitude = requireNumber(lng, assetLabel, `${field}[0]`)
  const latitude = requireNumber(lat, assetLabel, `${field}[1]`)
  if (longitude < LNG_MIN || longitude > LNG_MAX) {
    malformed(assetLabel, `${field} longitude ${longitude} is outside the NYC envelope (check for an axis swap)`)
  }
  if (latitude < LAT_MIN || latitude > LAT_MAX) {
    malformed(assetLabel, `${field} latitude ${latitude} is outside the NYC envelope (check for an axis swap)`)
  }
  return [longitude, latitude]
}

/**
 * Parse the published `traffic_observations` GeoJSON asset.
 *
 * The asset is publish-time validated and declares EPSG:4326, so this parser checks structure and
 * bounds only; it performs no reprojection and accepts no alternate CRS.
 */
export const parseTrafficObservations = (
  input: unknown,
  assetLabel = 'traffic_observations',
): TrafficObservation[] => {
  const collection = requireRecord(input, assetLabel, 'asset')
  if (collection.type !== 'FeatureCollection') malformed(assetLabel, 'asset must be a GeoJSON FeatureCollection')

  const features = collection.features
  if (!Array.isArray(features)) malformed(assetLabel, 'asset.features must be an array')
  if (features.length === 0) malformed(assetLabel, 'asset.features must not be empty')

  return features.map((feature, index) => {
    const field = `features[${index}]`
    const record = requireRecord(feature, assetLabel, field)

    if (record.type !== 'Feature') malformed(assetLabel, `${field}.type must be "Feature"`)

    const geometry = requireRecord(record.geometry, assetLabel, `${field}.geometry`)
    if (geometry.type !== 'Point') {
      malformed(assetLabel, `${field}.geometry.type must be "Point" (got "${String(geometry.type)}")`)
    }
    const coordinates = requireCoordinates(geometry.coordinates, assetLabel, `${field}.geometry.coordinates`)

    const properties = requireRecord(record.properties, assetLabel, `${field}.properties`)

    return {
      sourceId: requireString(properties.source_id, assetLabel, `${field}.properties.source_id`),
      measureId: requireString(properties.measure_id, assetLabel, `${field}.properties.measure_id`),
      segmentId: requireCount(properties.segment_id, assetLabel, `${field}.properties.segment_id`),
      borough: requireString(properties.borough, assetLabel, `${field}.properties.borough`),
      direction: requireString(properties.direction, assetLabel, `${field}.properties.direction`),
      month: requireMatch(properties.month, MONTH, assetLabel, `${field}.properties.month`, 'a YYYY-MM month'),
      dayType: requireDayType(properties.day_type, assetLabel, `${field}.properties.day_type`),
      timeBand: requireTimeBand(properties.time_band, assetLabel, `${field}.properties.time_band`),
      meanObserved15MinVolume: requireNonNegativeNumber(
        properties.mean_observed_15_min_volume, assetLabel, `${field}.properties.mean_observed_15_min_volume`,
      ),
      maxObserved15MinVolume: requireNonNegativeNumber(
        properties.max_observed_15_min_volume, assetLabel, `${field}.properties.max_observed_15_min_volume`,
      ),
      observationCount: requireCount(properties.observation_count, assetLabel, `${field}.properties.observation_count`),
      observedDays: requireCount(properties.observed_days, assetLabel, `${field}.properties.observed_days`),
      countSessions: requireCount(properties.count_sessions, assetLabel, `${field}.properties.count_sessions`),
      street: optionalString(properties.street, assetLabel, `${field}.properties.street`),
      fromStreet: optionalString(properties.from_street, assetLabel, `${field}.properties.from_street`),
      toStreet: optionalString(properties.to_street, assetLabel, `${field}.properties.to_street`),
      coordinates,
    }
  })
}

/**
 * Parse the published `facility_crossings` asset.
 *
 * Total vehicles and the E-ZPass share are recomputed from their documented numerator and
 * denominator rather than trusted as independent fields, so an internally inconsistent published
 * row fails loudly instead of rendering.
 */
export const parseFacilityCrossings = (
  input: unknown,
  assetLabel = 'facility_crossings',
): FacilityCrossing[] => {
  const root = requireRecord(input, assetLabel, 'asset')

  const records = root.records
  if (!Array.isArray(records)) malformed(assetLabel, 'asset.records must be an array')
  if (records.length === 0) malformed(assetLabel, 'asset.records must not be empty')

  return records.map((entry, index) => {
    const field = `records[${index}]`
    const record = requireRecord(entry, assetLabel, field)

    const direction = requireString(record.direction, assetLabel, `${field}.direction`)

    const plazaId = requireCount(record.plaza_id, assetLabel, `${field}.plaza_id`)
    if (plazaId === 0) malformed(assetLabel, `${field}.plaza_id must be a positive plaza identifier`)

    const ezpassVehicles = record.ezpass_vehicles === null ? null
      : requireCount(record.ezpass_vehicles, assetLabel, `${field}.ezpass_vehicles`)
    const tollsByMailValue = 'tolls_by_mail_vehicles' in record ? record.tolls_by_mail_vehicles : record.vtoll_vehicles
    const tollsByMailVehicles = tollsByMailValue === null
      ? null
      : requireCount(tollsByMailValue, assetLabel, `${field}.tolls_by_mail_vehicles`)
    const totalVehicles = requireCount(record.total_vehicles, assetLabel, `${field}.total_vehicles`)

    if (totalVehicles !== (ezpassVehicles ?? 0) + (tollsByMailVehicles ?? 0)) {
      malformed(
        assetLabel,
        `${field}.total_vehicles (${totalVehicles}) must equal the published payment components`,
      )
    }

    const ezpassSharePct = record.ezpass_share_pct === null ? null : requireNonNegativeNumber(record.ezpass_share_pct, assetLabel, `${field}.ezpass_share_pct`)
    if (ezpassSharePct !== null && ezpassSharePct > 100) {
      malformed(assetLabel, `${field}.ezpass_share_pct must be a percentage (got ${ezpassSharePct})`)
    }
    if ((ezpassVehicles === null || tollsByMailVehicles === null) && ezpassSharePct !== null) malformed(assetLabel, `${field}.ezpass_share_pct must be null when payment coverage is incomplete`)

    if (totalVehicles > 0 && ezpassVehicles !== null && ezpassSharePct !== null) {
      const expectedShare = (ezpassVehicles / totalVehicles) * 100
      if (Math.abs(expectedShare - ezpassSharePct) > SHARE_TOLERANCE_PCT) {
        malformed(
          assetLabel,
          `${field}.ezpass_share_pct (${ezpassSharePct}) does not match its numerator and denominator `
          + `(${expectedShare.toFixed(6)})`,
        )
      }
    }

    return {
      sourceId: requireString(record.source_id, assetLabel, `${field}.source_id`),
      measureId: requireString(record.measure_id, assetLabel, `${field}.measure_id`),
      observedOn: requireMatch(record.observed_on, ISO_DATE, assetLabel, `${field}.observed_on`, 'a YYYY-MM-DD date'),
      plazaId,
      facilityCode: requireString(record.facility_code, assetLabel, `${field}.facility_code`),
      facilityName: requireString(record.facility_name, assetLabel, `${field}.facility_name`),
      direction,
      ezpassVehicles,
      tollsByMailVehicles,
      totalVehicles,
      ezpassSharePct,
      paymentCoverageComplete: ezpassVehicles !== null && tollsByMailVehicles !== null,
    }
  })
}

/**
 * Parse the published `crz_context` asset. Monthly sums per detection group, so every count must be a
 * non-negative integer and the month a real `YYYY-MM`.
 */
export const parseCrzEntries = (
  input: unknown,
  assetLabel = 'crz_entry_summary',
): CrzEntrySummary[] => {
  const root = requireRecord(input, assetLabel, 'asset')

  const records = Array.isArray(root.records) ? root.records : Array.isArray(root.rows) ? root.rows : null
  if (!records) malformed(assetLabel, 'asset.records or asset.rows must be an array')
  if (records.length === 0) malformed(assetLabel, 'asset.records must not be empty')

  const entries = records.map((entry, index) => {
    const field = `records[${index}]`
    const record = requireRecord(entry, assetLabel, field)

    const crzEntries = requireCount(record.crz_entries, assetLabel, `${field}.crz_entries`)
    const excludedRoadwayEntries = requireCount(
      record.excluded_roadway_entries, assetLabel, `${field}.excluded_roadway_entries`,
    )
    const totalEntries = requireCount(record.total_entries ?? record.all_entries, assetLabel, `${field}.total_entries`)

    if (totalEntries !== crzEntries + excludedRoadwayEntries) {
      malformed(
        assetLabel,
        `${field}.total_entries (${totalEntries}) must equal crz_entries + excluded_roadway_entries `
        + `(${crzEntries} + ${excludedRoadwayEntries})`,
      )
    }

    const legacyMonth = typeof record.month_start === 'string'
      ? record.month_start.slice(0, 7)
      : typeof record.year === 'number' && typeof record.month === 'number'
        ? `${record.year}-${String(record.month).padStart(2, '0')}`
        : null

    return {
      sourceId: typeof record.source_id === 'string' && record.source_id.trim() !== ''
        ? requireString(record.source_id, assetLabel, `${field}.source_id`)
        : 'mta_crz_entries_2025_2026',
      measureId: typeof record.measure_id === 'string' && record.measure_id.trim() !== ''
        ? requireString(record.measure_id, assetLabel, `${field}.measure_id`)
        : 'crz_monthly_detection_group_entries',
      detectionGroup: requireString(record.detection_group, assetLabel, `${field}.detection_group`),
      detectionRegion: requireString(record.detection_region, assetLabel, `${field}.detection_region`),
      month: requireMatch(
        typeof record.month === 'string' ? record.month : legacyMonth,
        MONTH,
        assetLabel,
        `${field}.month`,
        'a YYYY-MM month',
      ),
      crzEntries,
      excludedRoadwayEntries,
      totalEntries,
    }
  })

  if (Array.isArray(root.records)) return entries

  const grouped = new Map<string, CrzEntrySummary>()
  for (const entry of entries) {
    const key = `${entry.sourceId}\n${entry.measureId}\n${entry.detectionGroup}\n${entry.detectionRegion}\n${entry.month}`
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...entry })
      continue
    }
    existing.crzEntries += entry.crzEntries
    existing.excludedRoadwayEntries += entry.excludedRoadwayEntries
    existing.totalEntries += entry.totalEntries
  }

  return [...grouped.values()]
}

/** Optional count: absent stays null and is never coerced to zero. */
const optionalCount = (value: unknown, assetLabel: string, field: string): number | null => {
  if (value === null || value === undefined) return null
  return requireCount(value, assetLabel, field)
}

/**
 * Optional non-negative number: for published fields that are not counts, such as a percentile.
 * Validating a percentile as a whole count is wrong and rejects a legitimate asset.
 */
const optionalNonNegativeNumber = (value: unknown, assetLabel: string, field: string): number | null => {
  if (value === null || value === undefined) return null
  return requireNonNegativeNumber(value, assetLabel, field)
}

/**
 * Parse the published modelled air surface.
 *
 * Values must stay inside 0-1 because the published field is relative; a value that looks like a
 * concentration means the wrong column was published, and that must fail rather than render.
 */
export const parseAirContext = (input: unknown, assetLabel = 'historical_context'): AirContextSurface => {
  const root = requireRecord(input, assetLabel, 'asset')

  const boundsRaw = root.bounds
  if (!Array.isArray(boundsRaw) || boundsRaw.length !== 4) {
    malformed(assetLabel, 'asset.bounds must be [west, south, east, north]')
  }
  const bounds = boundsRaw.map((value, index) =>
    requireNumber(value, assetLabel, `asset.bounds[${index}]`)) as [number, number, number, number]

  const width = requireCount(root.width, assetLabel, 'asset.width')
  const height = requireCount(root.height, assetLabel, 'asset.height')
  if (width === 0 || height === 0) malformed(assetLabel, 'asset.width and asset.height must be positive')

  const gridRaw = root.grid
  if (!Array.isArray(gridRaw) || gridRaw.length !== height) {
    malformed(assetLabel, `asset.grid must have ${height} rows`)
  }

  const grid = gridRaw.map((row, y) => {
    if (!Array.isArray(row) || row.length !== width) malformed(assetLabel, `asset.grid[${y}] must have ${width} columns`)
    return row.map((value, x) => {
      if (value === null) return null
      const parsed = requireNumber(value, assetLabel, `asset.grid[${y}][${x}]`)
      if (parsed < 0 || parsed > 1) {
        malformed(assetLabel, `asset.grid[${y}][${x}] must be a relative value between 0 and 1 (got ${parsed})`)
      }
      return parsed
    })
  })

  return {
    pollutantLabel: requireString(root.pollutant_label, assetLabel, 'asset.pollutant_label'),
    periodLabel: requireString(root.period_label, assetLabel, 'asset.period_label'),
    valuesNote: requireString(root.values, assetLabel, 'asset.values'),
    aggregation: requireString(root.aggregation, assetLabel, 'asset.aggregation'),
    bounds,
    width,
    height,
    grid,
  }
}

const PERIOD_RANGE = /^\d{4}-\d{4}$/

/** Parse the published historical health context. Rates are published as supplied, never recomputed. */
export const parseHealthContext = (input: unknown, assetLabel = 'health_context'): HealthContext => {
  const root = requireRecord(input, assetLabel, 'asset')

  const records = root.records
  if (!Array.isArray(records) || records.length === 0) malformed(assetLabel, 'asset.records must be a non-empty array')

  const parsed: HealthContextRecord[] = records.map((entry, index) => {
    const field = `records[${index}]`
    const record = requireRecord(entry, assetLabel, field)

    return {
      indicator: requireString(record.indicator, assetLabel, `${field}.indicator`),
      county: requireString(record.county, assetLabel, `${field}.county`),
      borough: requireString(record.borough, assetLabel, `${field}.borough`),
      period: requireMatch(record.period, PERIOD_RANGE, assetLabel, `${field}.period`, 'a YYYY-YYYY period'),
      // A rate per 10,000 head and a daily mean are published as fractions of a case, so they are
      // numbers rather than counts. Validating them as whole counts rejects the asset outright.
      ageAdjustedRatePer10000: optionalNonNegativeNumber(
        record.age_adjusted_rate_per_10000, assetLabel, `${field}.age_adjusted_rate_per_10000`,
      ),
      events: optionalCount(record.events, assetLabel, `${field}.events`),
      dailyMeanEvents: optionalNonNegativeNumber(
        record.daily_mean_events, assetLabel, `${field}.daily_mean_events`,
      ),
    }
  })

  return {
    source: requireString(root.source, assetLabel, 'asset.source'),
    geographyLabel: requireString(root.geography_label, assetLabel, 'asset.geography_label'),
    periodLabel: requireString(root.period_label, assetLabel, 'asset.period_label'),
    records: parsed,
  }
}

/**
 * Ring structure is part of the contract, not a detail of the renderer.
 *
 * Checking only that `coordinates` is an array accepts a payload whose rings are strings or whose
 * positions are one number long. The module then projects each position in turn and throws during
 * render, which reaches the reader as a blank module. Validate the structure here instead, so a
 * malformed published asset fails as a data error with a named field.
 */
const requireRings = (coordinates: unknown, assetLabel: string, field: string, type: string): void => {
  const position = (value: unknown, at: string): void => {
    if (!Array.isArray(value) || value.length < 2) {
      malformed(assetLabel, `${at} must be a [lng, lat] pair`)
    }
    // Bound every position to the city envelope. DATA_STRATEGY's spatial gate asks for coordinate
    // bounds precisely to catch an axis swap, and a swapped tract still renders as a shape rather
    // than as an error, so the shape check alone would let it through.
    requireCoordinates(value, assetLabel, at)
  }
  const ring = (value: unknown, at: string): void => {
    if (!Array.isArray(value) || value.length < 3) {
      malformed(assetLabel, `${at} must be a ring of at least 3 positions`)
    }
    value.forEach((item, index) => position(item, `${at}[${index}]`))
  }
  const polygon = (value: unknown, at: string): void => {
    if (!Array.isArray(value) || value.length === 0) {
      malformed(assetLabel, `${at} must be a non-empty array of rings`)
    }
    value.forEach((item, index) => ring(item, `${at}[${index}]`))
  }

  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    malformed(assetLabel, `${field} must be a non-empty array`)
  }
  if (type === 'Polygon') {
    polygon(coordinates, field)
    return
  }
  coordinates.forEach((item, index) => polygon(item, `${field}[${index}]`))
}

/** Parse the published archived equity geography. */
export const parseEquityContext = (input: unknown, assetLabel = 'dac_context'): EquityContext => {
  const root = requireRecord(input, assetLabel, 'asset')

  const features = root.features
  if (!Array.isArray(features) || features.length === 0) malformed(assetLabel, 'asset.features must be a non-empty array')

  const parsed: EquityContextFeature[] = features.map((entry, index) => {
    const field = `features[${index}]`
    const feature = requireRecord(entry, assetLabel, field)
    if (feature.type !== 'Feature') malformed(assetLabel, `${field}.type must be "Feature"`)

    const geometry = requireRecord(feature.geometry, assetLabel, `${field}.geometry`)
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      malformed(assetLabel, `${field}.geometry must be a Polygon or MultiPolygon (got "${String(geometry.type)}")`)
    }
    requireRings(geometry.coordinates, assetLabel, `${field}.geometry.coordinates`, geometry.type)

    const properties = requireRecord(feature.properties, assetLabel, `${field}.properties`)

    return {
      geoid: requireString(properties.GEOID, assetLabel, `${field}.properties.GEOID`),
      county: requireString(properties.County, assetLabel, `${field}.properties.County`),
      population: optionalCount(properties.Pop_Cnt, assetLabel, `${field}.properties.Pop_Cnt`),
      vulnerabilityPercentile: optionalNonNegativeNumber(
        properties.Vulner_Pct, assetLabel, `${field}.properties.Vulner_Pct`,
      ),
      geometry: { type: geometry.type, coordinates: geometry.coordinates },
    }
  })

  return {
    vintage: requireString(root.vintage, assetLabel, 'asset.vintage'),
    geographyLabel: requireString(root.geography_label, assetLabel, 'asset.geography_label'),
    features: parsed,
  }
}
