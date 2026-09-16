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
