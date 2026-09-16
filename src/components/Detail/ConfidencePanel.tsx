import type { SyntheticConfidenceSummary } from '../../lib/analysis'

interface ConfidencePanelProps {
  summary: SyntheticConfidenceSummary
}

const pct = (value: number): string => `${Math.round(value * 100)}%`

export function ConfidencePanel({ summary }: ConfidencePanelProps) {
  const total = summary.highConfidenceCount + summary.mediumConfidenceCount + summary.lowConfidenceCount

  return (
    <aside className="analysis-card confidence-card" aria-live="polite">
      <p className="analysis-kicker">CONFIDENCE CHECK · SYNTHETIC DEV</p>
      <h3>How stable are the strongest dev prototype signals?</h3>
      <p>
        {total > 0
          ? `${summary.highConfidenceCount} high-confidence signals, ${summary.mediumConfidenceCount} medium, ${summary.lowConfidenceCount} low.`
          : 'No active signals for the current filter.'}
      </p>
      <div className="confidence-chips" aria-label="Confidence composition">
        <span className="confidence-chip chip-high">HIGH {summary.highConfidenceCount}</span>
        <span className="confidence-chip chip-medium">MED {summary.mediumConfidenceCount}</span>
        <span className="confidence-chip chip-low">LOW {summary.lowConfidenceCount}</span>
      </div>
      <dl className="analysis-metrics">
        <div>
          <dt>Average confidence</dt>
          <dd>{pct(summary.averageConfidence)}</dd>
        </div>
        <div>
          <dt>High confidence share</dt>
          <dd>{total > 0 ? pct(summary.highConfidenceCount / total) : '0%'}</dd>
        </div>
      </dl>
    </aside>
  )
}
