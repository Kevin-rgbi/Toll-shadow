import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HotspotsModule } from '../../src/features/hotspots/HotspotsModule'
import type { ReleaseAsset, ReleaseManifest } from '../../src/lib/releaseManifest'
import type { TrafficObservation } from '../../src/types/releaseData'

const asset: ReleaseAsset = {
  kind: 'traffic_observations',
  path: '/data/releases/test/traffic_observations.geojson',
  format: 'geojson',
  sha256: 'a'.repeat(64),
  coverage: { start: '2026-09-01', end: '2026-09-21' },
  grain: 'one sampled segment aggregate',
  source_ids: ['dot_automated_traffic_counts_archive_20260915'],
  source_urls: ['https://example.test/traffic'],
  transform_version: 'pipeline-release-1.5.0',
  status: 'validated',
  limitations: ['Sampled observations are not continuous traffic monitoring.'],
  geometry_crs: 'EPSG:4326',
}

const release: ReleaseManifest = {
  release_id: '2026-09-22.1',
  schema_version: '2.2.0',
  generated_at: '2026-09-22T12:00:00.000Z',
  status: 'validated',
  transform_version: 'pipeline-release-1.5.0',
  source_ids: asset.source_ids,
  coverage: asset.coverage,
  limitations: ['Descriptive only.'],
  assets: [asset],
}

const row: TrafficObservation = {
  sourceId: asset.source_ids[0],
  measureId: 'dot_monthly_sampled_traffic_volume',
  segmentId: 44,
  borough: 'Bronx',
  direction: 'NB',
  month: '2026-09',
  dayType: 'Weekday',
  timeBand: 'AM peak (06-09)',
  meanObserved15MinVolume: 42.9,
  maxObserved15MinVolume: 146,
  observationCount: 864,
  observedDays: 9,
  countSessions: 1,
  street: 'WESTCHESTER AVENUE',
  fromStreet: 'ZEREGA AVENUE',
  toStreet: 'CASTLE HILL AVENUE',
  coordinates: [-73.84, 40.84],
}

const render = (observations: TrafficObservation[] = [row]) => renderToStaticMarkup(createElement(HotspotsModule, {
  state: { status: 'ready', data: observations },
  release,
  ranking: 'mean',
  onRankingChange: () => undefined,
  observations,
  month: '2026-09',
  monthOptions: ['2026-09'],
  onMonthChange: () => undefined,
  borough: null,
  onBoroughChange: () => undefined,
  dayType: null,
  onDayTypeChange: () => undefined,
  timeBand: null,
  onTimeBandChange: () => undefined,
  boroughOptions: ['Bronx'],
  dayTypeOptions: ['Weekday'],
  timeBandOptions: ['AM peak (06-09)'],
  selectedKey: null,
  onSelect: () => undefined,
}))

describe('hotspots module', () => {
  it('publishes a descriptive observed-traffic ranking with provenance', () => {
    const markup = render()

    expect(markup).toContain('Observed traffic hotspots')
    expect(markup).toContain('All published boroughs')
    expect(markup).toContain('Weekday and weekend')
    expect(markup).toContain('WESTCHESTER AVENUE')
    expect(markup).toContain('42.9 mean')
    expect(markup).toContain('864 source observations')
    expect(markup).toContain('sampled DOT traffic observations')
    expect(markup).toContain('does not rank air pollution')
    expect(markup).toContain('does not claim congestion pricing caused')
    expect(markup).toContain('dot_observed_segment_ranking')
  })

  it('states when the shared filters leave no published observations', () => {
    const markup = render([])

    expect(markup).toContain('No published traffic observation matches this selection')
    expect(markup).not.toContain('WESTCHESTER AVENUE')
  })
})
