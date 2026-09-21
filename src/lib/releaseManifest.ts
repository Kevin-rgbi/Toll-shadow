/**
 * Release manifest client.
 *
 * This module is the only production boundary between published pipeline output and the SPA.
 * It validates the release contract described in `docs/DATA_STRATEGY.md` ("Published-asset
 * contract") and `docs/ARCHITECTURE.md` ("Frontend manifest") before any asset reaches a view.
 *
 * Rules enforced here:
 * - A release manifest is either `validated` (publishable) or `unpublished` (empty state).
 * - Synthetic, demo, or raw archive material can never be accepted as a release asset.
 * - Spatial assets must declare EPSG:4326; the SPA never infers a CRS.
 * - Every asset keeps its own source IDs, coverage, grain, and limitations so that traffic,
 *   crossings, CRZ, DAC, historical context, and preliminary AIR measurements stay separate in the UI.
 */

export const RELEASE_ASSET_KINDS = [
  'boundary_zone',
  'traffic_observations',
  'facility_crossings',
  'crz_context',
  'dac_context',
  'historical_context',
  'air_measurements',
] as const

export type ReleaseAssetKind = (typeof RELEASE_ASSET_KINDS)[number]

export type ReleaseAssetFormat = 'json' | 'geojson' | 'csv'

export type ReleaseErrorCode =
  | 'MANIFEST_UNREACHABLE'
  | 'MANIFEST_MALFORMED'
  | 'MANIFEST_SYNTHETIC'
  | 'MANIFEST_PATH_VIOLATION'
  | 'ASSET_UNREACHABLE'
  | 'ASSET_MALFORMED'

export interface ReleaseCoverage {
  start: string
  end: string
}

export interface ReleaseAsset {
  kind: ReleaseAssetKind
  path: string
  format: ReleaseAssetFormat
  sha256: string
  coverage: ReleaseCoverage
  grain: string
  source_ids: string[]
  transform_version: string
  status: 'validated'
  limitations: string[]
  geometry_crs?: 'EPSG:4326'
  bytes?: number
}

export interface ReleaseManifest {
  release_id: string
  schema_version: string
  generated_at: string
  status: 'validated'
  transform_version: string
  source_ids: string[]
  coverage: ReleaseCoverage
  limitations: string[]
  assets: ReleaseAsset[]
  policy_reference_date?: string
}

export interface ReleaseTimelineBounds {
  minDateIso: string
  maxDateIso: string
  policyReferenceDateIso: string | null
}

export type ReleaseLoadResult =
  | { status: 'ready', manifest: ReleaseManifest }
  | { status: 'empty', reason: string }

export const UNPUBLISHED_RELEASE_REASON = 'No validated data release is published yet.'

export class ReleaseManifestError extends Error {
  readonly code: ReleaseErrorCode
  readonly detail: string

  constructor(code: ReleaseErrorCode, detail: string) {
    super(`[${code}] ${detail}`)
    this.name = 'ReleaseManifestError'
    this.code = code
    this.detail = detail
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const SEMVER = /^\d+\.\d+\.\d+$/
const SHA256 = /^[0-9a-f]{64}$/
const ALLOWED_ASSET_EXTENSIONS = new Set(['.json', '.geojson', '.csv'])

// Declared as a function so TypeScript narrows `unknown` inputs after the guard call.
function malformed(field: string, expected: string): never {
  throw new ReleaseManifestError('MANIFEST_MALFORMED', `field "${field}" ${expected}`)
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const requireRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (!isRecord(value)) malformed(field, 'must be an object')
  return value
}

const requireNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') malformed(field, 'must be a non-empty string')
  return value
}

const requireIsoDate = (value: unknown, field: string): string => {
  const text = requireNonEmptyString(value, field)
  if (!ISO_DATE.test(text) || !Number.isFinite(Date.parse(`${text}T00:00:00Z`))) {
    malformed(field, 'must be a YYYY-MM-DD date')
  }
  return text
}

const requireStringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value)) malformed(field, 'must be an array')
  if (value.length === 0) malformed(field, 'must not be empty')
  return value.map((entry, index) => requireNonEmptyString(entry, `${field}[${index}]`))
}

