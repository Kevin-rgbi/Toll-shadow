import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ReleaseManifestState } from '../../hooks/useReleaseManifest'
import type { SyntheticHotspotItem } from '../../lib/analysis'
import { RELEASE_ASSET_LABELS } from '../../lib/sourceMessaging'

interface DataRibbonProps {
  state: ReleaseManifestState
  syntheticHotspots: SyntheticHotspotItem[] | null
  latestCoverage?: string
}

const formatSigned = (value: number, digits = 1): string => {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}`
}

function RibbonFrame({ label, summary, children }: { label: string, summary: string, children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    return () => window.cancelAnimationFrame(frame)
  }, [expanded])

  return (
    <section className="data-ribbon-shell" aria-label={label} aria-live="polite">
      <button
        type="button"
        className="data-ribbon-toggle"
        aria-controls="data-ribbon-details"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="data-ribbon-compact">{summary}</span>
        <span className="data-ribbon-action">
          {expanded ? 'Hide release details' : 'Show release details'}
          <span aria-hidden="true">{expanded ? '↑' : '↓'}</span>
        </span>
      </button>
      <div id="data-ribbon-details" className="data-ribbon" hidden={!expanded}>
        {children}
      </div>
    </section>
  )
}

/**
 * Summary strip. In a release build it reports only declared release facts (release id, coverage,
 * published asset count, source count). Synthetic prototype metrics appear only while the
 * development demo flag is active, and are labelled as dev values.
 */
export function DataRibbon({ state, syntheticHotspots, latestCoverage }: DataRibbonProps) {
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
      <RibbonFrame label="Synthetic development summary" summary="Synthetic development summary">
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
      </RibbonFrame>
    )
  }

  const assetCount = release ? release.assets.length : 0
  const sourceCount = release ? release.source_ids.length : 0
  const contextKinds = release
    ? [...new Set(release.assets.map((asset) => RELEASE_ASSET_LABELS[asset.kind]))].join(' · ')
    : 'None published'

  return (
    <RibbonFrame
      label="Release status summary"
      summary={`Release ${release?.release_id ?? 'not published'} · ${status.toUpperCase()} · ${assetCount} assets`}
    >
      <p>
        <span>Release</span>
        <strong className="metric-value metric-neutral">{release?.release_id ?? 'None'}</strong>
      </p>
      <p>
        <span>Coverage window</span>
        <strong className="metric-value metric-neutral">
          {latestCoverage ?? (release ? `${release.coverage.start} → ${release.coverage.end}` : 'Not published')}
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
    </RibbonFrame>
  )
}
