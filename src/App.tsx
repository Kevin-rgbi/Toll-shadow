import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { MethodologyModal } from './components/UI/MethodologyModal'
import { NarrativeOverlay } from './components/Story/NarrativeOverlay'
import { ConfidencePanel } from './components/Detail/ConfidencePanel'
import { ModuleUnavailable } from './components/Detail/ModuleUnavailable'
import { HotspotDrawer } from './components/Hotspots/HotspotDrawer'
import { HotspotDetailPanel } from './components/Detail/HotspotDetailPanel'
import { SourcesPanel } from './components/Detail/SourcesPanel'
import { DataRibbon } from './components/Status/DataRibbon'
import { useReleaseManifest } from './hooks/useReleaseManifest'
import { useReleaseBoundary } from './hooks/useReleaseBoundary'
import { useReleaseAsset } from './hooks/useReleaseAsset'
import { getReleaseTimelineBounds } from './lib/releaseManifest'
import { parseCrzEntries, parseFacilityCrossings, parseTrafficObservations } from './lib/releaseData'
import type { TrafficDayType, TrafficObservation } from './types/releaseData'
import { getDevSyntheticTimelineBounds } from './lib/devSyntheticDataset'
import { APP_MODES, useAppStore } from './state/appStore'
import { buildSyntheticHotspotRankings, summarizeSyntheticConfidence } from './lib/analysis'
import { getHeaderStatusLabel, getModuleUnavailableReason } from './lib/sourceMessaging'
import { TrafficModule } from './features/traffic/TrafficModule'
import {
  filterTrafficByBorough,
  filterTrafficByDayType,
  filterTrafficByMonth,
  filterTrafficByTimeBand,
  listBoroughs,
  listDayTypes,
  listTimeBands,
  listTrafficMonths,
  monthFromIsoDate,
  toTrafficFeatureCollection,
} from './features/traffic/trafficSummary'
import { CrossingsModule } from './features/crossings/CrossingsModule'
import { CrzModule } from './features/crz/CrzModule'
import { crossingsDateBounds } from './features/crossings/crossingsSummary'
import { buildViewStateQuery, readViewStateFromLocation } from './lib/viewState'
import { BUILD_ID, isStaleBuild, readExpectedBuildIdFromLocation } from './lib/buildInfo'
import {
  formatDateLong,
  formatDateShort,
  isRenderableIsoDate,
  isoToTimestamp,
  timestampToIso,
} from './lib/dateFormat'

const MapShell = lazy(async () => {
  const module = await import('./components/Map/MapShell')
  return { default: module.MapShell }
})

/** Stable identity so memo dependencies do not churn before the release assets resolve. */
const NO_OBSERVATIONS: TrafficObservation[] = []

const MODULE_TITLES: Partial<Record<(typeof APP_MODES)[number], string>> = {
  TRAFFIC: 'TRAFFIC OBSERVATIONS',
  CROSSINGS: 'MTA FACILITY CROSSINGS',
  CRZ: 'CRZ ENTRY CONTEXT',
  AIR: 'HISTORICAL AIR AND HEALTH CONTEXT',
  EQUITY: 'EQUITY CONTEXT',
  CONFIDENCE: 'CONFIDENCE CHECK',
  HOTSPOTS: 'HOTSPOT RANKING',
}

