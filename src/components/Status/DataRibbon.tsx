import { useMemo } from 'react'
import type { ReleaseManifestState } from '../../hooks/useReleaseManifest'
import type { SyntheticHotspotItem } from '../../lib/analysis'
import { RELEASE_ASSET_LABELS } from '../../lib/sourceMessaging'

interface DataRibbonProps {
  state: ReleaseManifestState
  syntheticHotspots: SyntheticHotspotItem[] | null
}

const formatSigned = (value: number, digits = 1): string => {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}`
}

/**
 * Summary strip. In a release build it reports only declared release facts (release id, coverage,
 * published asset count, source count). Synthetic prototype metrics appear only while the
 * development demo flag is active, and are labelled as dev values.
 */
export function DataRibbon({ state, syntheticHotspots }: DataRibbonProps) {
  const { release, status, isDevSynthetic } = state

  const devMetrics = useMemo(() => {
    if (!syntheticHotspots || syntheticHotspots.length === 0) return null

    const tracked = syntheticHotspots.length
    const highConfidenceCount = syntheticHotspots.filter((hotspot) => hotspot.confidence >= 0.75).length
    const highConfidencePct = Math.round((highConfidenceCount / tracked) * 100)
    const leading = syntheticHotspots[0]

    return {
      tracked,
      highConfidencePct,
      topShiftLabel: leading.kind === 'traffic'
        ? `${formatSigned(leading.effect * 100)}% ${leading.direction.toUpperCase()}`
        : `${formatSigned(leading.effect, 2)} ug/m3 ${leading.direction.toUpperCase()}`,
      topShiftTone: leading.direction,
    }
  }, [syntheticHotspots])

  if (isDevSynthetic && devMetrics) {
    return (
      <section className="data-ribbon" aria-label="Synthetic development summary" aria-live="polite">
        <p>
          <span>Dev locations</span>
          <strong className="metric-value metric-neutral">{devMetrics.tracked}</strong>
        </p>
        <p>
          <span>Dev high-confidence share</span>
          <strong className="metric-value metric-neutral">{devMetrics.highConfidencePct}%</strong>
        </p>
        <p>
          <span>Largest dev shift</span>
          <strong className={`metric-value metric-${devMetrics.topShiftTone}`}>{devMetrics.topShiftLabel}</strong>
        </p>
        <p>
          <span>Evidence status</span>
          <strong className="metric-value metric-neutral">SYNTHETIC DEV</strong>
        </p>
      </section>
    )
  }

  const assetCount = release ? release.assets.length : 0
  const sourceCount = release ? release.source_ids.length : 0
  const contextKinds = release
    ? [...new Set(release.assets.map((asset) => RELEASE_ASSET_LABELS[asset.kind]))].join(' · ')
    : 'None published'

  return (
    <section className="data-ribbon" aria-label="Release status summary" aria-live="polite">
      <p>
        <span>Release</span>
        <strong className="metric-value metric-neutral">{release?.release_id ?? 'None'}</strong>
      </p>
      <p>
        <span>Coverage window</span>
        <strong className="metric-value metric-neutral">
          {release ? `${release.coverage.start} → ${release.coverage.end}` : 'Not published'}
        </strong>
      </p>
      <p>
        <span>Published assets</span>
        <strong className="metric-value metric-neutral">{assetCount}</strong>
      </p>
      <p>
        <span>Source registers</span>
        <strong className="metric-value metric-neutral">{sourceCount}</strong>
      </p>
      <p>
        <span>Modules with a published asset</span>
        <strong className="metric-value metric-neutral">{contextKinds}</strong>
      </p>
      <p>
        <span>Data state</span>
        <strong className="metric-value metric-neutral">{status.toUpperCase()}</strong>
      </p>
    </section>
  )
}
