import { describe, expect, it } from 'vitest'
import {
  classifyTrafficEffect,
  monitorRadiusFromZoomAndEffect,
  opacityFromConfidence,
  roadWidthFromEffect,
} from '../../src/lib/visualEncoding'

describe('visualEncoding classification', () => {
  it('classifies boundary effects correctly', () => {
    expect(classifyTrafficEffect(-0.02)).toBe('improved')
    expect(classifyTrafficEffect(-0.01)).toBe('improved')
    expect(classifyTrafficEffect(0)).toBe('no_material_change')
    expect(classifyTrafficEffect(0.009)).toBe('no_material_change')
    expect(classifyTrafficEffect(0.01)).toBe('worsened')
  })
})

describe('visualEncoding scales', () => {
  it('clamps opacity to configured range', () => {
    expect(opacityFromConfidence(-1)).toBeCloseTo(0.2)
    expect(opacityFromConfidence(0)).toBeCloseTo(0.2)
    expect(opacityFromConfidence(1)).toBeCloseTo(0.95)
    expect(opacityFromConfidence(99)).toBeCloseTo(0.95)
  })

  it('maps road width from effect magnitude and intensity', () => {
    const low = roadWidthFromEffect(0, 1)
    const high = roadWidthFromEffect(0.2, 1)
    const faded = roadWidthFromEffect(0.15, 0.2)

    expect(low).toBeCloseTo(1.8)
    expect(high).toBeCloseTo(8.2)
    expect(faded).toBeLessThan(high)
  })

  it('increases monitor radius with effect and zoom', () => {
    const low = monitorRadiusFromZoomAndEffect(9, 0, 1)
    const high = monitorRadiusFromZoomAndEffect(15, 0.5, 1)
    expect(high).toBeGreaterThan(low)
  })
})
