/**
 * Date helpers shared by the shell and its modules.
 *
 * Every function here assumes a real `YYYY-MM-DD` date. `isRenderableIsoDate` exists because the
 * shell can briefly hold an empty date while a release's bounds are being applied, and formatting
 * that empty value throws `RangeError: Invalid time value` inside the render pass, which blanks the
 * whole application. Callers must gate on `isRenderableIsoDate` rather than format blindly.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** True only for a well-formed date that `Intl` can format. */
export const isRenderableIsoDate = (isoDate: string): boolean => {
  if (!ISO_DATE.test(isoDate)) return false
  return Number.isFinite(Date.parse(`${isoDate}T00:00:00Z`))
}

export const isoToTimestamp = (isoDate: string): number => {
  return Date.parse(`${isoDate}T00:00:00Z`)
}

export const timestampToIso = (timestamp: number): string => {
  return new Date(timestamp).toISOString().slice(0, 10)
}

export const formatDateLong = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(date)
    .toUpperCase()
}

export const formatDateShort = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
    .format(date)
    .toUpperCase()
}
