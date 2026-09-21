import { useEffect } from 'react'
import { NYC_REFERENCE_LABELS } from './mapConfig'
import type { MutableRefObject, RefObject } from 'react'
import type * as maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'

const RELEASE_BOUNDARY_SOURCE = 'release-boundary'
const RELEASE_TRAFFIC_SOURCE = 'release-traffic'

/**
 * The layers the map draws from published release assets.
 *
 * These are native MapLibre sources and layers rather than canvas drawing, so the release path stays
 * independent of the prototype overlay renderer. Each effect is idempotent by source id: later data
 * goes through `setData` instead of re-adding the layer, and a release without an asset removes its
 * own layer rather than leaving a stale one on the map.
 */
export interface MapLayerRefs {
  mapRef: MutableRefObject<maplibregl.Map | null>
  pointsReadoutRef: RefObject<HTMLSpanElement | null>
}

export interface MapLayerInputs {
  mapReady: boolean
  /** Published boundary geometry from the validated release manifest. */
  boundary: FeatureCollection | null
  /** Published traffic points for the current selection, already filtered by the module. */
  releaseTraffic: FeatureCollection | null
}

export const useMapLayers = (refs: MapLayerRefs, inputs: MapLayerInputs): void => {
  // Plain values: each effect's dependency array names what it actually reads.
  const { mapReady, boundary, releaseTraffic } = inputs

  useEffect(() => {
    const { mapRef } = refs
    const map = mapRef.current
    if (!map || !mapReady) return

    if (map.getSource('nyc-reference-labels')) return

    map.addSource('nyc-reference-labels', {
      type: 'geojson',
      data: NYC_REFERENCE_LABELS as never,
    })

    map.addLayer({
      id: 'nyc-reference-labels-layer',
      type: 'symbol',
      source: 'nyc-reference-labels',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-letter-spacing': 0.1,
        'text-font': ['Open Sans Semibold'],
      },
      paint: {
        'text-color': 'rgba(88, 94, 102, 0.85)',
        'text-halo-color': 'rgba(252, 252, 251, 0.9)',
        'text-halo-width': 1.2,
      },
    })
  }, [refs, mapReady])

  useEffect(() => {
    const { mapRef } = refs
    const map = mapRef.current
    if (!map || !mapReady) return

    if (!boundary) return

    if (map.getSource(RELEASE_BOUNDARY_SOURCE)) {
      const source = map.getSource(RELEASE_BOUNDARY_SOURCE) as maplibregl.GeoJSONSource
      source.setData(boundary as never)
      return
    }

    map.addSource(RELEASE_BOUNDARY_SOURCE, { type: 'geojson', data: boundary as never })
    map.addLayer({
      id: 'release-boundary-fill',
      type: 'fill',
      source: RELEASE_BOUNDARY_SOURCE,
      paint: { 'fill-color': '#1f4bd8', 'fill-opacity': 0.04 },
    })
    map.addLayer({
      id: 'release-boundary-line',
      type: 'line',
      source: RELEASE_BOUNDARY_SOURCE,
      paint: {
        'line-color': '#1f4bd8',
        'line-opacity': 0.5,
        'line-width': 1,
        'line-dasharray': [3, 2],
      },
    })
  }, [boundary, mapReady, refs])

  /**
   * Published traffic points render as a native MapLibre layer rather than on the canvas overlay,
   * so the release path stays independent of the synthetic prototype renderer. Colour and radius
   * encode the published per-segment mean only; the layer draws nothing when the selection is empty
   * and is removed entirely when the release publishes no traffic asset.
   */
  useEffect(() => {
    const { mapRef, pointsReadoutRef } = refs
    const map = mapRef.current
    if (!map || !mapReady) return

    const removeLayer = (layerId: string) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
    }

    if (!releaseTraffic) {
      if (pointsReadoutRef.current) pointsReadoutRef.current.textContent = 'no published points in view'
      removeLayer('release-traffic-circles')
      if (map.getSource(RELEASE_TRAFFIC_SOURCE)) map.removeSource(RELEASE_TRAFFIC_SOURCE)
      return
    }

    if (map.getSource(RELEASE_TRAFFIC_SOURCE)) {
      const source = map.getSource(RELEASE_TRAFFIC_SOURCE) as maplibregl.GeoJSONSource
      source.setData(releaseTraffic as never)
      return
    }

    map.addSource(RELEASE_TRAFFIC_SOURCE, { type: 'geojson', data: releaseTraffic as never })
    map.addLayer({
      id: 'release-traffic-circles',
      type: 'circle',
      source: RELEASE_TRAFFIC_SOURCE,
      paint: {
        'circle-radius': [
          'coalesce',
          ['get', 'radius'],
          [
            'interpolate', ['linear'], ['get', 'meanVolume'],
            0, 3,
            50, 5,
            150, 9,
          ],
        ] as never,
        'circle-color': [
          'coalesce',
          ['get', 'color'],
          [
            'interpolate', ['linear'], ['get', 'meanVolume'],
            0, 'rgba(31, 75, 216, 0.30)',
            50, 'rgba(31, 75, 216, 0.68)',
            150, '#0f2a86',
          ],
        ] as never,
        'circle-opacity': 0.85,
        'circle-stroke-color': ['coalesce', ['get', 'stroke'], 'rgba(252, 252, 251, 0.9)'] as never,
        'circle-stroke-width': ['case', ['get', 'selected'], 2, ['get', 'missing'], 1.2, 0.8] as never,
      },
    })

  }, [mapReady, refs, releaseTraffic])
}
