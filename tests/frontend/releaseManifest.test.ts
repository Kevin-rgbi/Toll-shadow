import { describe, expect, it, vi } from 'vitest'
import {
  ReleaseManifestError,
  getReleaseAssets,
  getReleaseTimelineBounds,
  loadReleaseManifest,
  parseReleaseManifest,
} from '../../src/lib/releaseManifest'

const sha = 'a'.repeat(64)

const validManifest = () => ({
  release_id: '2026-09-15.1',
  schema_version: '1.0.0',
  generated_at: '2026-09-15T21:00:00Z',
  status: 'validated',
  policy_reference_date: '2025-01-05',
  transform_version: 'pipeline@0.1.0',
  source_ids: ['nyc-open-data-7ym2-wayt'],
  source_urls: ['https://example.test/source-register'],
  coverage: { start: '2024-01-01', end: '2025-06-30' },
  limitations: ['Observed counts only; no counterfactual baseline is published in this release.'],
  assets: [
    {
      kind: 'boundary_zone',
      path: '/data/releases/2026-09-15.1/zone.geojson',
      format: 'geojson',
      geometry_crs: 'EPSG:4326',
      sha256: sha,
      coverage: { start: '2025-01-05', end: '2025-01-05' },
      grain: 'one feature per CRZ boundary polygon',
      source_ids: ['nyc-open-data-crz-boundary'],
      source_urls: ['https://example.test/source-register'],
      transform_version: 'pipeline@0.1.0',
      status: 'validated',
      limitations: ['Boundary geometry is a published zone outline, not detector geometry.'],
    },
    {
      kind: 'traffic_observations',
      path: '/data/releases/2026-09-15.1/traffic.json',
      format: 'json',
      sha256: sha,
      coverage: { start: '2024-01-01', end: '2025-06-30' },
      grain: 'one row per location and observed month',
      source_ids: ['nyc-open-data-7ym2-wayt'],
      source_urls: ['https://example.test/source-register'],
      transform_version: 'pipeline@0.1.0',
      status: 'validated',
      limitations: ['Counts are observed volumes, not policy effects.'],
    },
  ],
})

