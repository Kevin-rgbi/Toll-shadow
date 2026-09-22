import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadReleaseManifest, parseReleaseManifest } from '../../src/lib/releaseManifest'
import { parseCrzEntries, parseFacilityCrossings, parseTrafficObservations } from '../../src/lib/releaseData'
import { parseMonthlyAsset } from '../../src/features/traffic/monthlyComparison'
import { parseReleaseBoundary } from '../../src/hooks/useReleaseBoundary'
import { parseAirDailyCsv, parseAirHourlyCsv } from '../../src/features/air/airData'

/**
 * Guards the release pointer that actually ships, and the assets it points at.
 *
 * This is the only test that reads the real published files rather than a fixture, so it is the one
 * that catches pipeline/frontend drift: a republished asset whose schema changed, a checksum the
 * manifest no longer matches, or a pointer that quietly stops being a validated release.
 */

const pointerPath = new URL('../../public/data/manifest.json', import.meta.url)

const readPointer = (): unknown => JSON.parse(readFileSync(pointerPath, 'utf8')) as unknown

const publicFilePath = (assetPath: string): URL => {
  return new URL(`../../public${assetPath}`, import.meta.url)
}

const sha256Of = (url: URL): string => {
  return createHash('sha256').update(readFileSync(url)).digest('hex')
}

type ShippedAssetParser = (payload: unknown, assetLabel: string) => unknown

const parseLegacyMonthlyAsset: ShippedAssetParser = (payload) => parseMonthlyAsset(payload)

const assetParserFor = (kind: string, payload: unknown): ShippedAssetParser | null => {
  if (kind === 'boundary_zone') return parseReleaseBoundary
  if (kind === 'traffic_observations') return parseTrafficObservations
  if (kind === 'facility_crossings') {
    return typeof payload === 'object' && payload !== null && 'records' in payload
      ? parseFacilityCrossings
      : parseLegacyMonthlyAsset
  }
  if (kind === 'crz_context') {
    return typeof payload === 'object' && payload !== null && 'records' in payload
      ? parseCrzEntries
      : parseLegacyMonthlyAsset
  }
  return null
}

describe('shipped release pointer', () => {
  it('is never synthetic', () => {
    const raw = readFileSync(pointerPath, 'utf8')

    expect(raw).not.toMatch(/"synthetic"\s*:\s*true/)
    expect(raw).not.toMatch(/demo/i)
  })

  it('resolves to a validated release through the runtime contract', async () => {
    const pointer = readPointer()
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => pointer,
    })) as unknown as typeof fetch

    try {
      const result = await loadReleaseManifest('/data/manifest.json')

      // A deployed pointer that loses its release is an incident, not a neutral state, so the
      // shipped artifact is asserted to be published rather than merely well-formed.
      expect(result.status).toBe('ready')
      if (result.status !== 'ready') throw new Error('shipped pointer is not a validated release')

      expect(result.manifest.release_id).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/)
      expect(result.manifest.status).toBe('validated')
      expect(result.manifest.assets.map(asset => asset.kind)).toEqual(expect.arrayContaining([
        'traffic_observations',
        'facility_crossings',
        'crz_context',
        'historical_context',
        'health_context',
        'dac_context',
      ]))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('publishes assets that exist on disk, match their checksum, and parse', () => {
    const manifest = parseReleaseManifest(readPointer())

    for (const asset of manifest.assets) {
      const file = publicFilePath(asset.path)

      expect(existsSync(file), `published asset is missing from public/: ${asset.path}`).toBe(true)
      expect(sha256Of(file), `checksum mismatch for ${asset.path}`).toBe(asset.sha256)

      if (asset.format === 'csv') continue

      const payload: unknown = JSON.parse(readFileSync(file, 'utf8'))
      const parse = assetParserFor(asset.kind, payload)

      if (parse) {
        // Throws on malformed published data, so a drifting pipeline fails here rather than in a view.
        expect(() => parse(payload, asset.path)).not.toThrow()
      }
    }
  })

  it('parses the published AIR CSV assets without filling gaps', () => {
    const manifest = parseReleaseManifest(readPointer())
    const airAssets = manifest.assets.filter((asset) => asset.kind === 'air_measurements')
    const dailyAsset = airAssets.find((asset) => asset.grain.includes('calendar day'))
    const hourlyAsset = airAssets.find((asset) => asset.grain.includes('UTC hour'))
    if (!dailyAsset || !hourlyAsset) throw new Error('shipped release must publish daily and hourly air assets')
    const dailyText = readFileSync(publicFilePath(dailyAsset.path), 'utf8')
    const daily = parseAirDailyCsv(dailyText, dailyAsset.path)
    expect(daily.stations).toHaveLength(15)
    expect(daily.dates.at(-1)).toBe('2026-09-20')
    expect(daily.row.qualifying).toBe(8237)
    expect(daily.row.nullValues).toBeGreaterThan(0)

    const hourlyText = readFileSync(publicFilePath(hourlyAsset.path), 'utf8')
    const hourly = parseAirHourlyCsv(hourlyText, daily.stations, hourlyAsset.path)
    expect(hourly.stations).toHaveLength(15)
    expect(hourly.row.present).toBe(198205)
    expect(hourly.row.nullValues).toBe(19667)
  })
})
