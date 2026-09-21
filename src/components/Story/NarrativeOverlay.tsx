interface NarrativeOverlayProps {
  progressPercent: number
  onJumpToStart?: () => void
  onJumpToPolicy?: () => void
  onJumpToLatest?: () => void
}

/**
 * Three chapter framings that follow the shared timeline. They carry no chapter numbering or
 * eyebrow label: the headline states the point, and the copy qualifies it.
 */
const narrativeChapter = (progressPercent: number): { title: string, copy: string } => {
  if (progressPercent < 34) {
    return {
      title: 'Start with the published observation window, not with a conclusion.',
      copy: 'Every module names its source register, coverage window, grain, and limitations before it shows a measure.',
    }
  }

  if (progressPercent < 67) {
    return {
      title: 'Compare places only where the same measure and period apply.',
      copy: 'Traffic counts, MTA facility crossings, CRZ entry context, and equity context come from separate published assets and are never mixed into one number.',
    }
  }

  return {
    title: 'Close on the limits: what this release cannot answer.',
    copy: 'Historical air and health context is context only; the preliminary NYCCAS monitor values are observed concentrations, not causal estimates. CRZ coordinates are approximate points, and no causal policy effect is claimed.',
  }
}

export function NarrativeOverlay({
  progressPercent,
  onJumpToStart,
  onJumpToPolicy,
  onJumpToLatest,
}: NarrativeOverlayProps) {
  const chapter = narrativeChapter(progressPercent)
  const hasJumps = onJumpToStart && onJumpToPolicy && onJumpToLatest

  return (
    <aside className="analysis-card story-card" aria-live="polite">
      <h3>{chapter.title}</h3>
      <p>{chapter.copy}</p>
      {hasJumps && (
        <div className="story-actions">
          <button type="button" onClick={onJumpToStart} aria-label="Jump to first published date">START</button>
          <button type="button" onClick={onJumpToPolicy} aria-label="Jump to the release policy reference date">POLICY REFERENCE</button>
          <button type="button" onClick={onJumpToLatest} aria-label="Jump to latest published date">LATEST</button>
        </div>
      )}
    </aside>
  )
}
