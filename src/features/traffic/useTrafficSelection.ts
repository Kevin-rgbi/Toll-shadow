import { useMemo } from 'react'
import type { ReleaseAssetState } from '../../hooks/useReleaseAsset'
import type { TrafficDayType, TrafficObservation } from '../../types/releaseData'
import { rankTrafficHotspots, trafficHotspotKey, type HotspotRanking } from '../hotspots/hotspotRanking'
import {
  filterTrafficByBorough,
  filterTrafficByDayType,
  filterTrafficByMonth,
  filterTrafficByTimeBand,
  listBoroughs,
  listDayTypes,
  listTimeBands,
  listTrafficMonths,
  monthFromIsoDate,
  toTrafficFeatureCollection,
} from './trafficSummary'

const NO_OBSERVATIONS: TrafficObservation[] = []

interface TrafficSelectionOptions {
  state: ReleaseAssetState<TrafficObservation[]>
  currentDateIso: string
  initialDate: string | null
  borough: string | null
  dayType: TrafficDayType | null
  timeBand: string | null
  ranking: HotspotRanking
  selectedHotspotId: string | null
}

const withAppliedValue = <T extends string>(options: T[], applied: T | null): T[] => {
  if (!applied || options.includes(applied)) return options
  return [...options, applied].sort((left, right) => left.localeCompare(right))
}

/** Keeps the traffic panel, hotspot ranking, and published map layer on one filtered selection. */
export function useTrafficSelection(options: TrafficSelectionOptions) {
  const observations = options.state.status === 'ready' ? options.state.data : NO_OBSERVATIONS
  const months = useMemo(() => listTrafficMonths(observations), [observations])
  const requestedMonth = monthFromIsoDate(options.currentDateIso || options.initialDate || '')
  const month = months.includes(requestedMonth) ? requestedMonth : months.at(-1) ?? ''
  const forMonth = useMemo(() => filterTrafficByMonth(observations, month), [month, observations])
  const selected = useMemo(
    () => filterTrafficByTimeBand(
      filterTrafficByDayType(filterTrafficByBorough(forMonth, options.borough), options.dayType),
      options.timeBand,
    ),
    [forMonth, options.borough, options.dayType, options.timeBand],
  )
  const boroughOptions = useMemo(
    () => listBoroughs(filterTrafficByTimeBand(filterTrafficByDayType(forMonth, options.dayType), options.timeBand)),
    [forMonth, options.dayType, options.timeBand],
  )
  const dayTypeOptions = useMemo(
    () => listDayTypes(filterTrafficByTimeBand(filterTrafficByBorough(forMonth, options.borough), options.timeBand)),
    [forMonth, options.borough, options.timeBand],
  )
  const timeBandOptions = useMemo(
    () => listTimeBands(filterTrafficByDayType(filterTrafficByBorough(forMonth, options.borough), options.dayType)),
    [forMonth, options.borough, options.dayType],
  )
  const features = useMemo(() => selected.length > 0 ? toTrafficFeatureCollection(selected) : null, [selected])
  const ranked = useMemo(() => rankTrafficHotspots(selected, options.ranking), [options.ranking, selected])
  const selectedHotspot = ranked.find((observation) => trafficHotspotKey(observation) === options.selectedHotspotId)
    ?? ranked[0]
    ?? null

  return {
    observations,
    months,
    month,
    forMonth,
    selected,
    features,
    boroughOptions: withAppliedValue(boroughOptions, options.borough),
    dayTypeOptions: withAppliedValue(dayTypeOptions, options.dayType),
    timeBandOptions: withAppliedValue(timeBandOptions, options.timeBand),
    selectedHotspot,
    selectedHotspotKey: selectedHotspot ? trafficHotspotKey(selectedHotspot) : null,
  }
}
