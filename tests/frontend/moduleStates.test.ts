import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TrafficModule } from '../../src/features/traffic/TrafficModule'
import { CrossingsModule } from '../../src/features/crossings/CrossingsModule'
import type { ReleaseManifest, ReleaseAsset } from '../../src/lib/releaseManifest'
import type { FacilityCrossing, TrafficObservation } from '../../src/types/releaseData'

/**
 * Copy-level checks for the module states a reviewer will see when data is missing, unreachable, or
 * simply not published for the current selection. These states are the product's claim boundary in
 * the UI, so they are asserted here rather than left to manual inspection.
 */

const asset: ReleaseAsset = {
  kind: 'traffic_observations',
  path: '/data/releases/test/traffic_observations.geojson',
  format: 'geojson',
  sha256: 'a'.repeat(64),
  coverage: { start: '2024-01-01', end: '2025-12-31' },
  grain: 'one segment, borough, direction, and calendar-month aggregate',
  source_ids: ['dot_automated_traffic_counts_archive_20260915'],
  source_urls: ['https://example.test/source-register'],
  transform_version: 'pipeline-release-1.0.0',
  status: 'validated',
  limitations: ['DOT counts are samples and do not represent continuous measurement'],
  geometry_crs: 'EPSG:4326',
}

const crossingAsset: ReleaseAsset = {
  ...asset,
  kind: 'facility_crossings',
  path: '/data/releases/test/facility_crossings.json',
  format: 'json',
  geometry_crs: undefined,
  source_ids: ['mta_daily_bridge_tunnel_traffic_archive_20260915'],
  source_urls: ['https://example.test/source-register'],
  limitations: ['source is a daily aggregate view and cannot support hourly analysis'],
}

const release: ReleaseManifest = {
  release_id: '2026-09-16.1',
  schema_version: '1.0.0',
  generated_at: '2026-09-16T02:19:51.000Z',
  status: 'validated',
  transform_version: 'pipeline-release-1.0.0',
  source_ids: [asset.source_ids[0], crossingAsset.source_ids[0]],
  coverage: { start: '2024-01-01', end: '2025-12-31' },
  limitations: ['Release 1 is descriptive only.'],
  assets: [asset, crossingAsset],
}

const observation: TrafficObservation = {
  sourceId: asset.source_ids[0],
  measureId: 'dot_monthly_sampled_traffic_volume',
  segmentId: 152523,
  borough: 'Brooklyn',
  direction: 'WB',
  month: '2024-01',
  dayType: 'Weekday',
  timeBand: 'AM peak (06-09)',
  meanObserved15MinVolume: 42.9,
  maxObserved15MinVolume: 146,
  observationCount: 864,
  observedDays: 9,
  countSessions: 1,
  street: 'METROPOLITAN AVENUE',
  fromStreet: null,
  toStreet: null,
  coordinates: [-73.93, 40.714],
}

const crossing: FacilityCrossing = {
  sourceId: crossingAsset.source_ids[0],
  measureId: 'mta_daily_facility_crossings',
  observedOn: '2024-01-01',
  plazaId: 21,
  facilityCode: 'TBX',
  facilityName: 'Robert F. Kennedy Bridge (Bronx and Queens plazas)',
  direction: 'I',
  ezpassVehicles: 90,
  vtollVehicles: 10,
  totalVehicles: 100,
  ezpassSharePct: 90,
}

const renderTraffic = (
  state: Parameters<typeof TrafficModule>[0]['state'],
  observations: TrafficObservation[] = [],
  monthTotal = 0,
) => {
  return renderToStaticMarkup(createElement(TrafficModule, {
    state,
    release,
    month: '2024-07',
    monthOptions: ['2024-01', '2024-07'],
    onMonthChange: () => undefined,
    borough: null,
    onBoroughChange: () => undefined,
    dayType: null,
    onDayTypeChange: () => undefined,
    timeBand: null,
    onTimeBandChange: () => undefined,
    boroughOptions: [],
    dayTypeOptions: [],
    timeBandOptions: [],
    monthTotal,
    observations,
  }))
}

