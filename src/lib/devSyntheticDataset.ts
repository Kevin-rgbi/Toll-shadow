/**
 * Development-only synthetic dataset loader (map/story prototyping).
 *
 * Isolation rules:
 * - Loads only when Vite runs in dev mode AND `VITE_USE_DEMO_DATA=true` was set explicitly.
 *   `vite.config.ts` already refuses that flag in a production build, and this module also
 *   refuses at runtime so a stale build cannot silently render synthetic material.
 * - The manifest must declare `synthetic: true`; a validated release manifest is rejected here so
 *   the two data boundaries can never be confused.
 * - `public/data/manifest.json` is the release pointer; it is not read by this module.
 */

import type { FeatureCollection } from 'geojson'
import type { DevSyntheticData, DevSyntheticManifest } from '../types/devSynthetic'
import { ReleaseManifestError } from './releaseManifest'

export interface PeriodEffectsEntry {
  periodStartIso: string
  effects: DevSyntheticData
}

export interface DevSyntheticDataset {
  manifest: DevSyntheticManifest
  effects: DevSyntheticData
  periodEffects: PeriodEffectsEntry[]
  zone: FeatureCollection
  manhattan: FeatureCollection | null
}

export interface DevSyntheticTimelineBounds {
  minDateIso: string
  maxDateIso: string
  policyStartDateIso: string
}

export type InterpolatedTrafficEffect = DevSyntheticData['traffic'][number] & {
  effectPct: number
  confidence: number
}

export type InterpolatedMonitorEffect = DevSyntheticData['monitors'][number] & {
  effect: number
  confidence: number
}

export interface InterpolatedEffects {
  traffic: InterpolatedTrafficEffect[]
  monitors: InterpolatedMonitorEffect[]
}

export const DEV_SYNTHETIC_MANIFEST_PATH = '/data/demo/dev-manifest.json'

export const DEV_SYNTHETIC_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_USE_DEMO_DATA === 'true'

export const assertDevSyntheticAllowed = (): void => {
  if (!DEV_SYNTHETIC_ENABLED) {
    throw new ReleaseManifestError(
      'MANIFEST_SYNTHETIC',
      'synthetic demo data is development-only and cannot be loaded in this build',
    )
  }
}

const asPublicPath = (path: string): string => {
  if (path.startsWith('/')) return path
  return `/${path}`
}

const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Failed to load ${path} (${response.status})`)
  }
  return (await response.json()) as T
}

const startOfYear = (isoDate: string): string => {
  const timestamp = Date.parse(`${isoDate}T00:00:00Z`)
  if (!Number.isFinite(timestamp)) return isoDate

  const date = new Date(timestamp)
  date.setUTCMonth(0, 1)
  return date.toISOString().slice(0, 10)
}

export const getDevSyntheticTimelineBounds = (
  manifest: DevSyntheticManifest,
  periodEffects: PeriodEffectsEntry[] = [],
): DevSyntheticTimelineBounds => {
  const policyStartDateIso = manifest.policy_start_date
  const maxDateIso = manifest.latest_observation_date
  const policyYearStartIso = startOfYear(policyStartDateIso)

  const earliestPeriodIso = periodEffects.length > 0
    ? periodEffects
      .map((entry) => entry.periodStartIso)
      .sort((left, right) => Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`))[0]
    : null

  const minDateIso = earliestPeriodIso
    ? (Date.parse(`${earliestPeriodIso}T00:00:00Z`) > Date.parse(`${policyYearStartIso}T00:00:00Z`)
      ? earliestPeriodIso
      : policyYearStartIso)
    : policyYearStartIso

  return { minDateIso, maxDateIso, policyStartDateIso }
}