const requireCoverage = (value: unknown, field: string): ReleaseCoverage => {
  const record = requireRecord(value, field)
  const start = requireIsoDate(record.start, `${field}.start`)
  const end = requireIsoDate(record.end, `${field}.end`)
  if (Date.parse(`${start}T00:00:00Z`) > Date.parse(`${end}T00:00:00Z`)) {
    malformed(field, 'must not end before it starts')
  }
  return { start, end }
}

const hasSyntheticMarker = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasSyntheticMarker)
  if (!isRecord(value)) return false
  if (value.synthetic === true) return true
  return Object.values(value).some(hasSyntheticMarker)
}

const assertAssetPath = (path: string, field: string): void => {
  function violation(reason: string): never {
    throw new ReleaseManifestError('MANIFEST_PATH_VIOLATION', `field "${field}" ${reason}`)
  }

  if (path.includes('://')) violation('must be a same-origin public path, not an absolute URL')
  if (!path.startsWith('/')) violation('must start with "/"')
  if (path.includes('//')) violation('must not contain an empty path segment')
  if (path.includes('..')) violation('must not contain ".."')
  if (/\s/.test(path)) violation('must not contain whitespace')
  if (/demo/i.test(path)) violation('must not reference synthetic demo material')
  if (/(^|\/)raw(\/|$)/i.test(path)) violation('must not serve immutable raw archive files')

  const extension = path.slice(path.lastIndexOf('.'))
  if (!ALLOWED_ASSET_EXTENSIONS.has(extension)) {
    violation(`must use one of ${[...ALLOWED_ASSET_EXTENSIONS].join(', ')}`)
  }
}

const parseAsset = (value: unknown, index: number): ReleaseAsset => {
  const field = `assets[${index}]`
  const record = requireRecord(value, field)

  const kindValue = requireNonEmptyString(record.kind, `${field}.kind`)
  const kind: ReleaseAssetKind = (RELEASE_ASSET_KINDS as readonly string[]).includes(kindValue)
    ? kindValue as ReleaseAssetKind
    : malformed(`${field}.kind`, `must be one of ${RELEASE_ASSET_KINDS.join(', ')}`)

  const path = requireNonEmptyString(record.path, `${field}.path`)
  assertAssetPath(path, `${field}.path`)

  const formatValue = requireNonEmptyString(record.format, `${field}.format`)
  const format: ReleaseAssetFormat = formatValue === 'json' || formatValue === 'geojson' || formatValue === 'csv'
    ? formatValue
    : malformed(`${field}.format`, 'must be "json", "geojson", or "csv"')

  if (format === 'csv' && kind !== 'air_measurements') {
    malformed(`${field}.format`, 'CSV is permitted only for the air_measurements asset kind')
  }

  if (!path.endsWith(format === 'geojson' ? '.geojson' : format === 'csv' ? '.csv' : '.json')) {
    malformed(`${field}.path`, `must end with a ".${format}" extension to match its declared format`)
  }

  const sha256 = requireNonEmptyString(record.sha256, `${field}.sha256`)
  if (!SHA256.test(sha256)) malformed(`${field}.sha256`, 'must be a lowercase 64-character SHA-256')

  const status = requireNonEmptyString(record.status, `${field}.status`)
  if (status !== 'validated') {
    malformed(`${field}.status`, 'must be "validated"; unvalidated assets cannot be published')
  }

  if (format === 'geojson') {
    const crs = requireNonEmptyString(record.geometry_crs, `${field}.geometry_crs`)
    if (crs !== 'EPSG:4326') malformed(`${field}.geometry_crs`, 'must be "EPSG:4326"')
  } else if (record.geometry_crs !== undefined && record.geometry_crs !== 'EPSG:4326') {
    malformed(`${field}.geometry_crs`, 'must be "EPSG:4326" when declared')
  }

  if (record.bytes !== undefined) {
    const bytes = record.bytes
    if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes <= 0) {
      malformed(`${field}.bytes`, 'must be a positive integer when declared')
    }
  }

  const asset: ReleaseAsset = {
    kind,
    path,
    format,
    sha256,
    coverage: requireCoverage(record.coverage, `${field}.coverage`),
    grain: requireNonEmptyString(record.grain, `${field}.grain`),
    source_ids: requireStringArray(record.source_ids, `${field}.source_ids`),
    transform_version: requireNonEmptyString(record.transform_version, `${field}.transform_version`),
    status: 'validated',
    limitations: requireStringArray(record.limitations, `${field}.limitations`),
  }

  if (record.geometry_crs === 'EPSG:4326') asset.geometry_crs = 'EPSG:4326'
  if (typeof record.bytes === 'number') asset.bytes = record.bytes

  return asset
}

