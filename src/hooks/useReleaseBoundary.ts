import type { FeatureCollection } from 'geojson'
import { useReleaseAsset } from './useReleaseAsset'
import type { ReleaseManifest } from '../lib/releaseManifest'

export function parseReleaseBoundary(input: unknown): FeatureCollection {
  const collection = input as FeatureCollection
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features) || !collection.features.length) throw new Error('Invalid official boundary collection')
  for (const feature of collection.features) {
    if (feature.type !== 'Feature' || !feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) throw new Error('Invalid official boundary geometry')
    const rings = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates.flat() : []
    for (const ring of rings) {
      if (ring.length < 4 || JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1)) || ring.some(point => point.length !== 2 || point.some(n => !Number.isFinite(n)) || point[0] < -75 || point[0] > -72 || point[1] < 40 || point[1] > 42)) throw new Error('Invalid official boundary ring')
    }
  }
  return collection
}

export function useReleaseBoundary(release: ReleaseManifest | null) {
  const state = useReleaseAsset(release, 'boundary_zone', parseReleaseBoundary)
  return { boundary: state.status === 'ready' ? state.data : null, isLoading: state.status === 'loading', error: state.status === 'error' ? state.reason : null }
}
