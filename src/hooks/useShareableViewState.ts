import { useEffect } from 'react'
import type { AirGranularity } from '../types/air'
import type { TrafficDayType } from '../types/releaseData'
import type { AppMode } from '../state/appStore'
import type { MapPreference } from '../lib/mapPreference'
import { BUILD_ID } from '../lib/buildInfo'
import { buildViewStateQuery } from '../lib/viewState'

interface ShareableViewStateOptions {
  enabled: boolean
  mode: AppMode
  date: string | null
  borough: string | null
  dayType: TrafficDayType | null
  timeBand: string | null
  crossingsStart: string | null
  crossingsEnd: string | null
  airGranularity: AirGranularity | null
  airTimestamp: number
  map: MapPreference | null
}

export function useShareableViewState(options: ShareableViewStateOptions) {
  useEffect(() => {
    if (typeof window === 'undefined' || !options.enabled) return
    const query = buildViewStateQuery({
      mode: options.mode,
      date: options.date,
      borough: options.borough,
      dayType: options.dayType,
      timeBand: options.timeBand,
      crossingsStart: options.crossingsStart,
      crossingsEnd: options.crossingsEnd,
      airGranularity: options.airGranularity,
      airTime: options.airTimestamp > 0 ? new Date(options.airTimestamp).toISOString() : null,
      build: BUILD_ID,
      map: options.map,
    })
    window.history.replaceState(null, '', `${window.location.pathname}${query}`)
  }, [options])
}
