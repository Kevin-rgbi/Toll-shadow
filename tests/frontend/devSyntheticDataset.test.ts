import { describe, expect, it } from 'vitest'
import {
  DEV_SYNTHETIC_ENABLED,
  getDevSyntheticTimelineBounds,
  getInterpolatedEffectsForDate,
  loadDevSyntheticDataset,
} from '../../src/lib/devSyntheticDataset'
import type { DevSyntheticData, DevSyntheticDataset } from '../../src/lib/devSyntheticDataset'

const makeEffects = (period: string, effectPct: number, monitorEffect: number): DevSyntheticData => ({
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

describe('dev synthetic dataset', () => {
  it('refuses to load without the explicit development flag', async () => {
    expect(DEV_SYNTHETIC_ENABLED).toBe(false)

    await expect(loadDevSyntheticDataset()).rejects.toThrow(/MANIFEST_SYNTHETIC/)
  })

  it('interpolates between dev periods by date', () => {
    const jan = makeEffects('2025-01', 0.1, 0.4)
    const feb = makeEffects('2025-02', -0.1, -0.2)

    const dataset: DevSyntheticDataset = {
      manifest: {
        version: 'test',
        generated_at: '2026-09-11',
        synthetic: true,
        policy_start_date: '2025-01-05',
        latest_observation_date: '2025-02-01',
        files: {
          effects: '/data/demo/effects.json',
          effects_by_period: {
            '2025-01-01': '/data/demo/effects.json',
            '2025-02-01': '/data/demo/effects.json',
          },
          zone: '/data/demo/toll_zone.geojson',
        },
      },
      effects: feb,
      periodEffects: [
        { periodStartIso: '2025-01-01', effects: jan },
        { periodStartIso: '2025-02-01', effects: feb },
      ],
      zone: { type: 'FeatureCollection', features: [] },
      manhattan: null,
    }

    const midway = getInterpolatedEffectsForDate(dataset, '2025-01-16')
    expect(midway.traffic[0].effectPct).toBeLessThan(0.05)
    expect(midway.traffic[0].effectPct).toBeGreaterThan(-0.05)
    expect(midway.monitors[0].effect).toBeLessThan(0.25)
    expect(midway.monitors[0].effect).toBeGreaterThan(0)
  })

  it('derives dev timeline bounds from the declared dev manifest window', () => {
    const bounds = getDevSyntheticTimelineBounds({
      version: 'test',
      generated_at: '2026-09-11',
      synthetic: true,
      policy_start_date: '2025-01-05',
      latest_observation_date: '2025-01-31',
      files: { zone: '/data/demo/toll_zone.geojson' },
    })

    expect(bounds).toEqual({
      minDateIso: '2025-01-01',
      maxDateIso: '2025-01-31',
      policyStartDateIso: '2025-01-05',
    })
  })
})
