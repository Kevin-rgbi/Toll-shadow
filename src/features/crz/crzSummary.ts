/**
 * Descriptive summaries over the published CRZ entry asset.
 *
 * The published grain is one month per detection group, so every figure here is a sum of published
 * monthly sums. Detection groups are areas, not detector points, and the asset cannot support an
 * hourly view.
 */

import type { CrzEntrySummary } from '../../types/releaseData'

export interface CrzGroupSummary {
  detectionGroup: string
  detectionRegion: string
  publishedMonths: number
  crzEntries: number
  excludedRoadwayEntries: number
  totalEntries: number
  firstMonth: string
  lastMonth: string
}

export interface CrzWindowSummary {
  start: string
  end: string
  publishedMonths: number
  groupCount: number
  crzEntries: number
  excludedRoadwayEntries: number
  totalEntries: number
}

export const crzMonthBounds = (entries: CrzEntrySummary[]): { start: string, end: string } | null => {
  if (entries.length === 0) return null
  const months = entries.map((entry) => entry.month).sort()
  return { start: months[0], end: months[months.length - 1] }
}

export const summarizeCrzWindow = (entries: CrzEntrySummary[]): CrzWindowSummary | null => {
  const bounds = crzMonthBounds(entries)
  if (!bounds) return null

  return {
    start: bounds.start,
    end: bounds.end,
    publishedMonths: new Set(entries.map((entry) => entry.month)).size,
    groupCount: new Set(entries.map((entry) => entry.detectionGroup)).size,
    crzEntries: entries.reduce((total, entry) => total + entry.crzEntries, 0),
    excludedRoadwayEntries: entries.reduce((total, entry) => total + entry.excludedRoadwayEntries, 0),
    totalEntries: entries.reduce((total, entry) => total + entry.totalEntries, 0),
  }
}

export const summarizeCrzByGroup = (entries: CrzEntrySummary[]): CrzGroupSummary[] => {
  const byGroup = new Map<string, CrzEntrySummary[]>()

  for (const entry of entries) {
    const group = byGroup.get(entry.detectionGroup)
    if (group) group.push(entry)
    else byGroup.set(entry.detectionGroup, [entry])
  }

  return [...byGroup.entries()]
    .map(([detectionGroup, rows]) => {
      const months = rows.map((row) => row.month).sort()
      return {
        detectionGroup,
        detectionRegion: rows[0].detectionRegion,
        publishedMonths: months.length,
        crzEntries: rows.reduce((total, row) => total + row.crzEntries, 0),
        excludedRoadwayEntries: rows.reduce((total, row) => total + row.excludedRoadwayEntries, 0),
        totalEntries: rows.reduce((total, row) => total + row.totalEntries, 0),
        firstMonth: months[0],
        lastMonth: months[months.length - 1],
      }
    })
    .sort((left, right) => right.crzEntries - left.crzEntries)
}
