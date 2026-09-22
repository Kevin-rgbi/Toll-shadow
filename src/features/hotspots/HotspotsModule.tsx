import { useMemo } from 'react'
import { AssetProvenance } from '../../components/Detail/AssetProvenance'
import type { ReleaseAssetState } from '../../hooks/useReleaseAsset'
import { getReleaseAssets } from '../../lib/releaseManifest'
import type { ReleaseManifest } from '../../lib/releaseManifest'
import type { TrafficDayType, TrafficObservation } from '../../types/releaseData'
import { describeSegment } from '../traffic/trafficSummary'
import {
  rankTrafficHotspots,
  trafficHotspotKey,
  type HotspotRanking,
} from './hotspotRanking'

interface HotspotsModuleProps {
  state: ReleaseAssetState<TrafficObservation[]>
  release: ReleaseManifest | null
  ranking: HotspotRanking
  onRankingChange: (ranking: HotspotRanking) => void
  observations: TrafficObservation[]
  month: string
  monthOptions: string[]
  onMonthChange: (month: string) => void
  borough: string | null
  onBoroughChange: (borough: string | null) => void
  dayType: TrafficDayType | null
  onDayTypeChange: (dayType: TrafficDayType | null) => void
  timeBand: string | null
  onTimeBandChange: (timeBand: string | null) => void
  boroughOptions: string[]
  dayTypeOptions: TrafficDayType[]
  timeBandOptions: string[]
  selectedKey: string | null
  onSelect: (key: string) => void
}

const rankingLabels: Record<HotspotRanking, string> = {
  mean: 'Highest published mean',
  maximum: 'Largest observed 15-min volume',
  coverage: 'Most source observations',
}

const rankingValue = (observation: TrafficObservation, ranking: HotspotRanking): string => {
  if (ranking === 'maximum') return `${observation.maxObserved15MinVolume.toLocaleString('en-US')} maximum`
  if (ranking === 'coverage') return `${observation.observationCount.toLocaleString('en-US')} source observations`
  return `${observation.meanObserved15MinVolume.toFixed(1)} mean`
}

export function HotspotsModule({
  state,
  release,
  ranking,
  onRankingChange,
  observations,
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
  selectedKey,
  onSelect,
}: HotspotsModuleProps) {
  const ranked = useMemo(() => rankTrafficHotspots(observations, ranking), [observations, ranking])
  const asset = release ? getReleaseAssets(release, 'traffic_observations')[0] ?? null : null

  return (
    <aside className="analysis-card module-card hotspots-module" aria-live="polite">
      <p className="analysis-kicker">HOTSPOTS · OBSERVED TRAFFIC</p>
      <h3>Observed traffic hotspots</h3>
      <p className="sources-note">
        This ranks sampled DOT traffic observations within the current shared filters. It does not
        rank air pollution and does not claim congestion pricing caused any observed difference.
      </p>

      {(state.status === 'loading' || state.status === 'idle') && <p className="sources-note">Reading the published traffic asset…</p>}
      {state.status === 'unavailable' && <p className="sources-note">This release does not publish a traffic observation asset.</p>}
      {state.status === 'error' && <p className="sources-note sources-note-alert">{state.reason}</p>}

      {state.status === 'ready' && (
        <>
          <div className="module-filter-row">
            <label>
              <span>Month</span>
              <select value={month} onChange={(event) => onMonthChange(event.target.value)}>
                {monthOptions.length === 0 && <option value="">No published months</option>}
                {monthOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Borough</span>
              <select value={borough ?? ''} onChange={(event) => onBoroughChange(event.target.value || null)}>
                <option value="">All published boroughs</option>
                {boroughOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Day type</span>
              <select value={dayType ?? ''} onChange={(event) => onDayTypeChange(event.target.value ? event.target.value as TrafficDayType : null)}>
                <option value="">Weekday and weekend</option>
                {dayTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Time band</span>
              <select value={timeBand ?? ''} onChange={(event) => onTimeBandChange(event.target.value || null)}>
                <option value="">All bands</option>
                {timeBandOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>Ranking</span>
              <select value={ranking} onChange={(event) => onRankingChange(event.target.value as HotspotRanking)}>
                {Object.entries(rankingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <p className="module-count">
            Showing <strong>{ranked.length}</strong> ranked aggregates from {observations.length} published matches.
          </p>

          {ranked.length === 0 ? (
            <p className="module-empty">No published traffic observation matches this selection.</p>
          ) : (
            <ol className="module-rows hotspot-ranking-list">
              {ranked.map((observation, index) => {
                const key = trafficHotspotKey(observation)
                return (
                  <li key={key}>
                    <button type="button" aria-pressed={selectedKey === key} onClick={() => onSelect(key)}>
                      <span className="module-row-main">#{index + 1} · {describeSegment(observation)}</span>
                      <span className="module-row-meta">
                        {observation.borough} · {observation.direction} · {observation.dayType} · {observation.timeBand}
                      </span>
                      <span className="module-row-meta">
                        {rankingValue(observation, ranking)} · {observation.observationCount.toLocaleString('en-US')} source observations · {observation.observedDays} observed days
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}

          {asset && <AssetProvenance asset={asset} measureId="dot_observed_segment_ranking" />}
        </>
      )}
    </aside>
  )
}
