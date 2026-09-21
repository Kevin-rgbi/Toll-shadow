import { create } from 'zustand'
import { airTimelineSteps, nearestAirStep } from '../features/air/airData'
import type { AirDataset } from '../types/air'
import type { AirGranularity } from '../types/air'

export const APP_MODES = [
  'STORY',
  'TRAFFIC',
  'CROSSINGS',
  'AIR',
  'EQUITY',
  'CONFIDENCE',
  'HOTSPOTS',
  'SOURCES',
] as const

export type AppMode = (typeof APP_MODES)[number]
export type CompareMode = 'off' | 'on'
export type CompareRenderMode = 'actual' | 'expected' | 'difference'

const DAY_IN_MS = 24 * 60 * 60 * 1000

interface AppState {
  mode: AppMode
  compareMode: CompareMode
  compareRenderMode: CompareRenderMode
  currentDateIso: string
  minDateIso: string
  maxDateIso: string
  isPlaying: boolean
  playbackRateDaysPerSecond: number
  playbackCarryMs: number
  airGranularity: AirGranularity
  airTimestamp: number
  airMinTimestamp: number
  airMaxTimestamp: number
  airSteps: number[]
  airIsPlaying: boolean
  airPlaybackRate: number
  airPlaybackCarrySteps: number
  airLoop: boolean
  airScrubbing: boolean
  setMode: (mode: AppMode) => void
  setCompareMode: (mode: CompareMode) => void
  setCompareRenderMode: (mode: CompareRenderMode) => void
  toggleCompareMode: () => void
  setCurrentDate: (isoDate: string) => void
  setDateBounds: (minDateIso: string, maxDateIso: string) => void
  setPlayback: (playing: boolean) => void
  togglePlayback: () => void
  setPlaybackRate: (daysPerSecond: number) => void
  tickPlayback: (secondsElapsed: number) => void
  setAirGranularity: (granularity: AirGranularity) => void
  setAirTimeline: (dataset: AirDataset | null, granularity: AirGranularity) => void
  setAirTimestamp: (timestamp: number) => void
  setAirPlayback: (playing: boolean) => void
  toggleAirPlayback: () => void
  setAirPlaybackRate: (stepsPerSecond: number) => void
  tickAirPlayback: (secondsElapsed: number) => void
  toggleAirLoop: () => void
  setAirScrubbing: (scrubbing: boolean) => void
}

const clampDateIso = (isoDate: string, minDateIso: string, maxDateIso: string): string => {
  // Bounds stay empty until a release (or the dev dataset) declares its coverage window.
  if (minDateIso === '' || maxDateIso === '') return isoDate

  const minTs = Date.parse(`${minDateIso}T00:00:00Z`)
  const maxTs = Date.parse(`${maxDateIso}T00:00:00Z`)
  const dateTs = Date.parse(`${isoDate}T00:00:00Z`)

  if (!Number.isFinite(minTs) || !Number.isFinite(maxTs) || !Number.isFinite(dateTs)) {
    return minDateIso
  }

  if (dateTs <= minTs) return minDateIso
  if (dateTs >= maxTs) return maxDateIso
  return isoDate
}

const toIsoDate = (timestamp: number): string => {
  return new Date(timestamp).toISOString().slice(0, 10)
}

