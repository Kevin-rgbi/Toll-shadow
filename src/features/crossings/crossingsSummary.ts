/**
 * Descriptive summaries over the published MTA facility-crossing asset.
 *
 * The published grain is one calendar day, toll plaza, and direction. Aggregating across days is a
 * plain sum of published daily counts, so the result is "vehicles counted at these plazas over this
 * window", never an hourly rate or a policy effect.
 *
 * Facility names are deliberately absent: the release publishes plaza identifiers only, and the
 * verified mapping for plazas 21-30 is still an open provenance item
 * (`docs/TOLL_SHADOW_MHC_EVENT_AUDIT.md`, problem 5). The UI must not invent a bridge name.
 */

import type { FacilityCrossing } from '../../types/releaseData'

export interface PlazaSummary {
  plazaId: number
  /** From the source register, so a summary is never a bare identifier. */
  facilityName: string
  facilityCode: string
  /** Published daily rows behind this summary. */
  publishedDays: number
  totalVehicles: number
  ezpassVehicles: number
  tollsByMailVehicles: number
  /** Share recomputed from summed published components, not averaged from daily shares. */
  ezpassSharePct: number | null
  firstObservedOn: string
  lastObservedOn: string
}

export interface DirectionSummary {
  direction: string
  publishedDays: number
  totalVehicles: number
  ezpassSharePct: number | null
}

export interface CrossingsWindow {
  start: string
  end: string
  publishedDays: number
  totalVehicles: number
  plazaCount: number
}

export const crossingsDateBounds = (
  crossings: FacilityCrossing[],
): { start: string, end: string } | null => {
  if (crossings.length === 0) return null

  const dates = crossings.map((crossing) => crossing.observedOn).sort()
  return { start: dates[0], end: dates[dates.length - 1] }
}

/** Inclusive ISO-date range filter; blank bounds leave that side open. */
export const filterCrossingsByDateRange = (
  crossings: FacilityCrossing[],
  start: string,
  end: string,
): FacilityCrossing[] => {
  return crossings.filter((crossing) => {
    if (start && crossing.observedOn < start) return false
    if (end && crossing.observedOn > end) return false
    return true
  })
}

/** Returns null when the empty selection cannot describe a window. */
export const summarizeCrossingsWindow = (
  crossings: FacilityCrossing[],
): CrossingsWindow | null => {
  const bounds = crossingsDateBounds(crossings)
  if (!bounds) return null

  return {
    start: bounds.start,
    end: bounds.end,
    publishedDays: crossings.length,
    totalVehicles: crossings.reduce((total, crossing) => total + crossing.totalVehicles, 0),
    plazaCount: new Set(crossings.map((crossing) => crossing.plazaId)).size,
  }
}

export const summarizeCrossingsByPlaza = (crossings: FacilityCrossing[]): PlazaSummary[] => {
  const byPlaza = new Map<number, FacilityCrossing[]>()

  for (const crossing of crossings) {
    const group = byPlaza.get(crossing.plazaId)
    if (group) group.push(crossing)
    else byPlaza.set(crossing.plazaId, [crossing])
  }

  return [...byPlaza.entries()]
    .map(([plazaId, rows]) => {
      const ezpassVehicles = rows.reduce((total, row) => total + (row.ezpassVehicles ?? 0), 0)
      const tollsByMailVehicles = rows.reduce((total, row) => total + (row.tollsByMailVehicles ?? 0), 0)
      const totalVehicles = rows.reduce((total, row) => total + row.totalVehicles, 0)
      const dates = rows.map((row) => row.observedOn).sort()

      return {
        plazaId,
        facilityName: rows[0].facilityName,
        facilityCode: rows[0].facilityCode,
        publishedDays: rows.length,
        totalVehicles,
        ezpassVehicles,
        tollsByMailVehicles,
        ezpassSharePct: rows.every((row) => row.paymentCoverageComplete) && totalVehicles > 0 ? (ezpassVehicles / totalVehicles) * 100 : null,
        firstObservedOn: dates[0],
        lastObservedOn: dates[dates.length - 1],
      }
    })
    .sort((left, right) => right.totalVehicles - left.totalVehicles)
}

export const summarizeCrossingsByDirection = (crossings: FacilityCrossing[]): DirectionSummary[] => {
  const directions = [...new Set(crossings.map((crossing) => crossing.direction))]

  return directions
    .map((direction) => {
      const rows = crossings.filter((crossing) => crossing.direction === direction)
      const ezpassVehicles = rows.reduce((total, row) => total + (row.ezpassVehicles ?? 0), 0)
      const totalVehicles = rows.reduce((total, row) => total + row.totalVehicles, 0)

      return {
        direction,
        publishedDays: rows.length,
        totalVehicles,
        ezpassSharePct: rows.every((row) => row.paymentCoverageComplete) && totalVehicles > 0 ? (ezpassVehicles / totalVehicles) * 100 : null,
      }
    })
    .filter((summary) => summary.publishedDays > 0)
}

export const directionLabel = (direction: string): string => {
  if (direction === 'I') return 'Inbound (I)'
  if (direction === 'O') return 'Outbound (O)'
  return direction
}