const normalizePeriodIso = (periodStartIso: string): string => {
  const normalized = periodStartIso.length === 7 ? `${periodStartIso}-01` : periodStartIso
  const timestamp = Date.parse(`${normalized}T00:00:00Z`)
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid period date in dev manifest: ${periodStartIso}`)
  }
  return new Date(timestamp).toISOString().slice(0, 10)
}

const interpolate = (start: number, end: number, t: number): number => {
  return start + ((end - start) * t)
}

const getInterpolationWindow = (
  periodEffects: PeriodEffectsEntry[],
  currentDateIso: string,
): { start: PeriodEffectsEntry, end: PeriodEffectsEntry, t: number } => {
  if (periodEffects.length === 0) {
    throw new Error('No effects available to interpolate.')
  }

  if (periodEffects.length === 1) {
    return { start: periodEffects[0], end: periodEffects[0], t: 0 }
  }

  const currentTs = Date.parse(`${currentDateIso}T00:00:00Z`)
  if (!Number.isFinite(currentTs)) {
    return { start: periodEffects[0], end: periodEffects[0], t: 0 }
  }

  const firstTs = Date.parse(`${periodEffects[0].periodStartIso}T00:00:00Z`)
  const lastTs = Date.parse(`${periodEffects[periodEffects.length - 1].periodStartIso}T00:00:00Z`)

  if (currentTs <= firstTs) {
    return { start: periodEffects[0], end: periodEffects[0], t: 0 }
  }

  if (currentTs >= lastTs) {
    const tail = periodEffects[periodEffects.length - 1]
    return { start: tail, end: tail, t: 0 }
  }

  for (let index = 0; index < periodEffects.length - 1; index += 1) {
    const start = periodEffects[index]
    const end = periodEffects[index + 1]
    const startTs = Date.parse(`${start.periodStartIso}T00:00:00Z`)
    const endTs = Date.parse(`${end.periodStartIso}T00:00:00Z`)

    if (currentTs >= startTs && currentTs <= endTs) {
      const width = endTs - startTs
      const t = width <= 0 ? 0 : (currentTs - startTs) / width
      return { start, end, t }
    }
  }

  const fallback = periodEffects[periodEffects.length - 1]
  return { start: fallback, end: fallback, t: 0 }
}

export const getInterpolatedEffectsForDate = (
  dataset: DevSyntheticDataset,
  currentDateIso: string,
): InterpolatedEffects => {
  const periodEffects = dataset.periodEffects
  const window = getInterpolationWindow(periodEffects, currentDateIso)

  const endTrafficMap = new Map(
    window.end.effects.traffic.map((effect) => [effect.locationId, effect]),
  )
  const traffic = window.start.effects.traffic.map((startEffect) => {
    const endEffect = endTrafficMap.get(startEffect.locationId) ?? startEffect
    const effectPct = interpolate(startEffect.effectPct, endEffect.effectPct, window.t)
    const confidence = interpolate(startEffect.confidence, endEffect.confidence, window.t)

    return { ...startEffect, effectPct, confidence }
  })

  const endMonitorMap = new Map(
    window.end.effects.monitors.map((effect) => [effect.monitorId, effect]),
  )
  const monitors = window.start.effects.monitors.map((startEffect) => {
    const endEffect = endMonitorMap.get(startEffect.monitorId) ?? startEffect
    const effect = interpolate(startEffect.effect, endEffect.effect, window.t)
    const confidence = interpolate(startEffect.confidence, endEffect.confidence, window.t)

    return { ...startEffect, effect, confidence }
  })

  return { traffic, monitors }
}

export const loadDevSyntheticDataset = async (
  manifestPath = DEV_SYNTHETIC_MANIFEST_PATH,
): Promise<DevSyntheticDataset> => {
  assertDevSyntheticAllowed()

  const manifest = await fetchJson<DevSyntheticManifest>(manifestPath)

  if (manifest.synthetic !== true) {
    throw new ReleaseManifestError(
      'MANIFEST_SYNTHETIC',
      `${manifestPath} is not marked as synthetic dev material and cannot be loaded as demo data`,
    )
  }

  const { effects: effectsPath, effects_by_period: effectsByPeriod, zone: zonePath, manhattan: manhattanPath } = manifest.files

  if (!zonePath) {
    throw new Error('Dev manifest is missing required file: zone.')
  }

  if (!effectsPath && (!effectsByPeriod || Object.keys(effectsByPeriod).length === 0)) {
    throw new Error('Dev manifest must include either files.effects or files.effects_by_period.')
  }

  let periodEffects: PeriodEffectsEntry[] = []
  if (effectsByPeriod && Object.keys(effectsByPeriod).length > 0) {
    const entries = Object.entries(effectsByPeriod)
    periodEffects = await Promise.all(
      entries.map(async ([periodStartIso, path]) => {
        const normalized = normalizePeriodIso(periodStartIso)
        const effects = await fetchJson<DevSyntheticData>(asPublicPath(path))
        return { periodStartIso: normalized, effects }
      }),
    )

    periodEffects.sort((left, right) => {
      return Date.parse(`${left.periodStartIso}T00:00:00Z`) - Date.parse(`${right.periodStartIso}T00:00:00Z`)
    })
  }

  const defaultEffectsPromise = effectsPath
    ? fetchJson<DevSyntheticData>(asPublicPath(effectsPath))
    : Promise.resolve(periodEffects[periodEffects.length - 1].effects)
  const zonePromise = fetchJson<FeatureCollection>(asPublicPath(zonePath))
  const manhattanPromise = manhattanPath
    ? fetchJson<FeatureCollection>(asPublicPath(manhattanPath))
    : Promise.resolve(null)
  const [effects, zone, manhattan] = await Promise.all([defaultEffectsPromise, zonePromise, manhattanPromise])

  if (periodEffects.length === 0) {
    periodEffects = [
      {
        periodStartIso: normalizePeriodIso(manifest.latest_observation_date),
        effects,
      },
    ]
  }

  return { manifest, effects, periodEffects, zone, manhattan }
}
