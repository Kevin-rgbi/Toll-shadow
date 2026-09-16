import { describe, expect, it } from 'vitest'
import {
  formatDateLong,
  formatDateShort,
  isRenderableIsoDate,
  isoToTimestamp,
  timestampToIso,
} from '../../src/lib/dateFormat'

/**
 * Regression guard for the cold-load crash.
 *
 * The application once rendered the timeline footer while its selected date was still an empty
 * string, and formatting that value threw `RangeError: Invalid time value` inside the render pass.
 * React then unmounted the whole tree, so a deep link to any module tab produced a blank page.
 * `isRenderableIsoDate` is the gate that prevents it; these tests pin both the gate and the hazard.
 */
describe('date formatting', () => {
  it('accepts only well-formed, parseable dates', () => {
    expect(isRenderableIsoDate('2025-12-31')).toBe(true)
    expect(isRenderableIsoDate('2024-02-29')).toBe(true)

    expect(isRenderableIsoDate('')).toBe(false)
    expect(isRenderableIsoDate('2025-12')).toBe(false)
    expect(isRenderableIsoDate('31-12-2025')).toBe(false)
    expect(isRenderableIsoDate('not-a-date')).toBe(false)
    expect(isRenderableIsoDate('2025-13-01')).toBe(false)
  })

  it('throws when formatting an empty date, which is why callers must gate on the check', () => {
    expect(() => formatDateLong('')).toThrow(RangeError)
    expect(() => formatDateShort('')).toThrow(RangeError)
  })

  it('formats a real date in UTC regardless of the host timezone', () => {
    expect(formatDateLong('2025-01-05')).toBe('JAN 05, 2025')
    expect(formatDateShort('2025-01-05')).toBe('JAN 25')
  })

  it('round-trips a timestamp back to its date', () => {
    const timestamp = isoToTimestamp('2025-01-05')

    expect(Number.isFinite(timestamp)).toBe(true)
    expect(timestampToIso(timestamp)).toBe('2025-01-05')
  })
})
