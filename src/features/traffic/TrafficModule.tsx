import { useMemo } from 'react'
import { AssetProvenance } from '../../components/Detail/AssetProvenance'
import { getReleaseAssets } from '../../lib/releaseManifest'
import type { ReleaseManifest } from '../../lib/releaseManifest'
import type { ReleaseAssetState } from '../../hooks/useReleaseAsset'
import type { TrafficDayType, TrafficObservation } from '../../types/releaseData'
import {
  describeSegment,
  summarizeTrafficMonth,
  topSegmentsByPublishedMean,
} from './trafficSummary'

const TOP_SEGMENT_LIMIT = 8

interface TrafficModuleProps {
  state: ReleaseAssetState<TrafficObservation[]>
  release: ReleaseManifest | null
  /** Selected month (`YYYY-MM`), shared with the timeline. */
  month: string
  /** Every month the release published, so the window can be changed from here as well. */
  monthOptions: string[]
  onMonthChange: (month: string) => void
  borough: string | null
  onBoroughChange: (borough: string | null) => void
  dayType: TrafficDayType | null
  onDayTypeChange: (dayType: TrafficDayType | null) => void
  timeBand: string | null
  onTimeBandChange: (timeBand: string | null) => void
  /** Dimension values that published data in the selected month, for the filter controls. */
  boroughOptions: string[]
  dayTypeOptions: TrafficDayType[]
  timeBandOptions: string[]
  /** Published aggregates for the selected month before the dimension filters are applied. */
  monthTotal: number
  /**
   * Published observations for the current month and filter selection. The same list feeds the map
   * layer, so the map and the summary can never disagree about what is selected.
   */
  observations: TrafficObservation[]
}

const formatMean = (value: number): string => value.toFixed(1)

/**
 * Traffic observation module (PRD FR-03).
 *
 * Shows published segment/month aggregates for the selected month, borough, day type and time band.
 * When the release published nothing for a selection, the module says so and reports how many
 * aggregates the month does hold; it never fills the gap with an estimate or another month's rows.
 */
export function TrafficModule({
  state,
  release,
  month,
  monthOptions,
  onMonthChange,
  borough,
  onBoroughChange,
  dayType,
  onDayTypeChange,
  timeBand,
  onTimeBandChange,
  boroughOptions,
  dayTypeOptions,
  timeBandOptions,
  monthTotal,
  observations,
}: TrafficModuleProps) {
  const summary = useMemo(() => summarizeTrafficMonth(observations), [observations])
  const topSegments = useMemo(
    () => topSegmentsByPublishedMean(observations, TOP_SEGMENT_LIMIT),
    [observations],
  )

  const asset = release ? getReleaseAssets(release, 'traffic_observations')[0] ?? null : null
  const measureId = observations[0]?.measureId ?? null

  return (
    <aside className="analysis-card module-card" aria-live="polite">
      <p className="analysis-kicker">TRAFFIC OBSERVATIONS</p>
      <h3>Sampled DOT counts, published monthly</h3>

      {state.status === 'loading' && <p className="sources-note">Reading the published traffic asset…</p>}

      {state.status === 'unavailable' && (
        <p className="sources-note">
          This release does not publish a traffic observation asset, so there is nothing to show.
        </p>
      )}

      {state.status === 'error' && (
        <p className="sources-note sources-note-alert">{state.reason}</p>
      )}

      {state.status === 'ready' && (
        <>
          <div className="module-filter-row">
            <label>
              <span>Month</span>
              <select
                value={month}
                onChange={(event) => onMonthChange(event.target.value)}
              >
                {monthOptions.length === 0 && <option value="">No published months</option>}
                {monthOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Borough</span>
              <select
                value={borough ?? ''}
                onChange={(event) => onBoroughChange(event.target.value === '' ? null : event.target.value)}
              >
                <option value="">All published boroughs</option>
                {boroughOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Day type</span>
              <select
                value={dayType ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  onDayTypeChange(value === '' ? null : value as TrafficDayType)
                }}
              >
                <option value="">Weekday and weekend</option>
                {dayTypeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Time band</span>
              <select
                value={timeBand ?? ''}
                onChange={(event) => onTimeBandChange(event.target.value === '' ? null : event.target.value)}
              >
                <option value="">All bands</option>
                {timeBandOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="module-count">
            Showing <strong>{observations.length}</strong> of {monthTotal} published aggregates for{' '}
            {month || 'the selected month'}.
          </p>

          {!summary && (
            <p className="module-empty">
              No published aggregate matches this selection.
              {monthTotal > 0
                ? ` Release ${release?.release_id ?? ''} holds ${monthTotal} aggregates for ${month}; clear a filter or move the timeline.`
                : ' Move the timeline to a month this release covers.'}
            </p>
          )}

          {summary && (
            <>
              <dl className="analysis-metrics">
                <div>
                  <dt>Published segment aggregates</dt>
                  <dd>{summary.publishedSegments}</dd>
                </div>
                <div>
                  <dt>Source observations behind them</dt>
                  <dd>{summary.totalObservations.toLocaleString('en-US')}</dd>
                </div>
                <div>
                  <dt>Mean of published segment means</dt>
                  <dd>{formatMean(summary.meanOfPublishedSegmentMeans)}</dd>
                </div>
                <div>
                  <dt>Highest published segment mean</dt>
                  <dd>{formatMean(summary.highestPublishedSegmentMean)}</dd>
                </div>
                <div>
                  <dt>Largest observed 15-min volume</dt>
                  <dd>{summary.largestObserved15MinVolume}</dd>
                </div>
                <div>
                  <dt>Observed days per segment</dt>
                  <dd>
                    {summary.observedDayMin === summary.observedDayMax
                      ? summary.observedDayMin
                      : `${summary.observedDayMin}-${summary.observedDayMax}`}
                  </dd>
                </div>
              </dl>

              <section className="module-section">
                <h4>Highest published segment means</h4>
                <ul className="module-rows">
                  {topSegments.map((observation) => (
                    <li key={`${observation.segmentId}:${observation.direction}:${observation.dayType}:${observation.timeBand}`}>
                      <span className="module-row-main">{describeSegment(observation)}</span>
                      <span className="module-row-meta">
                        {observation.borough} · {observation.direction} · {observation.dayType} ·{' '}
                        {observation.timeBand} · {formatMean(observation.meanObserved15MinVolume)} mean ·{' '}
                        {observation.observedDays} observed days
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          {asset && <AssetProvenance asset={asset} measureId={measureId} />}
        </>
      )}
    </aside>
  )
}
