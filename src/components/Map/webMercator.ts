/**
 * Web Mercator helpers for the WebGL-free map.
 *
 * These are the standard OSM/MapLibre tile equations, written out so they can be tested without a
 * browser. World coordinates are in tile units at a given zoom: the whole world is
 * `TILE_SIZE * 2^zoom` units wide, with the origin at the north-west corner.
 */

export const TILE_SIZE = 256

/** Zoom range the map allows. Below 9 the whole city is unreadable; above 17 OSM has no detail. */
export const MIN_ZOOM = 9
export const MAX_ZOOM = 17

export const clampZoom = (zoom: number): number => {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export const worldSize = (zoom: number): number => TILE_SIZE * 2 ** zoom

export interface WorldPoint {
  x: number
  y: number
}

export const lngLatToWorld = (lng: number, lat: number, zoom: number): WorldPoint => {
  const size = worldSize(zoom)
  const x = ((lng + 180) / 360) * size
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const latRad = (clampedLat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * size
  return { x, y }
}

export const worldToLngLat = (x: number, y: number, zoom: number): { lng: number, lat: number } => {
  const size = worldSize(zoom)
  const lng = (x / size) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / size
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n))
  return { lng, lat }
}

export interface TileCoordinate {
  z: number
  x: number
  y: number
}

/**
 * Tile coordinates covering a viewport, inclusive. `tileY` is clamped to the valid range; `tileX`
 * wraps, so panning past the antimeridian still resolves to real tiles.
 */
export const tileRangeFor = (
  centerLng: number,
  centerLat: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
): { minX: number, maxX: number, minY: number, maxY: number, scale: number } => {
  const scale = 2 ** zoom
  const center = lngLatToWorld(centerLng, centerLat, zoom)
  const halfWidth = viewportWidth / 2
  const halfHeight = viewportHeight / 2

  const minX = Math.floor((center.x - halfWidth) / TILE_SIZE)
  const maxX = Math.floor((center.x + halfWidth) / TILE_SIZE)
  const minY = Math.floor((center.y - halfHeight) / TILE_SIZE)
  const maxY = Math.floor((center.y + halfHeight) / TILE_SIZE)

  return {
    minX,
    maxX,
    minY: Math.max(0, minY),
    maxY: Math.min(scale - 1, maxY),
    scale,
  }
}

/** Screen position of a world point, relative to the viewport centre. */
export const worldToScreen = (
  point: WorldPoint,
  centerLng: number,
  centerLat: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number, y: number } => {
  const center = lngLatToWorld(centerLng, centerLat, zoom)
  return {
    x: point.x - center.x + viewportWidth / 2,
    y: point.y - center.y + viewportHeight / 2,
  }
}

/** Screen position of a lng/lat, using the current view. */
export const projectToScreen = (
  lng: number,
  lat: number,
  centerLng: number,
  centerLat: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number, y: number } => {
  return worldToScreen(lngLatToWorld(lng, lat, zoom), centerLng, centerLat, zoom, viewportWidth, viewportHeight)
}

/**
 * Keep the view over the city. The padding lets a reviewer nudge past the edges without losing the
 * published points entirely.
 */
export const clampCenter = (
  lng: number,
  lat: number,
  bounds: [[number, number], [number, number]],
  paddingDegrees = 0.25,
): { lng: number, lat: number } => {
  const [[west, south], [east, north]] = bounds
  return {
    lng: Math.min(east + paddingDegrees, Math.max(west - paddingDegrees, lng)),
    lat: Math.min(north + paddingDegrees, Math.max(south - paddingDegrees, lat)),
  }
}
