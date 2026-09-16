/**
 * Gesture maths for the WebGL-free map.
 *
 * Kept apart from the component so the parts that are easy to get wrong, anchoring a pinch and
 * turning an inertia offset into a new centre, can be tested without a browser.
 *
 * Screen and world units are the same size at a given zoom (world is `256 * 2^zoom` pixels across),
 * which is what makes the offsets below plain additions.
 */

import { clampZoom, lngLatToWorld, worldToLngLat } from './webMercator'

export interface ScreenPoint {
  x: number
  y: number
}

export interface Viewport {
  width: number
  height: number
}

export interface View {
  lng: number
  lat: number
  zoom: number
}

/** Screen offset of a point from the viewport centre. */
const offsetFromCentre = (point: ScreenPoint, viewport: Viewport): ScreenPoint => ({
  x: point.x - viewport.width / 2,
  y: point.y - viewport.height / 2,
})

/** The lng/lat currently under a screen point. */
export const lngLatAtScreenPoint = (view: View, viewport: Viewport, point: ScreenPoint): { lng: number, lat: number } => {
  const centreWorld = lngLatToWorld(view.lng, view.lat, view.zoom)
  const offset = offsetFromCentre(point, viewport)
  return worldToLngLat(centreWorld.x + offset.x, centreWorld.y + offset.y, view.zoom)
}

/** New centre after dragging by a screen delta. */
export const centreAfterDrag = (view: View, dx: number, dy: number): { lng: number, lat: number } => {
  const centreWorld = lngLatToWorld(view.lng, view.lat, view.zoom)
  return worldToLngLat(centreWorld.x - dx, centreWorld.y - dy, view.zoom)
}

export interface PinchInput {
  view: View
  viewport: Viewport
  /** Midpoint of the two pointers when the pinch began. */
  startMid: ScreenPoint
  /** Midpoint now. */
  currentMid: ScreenPoint
  /** Current distance between pointers divided by the distance when the pinch began. */
  scale: number
}

/**
 * Zoom and centre for a pinch: the lng/lat that was under the starting midpoint is placed under the
 * current midpoint, so the map scales around the fingers rather than around the viewport centre.
 */
export const pinchResult = (input: PinchInput): { lng: number, lat: number, zoom: number } => {
  const { view, viewport, startMid, currentMid, scale } = input
  const startAnchor = lngLatAtScreenPoint(view, viewport, startMid)

  const nextZoom = clampZoom(view.zoom + Math.log2(scale))
  const anchorWorldAtNextZoom = lngLatToWorld(startAnchor.lng, startAnchor.lat, nextZoom)
  const offset = offsetFromCentre(currentMid, viewport)

  return {
    ...worldToLngLat(anchorWorldAtNextZoom.x - offset.x, anchorWorldAtNextZoom.y - offset.y, nextZoom),
    zoom: nextZoom,
  }
}

/** Velocity in pixels per millisecond between two samples. */
export const sampleVelocity = (
  previous: { x: number, y: number, t: number },
  next: { x: number, y: number, t: number },
): ScreenPoint => {
  const elapsed = next.t - previous.t
  if (elapsed <= 0) return { x: 0, y: 0 }
  return { x: (next.x - previous.x) / elapsed, y: (next.y - previous.y) / elapsed }
}

/** Pixels per millisecond below which inertia is not worth starting. */
export const INERTIA_MIN_SPEED = 0.05

/** Fraction of velocity kept per 16.7 ms frame. */
export const INERTIA_FRICTION = 0.92

/** A flick slower than this does not move the map at all. */
export const isInertiaWorthStarting = (velocity: ScreenPoint): boolean => {
  return Math.hypot(velocity.x, velocity.y) >= INERTIA_MIN_SPEED
}
