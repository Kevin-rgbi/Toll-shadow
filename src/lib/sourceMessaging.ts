import type { ReleaseAssetKind, ReleaseManifest } from './releaseManifest'
import type { ReleaseManifestState } from '../hooks/useReleaseManifest'
import type { AppMode } from '../state/appStore'

export const MANIFEST_PUBLIC_PATH = 'public/data/manifest.json'

export const LOADING_STATUS_LABEL = 'READING RELEASE MANIFEST'
export const ERROR_STATUS_LABEL = 'RELEASE MANIFEST ERROR'
export const EMPTY_STATUS_LABEL = 'NO VALIDATED RELEASE PUBLISHED'
export const DEV_SYNTHETIC_STATUS_LABEL = 'SYNTHETIC DEV DATA · NOT EVIDENCE'

export const CLAIM_GUARDRAIL = 'This product reports observed measurements, their windows, and their limits. It does not claim that congestion pricing caused any observed difference.'

export const RELEASE_ASSET_LABELS: Record<ReleaseAssetKind, string> = {
  boundary_zone: 'zone boundary',
  traffic_observations: 'traffic observation',
  facility_crossings: 'MTA facility crossing',
  crz_context: 'CRZ entry context',
  dac_context: 'disadvantaged-community context',
  historical_context: 'modelled historical air surface',
  air_measurements: 'Preliminary NYCCAS PM2.5 monitor measurements',
  health_context: 'historical health context',
  air_quality_context: 'NYCCAS data quality and coverage context',
  neighborhood_context: 'Westchester Square neighborhood context',
}

/** Asset kind that backs each evidence module, or null when the module needs an approved method first. */
export const MODULE_ASSET_KIND: Record<AppMode, ReleaseAssetKind | null> = {
  STORY: null,
  TRAFFIC: 'traffic_observations',
  CROSSINGS: 'facility_crossings',
  CRZ: 'crz_context',
  AIR: 'historical_context',
  EQUITY: 'dac_context',
  CONFIDENCE: 'air_quality_context',
  HOTSPOTS: 'traffic_observations',
  SOURCES: null,
}

export const getHeaderStatusLabel = (state: ReleaseManifestState): string => {
  if (state.isDevSynthetic) return DEV_SYNTHETIC_STATUS_LABEL
  if (state.status === 'loading') return LOADING_STATUS_LABEL
  if (state.status === 'error') return ERROR_STATUS_LABEL
  if (state.status === 'empty') return EMPTY_STATUS_LABEL
  return state.release ? `RELEASE ${state.release.release_id} · VALIDATED` : EMPTY_STATUS_LABEL
}

export const getCoverageLabel = (release: ReleaseManifest | null): string => {
  if (!release) return 'No published observation window'
  return `${release.coverage.start} to ${release.coverage.end}`
}

/**
 * Explains why an evidence module is not shown. A module is only ever rendered from a release
 * asset it declares; nothing is substituted when the release does not publish it.
 */
export const getModuleUnavailableReason = (
  state: ReleaseManifestState,
  mode: AppMode,
): string => {
  const label = MODULE_ASSET_KIND[mode] ? RELEASE_ASSET_LABELS[MODULE_ASSET_KIND[mode]] : null

  if (state.status === 'error') {
    return `The release manifest could not be read: ${state.reason ?? 'unknown error'}`
  }

  if (state.status === 'empty' || !state.release) {
    return 'No validated data release is published yet, so no evidence module can be shown.'
  }

  if (mode === 'AIR') {
    const published = state.release.assets.some((asset) => (
      asset.kind === 'air_measurements' || asset.kind === 'historical_context'
    ))
    if (!published) {
      return `Release ${state.release.release_id} does not publish an AIR evidence asset.`
    }
    return `Release ${state.release.release_id} publishes an AIR evidence asset, but this build does not render it yet.`
  }

  if (!label) {
    return `A ${mode.toLowerCase()} view needs an approved measure specification before it can be published. This release does not include one.`
  }

  const published = state.release.assets.some((asset) => asset.kind === MODULE_ASSET_KIND[mode])
  if (!published) {
    return `Release ${state.release.release_id} does not publish a ${label} asset.`
  }

  return `Release ${state.release.release_id} publishes a ${label} asset, but this build does not render it yet.`
}
