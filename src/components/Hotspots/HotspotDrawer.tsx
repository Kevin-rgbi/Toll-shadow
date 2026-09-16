import type { SyntheticHotspotItem } from '../../lib/analysis'

interface HotspotDrawerProps {
  hotspots: SyntheticHotspotItem[]
  selectedId: string | null
  onSelect: (hotspotId: string) => void
}

const effectLabel = (item: SyntheticHotspotItem): string => {
  if (item.kind === 'traffic') {
    const pct = item.effect * 100
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
  }

  return `${item.effect >= 0 ? '+' : ''}${item.effect.toFixed(2)} ug/m3`
}

const effectAriaLabel = (item: SyntheticHotspotItem): string => {
  if (item.kind === 'traffic') {
    const pct = item.effect * 100
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)} percent synthetic dev effect`
  }

  return `${item.effect >= 0 ? '+' : ''}${item.effect.toFixed(2)} micrograms per cubic meter synthetic dev effect`
}

const selectAriaLabel = (item: SyntheticHotspotItem): string => {
  return `Select ${item.name}, ${item.direction}, ${effectAriaLabel(item)}`
}

const directionClass = (item: SyntheticHotspotItem): string => {
  if (item.direction === 'worsened') return 'is-worsened'
  if (item.direction === 'improved') return 'is-improved'
  return 'is-neutral'
}

export function HotspotDrawer({ hotspots, selectedId, onSelect }: HotspotDrawerProps) {
  return (
    <aside className="analysis-card hotspot-card" aria-live="polite">
      <p className="analysis-kicker">HOTSPOT RANKING · SYNTHETIC DEV</p>
      <h3>Highest combined dev effect and confidence</h3>
      <ol>
        {hotspots.slice(0, 5).map((hotspot) => (
          <li key={`${hotspot.kind}:${hotspot.id}`}>
            <button
              type="button"
              className={`${selectedId === hotspot.id ? 'is-active ' : ''}${directionClass(hotspot)}`}
              aria-pressed={selectedId === hotspot.id}
              aria-label={selectAriaLabel(hotspot)}
              onClick={() => onSelect(hotspot.id)}
            >
              <span>{hotspot.name}</span>
              <span className="hotspot-effect">{effectLabel(hotspot)}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  )
}
