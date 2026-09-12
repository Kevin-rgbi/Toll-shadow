import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../src/state/appStore'

describe('appStore timeline controls', () => {
  beforeEach(() => {
    useAppStore.setState({
      mode: 'STORY',
      compareMode: 'off',
      compareRenderMode: 'actual',
      currentDateIso: '2025-01-05',
      minDateIso: '2025-01-01',
      maxDateIso: '2025-01-31',
      isPlaying: false,
      playbackRateDaysPerSecond: 8,
      playbackCarryMs: 0,
    })
  })

  it('clamps current date to bounds', () => {
    useAppStore.getState().setCurrentDate('2023-12-01')
    expect(useAppStore.getState().currentDateIso).toBe('2025-01-01')

    useAppStore.getState().setCurrentDate('2026-02-01')
    expect(useAppStore.getState().currentDateIso).toBe('2025-01-31')
  })

  it('advances timeline during playback and stops at max date', () => {
    useAppStore.getState().setPlaybackRate(5)
    useAppStore.getState().setPlayback(true)

    useAppStore.getState().tickPlayback(1)
    const afterOneTick = useAppStore.getState()
    expect(afterOneTick.currentDateIso >= '2025-01-06').toBe(true)
    expect(afterOneTick.isPlaying).toBe(true)

    useAppStore.getState().tickPlayback(20)
    const endState = useAppStore.getState()
    expect(endState.currentDateIso).toBe('2025-01-31')
    expect(endState.isPlaying).toBe(false)
  })

  it('accumulates fractional playback ticks into full-day progression', () => {
    useAppStore.getState().setPlaybackRate(1)
    useAppStore.getState().setPlayback(true)

    for (let index = 0; index < 11; index += 1) {
      useAppStore.getState().tickPlayback(0.1)
    }

    expect(useAppStore.getState().currentDateIso >= '2025-01-06').toBe(true)
  })

  it('restarts from min date when playback is toggled at max date', () => {
    useAppStore.getState().setCurrentDate('2025-01-31')

    useAppStore.getState().togglePlayback()
    const state = useAppStore.getState()

    expect(state.isPlaying).toBe(true)
    expect(state.currentDateIso).toBe('2025-01-01')
  })
})
