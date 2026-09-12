import type { DataManifest } from '../../lib/dataManifest'
import {
  CAUSATION_GUARDRAIL,
  CURRENT_BUILD_POINTS,
  MANIFEST_PUBLIC_PATH,
  PIPELINE_STATUS_POINTS,
  PLANNED_MTA_SOURCES,
  PLANNED_NON_MTA_SOURCES,
  SCAFFOLD_STRENGTH_LINE,
  getManifestFileRows,
} from '../../lib/sourceMessaging'

interface SourcesPanelProps {
  manifest: DataManifest | null
  isLoading: boolean
  error: string | null
}

export function SourcesPanel({ manifest, isLoading, error }: SourcesPanelProps) {
  const manifestRows = getManifestFileRows(manifest)

  return (
    <aside className="analysis-card sources-card" aria-live="polite">
      <p className="analysis-kicker">SOURCES</p>
      <h3>Current data contract and source roadmap</h3>
      <p className="sources-lead">{SCAFFOLD_STRENGTH_LINE}</p>

      <div className="sources-grid">
        <section className="sources-section">
          <h4>Current build data</h4>
          <ul className="sources-list">
            {CURRENT_BUILD_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          {isLoading && (
            <p className="sources-note">Reading manifest from {MANIFEST_PUBLIC_PATH}.</p>
          )}

          {error && (
            <p className="sources-note sources-note-alert">
              Manifest load error: {error}
            </p>
          )}

          {!isLoading && !error && manifest && (
            <>
              <p className="sources-note">
                Active manifest version {manifest.version} generated {manifest.generated_at}.
              </p>
              <ul className="sources-list sources-list-compact">
                {manifestRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="sources-section">
          <h4>Planned MTA sources</h4>
          <ul className="sources-list">
            {PLANNED_MTA_SOURCES.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </section>

        <section className="sources-section sources-section-wide">
          <h4>Planned non-MTA sources</h4>
          <ul className="sources-list">
            {PLANNED_NON_MTA_SOURCES.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </section>

        <section className="sources-section sources-section-wide">
          <h4>Pipeline status</h4>
          <ul className="sources-list">
            {PIPELINE_STATUS_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="sources-caution">{CAUSATION_GUARDRAIL}</p>
        </section>
      </div>
    </aside>
  )
}
