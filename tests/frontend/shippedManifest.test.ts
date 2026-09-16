import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadReleaseManifest, parseReleaseManifest } from '../../src/lib/releaseManifest'
import { parseFacilityCrossings, parseTrafficObservations } from '../../src/lib/releaseData'

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

const assetParserFor = (kind: string) => {
  if (kind === 'traffic_observations') return parseTrafficObservations
  if (kind === 'facility_crossings') return parseFacilityCrossings
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

      expect(result.manifest.release_id).toBe('2026-09-16.2')
      expect(result.manifest.status).toBe('validated')
      expect(result.manifest.assets.length).toBeGreaterThan(0)
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

      const payload: unknown = JSON.parse(readFileSync(file, 'utf8'))
      const parse = assetParserFor(asset.kind)

      if (parse) {
        // Throws on malformed published data, so a drifting pipeline fails here rather than in a view.
        expect(() => parse(payload, asset.path)).not.toThrow()
      }
    }
  })
})
