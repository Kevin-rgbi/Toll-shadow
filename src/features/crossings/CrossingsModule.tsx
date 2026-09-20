import { useMemo } from 'react'
import { AssetProvenance } from '../../components/Detail/AssetProvenance'
import { getReleaseAssets } from '../../lib/releaseManifest'
import type { ReleaseManifest } from '../../lib/releaseManifest'
import type { ReleaseAssetState } from '../../hooks/useReleaseAsset'
import type { FacilityCrossing } from '../../types/releaseData'
import {
  crossingsDateBounds,
  directionLabel,
  filterCrossingsByDateRange,
  summarizeCrossingsByDirection,
  summarizeCrossingsByPlaza,
  summarizeCrossingsWindow,
} from './crossingsSummary'

const TOP_PLAZA_LIMIT = 10

/** Stable identity so memo dependencies do not churn while the asset is unavailable. */
const NO_CROSSINGS: FacilityCrossing[] = []

interface CrossingsModuleProps {
  state: ReleaseAssetState<FacilityCrossing[]>
  release: ReleaseManifest | null
  /** Inclusive ISO date range selected in the module. */
  start: string
  end: string
  onRangeChange: (start: string, end: string) => void
}

const formatVehicles = (value: number): string => value.toLocaleString('en-US')
const formatShare = (value: number): string => `${value.toFixed(1)}%`

/**
 * MTA facility-crossing module (PRD FR-04).
 *
 * Facilities are named from the source register, which resolves plaza identifiers from authority
 * metadata; the published identifier is shown alongside the name. Names are never invented here.
 */
export function CrossingsModule({ state, release, start, end, onRangeChange }: CrossingsModuleProps) {
  const crossings = state.status === 'ready' ? state.data : NO_CROSSINGS
  const bounds = useMemo(() => crossingsDateBounds(crossings), [crossings])

  const visible = useMemo(
    () => filterCrossingsByDateRange(crossings, start, end),
    [crossings, end, start],
  )

  const window = useMemo(() => summarizeCrossingsWindow(visible), [visible])
  const byPlaza = useMemo(() => summarizeCrossingsByPlaza(visible).slice(0, TOP_PLAZA_LIMIT), [visible])
  const byDirection = useMemo(() => summarizeCrossingsByDirection(visible), [visible])

  const asset = release ? getReleaseAssets(release, 'facility_crossings')[0] ?? null : null
  const measureId = visible[0]?.measureId ?? crossings[0]?.measureId ?? null

  return (
    <aside className="analysis-card module-card" aria-live="polite">
      <p className="analysis-kicker">MTA FACILITY CROSSINGS</p>
      <h3>Daily counts through published toll plazas</h3>

      {(state.status === 'loading' || state.status === 'idle') && <p className="sources-note">Reading the published crossings asset…</p>}

      {state.status === 'unavailable' && (
        <p className="sources-note">
          This release does not publish a facility-crossing asset, so there is nothing to show.
        </p>
      )}

      {state.status === 'error' && (
        <p className="sources-note sources-note-alert">{state.reason}</p>
      )}

      {state.status === 'ready' && (
        <>
          {bounds && (
            <div className="module-filter-row">
              <label>
                <span>From</span>
                <input
                  type="date"
                  value={start}
                  min={bounds.start}
                  max={bounds.end}
                  onChange={(event) => onRangeChange(event.target.value, end)}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  value={end}
                  min={bounds.start}
                  max={bounds.end}
                  onChange={(event) => onRangeChange(start, event.target.value)}
                />
              </label>
            </div>
          )}

          {!window && (
            <p className="module-empty">
              No published crossing record falls in the selected window. The release covers
              {bounds ? ` ${bounds.start} to ${bounds.end}` : ' no dates'}.
            </p>
          )}

          {window && (
            <>
              <dl className="analysis-metrics">
                <div>
                  <dt>Published daily rows</dt>
                  <dd>{formatVehicles(window.publishedDays)}</dd>
                </div>
                <div>
                  <dt>Plazas in window</dt>
                  <dd>{window.plazaCount}</dd>
                </div>
                <div>
                  <dt>Total vehicles counted</dt>
                  <dd>{formatVehicles(window.totalVehicles)}</dd>
                </div>
                <div>
                  <dt>Window</dt>
                  <dd>{window.start} to {window.end}</dd>
                </div>
              </dl>

              <section className="module-section">
                <h4>By direction</h4>
                <ul className="module-rows">
                  {byDirection.map((summary) => (
                    <li key={summary.direction}>
                      <span className="module-row-main">{directionLabel(summary.direction)}</span>
                      <span className="module-row-meta">
                        {formatVehicles(summary.totalVehicles)} vehicles ·{' '}
                        {formatShare(summary.ezpassSharePct)} E-ZPass ·{' '}
                        {formatVehicles(summary.publishedDays)} daily rows
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="module-section">
                <h4>By facility</h4>
                <ul className="module-rows">
                  {byPlaza.map((plaza) => (
                    <li key={plaza.plazaId}>
                      <span className="module-row-main">{plaza.facilityName}</span>
                      <span className="module-row-meta">
                        {plaza.facilityCode} · plaza {plaza.plazaId} ·{' '}
                        {formatVehicles(plaza.totalVehicles)} vehicles ·{' '}
                        {formatShare(plaza.ezpassSharePct)} E-ZPass ·{' '}
                        {formatVehicles(plaza.publishedDays)} daily rows ·{' '}
                        {plaza.firstObservedOn} to {plaza.lastObservedOn}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="sources-note">
                  Facility names and codes come from the source register, which resolves each plaza
                  identifier from authority metadata. The published plaza identifier is shown beside
                  each name. A crossing the register cannot name is refused by the pipeline rather
                  than published with a bare identifier.
                </p>
              </section>
            </>
          )}

          {asset && <AssetProvenance asset={asset} measureId={measureId} />}
        </>
      )}
    </aside>
  )
}
