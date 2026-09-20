import { create } from 'zustand'

export const APP_MODES = [
  'STORY',
  'TRAFFIC',
  'CROSSINGS',
  'CRZ',
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
}))
