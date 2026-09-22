import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AirModule } from './AirModule'
import { AirTimeline } from './AirTimeline'
import { buildAirMapPoints } from './airData'
import { useAirDataset } from '../../hooks/useAirDataset'
import { useAppStore } from '../../state/appStore'
import type { ReleaseManifest } from '../../lib/releaseManifest'
import type { AirGranularity } from '../../types/air'

type ReleaseStatus = 'loading' | 'ready' | 'empty' | 'error'

interface MeasuredAirExperienceOptions {
  enabled: boolean
  release: ReleaseManifest | null
  releaseStatus: ReleaseStatus
  releaseReason: string | null
  initialGranularity?: AirGranularity | null
  initialTime?: string | null
}

export function useMeasuredAirExperience({
  enabled,
  release,
  releaseStatus,
  releaseReason,
  initialGranularity,
  initialTime,
}: MeasuredAirExperienceOptions) {
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

  const [borough, setBorough] = useState<string | null>(null)
  const [siteFilter, setSiteFilter] = useState('all')
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [boundaryVisible, setBoundaryVisible] = useState(false)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [includePartial, setIncludePartial] = useState(false)
  const initialTimeApplied = useRef(false)
  const awaitingInitialGranularity = enabled && Boolean(initialGranularity) && airGranularity !== initialGranularity

  useEffect(() => {
    if (!enabled || !initialGranularity) return
    setAirGranularity(initialGranularity)
  }, [enabled, initialGranularity, setAirGranularity])

  const state = useAirDataset(enabled, airGranularity, release, releaseStatus, releaseReason)
  const dataset = state.status === 'error' ? null : state.dataset

  useEffect(() => {
    if (!enabled || awaitingInitialGranularity || state.granularity !== airGranularity) return
    setAirTimeline(dataset, airGranularity)
  }, [airGranularity, awaitingInitialGranularity, dataset, enabled, setAirTimeline, state.granularity])

  useEffect(() => {
    if (!enabled || initialTimeApplied.current || airSteps.length === 0 || !initialTime) return
    const requested = /^\d{4}-\d{2}-\d{2}$/.test(initialTime)
      ? Date.parse(`${initialTime}T00:00:00Z`)
      : Date.parse(initialTime)
    if (!Number.isFinite(requested)) return
    const minimum = airSteps[0]
    const maximum = airSteps.at(-1) ?? minimum
    const clamped = Math.max(minimum, Math.min(requested, maximum))
    setAirTimestamp(clamped)
    initialTimeApplied.current = true
  }, [airSteps, enabled, initialTime, setAirTimestamp])

  const rangeNotice = useMemo(() => {
    if (!initialTime || airSteps.length === 0) return null
    const requested = /^\d{4}-\d{2}-\d{2}$/.test(initialTime)
      ? Date.parse(`${initialTime}T00:00:00Z`)
      : Date.parse(initialTime)
    const minimum = airSteps[0]
    const maximum = airSteps.at(-1) ?? minimum
    if (!Number.isFinite(requested) || (requested >= minimum && requested <= maximum)) return null
    const clamped = Math.max(minimum, Math.min(requested, maximum))
    return `Requested AIR time is outside published coverage and was moved to ${new Date(clamped).toISOString()}.`
  }, [airSteps, initialTime])

  useEffect(() => {
    if (!enabled || !airIsPlaying) return

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
  }, [airIsPlaying, enabled, tickAirPlayback])

  const timestamp = useMemo(() => {
    if (airSteps.length > 0) return airTimestamp
    if (!dataset) return 0
    if (airGranularity === 'daily') {
      const parsed = Date.parse(`${dataset.daily.minDate}T00:00:00Z`)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return dataset.hourly?.minTimestamp ?? 0
  }, [airGranularity, airSteps, airTimestamp, dataset])

  const features = useMemo(
    () => buildAirMapPoints(dataset, airGranularity, timestamp, {
      borough,
      siteFilter,
      selectedSiteId,
    }),
    [airGranularity, borough, dataset, selectedSiteId, siteFilter, timestamp],
  )
  const selectedFeature = features.features.find((feature) => feature.id === selectedSiteId)
  const releaseFocus = selectedFeature?.geometry.type === 'Point'
    ? { id: String(selectedSiteId), coordinates: selectedFeature.geometry.coordinates as [number, number] }
    : null

  const onReleaseSelect = useCallback((id: string | null) => {
    setSelectedSiteId(id)
  }, [])

  const module = (
    <AirModule
      state={state}
      granularity={airGranularity}
      onGranularityChange={setAirGranularity}
      timestamp={timestamp}
      selectedSiteId={selectedSiteId}
      onSelectSite={setSelectedSiteId}
      borough={borough}
      onBoroughChange={setBorough}
      siteFilter={siteFilter}
      onSiteFilterChange={setSiteFilter}
      boundaryVisible={boundaryVisible}
      onBoundaryChange={setBoundaryVisible}
      comparisonOpen={comparisonOpen}
      onComparisonChange={setComparisonOpen}
      includePartial={includePartial}
      onIncludePartialChange={setIncludePartial}
      rangeNotice={rangeNotice}
      release={release}
    />
  )

  const timeline = (
    <AirTimeline
      granularity={airGranularity}
      steps={airSteps}
      timestamp={timestamp}
      isPlaying={airIsPlaying}
      playbackRate={airPlaybackRate}
      loop={airLoop}
      scrubbing={airScrubbing}
      onPlay={toggleAirPlayback}
      onRestart={() => setAirTimestamp(airSteps[0] ?? timestamp)}
      onPrevious={() => {
        const currentIndex = airSteps.indexOf(timestamp)
        setAirTimestamp(airSteps[Math.max(0, currentIndex - 1)] ?? timestamp)
      }}
      onNext={() => {
        const currentIndex = airSteps.indexOf(timestamp)
        setAirTimestamp(airSteps[Math.min(airSteps.length - 1, currentIndex + 1)] ?? timestamp)
      }}
      onRateChange={setAirPlaybackRate}
      onLoopChange={toggleAirLoop}
      onScrub={setAirTimestamp}
      onScrubStart={() => setAirScrubbing(true)}
      onScrubEnd={() => setAirScrubbing(false)}
    />
  )

  return {
    boundaryVisible,
    features,
    releaseFocus,
    onReleaseSelect,
    module,
    timeline,
    granularity: airGranularity,
    timestamp,
  }
}
