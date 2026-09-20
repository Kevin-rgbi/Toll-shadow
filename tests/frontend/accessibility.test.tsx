// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { TrafficModule } from '../../src/features/traffic/TrafficModule'
import { CrossingsModule } from '../../src/features/crossings/CrossingsModule'
import { CrzModule } from '../../src/features/crz/CrzModule'
import { SourcesPanel } from '../../src/components/Detail/SourcesPanel'
import { NarrativeOverlay } from '../../src/components/Story/NarrativeOverlay'
import { DataRibbon } from '../../src/components/Status/DataRibbon'
import { ModuleUnavailable } from '../../src/components/Detail/ModuleUnavailable'
import type { ReleaseManifest, ReleaseAsset } from '../../src/lib/releaseManifest'
import type { ReleaseManifestState } from '../../src/hooks/useReleaseManifest'
import type { CrzEntrySummary, FacilityCrossing, TrafficObservation } from '../../src/types/releaseData'

/**
 * Automated accessibility gate (PRD FR-09 asks for one; there was none).
 *
 * Each evidence surface is rendered to real DOM and checked by axe. Colour contrast is excluded
 * because jsdom has no layout or paint, so axe cannot resolve computed colours here; contrast is
 * handled by the design tokens and checked in the browser instead.
 */

const KNOWN_INCOMPLETE = new Set(['color-contrast'])

const asset: ReleaseAsset = {
  kind: 'traffic_observations',
  path: '/data/releases/test/traffic_observations.geojson',
  format: 'geojson',
  sha256: 'a'.repeat(64),
  coverage: { start: '2024-01-01', end: '2025-12-31' },
  grain: 'one segment, borough, direction, month, day type and time band aggregate',
  source_ids: ['dot_automated_traffic_counts_archive_20260915'],
  transform_version: 'pipeline-release-1.2.0',
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
  limitations: ['source is a daily aggregate view and cannot support hourly analysis'],
}

const release: ReleaseManifest = {
  release_id: '2026-09-20.1',
  schema_version: '1.2.0',
  generated_at: '2026-09-20T12:00:00.000Z',
  status: 'validated',
  transform_version: 'pipeline-release-1.2.0',
  source_ids: [asset.source_ids[0], crossingAsset.source_ids[0]],
  coverage: { start: '2024-01-01', end: '2025-12-31' },
  limitations: ['Release 1 is descriptive only.'],
  assets: [asset, crossingAsset],
}

const releaseState: ReleaseManifestState = {
  status: 'ready',
  release,
  isDevSynthetic: false,
  devSynthetic: null,
  reason: null,
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

const surfaces: Array<{ name: string, element: ReturnType<typeof createElement> }> = [
  {
    name: 'traffic module with published data',
    element: createElement(TrafficModule, {
      state: { status: 'ready', data: [observation] },
      release,
      month: '2024-01',
      monthOptions: ['2024-01'],
      onMonthChange: () => undefined,
      borough: null,
      onBoroughChange: () => undefined,
      dayType: null,
      onDayTypeChange: () => undefined,
      timeBand: null,
      onTimeBandChange: () => undefined,
      boroughOptions: ['Brooklyn'],
      dayTypeOptions: ['Weekday'],
      timeBandOptions: ['AM peak (06-09)'],
      monthTotal: 1,
      observations: [observation],
    }),
  },
  {
    name: 'crossings module with published data',
    element: createElement(CrossingsModule, {
      state: { status: 'ready', data: [crossing] },
      release,
      start: '2024-01-01',
      end: '2024-01-01',
      onRangeChange: () => undefined,
    }),
  },
  {
    name: 'CRZ module with published data',
    element: createElement(CrzModule, {
      state: {
        status: 'ready',
        data: [{
          sourceId: 'mta_crz_entries_archive_20260920',
          measureId: 'crz_monthly_detection_group_entries',
          detectionGroup: 'Brooklyn Bridge',
          detectionRegion: 'Brooklyn',
          month: '2025-01',
          crzEntries: 100,
          excludedRoadwayEntries: 20,
          totalEntries: 120,
        } satisfies CrzEntrySummary],
      },
      release,
    }),
  },
  { name: 'sources panel', element: createElement(SourcesPanel, { state: releaseState }) },
  {
    name: 'story view',
    element: createElement(NarrativeOverlay, {
      progressPercent: 10,
      onJumpToStart: () => undefined,
      onJumpToPolicy: () => undefined,
      onJumpToLatest: () => undefined,
    }),
  },
  { name: 'figures strip', element: createElement(DataRibbon, { state: releaseState, syntheticHotspots: null }) },
  {
    name: 'module unavailable state',
    element: createElement(ModuleUnavailable, { moduleName: 'EQUITY CONTEXT', reason: 'No asset backs this module.' }),
  },
]

describe('accessibility of the evidence surfaces', () => {
  for (const surface of surfaces) {
    it(`has no serious or critical violations: ${surface.name}`, async () => {
      document.body.innerHTML = renderToStaticMarkup(surface.element)

      const results = await axe.run(document.body, {
        rules: { 'color-contrast': { enabled: false } },
      })

      const serious = results.violations
        .filter((violation) => !KNOWN_INCOMPLETE.has(violation.id))
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} node(s))`)

      expect(serious).toEqual([])
    })
  }
})

describe('the accessibility gate itself', () => {
  it('reports a deliberately inaccessible surface, so the gate is not vacuous', async () => {
    document.body.innerHTML = [
      '<main>',
      '  <img src="/chart.png">',                 // no alt text
      '  <button></button>',                       // no accessible name
      '  <a href="#x"><span></span></a>',
      '</main>',
    ].join('')

    const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })
    const ids = results.violations.map((violation) => violation.id)

    expect(ids).toContain('image-alt')
    expect(ids).toContain('button-name')
  })
})
