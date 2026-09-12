interface NarrativeOverlayProps {
  progressPercent: number
  onJumpToStart: () => void
  onJumpToPolicy: () => void
  onJumpToLatest: () => void
}

const narrativeStep = (progressPercent: number): { kicker: string, title: string, copy: string } => {
  if (progressPercent < 34) {
    return {
      kicker: 'SPEECH CUE 1',
      title: 'Frame the question: where observed NYC departs from an expected no-toll baseline.',
      copy: 'Start in 2025 and define divergence as the gap between observed outcomes and counterfactual expectations by corridor and monitor.',
    }
  }

  if (progressPercent < 67) {
    return {
      kicker: 'SPEECH CUE 2',
      title: 'Answer the where: strongest splits cluster on entry corridors, edge streets, and nearby receiving areas.',
      copy: 'Use COMPARE in TOLL SHADOW mode to locate where traffic and exposure are lower than expected versus where they rise beyond expectation.',
    }
  }

  return {
    kicker: 'SPEECH CUE 3',
    title: 'Close with accountability: where the divergence is credible and who carries it.',
    copy: 'Confidence + Equity + Hotspots identify where follow-up should happen first.',
  }
}

export function NarrativeOverlay({
  progressPercent,
  onJumpToStart,
  onJumpToPolicy,
  onJumpToLatest,
}: NarrativeOverlayProps) {
  const step = narrativeStep(progressPercent)

  return (
    <aside className="analysis-card story-card" aria-live="polite">
      <p className="analysis-kicker">{step.kicker}</p>
      <h3>{step.title}</h3>
      <p>{step.copy}</p>
      <div className="story-actions">
        <button type="button" onClick={onJumpToStart} aria-label="Jump to first available date">START</button>
        <button type="button" onClick={onJumpToPolicy} aria-label="Jump to policy start date: January 05 2025">POLICY START</button>
        <button type="button" onClick={onJumpToLatest} aria-label="Jump to latest available date">LATEST</button>
      </div>
    </aside>
  )
}
