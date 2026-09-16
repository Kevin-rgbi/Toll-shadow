import { describe, expect, it } from 'vitest'
import type { ReleaseManifestState } from '../../src/hooks/useReleaseManifest'
import { getHeaderStatusLabel, getModuleUnavailableReason } from '../../src/lib/sourceMessaging'

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

  it('requires an approved measure specification for unbacked module views', () => {
    const reason = getModuleUnavailableReason(releaseState({ release: manifest }), 'HOTSPOTS')
    expect(reason).toMatch(/approved measure specification/)
  })
})
