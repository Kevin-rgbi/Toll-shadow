/**
 * Shareable view state (PRD FR-08).
 *
 * The encoder writes the selected module and the supported filters into the query string so a
 * reviewer can link to an exact view. The decoder is deliberately forgiving about *shape* and
 * strict about *meaning*: an unrecognised module or a malformed date is dropped rather than applied,
 * and it never fabricates a filter value. URL state is presentation only: it can select among
 * published data, and it never introduces data the release did not publish.
 */

import { readComparison, writeComparison } from '../features/traffic/monthlyComparison'
import type { ComparisonSelection } from '../features/traffic/monthlyComparison'
import { APP_MODES } from '../state/appStore'
import type { AppMode } from '../state/appStore'
import { TRAFFIC_DAY_TYPES, TRAFFIC_TIME_BANDS } from '../types/releaseData'
import type { TrafficDayType } from '../types/releaseData'
import type { AirGranularity } from '../types/air'
import { readMapPreference } from './mapPreference'
import type { MapPreference } from './mapPreference'

export interface ViewState {
  comparisonSelection?: ComparisonSelection
  mode: AppMode | null
  /** Selected timeline date, `YYYY-MM-DD`. */
  date: string | null
  borough: string | null
  dayType: TrafficDayType | null
  timeBand: string | null
  crossingsStart: string | null
  crossingsEnd: string | null
  airGranularity: AirGranularity | null
  /** Selected measured-air timestamp. Daily links may use a YYYY-MM-DD date. */
  airTime: string | null
  /** Build identity the link was generated from. Written on save, never read as view state. */
  build: string | null
  /** Renderer choice. Carried in the URL so it survives the address-bar rewrite on first paint. */
  map: MapPreference | null
}

export const EMPTY_VIEW_STATE: ViewState = {
  mode: null,
  date: null,
  borough: null,
  dayType: null,
  timeBand: null,
  crossingsStart: null,
  crossingsEnd: null,
  airGranularity: null,
  airTime: null,
  build: null,
  map: null,
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const asIsoDate = (value: string | null): string | null => {
  return value && ISO_DATE.test(value) ? value : null
}

const asAirTime = (value: string | null): string | null => {
  if (!value) return null
  return ISO_DATE.test(value) || Number.isFinite(Date.parse(value)) ? value : null
}

const asMode = (value: string | null): AppMode | null => {
  if (!value) return null
  return (APP_MODES as readonly string[]).includes(value) ? value as AppMode : null
}

const asText = (value: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

const asDayType = (value: string | null): TrafficDayType | null => {
  const text = asText(value)
  if (!text) return null
  return TRAFFIC_DAY_TYPES.includes(text as TrafficDayType) ? text as TrafficDayType : null
}

const asTimeBand = (value: string | null): string | null => {
  const text = asText(value)
  if (!text) return null
  return (TRAFFIC_TIME_BANDS as readonly string[]).includes(text) ? text : null
}

export const readViewState = (search: string): ViewState => {
  const params = new URLSearchParams(search)

  return {
    ...(params.has('baseline') || params.has('comparison') || params.has('months') || params.has('period') || params.has('layers') || params.has('search') ? { comparisonSelection: readComparison(params) } : {}),
    mode: asMode(params.get('module')),
    date: asIsoDate(params.get('date')),
    borough: asText(params.get('borough')),
    dayType: asDayType(params.get('day')),
    timeBand: asTimeBand(params.get('band')),
    crossingsStart: asIsoDate(params.get('crossingsFrom')),
    crossingsEnd: asIsoDate(params.get('crossingsTo')),
    airGranularity: params.get('air') === 'daily' || params.get('air') === 'hourly'
      ? params.get('air') as AirGranularity
      : null,
    airTime: asAirTime(params.get('airTime')),
    build: asText(params.get('v')),
    map: readMapPreference(search),
  }
}

/** Reads the current location, tolerating environments without a DOM (static render, tests). */
export const readViewStateFromLocation = (): ViewState => {
  if (typeof window === 'undefined') return EMPTY_VIEW_STATE
  return readViewState(window.location.search)
}

/**
 * Builds the query string for a view. Values equal to the default view are omitted so the shared URL
 * stays short and a bare URL keeps meaning "the default view".
 */
export const buildViewStateQuery = (state: ViewState): string => {
  const params = new URLSearchParams()

  if (state.mode && state.mode !== 'STORY') params.set('module', state.mode)
  if (state.date) params.set('date', state.date)
  if (state.borough) params.set('borough', state.borough)
  if (state.dayType) params.set('day', state.dayType)
  if (state.timeBand) params.set('band', state.timeBand)
  if (state.crossingsStart) params.set('crossingsFrom', state.crossingsStart)
  if (state.crossingsEnd) params.set('crossingsTo', state.crossingsEnd)
  if (state.airGranularity && state.airGranularity !== 'daily') params.set('air', state.airGranularity)
  if (state.airTime) params.set('airTime', state.airTime)
  if (state.build) params.set('v', state.build)
  if (state.map) params.set('map', state.map)
  if (state.comparisonSelection) writeComparison(params, state.comparisonSelection)

  const query = params.toString()
  return query === '' ? '' : `?${query}`
}
