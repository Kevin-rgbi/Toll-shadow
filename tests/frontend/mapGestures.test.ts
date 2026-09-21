import { describe, expect, it } from 'vitest'
import {
  INERTIA_MIN_SPEED,
  centreAfterDrag,
  isInertiaWorthStarting,
  lngLatAtScreenPoint,
  pinchResult,
  sampleVelocity,
} from '../../src/components/Map/mapGestures'

const viewport = { width: 390, height: 420 }
const view = { lng: -73.9712, lat: 40.715, zoom: 11 }

describe('drag', () => {
  it('moves the centre west when the map is dragged east', () => {
    const next = centreAfterDrag(view, 100, 0)

    expect(next.lng).toBeLessThan(view.lng)
    expect(next.lat).toBeCloseTo(view.lat, 8)
  })

  it('moves the centre north when the map is dragged south', () => {
    const next = centreAfterDrag(view, 0, 100)

    expect(next.lat).toBeGreaterThan(view.lat)
    expect(next.lng).toBeCloseTo(view.lng, 8)
  })

  it('is a no-op for a zero-distance drag', () => {
    const next = centreAfterDrag(view, 0, 0)

    expect(next.lng).toBeCloseTo(view.lng, 10)
    expect(next.lat).toBeCloseTo(view.lat, 10)
  })
})

describe('pinch', () => {
  const startMid = { x: 180, y: 200 }

  it('keeps the view unchanged for a scale of one', () => {
    const result = pinchResult({ view, viewport, startMid, currentMid: startMid, scale: 1 })

    expect(result.zoom).toBeCloseTo(view.zoom, 8)
    expect(result.lng).toBeCloseTo(view.lng, 5)
    expect(result.lat).toBeCloseTo(view.lat, 5)
  })

  it('adds one zoom level when the fingers double their distance', () => {
    const result = pinchResult({ view, viewport, startMid, currentMid: startMid, scale: 2 })

    expect(result.zoom).toBeCloseTo(view.zoom + 1, 8)
  })

  it('subtracts one zoom level when the fingers halve their distance', () => {
    const result = pinchResult({ view, viewport, startMid, currentMid: startMid, scale: 0.5 })

    expect(result.zoom).toBeCloseTo(view.zoom - 1, 8)
  })

  it('anchors the gesture: the place under the fingers stays under the fingers', () => {
    const currentMid = { x: 200, y: 240 }
    const result = pinchResult({ view, viewport, startMid, currentMid, scale: 1.6 })

    const before = lngLatAtScreenPoint(view, viewport, startMid)
    const after = lngLatAtScreenPoint({ ...result }, viewport, currentMid)

    expect(after.lng).toBeCloseTo(before.lng, 5)
    expect(after.lat).toBeCloseTo(before.lat, 5)
  })

  it('clamps the zoom to the supported range instead of trusting the gesture', () => {
    const zoomedIn = pinchResult({ view: { ...view, zoom: 17 }, viewport, startMid, currentMid: startMid, scale: 4 })

    expect(zoomedIn.zoom).toBeLessThanOrEqual(17)
  })
})

describe('inertia', () => {
  it('measures velocity in pixels per millisecond', () => {
    const velocity = sampleVelocity({ x: 0, y: 0, t: 1000 }, { x: 50, y: -25, t: 1050 })

    expect(velocity.x).toBeCloseTo(1, 6)
    expect(velocity.y).toBeCloseTo(-0.5, 6)
  })

  it('reports no velocity for a zero-length sample rather than dividing by zero', () => {
    expect(sampleVelocity({ x: 0, y: 0, t: 500 }, { x: 40, y: 40, t: 500 })).toEqual({ x: 0, y: 0 })
  })

  it('starts inertia for a flick and not for a slow placement', () => {
    expect(isInertiaWorthStarting({ x: 1.2, y: 0 })).toBe(true)
    expect(isInertiaWorthStarting({ x: 0.01, y: 0.01 })).toBe(false)
    expect(isInertiaWorthStarting({ x: INERTIA_MIN_SPEED, y: 0 })).toBe(true)
  })
})
