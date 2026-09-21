import { useMemo } from 'react'
import { AssetProvenance } from '../../components/Detail/AssetProvenance'
import { getReleaseAssets } from '../../lib/releaseManifest'
import type { ReleaseManifest } from '../../lib/releaseManifest'
import type { ReleaseAssetState } from '../../hooks/useReleaseAsset'
import type { EquityContext, EquityContextFeature } from '../../types/releaseData'
import { NYC_BOUNDS } from '../../components/Map/mapConfig'
import { projectToScreen } from '../../components/Map/webMercator'

interface EquityContextModuleProps {
  state: ReleaseAssetState<EquityContext>
  release: ReleaseManifest | null
}

const VIEW_WIDTH = 1000
const [WEST_SOUTH, EAST_NORTH] = NYC_BOUNDS
const CENTER_LNG = (WEST_SOUTH[0] + EAST_NORTH[0]) / 2
const CENTER_LAT = (WEST_SOUTH[1] + EAST_NORTH[1]) / 2
const VIEW_HEIGHT = Math.round(VIEW_WIDTH * ((EAST_NORTH[1] - WEST_SOUTH[1])
  / ((EAST_NORTH[0] - WEST_SOUTH[0]) * Math.cos((CENTER_LAT * Math.PI) / 180))))
const ZOOM = 9.6

const ringToPath = (ring: number[][]): string => ring
  .map((position, index) => {
    const { x, y } = projectToScreen(
      position[0], position[1], CENTER_LNG, CENTER_LAT, ZOOM, VIEW_WIDTH, VIEW_HEIGHT,
    )
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  })
  .join(' ') + ' Z'

const geometryToPath = (feature: EquityContextFeature): string => {
  const coordinates = feature.geometry.coordinates as unknown
  if (feature.geometry.type === 'Polygon') {
    return (coordinates as number[][][]).map(ringToPath).join(' ')
  }
  return (coordinates as number[][][][]).map((polygon) => polygon.map(ringToPath).join(' ')).join(' ')
}

const fillForPercentile = (percentile: number | null): string => {
  if (percentile === null) return 'rgba(20, 22, 26, 0.08)'
  const clamped = Math.max(0, Math.min(percentile, 100)) / 100
  return `rgba(31, 75, 216, ${(0.1 + clamped * 0.62).toFixed(3)})`
}

/**
 * Archived equity context (PRD FR-06).
 *
 * The layer is the archived 2023 disadvantaged-communities criteria, so the vintage is stated with
 * the data and the panel never calls the designation current. Geography is drawn as a projected
 * outline of the published tract polygons; shading carries the published vulnerability percentile and
 * nothing is inferred for tracts the release does not carry.
 */
export function EquityContextModule({ state, release }: EquityContextModuleProps) {
  const context = state.status === 'ready' ? state.data : null

  const paths = useMemo(() => {
    if (!context) return []
    return context.features.map((feature) => ({
      geoid: feature.geoid,
      path: geometryToPath(feature),
      fill: fillForPercentile(feature.vulnerabilityPercentile),
      county: feature.county,
    }))
  }, [context])

  const byCounty = useMemo(() => {
    if (!context) return []
    const counts = new Map<string, number>()
    for (const feature of context.features) {
      counts.set(feature.county, (counts.get(feature.county) ?? 0) + 1)
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1])
  }, [context])

  const asset = release ? getReleaseAssets(release, 'dac_context')[0] ?? null : null

  return (
    <aside className="analysis-card module-card" aria-live="polite">
      <p className="analysis-kicker">EQUITY CONTEXT</p>
      <h3>Archived disadvantaged-communities geography</h3>

      {(state.status === 'loading' || state.status === 'idle') && (
        <p className="sources-note">Reading the published equity layer…</p>
      )}
      {state.status === 'error' && <p className="sources-note sources-note-alert">{state.reason}</p>}
      {state.status === 'unavailable' && (
        <p className="sources-note">
          This release does not publish an equity geography, so there is nothing to show.
        </p>
      )}

      {context && (
        <>
          <dl className="analysis-metrics">
            <div>
              <dt>Published tract features</dt>
              <dd>{context.features.length}</dd>
            </div>
            <div>
              <dt>Counties present</dt>
              <dd>{byCounty.length}</dd>
            </div>
          </dl>

          <section className="module-section">
            <h4>Published geometry</h4>
            <svg
              className="equity-map"
              viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
              role="img"
              aria-label={`Projected outlines of ${context.features.length} archived disadvantaged-community census tracts. Shading carries each tract's published vulnerability percentile; unshaded tracts are those the release does not publish a percentile for.`}
            >
              {paths.map((entry) => (
                <path key={entry.geoid} d={entry.path} fill={entry.fill} className="equity-map-tract" />
              ))}
            </svg>
            <p className="sources-note">
              Shading carries the published vulnerability percentile of each tract, and tracts the
              release does not publish a percentile for are left unshaded rather than assumed. This is a
              projected outline of the published geometry, not an interactive map layer.
            </p>
          </section>

          <section className="module-section">
            <h4>Tracts by county</h4>
            <ul className="module-rows">
              {byCounty.map(([county, count]) => (
                <li key={county}>
                  <span className="module-row-main">{county}</span>
                  <span className="module-row-meta">{count} published tracts</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="sources-note">
            {context.vintage}. The designation this layer records is historical: the 2025 criteria
            revision means it cannot be presented as a current status, and it carries no individual risk
            or exposure result.
          </p>

          {asset && <AssetProvenance asset={asset} measureId="archived_dac_context_2023" />}
        </>
      )}
    </aside>
  )
}
