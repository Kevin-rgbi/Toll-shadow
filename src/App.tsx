import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { MethodologyModal } from './components/UI/MethodologyModal'
import { NarrativeOverlay } from './components/Story/NarrativeOverlay'
import { ConfidencePanel } from './components/Detail/ConfidencePanel'
import { EquityPanel } from './components/Detail/EquityPanel'
import { HotspotDrawer } from './components/Hotspots/HotspotDrawer'
import { HotspotDetailPanel } from './components/Detail/HotspotDetailPanel'
import { SourcesPanel } from './components/Detail/SourcesPanel'
import { useManifestDataset } from './hooks/useManifestDataset'
import { getTimelineBoundsFromManifest } from './lib/dataManifest'
import { APP_MODES, useAppStore } from './state/appStore'
import { buildEquitySignals, buildHotspotRankings, summarizeConfidence } from './lib/analysis'
import { getHeaderStatusLabel } from './lib/sourceMessaging'

const MapShell = lazy(async () => {
  const module = await import('./components/Map/MapShell')
  return { default: module.MapShell }
})

const formatDateLong = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(date)
    .toUpperCase()
}

const formatDateShort = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
    .format(date)
    .toUpperCase()
}

const isoToTimestamp = (isoDate: string): number => {
  return Date.parse(`${isoDate}T00:00:00Z`)
}

const timestampToIso = (timestamp: number): string => {
  return new Date(timestamp).toISOString().slice(0, 10)
}

