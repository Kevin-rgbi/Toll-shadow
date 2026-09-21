import { HotspotDrawer } from '../components/Hotspots/HotspotDrawer'
import { HotspotDetailPanel } from '../components/Detail/HotspotDetailPanel'
import type { SyntheticHotspotItem } from '../lib/analysis'

/**
 * The development hotspot surface, in one place.
 *
 * This module is reached only through the development-only dynamic import in `App.tsx`, so the panels
 * and their labels are absent from a production bundle rather than present and unreachable. Keeping the
 * whole surface here is what makes that true: a label left behind in `App.tsx` would ship with it.
 */
export interface DevHotspotStackProps {
  hotspots: SyntheticHotspotItem[]
  selectedId: string | null
  selectedHotspot: SyntheticHotspotItem | null
  onSelect: (id: string) => void
}

export function DevHotspotStack({ hotspots, selectedId, selectedHotspot, onSelect }: DevHotspotStackProps) {
  return (
    <section className="hotspot-stack" aria-label="Synthetic development hotspot panels">
      <HotspotDrawer hotspots={hotspots} selectedId={selectedId} onSelect={onSelect} />
      <HotspotDetailPanel hotspot={selectedHotspot} />
    </section>
  )
}