export const useAppStore = create<AppState>((set, get) => ({
  mode: 'STORY',
  compareMode: 'off',
  compareRenderMode: 'actual',
  currentDateIso: '',
  minDateIso: '',
  maxDateIso: '',
  isPlaying: false,
  playbackRateDaysPerSecond: 8,
  playbackCarryMs: 0,
  airGranularity: 'daily',
  airTimestamp: 0,
  airMinTimestamp: 0,
  airMaxTimestamp: 0,
  airSteps: [],
  airIsPlaying: false,
  airPlaybackRate: 1,
  airPlaybackCarrySteps: 0,
  airLoop: false,
  airScrubbing: false,

  setMode: (mode) => set({ mode }),

  setCompareMode: (compareMode) => set({ compareMode }),

  setCompareRenderMode: (compareRenderMode) => set({ compareRenderMode }),

  toggleCompareMode: () => {
    const compareMode = get().compareMode === 'on' ? 'off' : 'on'
    set({ compareMode })
  },

  setCurrentDate: (isoDate) => {
    const { minDateIso, maxDateIso } = get()
    set({
      currentDateIso: clampDateIso(isoDate, minDateIso, maxDateIso),
      playbackCarryMs: 0,
    })
  },

  setDateBounds: (minDateIso, maxDateIso) => {
    const currentDateIso = clampDateIso(get().currentDateIso, minDateIso, maxDateIso)
    set({ minDateIso, maxDateIso, currentDateIso, playbackCarryMs: 0 })
  },

  setPlayback: (isPlaying) => set({ isPlaying }),

  togglePlayback: () => set((state) => {
    if (state.isPlaying) {
      return { isPlaying: false }
    }

    const currentTs = Date.parse(`${state.currentDateIso}T00:00:00Z`)
    const maxTs = Date.parse(`${state.maxDateIso}T00:00:00Z`)

    // Restart from the beginning when the timeline is already at its end.
    if (Number.isFinite(currentTs) && Number.isFinite(maxTs) && currentTs >= maxTs) {
      return {
        isPlaying: true,
        currentDateIso: state.minDateIso,
        playbackCarryMs: 0,
      }
    }

    return { isPlaying: true }
  }),

  setPlaybackRate: (playbackRateDaysPerSecond) => set({ playbackRateDaysPerSecond }),

  tickPlayback: (secondsElapsed) => {
    const state = get()
    if (!state.isPlaying) return

    const maxTs = Date.parse(`${state.maxDateIso}T00:00:00Z`)
    const currentTs = Date.parse(`${state.currentDateIso}T00:00:00Z`)

    if (!Number.isFinite(maxTs) || !Number.isFinite(currentTs)) return

    const advancedMs = Math.max(0, secondsElapsed) * state.playbackRateDaysPerSecond * DAY_IN_MS
    const totalProgressMs = advancedMs + state.playbackCarryMs
    const wholeDays = Math.floor(totalProgressMs / DAY_IN_MS)
    const playbackCarryMs = totalProgressMs - (wholeDays * DAY_IN_MS)

    if (wholeDays <= 0) {
      set({ playbackCarryMs })
      return
    }

    const nextTs = currentTs + (wholeDays * DAY_IN_MS)
    const clampedTs = Math.min(nextTs, maxTs)

    set({
      currentDateIso: toIsoDate(clampedTs),
      isPlaying: clampedTs < maxTs,
      playbackCarryMs: clampedTs < maxTs ? playbackCarryMs : 0,
    })
  },

  setAirGranularity: (airGranularity) => set({ airGranularity }),

  setAirTimeline: (dataset, granularity) => {
    const steps = airTimelineSteps(dataset, granularity, null, null)
    const minTimestamp = steps[0] ?? 0
    const maxTimestamp = steps.at(-1) ?? 0
    const state = get()
    const currentInWindow = state.airTimestamp >= minTimestamp && state.airTimestamp <= maxTimestamp
    const airTimestamp = steps.length > 0
      ? (currentInWindow ? nearestAirStep(steps, state.airTimestamp) : minTimestamp)
      : 0
    set({
      airSteps: steps,
      airMinTimestamp: minTimestamp,
      airMaxTimestamp: maxTimestamp,
      airTimestamp,
      airGranularity: granularity,
      airIsPlaying: false,
      airPlaybackCarrySteps: 0,
      airScrubbing: false,
    })
  },

  setAirTimestamp: (timestamp) => {
    const state = get()
    if (state.airSteps.length === 0) return
    const clamped = Math.max(state.airMinTimestamp, Math.min(timestamp, state.airMaxTimestamp))
    set({ airTimestamp: nearestAirStep(state.airSteps, clamped), airPlaybackCarrySteps: 0 })
  },

  setAirPlayback: (airIsPlaying) => set({ airIsPlaying }),

  toggleAirPlayback: () => set((state) => {
    if (state.airIsPlaying) return { airIsPlaying: false }
    if (state.airSteps.length === 0) return {}
    if (!state.airLoop && state.airTimestamp >= state.airMaxTimestamp) {
      return { airIsPlaying: true, airTimestamp: state.airMinTimestamp, airPlaybackCarrySteps: 0 }
    }
    return { airIsPlaying: true }
  }),

  setAirPlaybackRate: (airPlaybackRate) => set({ airPlaybackRate }),

  tickAirPlayback: (secondsElapsed) => {
    const state = get()
    if (!state.airIsPlaying || state.airScrubbing || state.airSteps.length === 0) return

    const currentIndex = state.airSteps.indexOf(state.airTimestamp)
    const safeIndex = currentIndex >= 0 ? currentIndex : 0
    const totalSteps = Math.max(0, secondsElapsed) * state.airPlaybackRate + state.airPlaybackCarrySteps
    const wholeSteps = Math.floor(totalSteps)
    const airPlaybackCarrySteps = totalSteps - wholeSteps
    if (wholeSteps <= 0) {
      set({ airPlaybackCarrySteps })
      return
    }

    let nextIndex = safeIndex + wholeSteps
    if (state.airLoop) {
      nextIndex %= state.airSteps.length
    } else {
      nextIndex = Math.min(nextIndex, state.airSteps.length - 1)
    }

    set({
      airTimestamp: state.airSteps[nextIndex],
      airIsPlaying: state.airLoop || nextIndex < state.airSteps.length - 1,
      airPlaybackCarrySteps: state.airLoop ? airPlaybackCarrySteps : (nextIndex < state.airSteps.length - 1 ? airPlaybackCarrySteps : 0),
    })
  },

  toggleAirLoop: () => set((state) => ({ airLoop: !state.airLoop })),

  setAirScrubbing: (airScrubbing) => set({ airScrubbing }),
}))
