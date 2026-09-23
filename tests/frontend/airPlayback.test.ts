import { describe, expect, it, beforeEach } from 'vitest'
import { parseAirDailyCsv } from '../../src/features/air/airData'
import { useAppStore } from '../../src/state/appStore'
import { AIR_PLAYBACK_RATES } from '../../src/features/air/airPlaybackRates'

const daily = parseAirDailyCsv([
  'timestamp_utc,date_utc,site_id,site_name,borough,latitude,longitude,pm25_daily_mean_ugm3,valid_hours,coverage_pct,coverage_status,quality_status',
  '2026-01-01T00:00:00Z,2026-01-01,site-a,Site A,Manhattan,40.7,-74,8,24,100,qualifying,',
  '2026-01-02T00:00:00Z,2026-01-02,site-a,Site A,Manhattan,40.7,-74,9,24,100,qualifying,',
  '2026-01-03T00:00:00Z,2026-01-03,site-a,Site A,Manhattan,40.7,-74,10,24,100,qualifying,',
].join('\n'))
const dataset = {
  daily,
  hourly: null,
  dailyBytes: 0,
  hourlyBytes: null,
  sourceFiles: [],
}

beforeEach(() => {
  useAppStore.setState({
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
  })
})

describe('AIR playback store', () => {
  it('offers only the supported playback rates', () => {
    expect(AIR_PLAYBACK_RATES).toEqual([0.5, 1, 2, 4])
  })

  it('opens a newly loaded timeline at the latest published step', () => {
    useAppStore.getState().setAirTimeline(dataset, 'daily')

    expect(useAppStore.getState().airTimestamp).toBe(Date.parse('2026-01-03T00:00:00Z'))
  })

  it('snaps to recorded steps and accumulates fractional seconds', () => {
    useAppStore.setState({ airTimestamp: Date.parse('2026-01-01T00:00:00Z') })
    const store = useAppStore.getState()
    store.setAirTimeline(dataset, 'daily')
    expect(useAppStore.getState().airSteps).toHaveLength(3)
    expect(useAppStore.getState().airTimestamp).toBe(Date.parse('2026-01-01T00:00:00Z'))

    store.setAirPlayback(true)
    store.tickAirPlayback(0.6)
    expect(useAppStore.getState().airTimestamp).toBe(Date.parse('2026-01-01T00:00:00Z'))
    store.tickAirPlayback(0.5)
    expect(useAppStore.getState().airTimestamp).toBe(Date.parse('2026-01-02T00:00:00Z'))
  })

  it('pauses advancement while scrubbing and supports looping', () => {
    const state = useAppStore.getState()
    state.setAirTimeline(dataset, 'daily')
    state.setAirTimestamp(Date.parse('2026-01-01T00:00:00Z'))
    state.setAirPlayback(true)
    state.setAirScrubbing(true)
    state.tickAirPlayback(10)
    expect(useAppStore.getState().airTimestamp).toBe(Date.parse('2026-01-01T00:00:00Z'))

    state.setAirScrubbing(false)
    state.toggleAirLoop()
    state.setAirTimestamp(Date.parse('2026-01-03T00:00:00Z'))
    state.tickAirPlayback(1)
    expect(useAppStore.getState().airTimestamp).toBe(Date.parse('2026-01-01T00:00:00Z'))
    expect(useAppStore.getState().airIsPlaying).toBe(true)
  })
})
