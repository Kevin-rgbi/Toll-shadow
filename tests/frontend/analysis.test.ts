import { describe, expect, it } from 'vitest'
import type { ManifestDataset } from '../../src/lib/dataManifest'
import {
  buildEquitySignals,
  buildHotspotRankings,
  summarizeConfidence,
} from '../../src/lib/analysis'

const dataset: ManifestDataset = {
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
  effects: {
    synthetic: true,
    generatedFor: 'visualization-development-only',
    policyStartDate: '2025-01-05',
    traffic: [
      {
        locationId: 'a',
        name: 'A corridor',
        borough: 'Bronx',
        period: '2025-01',
        observed: 110,
        expected: 100,
        effectPct: 0.1,
        confidence: 0.9,
        classification: 'worsened',
        coordinates: [[-73.9, 40.8], [-73.89, 40.81]],
      },
      {
        locationId: 'b',
        name: 'B corridor',
        borough: 'Manhattan',
        period: '2025-01',
        observed: 95,
        expected: 100,
        effectPct: -0.05,
        confidence: 0.6,
        classification: 'improved',
        coordinates: [[-74.0, 40.7], [-73.99, 40.71]],
      },
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
        coordinates: [-73.91, 40.81],
      },
    ],
  },
  periodEffects: [
    {
      periodStartIso: '2025-01-01',
      effects: {
        synthetic: true,
        generatedFor: 'visualization-development-only',
        policyStartDate: '2025-01-05',
        traffic: [
          {
            locationId: 'a',
            name: 'A corridor',
            borough: 'Bronx',
            period: '2025-01',
            observed: 110,
            expected: 100,
            effectPct: 0.1,
            confidence: 0.9,
            classification: 'worsened',
            coordinates: [[-73.9, 40.8], [-73.89, 40.81]],
          },
          {
            locationId: 'b',
            name: 'B corridor',
            borough: 'Manhattan',
            period: '2025-01',
            observed: 95,
            expected: 100,
            effectPct: -0.05,
            confidence: 0.6,
            classification: 'improved',
            coordinates: [[-74.0, 40.7], [-73.99, 40.71]],
          },
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
            coordinates: [-73.91, 40.81],
          },
        ],
      },
    },
  ],
  zone: { type: 'FeatureCollection', features: [] },
}

describe('analysis helpers', () => {
  it('ranks hotspots by weighted score', () => {
    const hotspots = buildHotspotRankings(dataset, '2025-01-20')
    expect(hotspots[0].id).toBe('a')
    expect(hotspots[0].score).toBeGreaterThan(hotspots[1].score)
  })

  it('summarizes confidence buckets', () => {
    const hotspots = buildHotspotRankings(dataset, '2025-01-20')
    const summary = summarizeConfidence(hotspots)
    expect(summary.highConfidenceCount).toBe(1)
    expect(summary.mediumConfidenceCount).toBe(2)
    expect(summary.lowConfidenceCount).toBe(0)
  })

  it('computes equity net burden by borough', () => {
    const hotspots = buildHotspotRankings(dataset, '2025-01-20')
    const signals = buildEquitySignals(hotspots)
    expect(signals[0].borough).toBe('Bronx')
    expect(signals[0].netBurden).toBeGreaterThan(0)
  })
})
