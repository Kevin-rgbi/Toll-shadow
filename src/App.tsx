import { Suspense, lazy, useEffect, useMemo, useRef, useState, useCallback } from 'react'
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
import { parseCrzEntries, parseTrafficObservations } from './lib/releaseData'
import { ComparisonModule } from './features/traffic/ComparisonModule'
import { DEFAULT_COMPARISON, compareLocations, monthlyFeatures, parseMonthlyAsset } from './features/traffic/monthlyComparison'
import type { ComparisonSelection } from './features/traffic/monthlyComparison'
import type { TrafficDayType, TrafficObservation } from './types/releaseData'
import { getDevSyntheticTimelineBounds } from './lib/devSyntheticDataset'
import { APP_MODES, useAppStore } from './state/appStore'
import { buildSyntheticHotspotRankings, summarizeSyntheticConfidence } from './lib/analysis'
import { getHeaderStatusLabel, getModuleUnavailableReason } from './lib/sourceMessaging'
import { TrafficModule } from './features/traffic/TrafficModule'
import { AirModule } from './features/air/AirModule'
import { AirTimeline } from './features/air/AirTimeline'
import { buildAirMapPoints } from './features/air/airData'
import { useAirDataset } from './hooks/useAirDataset'
import { CrzModule } from './features/crz/CrzModule'
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
  AIR: 'MEASURED AIR CONTEXT',
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
  const airGranularity = useAppStore((state) => state.airGranularity)
  const airTimestamp = useAppStore((state) => state.airTimestamp)
  const airSteps = useAppStore((state) => state.airSteps)
  const airIsPlaying = useAppStore((state) => state.airIsPlaying)
  const airPlaybackRate = useAppStore((state) => state.airPlaybackRate)
  const airLoop = useAppStore((state) => state.airLoop)
  const airScrubbing = useAppStore((state) => state.airScrubbing)
  const setAirGranularity = useAppStore((state) => state.setAirGranularity)
  const setAirTimeline = useAppStore((state) => state.setAirTimeline)
  const setAirTimestamp = useAppStore((state) => state.setAirTimestamp)
  const toggleAirPlayback = useAppStore((state) => state.toggleAirPlayback)
  const setAirPlaybackRate = useAppStore((state) => state.setAirPlaybackRate)
  const tickAirPlayback = useAppStore((state) => state.tickAirPlayback)
  const toggleAirLoop = useAppStore((state) => state.toggleAirLoop)
  const setAirScrubbing = useAppStore((state) => state.setAirScrubbing)

  const releaseState = useReleaseManifest()
  const { release, isDevSynthetic, devSynthetic, status, reason } = releaseState
  const boundaryState = useReleaseBoundary(release)
  const monthlyAssetEnabled = mode === 'TRAFFIC' || mode === 'CROSSINGS' || mode === 'HOTSPOTS'
  const trafficState = useReleaseAsset(release, 'traffic_observations', parseTrafficObservations, monthlyAssetEnabled)
  const crossingsState = useReleaseAsset(release, 'facility_crossings', parseMonthlyAsset, monthlyAssetEnabled)
  const monthlyCrzState = useReleaseAsset(release, 'crz_context', parseMonthlyAsset, monthlyAssetEnabled)
  const crzState = useReleaseAsset(release, 'crz_context', parseCrzEntries, mode === 'CRZ')
  const airState = useAirDataset(mode === 'AIR', airGranularity, release, status, reason)
  const airMapDataset = airState.status === 'error' ? null : airState.dataset
  // A shared link seeds the filters once, at mount. Later edits go through the store and the URL
  // writer below; the URL is never re-read, so user interaction cannot be overwritten by history.
  const [initialView] = useState(readViewStateFromLocation)
  const [expectedBuildId] = useState(readExpectedBuildIdFromLocation)
  const [mapPreference] = useState(initialView.map)
  const staleBuild = isStaleBuild(expectedBuildId)
  const [trafficBorough, setTrafficBorough] = useState<string | null>(initialView.borough)
  const [trafficDayType, setTrafficDayType] = useState<TrafficDayType | null>(initialView.dayType)
  const [trafficTimeBand, setTrafficTimeBand] = useState<string | null>(initialView.timeBand)
  const [comparisonSelection, setComparisonSelection] = useState<ComparisonSelection>(initialView.comparisonSelection ?? DEFAULT_COMPARISON)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [airBorough, setAirBorough] = useState<string | null>(null)
  const [airSiteFilter, setAirSiteFilter] = useState('all')
  const [airSelectedSiteId, setAirSelectedSiteId] = useState<string | null>(null)
  const [airBoundaryVisible, setAirBoundaryVisible] = useState(false)
  const [airComparisonOpen, setAirComparisonOpen] = useState(false)
  const [airIncludePartial, setAirIncludePartial] = useState(false)
  const handleReleaseSelect = useCallback((id: string | null) => {
    if (id === null) {
      if (mode === 'AIR') setAirSelectedSiteId(null)
      else setSelectedLocationId(null)
      return
    }
    if (mode === 'AIR') setAirSelectedSiteId(id)
    else setSelectedLocationId(id)
  }, [mode])
  const monthlyMode = mode === 'TRAFFIC' || mode === 'CROSSINGS' || mode === 'HOTSPOTS'
  const locations = useMemo(() => compareLocations([
    ...(monthlyCrzState.status === 'ready' ? monthlyCrzState.data.rows : []),
    ...(crossingsState.status === 'ready' ? crossingsState.data.rows : []),
  ], comparisonSelection), [monthlyCrzState, crossingsState, comparisonSelection])
  const visibleLocations = useMemo(() => mode === 'CROSSINGS' ? locations.filter(item => item.layer === 'mta') : locations, [locations, mode])
  const focusedLocation = visibleLocations.find(item => item.id === selectedLocationId) ?? null
  const releaseFocus = useMemo(() => focusedLocation ? { id: focusedLocation.id, coordinates: focusedLocation.coordinates } : null, [focusedLocation])
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

  useEffect(() => {
    if (airState.granularity !== airGranularity) return
    setAirTimeline(airMapDataset, airGranularity)
  }, [airGranularity, airMapDataset, airState.granularity, setAirTimeline])

  useEffect(() => {
    if (!airIsPlaying) return

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
          tickAirPlayback(reducedMotionAccumulator)
          reducedMotionAccumulator = 0
        }
      } else {
        tickAirPlayback(elapsedSeconds)
      }

      frameId = window.requestAnimationFrame(step)
    }

    frameId = window.requestAnimationFrame(step)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [airIsPlaying, tickAirPlayback])

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
  const trafficMonths = useMemo(() => listTrafficMonths(trafficObservations), [trafficObservations])
  const requestedDotMonth = monthFromIsoDate(currentDateIso || initialView.date || '')
  const trafficMonth = trafficMonths.includes(requestedDotMonth) ? requestedDotMonth : trafficMonths.at(-1) ?? ''

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

  const combinedFeatures = useMemo(() => {
    const points = monthlyFeatures(visibleLocations, selectedLocationId)
    if (comparisonSelection.layers.includes('dot') && trafficFeatures) points.features.unshift(...trafficFeatures.features)
    return points
  }, [visibleLocations, selectedLocationId, comparisonSelection.layers, trafficFeatures])

  const airSelectedStation = airMapDataset?.daily.stations.find((station) => station.id === airSelectedSiteId) ?? null
  const airReleaseFocus = airSelectedStation ? { id: airSelectedStation.id, coordinates: airSelectedStation.coordinates } : null
  const airDisplayTimestamp = useMemo(() => {
    if (airSteps.length > 0) return airTimestamp
    if (!airMapDataset) return 0
    if (airGranularity === 'daily') {
      const timestamp = Date.parse(`${airMapDataset.daily.minDate}T00:00:00Z`)
      return Number.isFinite(timestamp) ? timestamp : 0
    }
    return airMapDataset.hourly?.minTimestamp ?? 0
  }, [airGranularity, airMapDataset, airSteps, airTimestamp])
  const airFeatures = useMemo(
    () => buildAirMapPoints(airMapDataset, airGranularity, airDisplayTimestamp, {
      borough: airBorough,
      siteFilter: airSiteFilter,
      selectedSiteId: airSelectedSiteId,
    }),
    [airBorough, airGranularity, airSelectedSiteId, airSiteFilter, airMapDataset, airDisplayTimestamp],
  )

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
      crossingsStart: null,
      crossingsEnd: null,
      comparisonSelection,
      build: BUILD_ID,
      map: mapPreference,
    })

    window.history.replaceState(null, '', `${window.location.pathname}${query}`)
  }, [
    comparisonSelection,
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

    if (mode === 'CRZ') {
      return <CrzModule state={crzState} release={release} />
    }

    if (mode === 'HOTSPOTS' && isDevSynthetic && syntheticHotspots) {
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

    if (mode === 'TRAFFIC' || mode === 'CROSSINGS' || mode === 'HOTSPOTS') {
      return <>
        <ComparisonModule mode={mode} selection={comparisonSelection} onChange={setComparisonSelection} locations={locations} selectedId={selectedLocationId} onSelect={setSelectedLocationId} crz={monthlyCrzState} mta={crossingsState} release={release} />
        {comparisonSelection.layers.includes('dot') && <TrafficModule
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
        />}
      </>
    }

    if (mode === 'AIR') {
      return (
        <AirModule
          state={airState}
          granularity={airGranularity}
          onGranularityChange={setAirGranularity}
          timestamp={airDisplayTimestamp}
          selectedSiteId={airSelectedSiteId}
          onSelectSite={setAirSelectedSiteId}
          borough={airBorough}
          onBoroughChange={setAirBorough}
          siteFilter={airSiteFilter}
          onSiteFilterChange={setAirSiteFilter}
          boundaryVisible={airBoundaryVisible}
          onBoundaryChange={setAirBoundaryVisible}
          comparisonOpen={airComparisonOpen}
          onComparisonChange={setAirComparisonOpen}
          includePartial={airIncludePartial}
          onIncludePartialChange={setAirIncludePartial}
        />
      )
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

      <DataRibbon state={releaseState} syntheticHotspots={mode === 'AIR' ? null : syntheticHotspots} latestCoverage={monthlyCrzState.status === 'ready' && crossingsState.status === 'ready' ? `CRZ ${monthlyCrzState.data.latest.month}: ${monthlyCrzState.data.latest.coverage_days.join('/')} days (${monthlyCrzState.data.latest.complete ? 'complete' : 'partial'}); MTA ${crossingsState.data.latest.month}: ${crossingsState.data.latest.coverage_days.join('/')} days (${crossingsState.data.latest.complete ? 'complete' : 'partial'})` : undefined} />

      {isDevSynthetic && compareMode === 'on' && mode !== 'SOURCES' && mode !== 'AIR' && (
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
              boundary={mode === 'AIR' ? (airBoundaryVisible ? boundaryState.boundary : null) : (comparisonSelection.layers.includes('boundary') ? boundaryState.boundary : null)}
              releaseTraffic={mode === 'AIR' ? airFeatures : combinedFeatures}
              releaseFocus={monthlyMode ? releaseFocus : airReleaseFocus}
              onReleaseSelect={handleReleaseSelect}
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

          {canRenderTimeline && !monthlyMode && mode !== 'STORY' && mode !== 'SOURCES' && mode !== 'AIR' && (
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
          {mode === 'AIR' && (
            <AirTimeline
              granularity={airGranularity}
              steps={airSteps}
              timestamp={airDisplayTimestamp}
              isPlaying={airIsPlaying}
              playbackRate={airPlaybackRate}
              loop={airLoop}
              scrubbing={airScrubbing}
              onPlay={toggleAirPlayback}
              onRestart={() => setAirTimestamp(airSteps[0] ?? airDisplayTimestamp)}
              onPrevious={() => {
                const currentIndex = airSteps.indexOf(airDisplayTimestamp)
                setAirTimestamp(airSteps[Math.max(0, currentIndex - 1)] ?? airDisplayTimestamp)
              }}
              onNext={() => {
                const currentIndex = airSteps.indexOf(airDisplayTimestamp)
                setAirTimestamp(airSteps[Math.min(airSteps.length - 1, currentIndex + 1)] ?? airDisplayTimestamp)
              }}
              onRateChange={setAirPlaybackRate}
              onLoopChange={toggleAirLoop}
              onScrub={setAirTimestamp}
              onScrubStart={() => setAirScrubbing(true)}
              onScrubEnd={() => setAirScrubbing(false)}
            />
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
