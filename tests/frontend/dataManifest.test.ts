import { describe, expect, it, vi } from 'vitest'
import {
  getInterpolatedEffectsForDate,
  loadDatasetFromManifest,
  type ManifestDataset,
} from '../../src/lib/dataManifest'
import type { DemoData } from '../../src/types/demo'

const makeEffects = (period: string, effectPct: number, monitorEffect: number): DemoData => ({
  synthetic: true,
  generatedFor: 'visualization-development-only',
  policyStartDate: '2025-01-05',
  traffic: [
    {
      locationId: 'loc-1',
      name: 'Corridor 1',
      borough: 'Manhattan',
      period,
      observed: 100,
      expected: 100,
      effectPct,
      confidence: 0.8,
      classification: 'worsened',
      coordinates: [[-73.99, 40.72], [-73.98, 40.73]],
    },
  ],
  monitors: [
    {
      monitorId: 'mon-1',
      name: 'Monitor 1',
      period,
      observedPm25: 7.2,
      expectedPm25: 7.0,
      effect: monitorEffect,
      confidence: 0.7,
      classification: 'worsened',
      coordinates: [-73.99, 40.72],
    },
  ],
})

describe('dataManifest interpolation', () => {
  it('interpolates between period effects by date', () => {
    const jan = makeEffects('2025-01', 0.1, 0.4)
    const feb = makeEffects('2025-02', -0.1, -0.2)

    const dataset: ManifestDataset = {
      manifest: {
        version: 'test',
        generated_at: '2026-09-11',
        synthetic: true,
        policy_start_date: '2025-01-05',
        latest_observation_date: '2025-02-01',
        files: {
          effects: '/data/a.json',
          effects_by_period: {
            '2025-01-01': '/data/a.json',
            '2025-02-01': '/data/b.json',
          },
          zone: '/data/zone.geojson',
        },
      },
      effects: feb,
      periodEffects: [
        { periodStartIso: '2025-01-01', effects: jan },
        { periodStartIso: '2025-02-01', effects: feb },
      ],
      zone: { type: 'FeatureCollection', features: [] },
    }

    const midway = getInterpolatedEffectsForDate(dataset, '2025-01-16')
    expect(midway.traffic[0].effectPct).toBeLessThan(0.05)
    expect(midway.traffic[0].effectPct).toBeGreaterThan(-0.05)
    expect(midway.monitors[0].effect).toBeLessThan(0.25)
    expect(midway.monitors[0].effect).toBeGreaterThan(0)
  })
})

describe('dataManifest loader validation', () => {
  it('throws when neither effects nor period effects are provided', async () => {
    const originalFetch = globalThis.fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        version: 'x',
        generated_at: '2026-09-11',
        synthetic: true,
        policy_start_date: '2025-01-05',
        latest_observation_date: '2025-01-31',
        files: { zone: '/data/zone.geojson' },
      }),
    }))

    globalThis.fetch = fetchMock as typeof fetch

    await expect(loadDatasetFromManifest('/data/manifest.json')).rejects.toThrow(
      'Manifest must include either files.effects or files.effects_by_period.',
    )

    globalThis.fetch = originalFetch
  })
})
