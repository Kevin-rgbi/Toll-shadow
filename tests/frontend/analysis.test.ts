import { describe, expect, it } from 'vitest'
import type { DevSyntheticDataset } from '../../src/lib/devSyntheticDataset'
import {
  buildSyntheticHotspotRankings,
  summarizeSyntheticConfidence,
} from '../../src/lib/analysis'

const trafficEffect = (
  locationId: string,
  borough: string,
  observed: number,
  expected: number,
  effectPct: number,
  confidence: number,
) => ({
  locationId,
  name: `${locationId} corridor`,
  borough,
  period: '2025-01',
  observed,
  expected,
  effectPct,
  confidence,
  classification: (effectPct > 0.01 ? 'worsened' : effectPct < -0.01 ? 'improved' : 'no_material_change') as
    'worsened' | 'improved' | 'no_material_change',
  coordinates: [[-73.9, 40.8], [-73.89, 40.81]] as [number, number][],
})

const devEffects = {
  synthetic: true,
  generatedFor: 'visualization-development-only',
  policyStartDate: '2025-01-05',
  traffic: [
    trafficEffect('a', 'Bronx', 110, 100, 0.1, 0.9),
    trafficEffect('b', 'Manhattan', 95, 100, -0.05, 0.6),
  ],
  monitors: [
    {
      monitorId: 'm1',
      name: 'Mott Haven Monitor',
      period: '2025-01',
      observedPm25: 8.1,
      expectedPm25: 7.6,
      effect: 0.5,
      confidence: 0.7,
      classification: 'worsened',
      coordinates: [-73.91, 40.81] as [number, number],
    },
  ],
}

const dataset: DevSyntheticDataset = {
  manifest: {
    version: 'test',
    generated_at: '2026-09-11',
    synthetic: true,
    policy_start_date: '2025-01-05',
    latest_observation_date: '2025-01-31',
    files: {
      effects: '/data/demo/effects.json',
      zone: '/data/demo/toll_zone.geojson',
    },
  },
  effects: devEffects,
  periodEffects: [{ periodStartIso: '2025-01-01', effects: devEffects }],
  zone: { type: 'FeatureCollection', features: [] },
  manhattan: null,
}

describe('synthetic dev analysis helpers', () => {
  it('ranks dev hotspots by weighted score', () => {
    const hotspots = buildSyntheticHotspotRankings(dataset, '2025-01-20')
    expect(hotspots[0].id).toBe('a')
    expect(hotspots[0].score).toBeGreaterThan(hotspots[1].score)
  })

  it('summarizes dev confidence buckets', () => {
    const hotspots = buildSyntheticHotspotRankings(dataset, '2025-01-20')
    const summary = summarizeSyntheticConfidence(hotspots)
    expect(summary.highConfidenceCount).toBe(1)
    expect(summary.mediumConfidenceCount).toBe(2)
    expect(summary.lowConfidenceCount).toBe(0)
  })

  it('does not assign fabricated per-borough vulnerability weights', () => {
    const hotspots = buildSyntheticHotspotRankings(dataset, '2025-01-20')
    const keys = new Set(Object.keys(hotspots[0] as unknown as Record<string, unknown>))

    // Equity weighting requires published DAC context, so no dev hotspot may carry a
    // vulnerability or net-burden field.
    expect(keys.has('vulnerability')).toBe(false)
    expect(keys.has('netBurden')).toBe(false)
  })
})
