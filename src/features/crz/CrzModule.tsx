import { useMemo } from 'react'
import { AssetProvenance } from '../../components/Detail/AssetProvenance'
import { getReleaseAssets } from '../../lib/releaseManifest'
import type { ReleaseManifest } from '../../lib/releaseManifest'
import type { ReleaseAssetState } from '../../hooks/useReleaseAsset'
import type { CrzEntrySummary } from '../../types/releaseData'
import { summarizeCrzByGroup, summarizeCrzWindow } from './crzSummary'

const TOP_GROUP_LIMIT = 12

/** Stable identity so memo dependencies do not churn while the asset is unavailable. */
const NO_CRZ: CrzEntrySummary[] = []

interface CrzModuleProps {
  state: ReleaseAssetState<CrzEntrySummary[]>
  release: ReleaseManifest | null
}

const formatCount = (value: number): string => value.toLocaleString('en-US')

/**
 * Congestion Relief Zone entry module (PRD FR-05).
 *
 * Published grain is one month per detection group, so the module reports monthly sums and says so.
 * Detection groups are areas around the Central Business District rather than detector points, and
 * the asset cannot support an hourly view; both limits are stated in the panel, not implied.
 */
export function CrzModule({ state, release }: CrzModuleProps) {
  const entries = state.status === 'ready' ? state.data : NO_CRZ

  const window = useMemo(() => summarizeCrzWindow(entries), [entries])
  const byGroup = useMemo(() => summarizeCrzByGroup(entries).slice(0, TOP_GROUP_LIMIT), [entries])

  const asset = release ? getReleaseAssets(release, 'crz_context')[0] ?? null : null
  const measureId = entries[0]?.measureId ?? null

  return (
    <aside className="analysis-card module-card" aria-live="polite">
      <p className="analysis-kicker">CRZ ENTRY CONTEXT</p>
      <h3>Monthly entries through published detection groups</h3>

      {(state.status === 'loading' || state.status === 'idle') && (
        <p className="sources-note">Reading the published CRZ aggregate…</p>
      )}

      {state.status === 'unavailable' && (
        <p className="sources-note">
          This release does not publish a CRZ entry asset, so there is nothing to show.
        </p>
      )}

      {state.status === 'error' && (
        <p className="sources-note sources-note-alert">{state.reason}</p>
      )}

      {state.status === 'ready' && (
        <>
          {!window && (
            <p className="module-empty">
              The release publishes no CRZ aggregate row, so nothing can be shown for this module.
            </p>
          )}

          {window && (
            <>
              <dl className="analysis-metrics">
                <div>
                  <dt>Detection groups</dt>
                  <dd>{window.groupCount}</dd>
                </div>
                <div>
                  <dt>Published months</dt>
                  <dd>{window.publishedMonths}</dd>
                </div>
                <div>
                  <dt>CRZ entries in window</dt>
                  <dd>{formatCount(window.crzEntries)}</dd>
                </div>
                <div>
                  <dt>Entries via excluded roadways</dt>
                  <dd>{formatCount(window.excludedRoadwayEntries)}</dd>
                </div>
                <div>
                  <dt>Aggregation window</dt>
                  <dd>{window.start} to {window.end}</dd>
                </div>
              </dl>

              <section className="module-section">
                <h4>By detection group</h4>
                <ul className="module-rows">
                  {byGroup.map((group) => (
                    <li key={group.detectionGroup}>
                      <span className="module-row-main">{group.detectionGroup}</span>
                      <span className="module-row-meta">
                        {group.detectionRegion} · {formatCount(group.crzEntries)} CRZ entries ·{' '}
                        {formatCount(group.excludedRoadwayEntries)} excluded-roadway entries ·{' '}
                        {group.publishedMonths} months · {group.firstMonth} to {group.lastMonth}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="sources-note">
                  Detection groups are areas around the Central Business District, not detector points,
                  and every figure here is a sum of published monthly sums. This asset cannot support
                  an hourly view, and entries are vehicle counts, not revenue or a causal effect.
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