const formatSigned = (value: number, digits = 1): string => {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}`
}

const formatBoroughLabel = (borough: string): string => {
  if (borough === 'StatenIsland') return 'Staten Island'
  return borough
}

function App() {
  const [methodologyOpen, setMethodologyOpen] = useState(false)
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null)
  const mode = useAppStore((state) => state.mode)
  const compareMode = useAppStore((state) => state.compareMode)
  const compareRenderMode = useAppStore((state) => state.compareRenderMode)
  const currentDateIso = useAppStore((state) => state.currentDateIso)
  const minDateIso = useAppStore((state) => state.minDateIso)
  const maxDateIso = useAppStore((state) => state.maxDateIso)
  const isPlaying = useAppStore((state) => state.isPlaying)
  const setMode = useAppStore((state) => state.setMode)
  const setDateBounds = useAppStore((state) => state.setDateBounds)
  const setCurrentDate = useAppStore((state) => state.setCurrentDate)
  const togglePlayback = useAppStore((state) => state.togglePlayback)
  const tickPlayback = useAppStore((state) => state.tickPlayback)
  const toggleCompareMode = useAppStore((state) => state.toggleCompareMode)
  const setCompareRenderMode = useAppStore((state) => state.setCompareRenderMode)

  const { data: dataset, isLoading, error } = useManifestDataset()
  const appliedManifestVersionRef = useRef<string | null>(null)

  useEffect(() => {
    if (!dataset) return

    const manifestVersion = `${dataset.manifest.version}:${dataset.manifest.generated_at}`
    if (appliedManifestVersionRef.current === manifestVersion) return

    const bounds = getTimelineBoundsFromManifest(dataset.manifest, dataset.periodEffects)
    setDateBounds(bounds.minDateIso, bounds.maxDateIso)
    setCurrentDate(bounds.maxDateIso)
    appliedManifestVersionRef.current = manifestVersion
  }, [dataset, setCurrentDate, setDateBounds])

  useEffect(() => {
    if (!isPlaying) return

    let previousTime = performance.now()
    let frameId = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let reducedMotionAccumulator = 0

    const step = (now: number) => {
      const elapsedSeconds = (now - previousTime) / 1000
      previousTime = now

      if (reduceMotion) {
        reducedMotionAccumulator += elapsedSeconds
        if (reducedMotionAccumulator >= 0.35) {
          tickPlayback(reducedMotionAccumulator)
          reducedMotionAccumulator = 0
        }
      } else {
        tickPlayback(elapsedSeconds)
      }

      frameId = window.requestAnimationFrame(step)
    }

    frameId = window.requestAnimationFrame(step)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [isPlaying, tickPlayback])

  const minDateTimestamp = isoToTimestamp(minDateIso)
  const maxDateTimestamp = isoToTimestamp(maxDateIso)
  const currentDateTimestamp = isoToTimestamp(currentDateIso)

  const timelineValue = useMemo(() => {
    const width = maxDateTimestamp - minDateTimestamp
    if (width <= 0) return 0
    return ((currentDateTimestamp - minDateTimestamp) / width) * 100
  }, [currentDateTimestamp, maxDateTimestamp, minDateTimestamp])

  const policyStartDateIso = dataset?.manifest.policy_start_date ?? '2025-01-05'

  const statusLabel = useMemo(() => {
    return getHeaderStatusLabel({
      manifest: dataset?.manifest ?? null,
      isLoading,
      error,
    })
  }, [dataset?.manifest, error, isLoading])

  const hotspots = useMemo(() => {
    if (!dataset) return []
    return buildHotspotRankings(dataset, currentDateIso)
  }, [currentDateIso, dataset])

  const confidenceSummary = useMemo(() => summarizeConfidence(hotspots), [hotspots])
  const equitySignals = useMemo(() => buildEquitySignals(hotspots), [hotspots])
  const activeHotspotId = useMemo(() => {
    if (hotspots.length === 0) return null
    if (!selectedHotspotId) return hotspots[0].id
    return hotspots.some((hotspot) => hotspot.id === selectedHotspotId)
      ? selectedHotspotId
      : hotspots[0].id
  }, [hotspots, selectedHotspotId])
  const selectedHotspot = hotspots.find((hotspot) => hotspot.id === activeHotspotId) ?? null
  const topHotspot = hotspots[0] ?? null

  const dataRibbon = useMemo(() => {
    const tracked = hotspots.length
    const highConfidencePct = tracked === 0
      ? 0
      : Math.round((confidenceSummary.highConfidenceCount / tracked) * 100)
    const netBurdenLeader = equitySignals[0]?.borough
      ? formatBoroughLabel(equitySignals[0].borough)
      : 'N/A'

    let topShiftLabel = 'N/A'
    let topShiftTone: 'worsened' | 'improved' | 'neutral' = 'neutral'
    if (topHotspot) {
      if (topHotspot.kind === 'traffic') {
        topShiftLabel = `${formatSigned(topHotspot.effect * 100)}% ${topHotspot.direction.toUpperCase()}`
      } else {
        topShiftLabel = `${formatSigned(topHotspot.effect, 2)} ug/m3 ${topHotspot.direction.toUpperCase()}`
      }
      topShiftTone = topHotspot.direction
    }

    const confidenceTone = highConfidencePct >= 70
      ? 'improved'
      : highConfidencePct >= 45
        ? 'neutral'
        : 'worsened'
    const netBurdenTone = equitySignals[0]
      ? (equitySignals[0].netBurden > 0 ? 'worsened' : equitySignals[0].netBurden < 0 ? 'improved' : 'neutral')
      : 'neutral'

    return {
      tracked,
      highConfidencePct,
      netBurdenLeader,
      topShiftLabel,
      topShiftTone,
      confidenceTone,
      netBurdenTone,
    }
  }, [confidenceSummary.highConfidenceCount, equitySignals, hotspots.length, topHotspot])

  const policyTimestamp = isoToTimestamp(policyStartDateIso)
  const timelineProgress = useMemo(() => {
    const width = maxDateTimestamp - minDateTimestamp
    if (width <= 0) return 0
    return Math.max(0, Math.min(100, ((currentDateTimestamp - minDateTimestamp) / width) * 100))
  }, [currentDateTimestamp, maxDateTimestamp, minDateTimestamp])

  const appShellClassName = [
    'app-shell',
    `mode-${mode.toLowerCase()}`,
    compareMode === 'on' ? 'compare-active' : '',
  ].filter(Boolean).join(' ')

  return (
    <main className={appShellClassName}>
      <Suspense
        fallback={(
          <div className="map-shell map-shell-loading" role="status" aria-live="polite">
            Loading map layer...
          </div>
        )}
      >
        <MapShell
          dataset={dataset}
          currentDateIso={currentDateIso}
          activeMode={mode}
          compareMode={compareMode}
          compareRenderMode={compareRenderMode}
          focusedHotspotId={mode === 'HOTSPOTS' ? activeHotspotId : null}
          focusedHotspotKind={mode === 'HOTSPOTS' ? (selectedHotspot?.kind ?? null) : null}
          dataError={Boolean(error)}
        />
      </Suspense>
      <div className="map-vignette" aria-hidden="true" />

      <header className="masthead">
        <div>
          <p className="eyebrow">NYC · JAN 2025-PRESENT</p>
          <h1>THE TOLL SHADOW</h1>
          <p className="subtitle">Observed vs expected, block by block.</p>
        </div>
        <div className="status" aria-label="Data status">
          <span className="status-dot" aria-hidden="true" />
          <span className="status-copy">{statusLabel}</span>
          <button type="button" onClick={() => setMethodologyOpen(true)}>
            METHODS
          </button>
        </div>
        <button
          type="button"
          className="mobile-methods-button"
          aria-label="Open methodology"
          onClick={() => setMethodologyOpen(true)}
        >
          METHODS
        </button>
      </header>

      <nav className="mode-tabs" aria-label="Map mode">
        {APP_MODES.map((tabMode) => (
          <button
            key={tabMode}
            type="button"
            className={mode === tabMode ? 'mode-tab is-active' : 'mode-tab'}
            aria-pressed={mode === tabMode}
            onClick={() => setMode(tabMode)}
          >
            {tabMode}
          </button>
        ))}
        <button
          type="button"
          className={compareMode === 'on' ? 'mode-tab compare-tab is-active' : 'mode-tab compare-tab'}
          aria-pressed={compareMode === 'on'}
          onClick={toggleCompareMode}
        >
          COMPARE
        </button>
      </nav>

      <section className="data-ribbon" aria-label="Current analysis summary" aria-live="polite">
        <p>
          <span>Tracked locations</span>
          <strong className="metric-value metric-neutral">{dataRibbon.tracked}</strong>
        </p>
        <p>
          <span>High-confidence share</span>
          <strong className={`metric-value metric-${dataRibbon.confidenceTone}`}>{dataRibbon.highConfidencePct}%</strong>
        </p>
        <p>
          <span>Strongest shift</span>
          <strong className={`metric-value metric-${dataRibbon.topShiftTone}`}>{dataRibbon.topShiftLabel}</strong>
        </p>
        <p>
          <span>Top net burden borough</span>
          <strong className={`metric-value metric-${dataRibbon.netBurdenTone}`}>{dataRibbon.netBurdenLeader}</strong>
        </p>
      </section>

      {compareMode === 'on' && mode !== 'SOURCES' && (
        <section className="compare-mode-switch" aria-label="Compare render mode">
          <button
            type="button"
            className={compareRenderMode === 'actual' ? 'is-active' : ''}
            aria-label="Show actual NYC observations"
            aria-pressed={compareRenderMode === 'actual'}
            onClick={() => setCompareRenderMode('actual')}
          >
            <span className="compare-label-full">ACTUAL NYC</span>
            <span className="compare-label-short" aria-hidden="true">ACTUAL</span>
          </button>
          <button
            type="button"
            className={compareRenderMode === 'expected' ? 'is-active' : ''}
            aria-label="Show expected no-toll baseline"
            aria-pressed={compareRenderMode === 'expected'}
            onClick={() => setCompareRenderMode('expected')}
          >
            <span className="compare-label-full">EXPECTED NO-TOLL</span>
            <span className="compare-label-short" aria-hidden="true">EXPECTED</span>
          </button>
          <button
            type="button"
            className={compareRenderMode === 'difference' ? 'is-active' : ''}
            aria-label="Show toll shadow difference"
            aria-pressed={compareRenderMode === 'difference'}
            onClick={() => setCompareRenderMode('difference')}
          >
            <span className="compare-label-full">TOLL SHADOW</span>
            <span className="compare-label-short" aria-hidden="true">SHADOW</span>
          </button>
        </section>
      )}

      {mode === 'STORY' && (
        <NarrativeOverlay
          progressPercent={timelineProgress}
          onJumpToStart={() => setCurrentDate(minDateIso)}
          onJumpToPolicy={() => setCurrentDate(timestampToIso(policyTimestamp))}
          onJumpToLatest={() => setCurrentDate(maxDateIso)}
        />
      )}

      {mode === 'CONFIDENCE' && <ConfidencePanel summary={confidenceSummary} />}

      {mode === 'EQUITY' && <EquityPanel signals={equitySignals} />}

      {mode === 'HOTSPOTS' && (
        <section className="hotspot-stack" aria-label="Hotspot analysis panels">
          <HotspotDrawer
            hotspots={hotspots}
            selectedId={activeHotspotId}
            onSelect={setSelectedHotspotId}
          />
          <HotspotDetailPanel hotspot={selectedHotspot} />
        </section>
      )}

      {mode === 'SOURCES' && (
        <SourcesPanel
          manifest={dataset?.manifest ?? null}
          isLoading={isLoading}
          error={error}
        />
      )}

      {mode !== 'STORY' && mode !== 'SOURCES' && (
        <footer className="timeline-shell">
          <button
            className="play-button"
            type="button"
            aria-label={isPlaying ? 'Pause timeline playback' : 'Play timeline'}
            onClick={togglePlayback}
            disabled={Boolean(error) || isLoading}
          >
            <span aria-hidden="true">{isPlaying ? '||' : '>'}</span>
          </button>
          <div className="timeline-track">
            <div className="timeline-labels" aria-hidden="true">
              <span>{formatDateShort(minDateIso)}</span>
              <span>{formatDateLong(policyStartDateIso)}</span>
              <span>{formatDateShort(maxDateIso)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={timelineValue}
              onChange={(event) => {
                const sliderRatio = Number(event.target.value) / 100
                const nextDate = minDateTimestamp + ((maxDateTimestamp - minDateTimestamp) * sliderRatio)
                setCurrentDate(timestampToIso(nextDate))
              }}
              aria-label="Current date on timeline"
              disabled={Boolean(error) || isLoading}
            />
            <span className="policy-label">CONGESTION PRICING</span>
          </div>
          <p className="date-label" aria-live="polite">{formatDateLong(currentDateIso)}</p>
        </footer>
      )}

      {methodologyOpen && (
        <MethodologyModal onClose={() => setMethodologyOpen(false)} />
      )}
    </main>
  )
}

export default App
