import type { FeatureCollection, Geometry } from 'geojson'

export const QUALITY_POLLUTANTS = ['EC', 'NOX', 'PM', 'O3'] as const
export type QualityPollutant = (typeof QUALITY_POLLUTANTS)[number]

export interface QualityCoverage {
  start: string
  end: string
}

export interface AnalyticFieldSummary {
  unit: string
  present: number
  missing: number
}

export interface QualitySitePost {
  siteId: string
  postNo: string
  latitude: number
  longitude: number
  referenceValues: string[]
  coreValues: string[]
  sourceRows: number
  qaRows: number
  coverage: QualityCoverage
}

export interface PollutantQuality {
  sourceId: string
  label: string
  sourceRows: number
  distinctSiteIds: number
  distinctSitePosts: number
  coverage: QualityCoverage
  analyticFields: Record<string, AnalyticFieldSummary>
  qa: { flag1: number, flag2: number, eitherFlag: number, neitherFlag: number }
  sitePosts: QualitySitePost[]
}

export interface AirQualityContext {
  title: string
  sourceReleaseDate: string
  coverage: QualityCoverage
  pollutants: Record<QualityPollutant, PollutantQuality>
  limitations: string[]
}

export interface NeighborhoodPoint {
  siteId: string
  siteName: string | null
  inside: false
  distanceKm: number
  coordinates: [number, number]
  pollutants: QualityPollutant[]
}

export interface NeighborhoodContext {
  area: { id: 'BX1001', name: 'Westchester Square', borough: 'Bronx' }
  coverage: { historicalSitesInside: 0, currentMonitorsInside: 0 }
  nearestHistorical: NeighborhoodPoint
  nearestCurrent: NeighborhoodPoint
  featureCollection: FeatureCollection
  limitations: string[]
}

export function toNeighborhoodMapLayers(context: NeighborhoodContext) {
  const source = context.featureCollection
  const boundary = source.features.filter((feature) => feature.properties?.kind === 'boundary')
  const points = source.features.filter((feature) => feature.geometry.type === 'Point').map((feature) => {
    const properties = feature.properties ?? {}
    const distance = typeof properties.distance_to_boundary_km === 'number'
      ? properties.distance_to_boundary_km
      : null
    const siteId = typeof properties.site_id === 'string' ? properties.site_id : 'monitor'
    return {
      ...feature,
      properties: {
        ...properties,
        id: siteId,
        name: typeof properties.site_name === 'string' ? properties.site_name : siteId,
        borough: 'Bronx · outside BX1001',
        period: properties.kind === 'nearest_current' ? 'current monitor' : 'historical NYCCAS site',
        coverage: distance === null ? 'outside boundary' : `${distance.toFixed(3)} km outside boundary`,
        meanVolume: 50,
        radius: properties.kind === 'nearest_current' ? 7 : 6,
        color: properties.kind === 'nearest_current' ? '#c84b31' : '#1f4bd8',
      },
    }
  })
  return {
    boundary: { type: 'FeatureCollection' as const, features: boundary },
    points: { type: 'FeatureCollection' as const, features: points },
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const EXPECTED_FIELDS: Record<QualityPollutant, string[]> = {
  EC: ['bc_conc', 'ec_abs_iso'],
  NOX: ['blk_corr_no', 'blk_corr_no2'],
  PM: ['blk_corr_pm_ugm3'],
  O3: ['blk_corr_o3_ppb'],
}

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as Record<string, unknown>
}

const asText = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`)
  return value
}

const asInteger = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer`)
  return value
}

const asFinite = (value: unknown, label: string, minimum: number, maximum: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`)
  }
  return value
}

const asStringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array`)
  return value.map((entry, index) => asText(entry, `${label}[${index}]`))
}

const asCoverage = (value: unknown, label: string): QualityCoverage => {
  const record = asRecord(value, label)
  const start = asText(record.start, `${label}.start`)
  const end = asText(record.end, `${label}.end`)
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end) || start > end) throw new Error(`${label} must contain ordered ISO dates`)
  return { start, end }
}

const parseAnalyticFields = (value: unknown, pollutant: QualityPollutant, sourceRows: number) => {
  const fields = asRecord(value, `${pollutant}.analytic_fields`)
  if (Object.keys(fields).sort().join('|') !== [...EXPECTED_FIELDS[pollutant]].sort().join('|')) {
    throw new Error(`${pollutant}.analytic_fields do not match the approved fields`)
  }
  return Object.fromEntries(Object.entries(fields).map(([name, input]) => {
    const record = asRecord(input, `${pollutant}.${name}`)
    const present = asInteger(record.present, `${pollutant}.${name}.present`)
    const missing = asInteger(record.missing, `${pollutant}.${name}.missing`)
    if (present + missing !== sourceRows) throw new Error(`${pollutant}.${name} present plus missing must equal source_rows`)
    return [name, { unit: asText(record.unit, `${pollutant}.${name}.unit`), present, missing }]
  }))
}

