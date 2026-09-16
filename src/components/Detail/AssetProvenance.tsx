import type { ReleaseAsset } from '../../lib/releaseManifest'
import { RELEASE_ASSET_LABELS } from '../../lib/sourceMessaging'

interface AssetProvenanceProps {
  asset: ReleaseAsset
  /** Approved measure identifier from the pipeline measure spec, when the payload declares one. */
  measureId: string | null
}

const shortSha = (sha: string): string => `${sha.slice(0, 12)}…`

/**
 * Source, method, and limitation detail for one published asset (PRD FR-07).
 *
 * Every evidence module renders this, so a displayed metric always has a path back to the release
 * manifest entry that produced it.
 */
export function AssetProvenance({ asset, measureId }: AssetProvenanceProps) {
  return (
    <section className="module-provenance" aria-label={`${RELEASE_ASSET_LABELS[asset.kind]} provenance`}>
      <h4>Source and method</h4>
      <dl className="analysis-metrics">
        <div>
          <dt>Published asset</dt>
          <dd>{RELEASE_ASSET_LABELS[asset.kind]}</dd>
        </div>
        {measureId && (
          <div>
            <dt>Measure</dt>
            <dd>{measureId}</dd>
          </div>
        )}
        <div>
          <dt>Source register</dt>
          <dd>{asset.source_ids.join(', ')}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>{asset.coverage.start} to {asset.coverage.end}</dd>
        </div>
        <div>
          <dt>Grain</dt>
          <dd>{asset.grain}</dd>
        </div>
        <div>
          <dt>Transform</dt>
          <dd>{asset.transform_version}</dd>
        </div>
        <div>
          <dt>Checksum</dt>
          <dd>sha256 {shortSha(asset.sha256)}</dd>
        </div>
      </dl>

      <h4>Limitations of this asset</h4>
      <ul className="sources-list sources-list-compact">
        {asset.limitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </section>
  )
}
