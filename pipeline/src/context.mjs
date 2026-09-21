/**
 * Validators for the published context assets: modelled air surface, historical health context, and
 * archived equity geography.
 *
 * Each payload is a derivative whose recipe is recorded in the source register. These checks make the
 * published asset fail loudly rather than emit a plausible-looking shape: a relative air value outside
 * 0-1, a health rate that is negative, or an equity feature without an identifier are all rejected.
 */

export class ContextContractError extends Error {
  constructor(asset, message) {
    super(`${asset}: ${message}`);
    this.name = 'ContextContractError';
  }
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

function fail(asset, message) {
  throw new ContextContractError(asset, message)
}

function text(asset, value, field) {
  if (typeof value !== 'string' || value.trim() === '') fail(asset, `${field} must be a non-empty string`)
  return value.trim()
}

/** Any finite number, including negative longitudes. */
function number(asset, value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(asset, `${field} must be a finite number`)
  return value
}

function count(asset, value, field, { nullable = false } = {}) {
  if (value === null || value === undefined) {
    if (nullable) return null
    fail(asset, `${field} is required`)
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(asset, `${field} must be a finite number`)
  if (value < 0) fail(asset, `${field} must not be negative`)
  return value
}

/** Modelled air surface, published as a relative field with inferred labels. */
export function validateAirContext(payload, asset = 'historical_context') {
  if (!isObject(payload)) fail(asset, 'payload must be an object')
  text(asset, payload.pollutant_label, 'pollutant_label')
  text(asset, payload.period_label, 'period_label')
  text(asset, payload.values, 'values')
  text(asset, payload.aggregation, 'aggregation')

  const bounds = payload.bounds
  if (!Array.isArray(bounds) || bounds.length !== 4) fail(asset, 'bounds must be [west, south, east, north]')
  bounds.forEach((value, index) => number(asset, value, `bounds[${index}]`))

  const width = count(asset, payload.width, 'width')
  const height = count(asset, payload.height, 'height')
  if (!Number.isInteger(width) || !Number.isInteger(height)) fail(asset, 'width and height must be integers')

  const grid = payload.grid
  if (!Array.isArray(grid) || grid.length !== height) {
    fail(asset, `grid must have ${height} rows (got ${Array.isArray(grid) ? grid.length : 'none'})`)
  }
  grid.forEach((row, y) => {
    if (!Array.isArray(row) || row.length !== width) {
      fail(asset, `grid[${y}] must have ${width} columns (got ${Array.isArray(row) ? row.length : 'none'})`)
    }
    row.forEach((value, x) => {
      if (value === null) return
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        fail(asset, `grid[${y}][${x}] must be null or a relative value between 0 and 1 (got ${value})`)
      }
    })
  })

  const cells = grid.flat().filter((value) => value !== null).length
  if (cells === 0) fail(asset, 'grid must contain at least one value')

  return { width, height, bounds, cells }
}

const PERIOD = /^\d{4}-\d{4}$/

/** Historical county-level health context. */
export function validateHealthContext(payload, asset = 'health_context') {
  if (!isObject(payload)) fail(asset, 'payload must be an object')
  text(asset, payload.source, 'source')
  text(asset, payload.geography_label, 'geography_label')
  text(asset, payload.period_label, 'period_label')

  const records = payload.records
  if (!Array.isArray(records) || records.length === 0) fail(asset, 'records must be a non-empty array')

  records.forEach((record, index) => {
    const field = `records[${index}]`
    if (!isObject(record)) fail(asset, `${field} must be an object`)
    text(asset, record.indicator, `${field}.indicator`)
    text(asset, record.county, `${field}.county`)
    text(asset, record.borough, `${field}.borough`)
    const period = text(asset, record.period, `${field}.period`)
    if (!PERIOD.test(period)) fail(asset, `${field}.period must be YYYY-YYYY (got "${period}")`)
    count(asset, record.age_adjusted_rate_per_10000, `${field}.age_adjusted_rate_per_10000`, { nullable: true })
    count(asset, record.events, `${field}.events`, { nullable: true })
    count(asset, record.daily_mean_events, `${field}.daily_mean_events`, { nullable: true })
  })

  return { records: records.length, periods: new Set(records.map((r) => r.period)).size }
}

/** Archived equity geography. */
export function validateEquityContext(payload, asset = 'dac_context') {
  if (!isObject(payload)) fail(asset, 'payload must be an object')
  text(asset, payload.vintage, 'vintage')
  text(asset, payload.geography_label, 'geography_label')
  text(asset, payload.aggregation, 'aggregation')

  const features = payload.features
  if (!Array.isArray(features) || features.length === 0) fail(asset, 'features must be a non-empty array')

  features.forEach((feature, index) => {
    const field = `features[${index}]`
    if (!isObject(feature) || feature.type !== 'Feature') fail(asset, `${field} must be a GeoJSON Feature`)
    const geometry = feature.geometry
    if (!isObject(geometry) || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
      fail(asset, `${field}.geometry must be a Polygon or MultiPolygon`)
    }
    const properties = feature.properties
    if (!isObject(properties)) fail(asset, `${field}.properties must be an object`)
    text(asset, properties.GEOID, `${field}.properties.GEOID`)
    text(asset, properties.County, `${field}.properties.County`)
  })

  return { features: features.length }
}