const parseSitePosts = (value: unknown, pollutant: QualityPollutant, sourceRows: number): QualitySitePost[] => {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${pollutant}.site_posts must be a non-empty array`)
  const seen = new Set<string>()
  const sites = value.map((input, index) => {
    const record = asRecord(input, `${pollutant}.site_posts[${index}]`)
    const siteId = asText(record.site_id, `${pollutant}.site_posts[${index}].site_id`)
    const postNo = asText(record.post_no, `${pollutant}.site_posts[${index}].post_no`)
    const key = `${siteId}:${postNo}`
    if (seen.has(key)) throw new Error(`${pollutant}.site_posts contains duplicate ${key}`)
    seen.add(key)
    const rows = asInteger(record.source_rows, `${key}.source_rows`)
    const qaRows = asInteger(record.qa_rows, `${key}.qa_rows`)
    if (rows === 0 || qaRows > rows) throw new Error(`${key} has invalid row counts`)
    return {
      siteId,
      postNo,
      latitude: asFinite(record.latitude, `${key}.latitude`, -90, 90),
      longitude: asFinite(record.longitude, `${key}.longitude`, -180, 180),
      referenceValues: asStringArray(record.reference_values, `${key}.reference_values`),
      coreValues: asStringArray(record.core_values, `${key}.core_values`),
      sourceRows: rows,
      qaRows,
      coverage: asCoverage(record.coverage, `${key}.coverage`),
    }
  })
  if (sites.reduce((total, site) => total + site.sourceRows, 0) !== sourceRows) {
    throw new Error(`${pollutant}.site_posts source row total does not match source_rows`)
  }
  return sites
}

export function parseAirQualityContext(input: unknown, label = 'air quality context'): AirQualityContext {
  const record = asRecord(input, label)
  if (record.schema_version !== '1.0.0') throw new Error(`${label} has an unsupported schema_version`)
  const rawPollutants = asRecord(record.pollutants, `${label}.pollutants`)
  if (Object.keys(rawPollutants).sort().join('|') !== [...QUALITY_POLLUTANTS].sort().join('|')) {
    throw new Error(`${label}.pollutants must contain EC, NOX, PM, and O3`)
  }
  const pollutants = Object.fromEntries(QUALITY_POLLUTANTS.map((pollutant) => {
    const value = asRecord(rawPollutants[pollutant], pollutant)
    const sourceRows = asInteger(value.source_rows, `${pollutant}.source_rows`)
    if (sourceRows === 0) throw new Error(`${pollutant}.source_rows must be positive`)
    const sitePosts = parseSitePosts(value.site_posts, pollutant, sourceRows)
    const distinctSitePosts = asInteger(value.distinct_site_posts, `${pollutant}.distinct_site_posts`)
    const distinctSiteIds = asInteger(value.distinct_site_ids, `${pollutant}.distinct_site_ids`)
    if (distinctSitePosts !== sitePosts.length || distinctSiteIds !== new Set(sitePosts.map((site) => site.siteId)).size) {
      throw new Error(`${pollutant} distinct site counts do not match site_posts`)
    }
    const qaRecord = asRecord(value.qa, `${pollutant}.qa`)
    const qa = {
      flag1: asInteger(qaRecord.flag1, `${pollutant}.qa.flag1`),
      flag2: asInteger(qaRecord.flag2, `${pollutant}.qa.flag2`),
      eitherFlag: asInteger(qaRecord.either_flag, `${pollutant}.qa.either_flag`),
      neitherFlag: asInteger(qaRecord.neither_flag, `${pollutant}.qa.neither_flag`),
    }
    if (qa.eitherFlag + qa.neitherFlag !== sourceRows || qa.flag1 > qa.eitherFlag || qa.flag2 > qa.eitherFlag) {
      throw new Error(`${pollutant}.qa counts are inconsistent with source_rows`)
    }
    const parsed: PollutantQuality = {
      sourceId: asText(value.source_id, `${pollutant}.source_id`),
      label: asText(value.label, `${pollutant}.label`),
      sourceRows,
      distinctSiteIds,
      distinctSitePosts,
      coverage: asCoverage(value.coverage, `${pollutant}.coverage`),
      analyticFields: parseAnalyticFields(value.analytic_fields, pollutant, sourceRows),
      qa,
      sitePosts,
    }
    return [pollutant, parsed]
  })) as unknown as Record<QualityPollutant, PollutantQuality>

  return {
    title: asText(record.title, `${label}.title`),
    sourceReleaseDate: asText(record.source_release_date, `${label}.source_release_date`),
    coverage: asCoverage(record.coverage, `${label}.coverage`),
    pollutants,
    limitations: asStringArray(record.limitations, `${label}.limitations`),
  }
}

const validateGeometry = (geometry: unknown, type: 'MultiPolygon' | 'Point', label: string): Geometry => {
  const record = asRecord(geometry, `${label}.geometry`)
  if (record.type !== type || !Array.isArray(record.coordinates)) throw new Error(`${label} must have ${type} geometry`)
  const walk = (value: unknown): void => {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} has malformed coordinates`)
    if (typeof value[0] === 'number') {
      if (value.length < 2) throw new Error(`${label} coordinate is incomplete`)
      asFinite(value[0], `${label}.longitude`, -180, 180)
      asFinite(value[1], `${label}.latitude`, -90, 90)
      return
    }
    value.forEach(walk)
  }
  walk(record.coordinates)
  return record as unknown as Geometry
}

