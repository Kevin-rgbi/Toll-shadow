import { describe, expect, it } from 'vitest'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_SIZE,
  clampCenter,
  clampZoom,
  lngLatToWorld,
  projectToScreen,
  tileRangeFor,
  worldSize,
  worldToLngLat,
} from '../../src/components/Map/webMercator'
import { NYC_BOUNDS, NYC_CENTER } from '../../src/components/Map/mapConfig'

describe('web mercator projection', () => {
  it('round-trips a coordinate through world space', () => {
    const world = lngLatToWorld(-73.9712, 40.715, 12)
    const back = worldToLngLat(world.x, world.y, 12)

    expect(back.lng).toBeCloseTo(-73.9712, 8)
    expect(back.lat).toBeCloseTo(40.715, 8)
  })

  it('places central NYC on the tile the tile server actually serves', () => {
    // Ground truth: the GPU renderer requested tile 11/603/769 for this centre, and so does the
    // raster map. If this drifts, the raster map is showing the wrong part of the world.
    const world = lngLatToWorld(NYC_CENTER[0], NYC_CENTER[1], 11)

    expect(Math.floor(world.x / TILE_SIZE)).toBe(603)
    expect(Math.floor(world.y / TILE_SIZE)).toBe(769)
  })

  it('scales world space by powers of two in tile units', () => {
    expect(worldSize(0)).toBe(TILE_SIZE)
    expect(worldSize(11)).toBe(TILE_SIZE * 2048)
  })

  it('covers the viewport with tiles and clamps the vertical range', () => {
    const range = tileRangeFor(NYC_CENTER[0], NYC_CENTER[1], 11, 880, 600)

    expect(range.maxX).toBeGreaterThan(range.minX)
    expect(range.maxY).toBeGreaterThan(range.minY)
    expect(range.minY).toBeGreaterThanOrEqual(0)
    expect(range.maxY).toBeLessThanOrEqual(2 ** 11 - 1)
  })

  it('keeps a zoom inside the supported range', () => {
    expect(clampZoom(2)).toBe(MIN_ZOOM)
    expect(clampZoom(30)).toBe(MAX_ZOOM)
    expect(clampZoom(12)).toBe(12)
  })

  it('projects a published point near the viewport centre', () => {
    const screen = projectToScreen(NYC_CENTER[0], NYC_CENTER[1], NYC_CENTER[0], NYC_CENTER[1], 11, 880, 600)

    expect(screen.x).toBeCloseTo(440, 6)
    expect(screen.y).toBeCloseTo(300, 6)
  })

  it('moves a point left of centre when it is west of it', () => {
    const screen = projectToScreen(NYC_CENTER[0] - 0.05, NYC_CENTER[1], NYC_CENTER[0], NYC_CENTER[1], 11, 880, 600)

    expect(screen.x).toBeLessThan(440)
    expect(screen.y).toBeCloseTo(300, 6)
  })

  it('clamps the centre so the city cannot be panned away', () => {
    const clamped = clampCenter(-100, 10, NYC_BOUNDS)

    expect(clamped.lng).toBeGreaterThanOrEqual(NYC_BOUNDS[0][0] - 0.25)
    expect(clamped.lat).toBeGreaterThanOrEqual(NYC_BOUNDS[0][1] - 0.25)

    const inside = clampCenter(-73.97, 40.715, NYC_BOUNDS)
    expect(inside.lng).toBeCloseTo(-73.97, 6)
    expect(inside.lat).toBeCloseTo(40.715, 6)
  })
})