describe('parseReleaseManifest', () => {
  it('accepts a validated release manifest and preserves asset separation', () => {
    const manifest = parseReleaseManifest(validManifest())

    expect(manifest.release_id).toBe('2026-09-15.1')
    expect(getReleaseAssets(manifest, 'boundary_zone')).toHaveLength(1)
    expect(getReleaseAssets(manifest, 'traffic_observations')).toHaveLength(1)
    expect(getReleaseAssets(manifest, 'dac_context')).toHaveLength(0)
  })

  it('rejects a manifest that is marked synthetic', () => {
    const synthetic = { ...validManifest(), synthetic: true }

    expect(() => parseReleaseManifest(synthetic)).toThrow(ReleaseManifestError)
    expect(() => parseReleaseManifest(synthetic)).toThrow(/MANIFEST_SYNTHETIC/)
  })

  it('rejects an asset path that points at demo or raw material', () => {
    const demo = validManifest()
    demo.assets[0].path = '/data/demo/toll_zone.geojson'

    expect(() => parseReleaseManifest(demo)).toThrow(/MANIFEST_PATH_VIOLATION/)

    const raw = validManifest()
    raw.assets[1].path = '/data/raw/traffic/counts.csv'

    expect(() => parseReleaseManifest(raw)).toThrow(/MANIFEST_PATH_VIOLATION/)
  })

  it('rejects a spatial asset with no declared CRS and a non-4326 CRS', () => {
    const missingCrs = validManifest()
    delete (missingCrs.assets[0] as { geometry_crs?: string }).geometry_crs

    expect(() => parseReleaseManifest(missingCrs)).toThrow(/geometry_crs/)

    const wrongCrs = validManifest()
    wrongCrs.assets[0].geometry_crs = 'EPSG:2263'

    expect(() => parseReleaseManifest(wrongCrs)).toThrow(/MANIFEST_MALFORMED/)
  })

  it('rejects a manifest with missing provenance, coverage, or limitations', () => {
    const noSources = validManifest()
    noSources.source_ids = []

    expect(() => parseReleaseManifest(noSources)).toThrow(/source_ids/)

    const badCoverage = validManifest()
    badCoverage.coverage = { start: '2025-06-30', end: '2024-01-01' }

    expect(() => parseReleaseManifest(badCoverage)).toThrow(/coverage/)

    const noLimits = validManifest()
    noLimits.limitations = []

    expect(() => parseReleaseManifest(noLimits)).toThrow(/limitations/)
  })

  it('rejects a manifest with no assets at all', () => {
    const empty = validManifest()
    empty.assets = []

    expect(() => parseReleaseManifest(empty)).toThrow(/MANIFEST_MALFORMED/)
  })

  it('accepts a checksum-declared CSV measurement asset', () => {
    const manifest = validManifest()
    manifest.assets.push({
      kind: 'air_measurements',
      path: '/data/releases/2026-09-18.1/nyccas_pm25_daily.csv',
      format: 'csv',
      sha256: sha,
      coverage: { start: '2025-01-01', end: '2026-09-17' },
      grain: 'daily site-level PM2.5 mean',
      source_ids: ['nyccas_pm25_monitor_daily_2025_2026'],
      source_urls: ['https://a816-dohbesp.nyc.gov/IndicatorPublic/data-features/nyccas/'],
      transform_version: 'supplied-kepler-derivative-1.0.0',
      status: 'validated',
      limitations: ['Observed concentrations; not a causal estimate of congestion-pricing effects.'],
    })

    expect(parseReleaseManifest(manifest).assets.at(-1)?.format).toBe('csv')
    expect(getReleaseAssets(parseReleaseManifest(manifest), 'air_measurements')).toHaveLength(1)
  })

  it('accepts quality JSON and EPSG:4326 neighborhood GeoJSON as separate assets', () => {
    const manifest = validManifest()
    manifest.assets.push({
      kind: 'air_quality_context',
      path: '/data/releases/2026-09-22.1/air_quality_context.json',
      format: 'json',
      sha256: sha,
      coverage: { start: '2008-12-16', end: '2025-11-26' },
      grain: 'one workbook pollutant summary plus site/post coverage metadata',
      source_ids: ['nyccas_pm_year1_17_20260810'],
      source_urls: ['https://example.test/nyccas'],
      transform_version: 'quality-hotspots-1.0.0',
      status: 'validated',
      limitations: ['Coverage facts only; not a statistical confidence score.'],
    }, {
      kind: 'neighborhood_context',
      path: '/data/releases/2026-09-22.1/neighborhood_context.geojson',
      format: 'geojson',
      geometry_crs: 'EPSG:4326',
      sha256: sha,
      coverage: { start: '2008-12-16', end: '2026-09-20' },
      grain: 'one official boundary and two explicitly outside monitoring points',
      source_ids: ['nyc_nta_westchester_square_2020_20260922'],
      source_urls: ['https://example.test/nta'],
      transform_version: 'quality-hotspots-1.0.0',
      status: 'validated',
      limitations: ['Outside sites are not Westchester Square measurements.'],
    })

    const parsed = parseReleaseManifest(manifest)
    expect(getReleaseAssets(parsed, 'air_quality_context')).toHaveLength(1)
    expect(getReleaseAssets(parsed, 'neighborhood_context')[0].geometry_crs).toBe('EPSG:4326')
  })

  it('rejects a CSV path whose extension does not match its declared format', () => {
    const manifest = validManifest()
    manifest.assets.push({
      kind: 'air_measurements',
      path: '/data/releases/2026-09-18.1/nyccas_pm25_daily.json',
      format: 'csv',
      sha256: sha,
      coverage: { start: '2025-01-01', end: '2026-09-17' },
      grain: 'daily site-level PM2.5 mean',
      source_ids: ['nyccas_pm25_monitor_daily_2025_2026'],
      source_urls: ['https://a816-dohbesp.nyc.gov/IndicatorPublic/data-features/nyccas/'],
      transform_version: 'supplied-kepler-derivative-1.0.0',
      status: 'validated',
      limitations: ['Observed concentrations; not a causal estimate of congestion-pricing effects.'],
    })

    expect(() => parseReleaseManifest(manifest)).toThrow(/extension/)
  })

  it('rejects a CSV asset outside air measurements', () => {
    const manifest = validManifest()
    manifest.assets.push({
      kind: 'traffic_observations',
      path: '/data/releases/2026-09-18.1/traffic.csv',
      format: 'csv',
      sha256: sha,
      coverage: { start: '2025-01-01', end: '2026-09-17' },
      grain: 'traffic rows',
      source_ids: ['nyc-open-data-7ym2-wayt'],
      source_urls: ['https://data.cityofnewyork.us/Transportation/Automated-Traffic-Volume-Counts/7ym2-wayt'],
      transform_version: 'pipeline@0.1.0',
      status: 'validated',
      limitations: ['Observed counts only.'],
    })

    expect(() => parseReleaseManifest(manifest)).toThrow(/air_measurements/)
  })

  it('rejects a bad checksum', () => {
    const badSha = validManifest()
    badSha.assets[0].sha256 = 'not-a-sha256'

    expect(() => parseReleaseManifest(badSha)).toThrow(/sha256/)
  })
})

