import { AssetProvenance } from '../../components/Detail/AssetProvenance'
import type { ReleaseAssetState } from '../../hooks/useReleaseAsset'
import { getReleaseAssets } from '../../lib/releaseManifest'
import type { ReleaseManifest } from '../../lib/releaseManifest'
import type { AirQualityContext, NeighborhoodContext, QualityPollutant } from './qualityData'
import { QUALITY_POLLUTANTS } from './qualityData'

interface QualityModuleProps {
  quality: ReleaseAssetState<AirQualityContext>
  neighborhood: ReleaseAssetState<NeighborhoodContext>
  release: ReleaseManifest | null
  pollutant: QualityPollutant
  onPollutantChange: (pollutant: QualityPollutant) => void
  siteSearch: string
  onSiteSearchChange: (search: string) => void
  selectedSiteKey: string | null
  onSelectSite: (siteKey: string) => void
}

const labelForPollutant: Record<QualityPollutant, string> = {
  EC: 'EC / BC',
  NOX: 'NO / NO2',
  PM: 'PM2.5',
  O3: 'O3',
}

const formatCount = (value: number) => value.toLocaleString('en-US')
const siteKey = (siteId: string, postNo: string) => `${siteId}:${postNo}`

export function QualityModule({
  quality,
  neighborhood,
  release,
  pollutant,
  onPollutantChange,
  siteSearch,
  onSiteSearchChange,
  selectedSiteKey,
  onSelectSite,
}: QualityModuleProps) {
  const error = quality.status === 'error' ? quality.reason : neighborhood.status === 'error' ? neighborhood.reason : null
  const unavailable = quality.status === 'unavailable' || neighborhood.status === 'unavailable'
  const loading = quality.status === 'loading' || quality.status === 'idle' || neighborhood.status === 'loading' || neighborhood.status === 'idle'
  const context = quality.status === 'ready' && neighborhood.status === 'ready'
    ? { quality: quality.data, neighborhood: neighborhood.data }
    : null
  const selectedPollutant = context?.quality.pollutants[pollutant] ?? null
  const search = siteSearch.trim().toLowerCase()
  const matchingSites = selectedPollutant?.sitePosts.filter((site) => (
    `${site.siteId} ${site.postNo}`.toLowerCase().includes(search)
  )) ?? []
  const selectedSite = matchingSites.find((site) => siteKey(site.siteId, site.postNo) === selectedSiteKey)
    ?? matchingSites[0]
    ?? null
  const qualityAsset = release ? getReleaseAssets(release, 'air_quality_context')[0] ?? null : null
  const neighborhoodAsset = release ? getReleaseAssets(release, 'neighborhood_context')[0] ?? null : null

  return (
    <aside className="analysis-card module-card quality-module" aria-live="polite">
      <p className="analysis-kicker">CONFIDENCE · SOURCE QUALITY</p>
      <h3>Data quality and coverage</h3>
      <p className="sources-note">
        Direct source completeness and QA counts, not a statistical confidence score. Raw NYCCAS
        samples require temporal adjustment and modeling before they can describe pollution across New York City.
      </p>

      {loading && <p className="sources-note">Reading the published quality and neighborhood assets…</p>}
      {error && <p className="sources-note sources-note-alert">{error}</p>}
      {unavailable && <p className="sources-note">This release does not publish both required quality assets.</p>}

      {context && selectedPollutant && (
        <>
          <div className="module-filter-row">
            <label>
              <span>Pollutant workbook</span>
              <select value={pollutant} onChange={(event) => onPollutantChange(event.target.value as QualityPollutant)}>
                {QUALITY_POLLUTANTS.map((value) => <option key={value} value={value}>{labelForPollutant[value]}</option>)}
              </select>
            </label>
            <label>
              <span>Site / post</span>
              <input type="search" maxLength={80} value={siteSearch} onChange={(event) => onSiteSearchChange(event.target.value)} />
            </label>
          </div>

          <dl className="analysis-metrics">
            <div><dt>Source rows</dt><dd>{formatCount(selectedPollutant.sourceRows)}</dd></div>
            <div><dt>Site IDs</dt><dd>{selectedPollutant.distinctSiteIds}</dd></div>
            <div><dt>Site / post locations</dt><dd>{selectedPollutant.distinctSitePosts}</dd></div>
            <div><dt>Rows carrying a QA flag</dt><dd>{formatCount(selectedPollutant.qa.eitherFlag)}</dd></div>
            <div><dt>Rows carrying no QA flag</dt><dd>{formatCount(selectedPollutant.qa.neitherFlag)}</dd></div>
            <div><dt>Source coverage</dt><dd>{selectedPollutant.coverage.start} to {selectedPollutant.coverage.end}</dd></div>
          </dl>

          <section className="module-section">
            <h4>Analytic field completeness</h4>
            <ul className="module-rows">
              {Object.entries(selectedPollutant.analyticFields).map(([field, summary]) => (
                <li key={field}>
                  <span className="module-row-main">{field} · {summary.unit}</span>
                  <span className="module-row-meta">{formatCount(summary.present)} present · {formatCount(summary.missing)} missing</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="module-section">
            <h4>Site / post coverage</h4>
            <ul className="module-rows quality-site-list">
              {matchingSites.slice(0, 12).map((site) => {
                const key = siteKey(site.siteId, site.postNo)
                return <li key={key}>
                  <button type="button" aria-pressed={selectedSite ? key === siteKey(selectedSite.siteId, selectedSite.postNo) : false} onClick={() => onSelectSite(key)}>
                    <span className="module-row-main">Site {site.siteId} · post {site.postNo}</span>
                    <span className="module-row-meta">{formatCount(site.sourceRows)} rows · {site.coverage.start} to {site.coverage.end}</span>
                  </button>
                </li>
              })}
            </ul>
            {matchingSites.length === 0 && <p className="module-empty">No published site / post matches this search.</p>}
            {selectedSite && <dl className="analysis-metrics quality-site-detail">
              <div><dt>Selected site</dt><dd>{selectedSite.siteId} · post {selectedSite.postNo}</dd></div>
              <div><dt>Published coordinates</dt><dd>{selectedSite.latitude.toFixed(5)}, {selectedSite.longitude.toFixed(5)}</dd></div>
              <div><dt>Rows carrying a QA flag</dt><dd>{selectedSite.qaRows}</dd></div>
              <div><dt>Source classes</dt><dd>reference {selectedSite.referenceValues.join('/')} · core {selectedSite.coreValues.join('/')}</dd></div>
            </dl>}
          </section>

          <section className="module-section" aria-label="Westchester Square coverage">
            <h4>Westchester Square · official NTA BX1001</h4>
            <dl className="analysis-metrics">
              <div><dt>Historical NYCCAS coverage</dt><dd>{context.neighborhood.coverage.historicalSitesInside} historical sites inside</dd></div>
              <div><dt>Current monitor coverage</dt><dd>{context.neighborhood.coverage.currentMonitorsInside} current monitors inside</dd></div>
              <div><dt>Nearest historical site</dt><dd>{context.neighborhood.nearestHistorical.siteId} · {context.neighborhood.nearestHistorical.distanceKm.toFixed(3)} km outside</dd></div>
              <div><dt>Nearest current monitor</dt><dd>{context.neighborhood.nearestCurrent.siteName ?? context.neighborhood.nearestCurrent.siteId} · {context.neighborhood.nearestCurrent.distanceKm.toFixed(3)} km outside</dd></div>
            </dl>
            <p className="sources-note">
              Both nearest points are outside the official boundary. They are not Westchester Square measurements,
              are not averaged into the area, and do not support a neighborhood concentration estimate.
            </p>
          </section>

          {qualityAsset && <AssetProvenance asset={qualityAsset} measureId="nyccas_source_quality_coverage" />}
          {neighborhoodAsset && <AssetProvenance asset={neighborhoodAsset} measureId="westchester_square_monitor_coverage" />}
        </>
      )}
    </aside>
  )
}
