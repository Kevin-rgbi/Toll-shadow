import type { FeatureCollection } from 'geojson'
import type * as maplibregl from 'maplibre-gl'
import type { AppMode } from '../../state/appStore'

export const NYC_CENTER: [number, number] = [-73.9712, 40.715]

export const NYC_BOUNDS: [[number, number], [number, number]] = [
  [-74.35, 40.45],
  [-73.55, 40.98],
]

/**
 * Basemap treatment: the map is a figure inside a light document, not the page background.
 * The raster is desaturated and lightened toward paper so published data reads as the only
 * saturated layer on screen.
 */
export const NYC_BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#f0f0ed',
      },
      minzoom: 0,
      maxzoom: 22,
    },
    {
      id: 'openstreetmap-base',
      type: 'raster',
      source: 'openstreetmap',
      paint: {
        'raster-opacity': 0.78,
        'raster-saturation': -1,
        'raster-contrast': -0.18,
        'raster-brightness-min': 0.42,
        'raster-brightness-max': 0.96,
      },
    },
  ],
}

export const NYC_REFERENCE_LABELS: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.98, 40.76] },
      properties: { name: 'Manhattan' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.95, 40.65] },
      properties: { name: 'Brooklyn' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.81, 40.73] },
      properties: { name: 'Queens' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.89, 40.85] },
      properties: { name: 'Bronx' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-74.14, 40.58] },
      properties: { name: 'Staten Island' },
    },
  ],
}

/**
 * Shown when the browser cannot provide a WebGL2 context, which MapLibre GL v6 requires. The
 * wording names the real cause and where to check it, rather than implying the app is broken.
 */
export const MAP_FALLBACK_MESSAGE =
  'This browser could not provide a WebGL2 context, so the map is drawn from raster tiles instead of the GPU renderer. Panning and zooming still work. chrome://gpu reports why WebGL2 is unavailable.'

/** Used when the library fails to start for a reason other than the context probe. */
export const MAP_START_FAILURE_PREFIX = 'The interactive map failed to start: '

/** Shown when the software map was asked for explicitly rather than falling back to it. */
export const SOFTWARE_MAP_OPT_IN_MESSAGE =
  'Software map requested with ?map=software. It uses raster tiles instead of the GPU renderer.'

export const focusOffsetForMode = (mode: AppMode): [number, number] => {
  if (window.innerWidth <= 720) {
    return [0, -118]
  }

  if (mode === 'HOTSPOTS' || mode === 'CONFIDENCE' || mode === 'EQUITY') {
    return [-170, -16]
  }

  if (mode === 'STORY') {
    return [136, -16]
  }

  return [0, -16]
}
