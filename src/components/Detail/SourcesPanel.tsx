import type { ReleaseManifestState } from '../../hooks/useReleaseManifest'
import { MANIFEST_PUBLIC_PATH, RELEASE_ASSET_LABELS, CLAIM_GUARDRAIL } from '../../lib/sourceMessaging'

interface SourcesPanelProps {
  state: ReleaseManifestState
}

const shortSha = (sha: string): string => `${sha.slice(0, 12)}…`

export function SourcesPanel({ state }: SourcesPanelProps) {
  const { release, status, reason, isDevSynthetic } = state

  return (
    <aside className="analysis-card sources-card" aria-live="polite">
      <p className="analysis-kicker">SOURCES</p>
      <h3>Release provenance</h3>

      {isDevSynthetic && (
        <p className="sources-caution">
          Synthetic development data is active in this local build. Nothing shown on the map is
          release evidence.
        </p>
      )}

      {status === 'loading' && (
        <p className="sources-note">Reading {MANIFEST_PUBLIC_PATH}.</p>
      )}

      {status === 'error' && (
        <p className="sources-note sources-note-alert">Release manifest error: {reason}</p>
      )}

      {!release && status !== 'loading' && status !== 'error' && (
        <p className="sources-note">No validated data release is published yet.</p>
      )}

      {release && (
        <>
          <dl className="analysis-metrics">
            <div>
              <dt>Release</dt>
              <dd>{release.release_id}</dd>
            </div>
            <div>
              <dt>Contract version</dt>
              <dd>{release.schema_version}</dd>
            </div>
            <div>
              <dt>Coverage</dt>
              <dd>{release.coverage.start} to {release.coverage.end}</dd>
            </div>
            <div>
              <dt>Transform</dt>
              <dd>{release.transform_version}</dd>
            </div>
          </dl>

          <section className="sources-section">
            <h4>Source registers cited by this release</h4>
            <ul className="sources-list sources-list-compact">
              {release.source_ids.map((sourceId) => (
                <li key={sourceId}>{sourceId}</li>
              ))}
            </ul>
          </section>

          <section className="sources-section sources-section-wide">
            <h4>Published assets</h4>
            <ul className="sources-list">
              {release.assets.map((asset) => (
                <li key={asset.path}>
                  <strong>{RELEASE_ASSET_LABELS[asset.kind]}</strong>
                  {` · ${asset.grain} · ${asset.coverage.start} to ${asset.coverage.end} · ${asset.format.toUpperCase()}`}
                  {asset.geometry_crs ? ` · ${asset.geometry_crs}` : ''}
                  {` · sha256 ${shortSha(asset.sha256)}`}
                  <br />
                  <span className="sources-note">{asset.path}</span>
                  {asset.limitations.length > 0 && (
                    <ul className="sources-list sources-list-compact">
                      {asset.limitations.map((limitation) => (
                        <li key={limitation}>{limitation}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="sources-section sources-section-wide">
            <h4>Release limitations</h4>
            <ul className="sources-list">
              {release.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </section>
        </>
      )}

      <p className="sources-caution">{CLAIM_GUARDRAIL}</p>
    </aside>
  )
}
