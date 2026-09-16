import type { MonitorEffect } from './air'
import type { TrafficEffect } from './traffic'

/**
 * Development-only synthetic visualization input.
 *
 * This shape exists so the map/story prototype can still be worked on locally. It is never a
 * release contract, it is not loaded in a production build, and no release module may consume it.
 * Published evidence comes from `src/lib/releaseManifest.ts` instead.
 */
export interface DevSyntheticData {
  synthetic: true
  generatedFor: 'visualization-development-only'
  policyStartDate: string
  traffic: TrafficEffect[]
  monitors: MonitorEffect[]
}

export interface DevSyntheticManifest {
  version: string
  generated_at: string
  synthetic: true
  policy_start_date: string
  latest_observation_date: string
  files: {
    effects?: string
    effects_by_period?: Record<string, string>
    zone: string
    manhattan?: string
    [key: string]: string | Record<string, string> | undefined
  }
}