export function parseNeighborhoodContext(input: unknown, label = 'neighborhood context'): NeighborhoodContext {
  const record = asRecord(input, label)
  if (record.type !== 'FeatureCollection' || record.schema_version !== '1.0.0' || record.geometry_crs !== 'EPSG:4326') {
    throw new Error(`${label} must be schema 1.0.0 EPSG:4326 FeatureCollection`)
  }
  if (!Array.isArray(record.features) || record.features.length !== 3) throw new Error(`${label} must contain exactly three features`)
  const byKind = new Map<string, Record<string, unknown>>()
  for (const inputFeature of record.features) {
    const feature = asRecord(inputFeature, `${label}.feature`)
    const properties = asRecord(feature.properties, `${label}.feature.properties`)
    const kind = asText(properties.kind, `${label}.feature.kind`)
    if (byKind.has(kind)) throw new Error(`${label} contains duplicate ${kind}`)
    validateGeometry(feature.geometry, kind === 'boundary' ? 'MultiPolygon' : 'Point', `${label}.${kind}`)
    byKind.set(kind, feature)
  }
  const boundary = byKind.get('boundary')
  const historical = byKind.get('nearest_historical')
  const current = byKind.get('nearest_current')
  if (!boundary || !historical || !current || byKind.size !== 3) throw new Error(`${label} feature kinds are incomplete`)
  const boundaryProperties = asRecord(boundary.properties, 'boundary.properties')
  if (boundaryProperties.nta2020 !== 'BX1001' || boundaryProperties.ntaname !== 'Westchester Square' || boundaryProperties.boroname !== 'Bronx') {
    throw new Error(`${label} boundary must be Bronx NTA BX1001 Westchester Square`)
  }
  const coverage = asRecord(record.coverage_summary, `${label}.coverage_summary`)
  if (coverage.historical_sites_inside !== 0 || coverage.current_monitors_inside !== 0) {
    throw new Error(`${label} must report zero sites inside the official boundary`)
  }

  const parsePoint = (feature: Record<string, unknown>, pointLabel: string): NeighborhoodPoint => {
    const properties = asRecord(feature.properties, `${pointLabel}.properties`)
    if (properties.inside !== false) throw new Error(`${pointLabel} must remain outside the official boundary`)
    const geometry = asRecord(feature.geometry, `${pointLabel}.geometry`)
    const coordinates = geometry.coordinates as unknown[]
    const pollutants = properties.pollutants === undefined
      ? []
      : asStringArray(properties.pollutants, `${pointLabel}.pollutants`).map((value) => {
        if (!(QUALITY_POLLUTANTS as readonly string[]).includes(value)) throw new Error(`${pointLabel} has unknown pollutant ${value}`)
        return value as QualityPollutant
      })
    return {
      siteId: asText(properties.site_id, `${pointLabel}.site_id`),
      siteName: typeof properties.site_name === 'string' ? properties.site_name : null,
      inside: false,
      distanceKm: asFinite(properties.distance_to_boundary_km, `${pointLabel}.distance`, 0.000001, 1000),
      coordinates: [
        asFinite(coordinates[0], `${pointLabel}.longitude`, -180, 180),
        asFinite(coordinates[1], `${pointLabel}.latitude`, -90, 90),
      ],
      pollutants,
    }
  }

  return {
    area: { id: 'BX1001', name: 'Westchester Square', borough: 'Bronx' },
    coverage: { historicalSitesInside: 0, currentMonitorsInside: 0 },
    nearestHistorical: parsePoint(historical, 'nearest_historical'),
    nearestCurrent: parsePoint(current, 'nearest_current'),
    featureCollection: input as FeatureCollection,
    limitations: asStringArray(record.limitations, `${label}.limitations`),
  }
}
