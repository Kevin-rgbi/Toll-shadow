import type { HotspotItem } from '../../lib/analysis'

interface HotspotDetailPanelProps {
  hotspot: HotspotItem | null
}

const impactLabel = (hotspot: HotspotItem): string => {
  if (hotspot.kind === 'traffic') {
    const value = hotspot.effect * 100
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}% vs expected`
  }

  return `${hotspot.effect >= 0 ? '+' : ''}${hotspot.effect.toFixed(2)} ug/m3 vs expected`
}

export function HotspotDetailPanel({ hotspot }: HotspotDetailPanelProps) {
  if (!hotspot) {
    return (
      <aside className="analysis-card detail-card" aria-live="polite">
        <p className="analysis-kicker">DRILL-DOWN</p>
        <h3>Select a hotspot from the ranking.</h3>
        <p>Choose a corridor or monitor to inspect impact, direction, and confidence in one place.</p>
      </aside>
    )
  }

  return (
    <aside className="analysis-card detail-card" aria-live="polite">
      <p className="analysis-kicker">DRILL-DOWN</p>
      <h3>{hotspot.name}</h3>
      <p className={`impact-line impact-${hotspot.direction}`}>{hotspot.direction.toUpperCase()} · {impactLabel(hotspot)}</p>
      <dl className="analysis-metrics">
        <div>
          <dt>Borough</dt>
          <dd>{hotspot.borough}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(hotspot.confidence * 100)}%</dd>
        </div>
        <div>
          <dt>Hotspot score</dt>
          <dd>{hotspot.score.toFixed(1)}</dd>
        </div>
      </dl>
    </aside>
  )
}
