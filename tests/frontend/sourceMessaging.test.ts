import { describe, expect, it } from 'vitest'
import type { ReleaseManifestState } from '../../src/hooks/useReleaseManifest'
import { MODULE_ASSET_KIND, getHeaderStatusLabel, getModuleUnavailableReason } from '../../src/lib/sourceMessaging'

const releaseState = (overrides: Partial<ReleaseManifestState>): ReleaseManifestState => ({
  status: 'ready',
  release: null,
  reason: null,
  devSynthetic: null,
  isDevSynthetic: false,
  ...overrides,
})

const manifest = {
  release_id: '2026-09-15.1',
  schema_version: '1.0.0',
  generated_at: '2026-09-15T21:00:00Z',
  status: 'validated' as const,
  transform_version: 'pipeline@0.1.0',
  source_ids: ['nyc-open-data-7ym2-wayt'],
  source_urls: ['https://example.test/source-register'],
  coverage: { start: '2024-01-01', end: '2025-06-30' },
  limitations: ['Observed counts only.'],
  assets: [
    {
      kind: 'traffic_observations' as const,
      path: '/data/releases/2026-09-15.1/traffic.json',
      format: 'json' as const,
      sha256: 'a'.repeat(64),
      coverage: { start: '2024-01-01', end: '2025-06-30' },
      grain: 'one row per location and month',
      source_ids: ['nyc-open-data-7ym2-wayt'],
      source_urls: ['https://example.test/source-register'],
      transform_version: 'pipeline@0.1.0',
      status: 'validated' as const,
      limitations: ['Observed volumes only.'],
    },
  ],
}

describe('release status labels', () => {
  it('reports loading, error, empty, ready, and dev states distinctly', () => {
    expect(getHeaderStatusLabel(releaseState({ status: 'loading' }))).toMatch(/READING/)
    expect(getHeaderStatusLabel(releaseState({ status: 'error', reason: 'boom' }))).toMatch(/ERROR/)
    expect(getHeaderStatusLabel(releaseState({ status: 'empty' }))).toMatch(/NO VALIDATED RELEASE/)
    expect(getHeaderStatusLabel(releaseState({ release: manifest }))).toContain('2026-09-15.1')
    expect(getHeaderStatusLabel(releaseState({ isDevSynthetic: true }))).toMatch(/SYNTHETIC DEV/)
  })
})

describe('module availability reasons', () => {
  it('explains an unpublished release instead of showing a module', () => {
    const reason = getModuleUnavailableReason(releaseState({ status: 'empty' }), 'TRAFFIC')
    expect(reason).toMatch(/No validated data release/)
  })

  it('names the missing asset when a release does not publish that module', () => {
    const reason = getModuleUnavailableReason(releaseState({ release: manifest }), 'EQUITY')
    expect(reason).toContain('2026-09-15.1')
    expect(reason).toMatch(/disadvantaged-community context/)
  })

  it('states that a published asset is not rendered yet rather than showing estimates', () => {
    const reason = getModuleUnavailableReason(releaseState({ release: manifest }), 'TRAFFIC')
    expect(reason).toMatch(/does not render it yet/)
  })

  it('routes confidence to its approved quality asset contract', () => {
    expect(MODULE_ASSET_KIND.CONFIDENCE).toBe('air_quality_context')
    const reason = getModuleUnavailableReason(releaseState({ release: manifest }), 'CONFIDENCE')
    expect(reason).toMatch(/does not publish.*data quality/i)
    expect(reason).not.toMatch(/approved measure specification/)
  })

  it('routes hotspots to the published traffic observations', () => {
    expect(MODULE_ASSET_KIND.HOTSPOTS).toBe('traffic_observations')
    const reason = getModuleUnavailableReason(releaseState({ release: { ...manifest, assets: [] } }), 'HOTSPOTS')
    expect(reason).toMatch(/does not publish.*traffic/i)
    expect(reason).not.toMatch(/approved measure specification/)
  })
})