const renderCrossings = (
  state: Parameters<typeof CrossingsModule>[0]['state'],
  start = '2024-01-01',
  end = '2024-06-30',
) => {
  return renderToStaticMarkup(createElement(CrossingsModule, {
    state,
    release,
    start,
    end,
    onRangeChange: () => undefined,
  }))
}

describe('traffic module states', () => {
  it('states that the release publishes no traffic asset', () => {
    const markup = renderTraffic({ status: 'unavailable' })

    expect(markup).toContain('does not publish a traffic observation asset')
  })

  it('reports the reason instead of rendering data when the asset failed', () => {
    const markup = renderTraffic({ status: 'error', reason: 'checksum mismatch' })

    expect(markup).toContain('checksum mismatch')
    expect(markup).not.toContain('Mean of published segment means')
  })

  it('names the empty selection instead of borrowing another month', () => {
    const markup = renderTraffic({ status: 'ready', data: [observation] }, [])

    expect(markup).toContain('No published aggregate matches this selection')
    expect(markup).toContain('Move the timeline to a month this release covers')
    expect(markup).not.toContain('Mean of published segment means')
  })

  it('reports how many aggregates the month holds when a filter empties the selection', () => {
    const markup = renderTraffic({ status: 'ready', data: [observation] }, [], 60)

    expect(markup).toContain('holds 60 aggregates for 2024-07')
    expect(markup).toContain('clear a filter')
  })

  it('reports how many of the published aggregates are on screen', () => {
    const markup = renderTraffic({ status: 'ready', data: [observation] }, [observation], 60)

    expect(markup).toContain('Showing')
    expect(markup).toContain('of 60 published aggregates for 2024-07')
  })

  it('shows the day type and time band of a published aggregate', () => {
    const markup = renderTraffic({ status: 'ready', data: [observation] }, [observation], 1)

    expect(markup).toContain('Weekday')
    expect(markup).toContain('AM peak (06-09)')
  })

  it('reports descriptive measures and provenance when data exists', () => {
    const markup = renderTraffic({ status: 'ready', data: [observation] }, [observation])

    expect(markup).toContain('Mean of published segment means')
    expect(markup).toContain('METROPOLITAN AVENUE')
    expect(markup).toContain('dot_monthly_sampled_traffic_volume')
    expect(markup).toContain('Source and method')
    expect(markup).toContain('DOT counts are samples')
  })

  it('never uses causal or expected-value language', () => {
    const markup = renderTraffic({ status: 'ready', data: [observation] }, [observation])

    expect(markup).not.toMatch(/\bcaused\b/i)
    expect(markup).not.toMatch(/\bexpected\b/i)
    expect(markup).not.toMatch(/\bimpact\b/i)
  })
})

describe('crossings module states', () => {
  it('states that the release publishes no crossing asset', () => {
    expect(renderCrossings({ status: 'unavailable' })).toContain('does not publish a facility-crossing asset')
  })

  it('reports an empty window without inventing rows', () => {
    // The only published row is 2024-01-01, so this window selects nothing.
    const markup = renderCrossings({ status: 'ready', data: [crossing] }, '2024-02-01', '2024-02-02')

    expect(markup).toContain('No published crossing record falls in the selected window')
    expect(markup).not.toContain('Total vehicles counted')
  })

  it('names the facility and keeps the published identifier beside it', () => {
    const markup = renderToStaticMarkup(createElement(CrossingsModule, {
      state: { status: 'ready', data: [crossing] },
      release,
      start: '2024-01-01',
      end: '2024-01-01',
      onRangeChange: () => undefined,
    }))

    expect(markup).toContain('Robert F. Kennedy Bridge (Bronx and Queens plazas)')
    expect(markup).toContain('TBX')
    expect(markup).toContain('plaza 21')
    expect(markup).toContain('source register')
  })
})
