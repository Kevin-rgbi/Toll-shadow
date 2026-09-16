import { useEffect, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import { getReleaseAssets } from '../lib/releaseManifest'
import type { ReleaseManifest } from '../lib/releaseManifest'

interface LoadedBoundary {
  path: string
  boundary: FeatureCollection | null
  error: string | null
}

interface ReleaseBoundaryState {
  boundary: FeatureCollection | null
  isLoading: boolean
  error: string | null
}

/**
 * Loads the release's published boundary asset (`boundary_zone`).
 *
 * The asset must already be a validated EPSG:4326 release asset; this hook performs no geometry
 * transformation and never falls back to bundled demo geometry.
 */
export function useReleaseBoundary(release: ReleaseManifest | null): ReleaseBoundaryState {
  const [loaded, setLoaded] = useState<LoadedBoundary | null>(null)
  const boundaryPath = release ? getReleaseAssets(release, 'boundary_zone')[0]?.path ?? null : null
  const isCurrent = boundaryPath !== null && loaded?.path === boundaryPath

  useEffect(() => {
    if (!boundaryPath) return

    let cancelled = false

    const run = async () => {
      try {
        const response = await fetch(boundaryPath)
        if (!response.ok) {
          throw new Error(`could not fetch ${boundaryPath} (HTTP ${response.status})`)
        }
        const collection = (await response.json()) as FeatureCollection
        if (cancelled) return
        if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
          throw new Error(`${boundaryPath} is not a GeoJSON FeatureCollection`)
        }
        setLoaded({ path: boundaryPath, boundary: collection, error: null })
      } catch (error) {
        if (cancelled) return
        setLoaded({
          path: boundaryPath,
          boundary: null,
          error: error instanceof Error ? error.message : 'Unknown boundary asset error.',
        })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [boundaryPath])

  return {
    boundary: isCurrent ? loaded.boundary : null,
    isLoading: boundaryPath !== null && !isCurrent,
    error: isCurrent ? loaded.error : null,
  }
}
