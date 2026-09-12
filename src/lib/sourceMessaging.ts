import type { DataManifest } from './dataManifest'

export const MANIFEST_PUBLIC_PATH = 'public/data/manifest.json'

export const SYNTHETIC_PIPELINE_STATUS_LABEL = 'SYNTHETIC DEMO | REAL DATA PIPELINE DEFERRED'
export const CONNECTED_EXPORT_STATUS_LABEL = 'MODEL EXPORT CONNECTED'
export const LOADING_STATUS_LABEL = 'LOADING DATA'
export const ERROR_STATUS_LABEL = 'DATA ERROR'

export const SCAFFOLD_STRENGTH_LINE = 'This scaffold demonstrates how observed vs expected divergence will be investigated once real exports are connected.'

export const CURRENT_BUILD_POINTS = [
  'Synthetic demo bundle is loaded from public/data/manifest.json.',
  'Effects, zone, traffic, monitors, confidence, and equity values are scaffold data for the current presentation build.',
  'The frontend only loads files referenced by the manifest data contract.',
] as const

export const PLANNED_MTA_SOURCES = [
  'MTA congestion pricing and traffic exports, where applicable to corridor analysis.',
] as const

export const PLANNED_NON_MTA_SOURCES = [
  'NYC DOT Automated Traffic Volume Counts.',
  'NYC Street Centerline geometry.',
  'Official toll-zone geography.',
  'NYC DOHMH / NYCCAS air-quality surfaces.',
  'EPA AQS monitor and API feeds.',
  'NOAA and NWS weather controls.',
  'ACS Census equity indicators.',
  'Official city and state geography layers.',
] as const

export const PIPELINE_STATUS_POINTS = [
  'Real-source integration is deferred until pipeline exports are stable and versioned.',
  'Current app output demonstrates investigation method and UI behavior with synthetic values.',
  'Planned MTA and non-MTA connections are defined but not currently active in this frontend build.',
] as const

export const CAUSATION_GUARDRAIL = 'The project identifies patterns consistent with redistribution and does not claim every observed difference was caused solely by congestion pricing.'

export const getHeaderStatusLabel = ({
  manifest,
  isLoading,
  error,
}: {
  manifest: DataManifest | null
  isLoading: boolean
  error: string | null
}): string => {
  if (error) return ERROR_STATUS_LABEL
  if (isLoading) return LOADING_STATUS_LABEL
  if (manifest?.synthetic) return SYNTHETIC_PIPELINE_STATUS_LABEL
  return CONNECTED_EXPORT_STATUS_LABEL
}

export const getManifestFileRows = (manifest: DataManifest | null): string[] => {
  if (!manifest) return []

  const rows: string[] = []
  if (manifest.files.effects) {
    rows.push(`effects: ${manifest.files.effects}`)
  }

  if (manifest.files.effects_by_period) {
    const periods = Object.keys(manifest.files.effects_by_period).sort()
    for (const period of periods) {
      const filePath = manifest.files.effects_by_period[period]
      if (filePath) {
        rows.push(`effects_by_period ${period}: ${filePath}`)
      }
    }
  }

  rows.push(`zone: ${manifest.files.zone}`)
  if (manifest.files.manhattan) {
    rows.push(`manhattan: ${manifest.files.manhattan}`)
  }

  return rows
}