describe('getReleaseTimelineBounds', () => {
  it('derives the timeline window from release coverage instead of hardcoded dates', () => {
    const manifest = parseReleaseManifest(validManifest())

    expect(getReleaseTimelineBounds(manifest)).toEqual({
      minDateIso: '2024-01-01',
      maxDateIso: '2025-06-30',
      policyReferenceDateIso: '2025-01-05',
    })
  })

  it('reports no policy marker when the release does not declare one', () => {
    const manifest = parseReleaseManifest(validManifest())
    const withoutMarker = { ...manifest, policy_reference_date: undefined }

    expect(getReleaseTimelineBounds(withoutMarker).policyReferenceDateIso).toBeNull()
  })
})

describe('loadReleaseManifest', () => {
  it('reports an unreachable manifest without substituting fallback content', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(loadReleaseManifest('/data/manifest.json')).rejects.toThrow(/MANIFEST_UNREACHABLE/)
  })

  it('reports malformed JSON content as a malformed manifest', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hello: 'world' }) }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(loadReleaseManifest('/data/manifest.json')).rejects.toThrow(/MANIFEST_MALFORMED/)
  })

  it('reports an unpublished release as an empty state rather than an error', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        release_id: null,
        schema_version: '1.0.0',
        status: 'unpublished',
        assets: [],
      }),
    }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(loadReleaseManifest('/data/manifest.json')).resolves.toEqual({
      status: 'empty',
      reason: 'No validated data release is published yet.',
    })
  })

  it('returns a validated release for a well-formed manifest', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => validManifest() }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await loadReleaseManifest('/data/manifest.json')

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected a ready release')
    expect(result.manifest.release_id).toBe('2026-09-15.1')
  })
})

describe('source URLs on a published asset', () => {
  const withAsset = (assetOverrides: Record<string, unknown>) => ({
    release_id: '2026-09-20.5',
    schema_version: '1.4.0',
    generated_at: '2026-09-20T00:00:00.000Z',
    status: 'validated',
    transform_version: 'pipeline-release-1.4.0',
    source_ids: ['s'],
    source_urls: ['https://example.test/source-register'],
    coverage: { start: '2024-01-01', end: '2025-12-31' },
    limitations: ['descriptive only'],
    assets: [{
      kind: 'traffic_observations',
      path: '/data/releases/2026-09-20.5/traffic_observations.geojson',
      format: 'geojson',
      sha256: 'a'.repeat(64),
      coverage: { start: '2024-01-01', end: '2025-12-31' },
      grain: 'one row per segment',
      source_ids: ['dot_automated_traffic_counts_archive_20260915'],
      source_urls: ['https://data.cityofnewyork.us/Transportation/example/about_data'],
      transform_version: 'pipeline-release-1.4.0',
      status: 'validated',
      limitations: ['sampled'],
      geometry_crs: 'EPSG:4326',
      ...assetOverrides,
    }],
  })

  it('accepts an asset that publishes its source URL', () => {
    const parsed = parseReleaseManifest(withAsset({}))
    expect(parsed.assets[0].source_urls).toEqual(['https://data.cityofnewyork.us/Transportation/example/about_data'])
  })

  it('rejects an asset with no source URL, which would render an unlinked metric', () => {
    expect(() => parseReleaseManifest(withAsset({ source_urls: undefined }))).toThrow(/source_urls/)
  })

  it('rejects a source URL that is not http(s)', () => {
    expect(() => parseReleaseManifest(withAsset({ source_urls: ['javascript:alert(1)'] }))).toThrow(/http\(s\)/)
  })
})