function App() {
  const [methodologyOpen, setMethodologyOpen] = useState(false)
  // On phones the data rail becomes a bottom sheet; this is its collapsed/expanded state.
  const [railExpanded, setRailExpanded] = useState(false)
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

  const releaseState = useReleaseManifest()
  const { release, isDevSynthetic, devSynthetic, status, reason } = releaseState
  const boundaryState = useReleaseBoundary(release)
  // Each asset is fetched only while the module that reads it is open; see DATA_STRATEGY, "load map
  // data by URL and by selected module".
  const trafficState = useReleaseAsset(release, 'traffic_observations', parseTrafficObservations, mode === 'TRAFFIC')
  const crossingsState = useReleaseAsset(release, 'facility_crossings', parseFacilityCrossings, mode === 'CROSSINGS')
  const crzState = useReleaseAsset(release, 'crz_context', parseCrzEntries, mode === 'CRZ')
  // A shared link seeds the filters once, at mount. Later edits go through the store and the URL
  // writer below; the URL is never re-read, so user interaction cannot be overwritten by history.
  const [initialView] = useState(readViewStateFromLocation)
  const [expectedBuildId] = useState(readExpectedBuildIdFromLocation)
  const [mapPreference] = useState(initialView.map)
  const staleBuild = isStaleBuild(expectedBuildId)
  const [trafficBorough, setTrafficBorough] = useState<string | null>(initialView.borough)
  const [trafficDayType, setTrafficDayType] = useState<TrafficDayType | null>(initialView.dayType)
  const [trafficTimeBand, setTrafficTimeBand] = useState<string | null>(initialView.timeBand)
  const [crossingsRangeOverride, setCrossingsRangeOverride] = useState<{ start: string, end: string } | null>(
    initialView.crossingsStart && initialView.crossingsEnd
      ? { start: initialView.crossingsStart, end: initialView.crossingsEnd }
      : null,
  )
  const appliedBoundsRef = useRef<string | null>(null)

  const timeline = useMemo(() => {
    if (devSynthetic) {
      return getDevSyntheticTimelineBounds(devSynthetic.manifest, devSynthetic.periodEffects)
    }

    if (release) {
      const bounds = getReleaseTimelineBounds(release)
      return {
        minDateIso: bounds.minDateIso,
        maxDateIso: bounds.maxDateIso,
        policyStartDateIso: bounds.policyReferenceDateIso,
      }
    }

    return null
  }, [devSynthetic, release])

  useEffect(() => {
    if (!timeline) return

    const boundsKey = `${timeline.minDateIso}:${timeline.maxDateIso}`
    if (appliedBoundsRef.current === boundsKey) return

    setDateBounds(timeline.minDateIso, timeline.maxDateIso)
    // A linked date is applied once, when the release bounds first arrive; otherwise the timeline
    // opens at the end of the published coverage.
    setCurrentDate(initialView.date ?? timeline.maxDateIso)
    appliedBoundsRef.current = boundsKey
  }, [initialView.date, setCurrentDate, setDateBounds, timeline])

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

  const syntheticHotspots = useMemo(() => {
    if (!devSynthetic) return null
    return buildSyntheticHotspotRankings(devSynthetic, currentDateIso)
  }, [currentDateIso, devSynthetic])

  const confidenceSummary = useMemo(
    () => summarizeSyntheticConfidence(syntheticHotspots ?? []),
    [syntheticHotspots],
  )

  const activeHotspotId = useMemo(() => {
    if (!syntheticHotspots || syntheticHotspots.length === 0) return null
    if (!selectedHotspotId) return syntheticHotspots[0].id
    return syntheticHotspots.some((hotspot) => hotspot.id === selectedHotspotId)
      ? selectedHotspotId
      : syntheticHotspots[0].id
  }, [selectedHotspotId, syntheticHotspots])

  const selectedHotspot = syntheticHotspots?.find((hotspot) => hotspot.id === activeHotspotId) ?? null

  // --- Released asset selection -------------------------------------------------------------
  // The month comes from the shared timeline; the borough filter narrows it further. Both the map
  // layer and the module summary read this one selection, so they cannot disagree.
  const trafficObservations = trafficState.status === 'ready' ? trafficState.data : NO_OBSERVATIONS
  const trafficMonth = currentDateIso
    ? monthFromIsoDate(currentDateIso)
    : release ? monthFromIsoDate(release.coverage.end) : ''

  const trafficForMonth = useMemo(
    () => filterTrafficByMonth(trafficObservations, trafficMonth),
    [trafficMonth, trafficObservations],
  )

  const trafficSelected = useMemo(
    () => filterTrafficByTimeBand(
      filterTrafficByDayType(
        filterTrafficByBorough(trafficForMonth, trafficBorough),
        trafficDayType,
      ),
      trafficTimeBand,
    ),
    [trafficBorough, trafficDayType, trafficForMonth, trafficTimeBand],
  )

  // Each filter's options are derived from the set narrowed by the *other* filters, so a control can
  // never offer a value that would return nothing.
  const trafficMonths = useMemo(() => listTrafficMonths(trafficObservations), [trafficObservations])

  const trafficBoroughOptions = useMemo(
    () => listBoroughs(filterTrafficByTimeBand(filterTrafficByDayType(trafficForMonth, trafficDayType), trafficTimeBand)),
    [trafficDayType, trafficForMonth, trafficTimeBand],
  )

  const trafficDayTypeOptions = useMemo(
    () => listDayTypes(filterTrafficByTimeBand(filterTrafficByBorough(trafficForMonth, trafficBorough), trafficTimeBand)),
    [trafficBorough, trafficForMonth, trafficTimeBand],
  )

  const trafficTimeBandOptions = useMemo(
    () => listTimeBands(filterTrafficByDayType(filterTrafficByBorough(trafficForMonth, trafficBorough), trafficDayType)),
    [trafficBorough, trafficDayType, trafficForMonth],
  )

  const trafficFeatures = useMemo(
    () => (trafficSelected.length > 0 ? toTrafficFeatureCollection(trafficSelected) : null),
    [trafficSelected],
  )

  const crossingsData = crossingsState.status === 'ready' ? crossingsState.data : null
  const crossingsBounds = useMemo(
    () => (crossingsData ? crossingsDateBounds(crossingsData) : null),
    [crossingsData],
  )

  // The selected window is the reviewer's override when set, and the asset's own published bounds
  // otherwise. Deriving it avoids a state-sync effect that would render the window twice.
  const crossingsRange = crossingsRangeOverride ?? crossingsBounds

  // Keep the address bar in step with the selected view so the current state is shareable.
  useEffect(() => {
    if (typeof window === 'undefined' || !release) return

    // `v` always carries the build this tab is actually running, so the address bar stays a truthful
    // record of it even when a stale bundle answered the request.
    const query = buildViewStateQuery({
      mode,
      date: currentDateIso || null,
      borough: trafficBorough,
      dayType: trafficDayType,
      timeBand: trafficTimeBand,
      crossingsStart: crossingsRange?.start ?? null,
      crossingsEnd: crossingsRange?.end ?? null,
      build: BUILD_ID,
      map: mapPreference,
    })

    window.history.replaceState(null, '', `${window.location.pathname}${query}`)
  }, [
    crossingsRange?.end,
    crossingsRange?.start,
    currentDateIso,
    mapPreference,
    mode,
    release,
    trafficBorough,
    trafficDayType,
    trafficTimeBand,
  ])

  const statusLabel = getHeaderStatusLabel(releaseState)
  const dataError = status === 'error' || boundaryState.error !== null
  const hasTimeline = timeline !== null

  /**
   * The timeline footer formats the selected date, so it cannot render in the window between the
   * release bounds arriving and the first date being seeded. That window is one render long on a
   * cold load, and formatting an empty string there throws `RangeError: Invalid time value`.
   */
  const canRenderTimeline = hasTimeline && isRenderableIsoDate(currentDateIso)

  const eyebrow = release
    ? `NYC · ${release.coverage.start} → ${release.coverage.end}`
    : isDevSynthetic ? 'NYC · SYNTHETIC DEV BUILD' : 'NYC · NO RELEASE PUBLISHED'

  const unavailableReason = getModuleUnavailableReason(releaseState, mode)

  const renderModule = () => {
    if (mode === 'SOURCES') {
      return <SourcesPanel state={releaseState} />
    }

    if (mode === 'TRAFFIC') {
      return (
        <TrafficModule
          state={trafficState}
          release={release}
          month={trafficMonth}
          monthOptions={trafficMonths}
          onMonthChange={(nextMonth) => {
            // The window is driven by the shared timeline, so choosing a month here moves the
            // timeline to that month rather than holding a second, independent selection.
            if (nextMonth) setCurrentDate(`${nextMonth}-01`)
          }}
          borough={trafficBorough}
          onBoroughChange={setTrafficBorough}
          dayType={trafficDayType}
          onDayTypeChange={setTrafficDayType}
          timeBand={trafficTimeBand}
          onTimeBandChange={setTrafficTimeBand}
          boroughOptions={trafficBoroughOptions}
          dayTypeOptions={trafficDayTypeOptions}
          timeBandOptions={trafficTimeBandOptions}
          monthTotal={trafficForMonth.length}
          observations={trafficSelected}
        />
      )
    }

    if (mode === 'CROSSINGS') {
      return (
        <CrossingsModule
          state={crossingsState}
          release={release}
          start={crossingsRange?.start ?? ''}
          end={crossingsRange?.end ?? ''}
          onRangeChange={(start, end) => setCrossingsRangeOverride({ start, end })}
        />
      )
    }

    if (mode === 'CRZ') {
      return <CrzModule state={crzState} release={release} />
    }

    if (mode === 'STORY') {
      return (
        <NarrativeOverlay
          progressPercent={hasTimeline ? timelineValue : 0}
          onJumpToStart={hasTimeline ? () => setCurrentDate(minDateIso) : undefined}
          onJumpToPolicy={hasTimeline && timeline?.policyStartDateIso
            ? () => setCurrentDate(timeline.policyStartDateIso as string)
            : undefined}
          onJumpToLatest={hasTimeline ? () => setCurrentDate(maxDateIso) : undefined}
        />
      )
    }

    if (!syntheticHotspots) {
      return <ModuleUnavailable moduleName={MODULE_TITLES[mode] ?? mode} reason={unavailableReason} />
    }

    if (mode === 'CONFIDENCE') {
      return <ConfidencePanel summary={confidenceSummary} />
    }

    if (mode === 'HOTSPOTS') {
      return (
        <section className="hotspot-stack" aria-label="Synthetic development hotspot panels">
          <HotspotDrawer
            hotspots={syntheticHotspots}
            selectedId={activeHotspotId}
            onSelect={setSelectedHotspotId}
          />
          <HotspotDetailPanel hotspot={selectedHotspot} />
        </section>
      )
    }

    return <ModuleUnavailable moduleName={MODULE_TITLES[mode] ?? mode} reason={unavailableReason} />
  }

  const appShellClassName = [
    'app-shell',
    `mode-${mode.toLowerCase()}`,
    `state-${status}`,
    compareMode === 'on' ? 'compare-active' : '',
  ].filter(Boolean).join(' ')

  return (
    <main className={appShellClassName}>
      {staleBuild && (
        <p className="stale-banner" role="alert">
          <strong>Stale build.</strong> This tab is running <code>{BUILD_ID}</code>, but the link asked
          for <code>{expectedBuildId}</code>. Your browser served a cached bundle. Hard-reload
          (Ctrl+Shift+R) to load the current build.
        </p>
      )}

      <header className="masthead">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>THE TOLL SHADOW</h1>
          <p className="subtitle">Observed measurements, their windows, and their limits.</p>
        </div>
        <div className="masthead-meta">
          <p className="build-stamp" title="The exact build this browser is running">
            <span>Build</span>
            <strong>{BUILD_ID}</strong>
          </p>
          <div className="status" aria-label="Data status">
            <span className="status-dot" aria-hidden="true" />
            <span className="status-copy">{statusLabel}</span>
            <button type="button" onClick={() => setMethodologyOpen(true)}>
              METHODS
            </button>
          </div>
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

      <nav className="mode-tabs" aria-label="Evidence module">
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
        {isDevSynthetic && (
          <button
            type="button"
            className={compareMode === 'on' ? 'mode-tab compare-tab is-active' : 'mode-tab compare-tab'}
            aria-pressed={compareMode === 'on'}
            onClick={toggleCompareMode}
          >
            COMPARE (DEV)
          </button>
        )}
      </nav>

      <DataRibbon state={releaseState} syntheticHotspots={syntheticHotspots} />

      {isDevSynthetic && compareMode === 'on' && mode !== 'SOURCES' && (
        <section className="compare-mode-switch" aria-label="Synthetic development render mode">
          <button
            type="button"
            className={compareRenderMode === 'actual' ? 'is-active' : ''}
            aria-label="Show synthetic dev observed values"
            aria-pressed={compareRenderMode === 'actual'}
            onClick={() => setCompareRenderMode('actual')}
          >
            <span className="compare-label-full">DEV OBSERVED</span>
            <span className="compare-label-short" aria-hidden="true">OBSERVED</span>
          </button>
          <button
            type="button"
            className={compareRenderMode === 'expected' ? 'is-active' : ''}
            aria-label="Show synthetic dev baseline values"
            aria-pressed={compareRenderMode === 'expected'}
            onClick={() => setCompareRenderMode('expected')}
          >
            <span className="compare-label-full">DEV BASELINE</span>
            <span className="compare-label-short" aria-hidden="true">BASELINE</span>
          </button>
          <button
            type="button"
            className={compareRenderMode === 'difference' ? 'is-active' : ''}
            aria-label="Show synthetic dev difference"
            aria-pressed={compareRenderMode === 'difference'}
            onClick={() => setCompareRenderMode('difference')}
          >
            <span className="compare-label-full">DEV DIFFERENCE</span>
            <span className="compare-label-short" aria-hidden="true">DIFF</span>
          </button>
        </section>
      )}

      <section className="workspace">
        <div className="map-column">
          <Suspense
            fallback={(
              <div className="map-shell map-shell-loading" role="status" aria-live="polite">
                Loading map layer
              </div>
            )}
          >
            <MapShell
              boundary={boundaryState.boundary}
              releaseTraffic={trafficFeatures}
              mapPreference={mapPreference}
              syntheticDataset={devSynthetic}
              currentDateIso={currentDateIso}
              activeMode={mode}
              compareMode={isDevSynthetic ? compareMode : 'off'}
              compareRenderMode={compareRenderMode}
              focusedHotspotId={mode === 'HOTSPOTS' ? activeHotspotId : null}
              focusedHotspotKind={mode === 'HOTSPOTS' ? (selectedHotspot?.kind ?? null) : null}
              dataError={dataError}
            />
          </Suspense>
          <div className="map-vignette" aria-hidden="true" />

          {canRenderTimeline && mode !== 'STORY' && mode !== 'SOURCES' && (
            <footer className="timeline-shell">
              <button
                className="play-button"
                type="button"
                aria-label={isPlaying ? 'Pause timeline playback' : 'Play timeline'}
                onClick={togglePlayback}
                disabled={Boolean(reason) || status === 'loading'}
              >
                <span aria-hidden="true">{isPlaying ? '||' : '>'}</span>
              </button>
              <div className="timeline-track">
                <div className="timeline-labels" aria-hidden="true">
                  <span>{formatDateShort(minDateIso)}</span>
                  {timeline?.policyStartDateIso && <span>{formatDateLong(timeline.policyStartDateIso)}</span>}
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
                />
              </div>
              <p className="date-label" aria-live="polite">{formatDateLong(currentDateIso)}</p>
            </footer>
          )}
        </div>

        <div className={railExpanded ? 'data-rail is-expanded' : 'data-rail'}>
          <button
            type="button"
            className="rail-handle"
            aria-expanded={railExpanded}
            onClick={() => setRailExpanded((expanded) => !expanded)}
          >
            <span className="rail-handle-bar" aria-hidden="true" />
            <span className="rail-handle-label">{railExpanded ? 'Hide the figures' : 'Show the figures'}</span>
          </button>
          {renderModule()}
        </div>
      </section>

      {methodologyOpen && (
        <MethodologyModal state={releaseState} onClose={() => setMethodologyOpen(false)} />
      )}
    </main>
  )
}

export default App