export const parseReleaseManifest = (input: unknown): ReleaseManifest => {
  if (hasSyntheticMarker(input)) {
    throw new ReleaseManifestError(
      'MANIFEST_SYNTHETIC',
      'manifest or asset is marked synthetic; synthetic material cannot enter the production path',
    )
  }

  const record = requireRecord(input, 'manifest')

  const schemaVersion = requireNonEmptyString(record.schema_version, 'schema_version')
  if (!SEMVER.test(schemaVersion)) malformed('schema_version', 'must be a semantic version like "1.0.0"')

  const status = requireNonEmptyString(record.status, 'status')
  if (status !== 'validated') {
    malformed('status', 'must be "validated" for a publishable release')
  }

  const generatedAt = requireNonEmptyString(record.generated_at, 'generated_at')
  if (!Number.isFinite(Date.parse(generatedAt))) malformed('generated_at', 'must be a parseable timestamp')

  if (!Array.isArray(record.assets)) malformed('assets', 'must be an array')
  if (record.assets.length === 0) malformed('assets', 'must declare at least one validated asset')

  const manifest: ReleaseManifest = {
    release_id: requireNonEmptyString(record.release_id, 'release_id'),
    schema_version: schemaVersion,
    generated_at: generatedAt,
    status: 'validated',
    transform_version: requireNonEmptyString(record.transform_version, 'transform_version'),
    source_ids: requireStringArray(record.source_ids, 'source_ids'),
    coverage: requireCoverage(record.coverage, 'coverage'),
    limitations: requireStringArray(record.limitations, 'limitations'),
    assets: record.assets.map((asset, index) => parseAsset(asset, index)),
  }

  if (record.policy_reference_date !== undefined) {
    manifest.policy_reference_date = requireIsoDate(record.policy_reference_date, 'policy_reference_date')
  }

  return manifest
}

export const getReleaseAssets = (manifest: ReleaseManifest, kind: ReleaseAssetKind): ReleaseAsset[] => {
  return manifest.assets.filter((asset) => asset.kind === kind)
}

export const getReleaseTimelineBounds = (
  manifest: Pick<ReleaseManifest, 'coverage' | 'policy_reference_date'>,
): ReleaseTimelineBounds => {
  return {
    minDateIso: manifest.coverage.start,
    maxDateIso: manifest.coverage.end,
    policyReferenceDateIso: manifest.policy_reference_date ?? null,
  }
}

/**
 * Only an explicit `status: "unpublished"` pointer counts as the empty state. An unrecognized or
 * incomplete payload must fail validation instead, so a broken manifest can never be reported to
 * the reviewer as "nothing published yet".
 */
const isUnpublishedPointer = (record: Record<string, unknown>): boolean => {
  return record.status === 'unpublished'
}

export const loadReleaseManifest = async (manifestPath = '/data/manifest.json'): Promise<ReleaseLoadResult> => {
  let response: Response
  try {
    response = await fetch(manifestPath)
  } catch (error) {
    throw new ReleaseManifestError(
      'MANIFEST_UNREACHABLE',
      `could not fetch ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (!response.ok) {
    throw new ReleaseManifestError('MANIFEST_UNREACHABLE', `could not fetch ${manifestPath} (HTTP ${response.status})`)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new ReleaseManifestError(
      'MANIFEST_MALFORMED',
      `${manifestPath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (hasSyntheticMarker(payload)) {
    throw new ReleaseManifestError(
      'MANIFEST_SYNTHETIC',
      `${manifestPath} is marked synthetic and cannot be used as a release`,
    )
  }

  if (isRecord(payload) && isUnpublishedPointer(payload)) {
    return { status: 'empty', reason: UNPUBLISHED_RELEASE_REASON }
  }

  return { status: 'ready', manifest: parseReleaseManifest(payload) }
}
