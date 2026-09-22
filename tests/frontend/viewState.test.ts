import { describe, expect, it } from 'vitest'
import { buildViewStateQuery, readViewState } from '../../src/lib/viewState'

describe('view state in the URL', () => {
  it('reads a full shared view', () => {
    const state = readViewState(
      '?module=TRAFFIC&date=2025-03-15&borough=Queens&crossingsFrom=2024-01-01&crossingsTo=2024-06-30',
    )

    expect(state).toEqual({
      mode: 'TRAFFIC',
      date: '2025-03-15',
      borough: 'Queens',
      dayType: null,
      timeBand: null,
      crossingsStart: '2024-01-01',
      crossingsEnd: '2024-06-30',
      airGranularity: null,
      airTime: null,
      build: null,
      map: null,
      hotspotRanking: null,
      qualityPollutant: null,
      qualitySite: null,
    })
  })

  it('drops an unrecognised module rather than applying it', () => {
    expect(readViewState('?module=NOT_A_MODULE').mode).toBeNull()
    expect(readViewState('?module=traffic').mode).toBeNull()
  })

  it('drops malformed dates rather than applying them', () => {
    const state = readViewState('?date=2025-3-5&crossingsFrom=not-a-date')

    expect(state.date).toBeNull()
    expect(state.crossingsStart).toBeNull()
  })

  it('treats a blank filter as absent, not as an empty selection', () => {
    expect(readViewState('?borough=%20%20').borough).toBeNull()
  })

  it('reports the default state for an empty query', () => {
    expect(readViewState('')).toEqual({
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
      hotspotRanking: null,
      qualityPollutant: null,
      qualitySite: null,
    })
  })

  it('omits the default module and empty values when building a query', () => {
    expect(buildViewStateQuery({
      mode: 'STORY',
      date: null,
      borough: null,
      crossingsStart: null,
      crossingsEnd: null,
    })).toBe('')

    expect(buildViewStateQuery({
      mode: 'CROSSINGS',
      date: '2025-01-05',
      borough: null,
      crossingsStart: null,
      crossingsEnd: null,
    })).toBe('?module=CROSSINGS&date=2025-01-05')
  })

  it('writes the build into the link and reads it back', () => {
    const query = buildViewStateQuery({
      mode: 'TRAFFIC',
      date: null,
      borough: null,
      dayType: null,
      timeBand: null,
      crossingsStart: null,
      crossingsEnd: null,
      build: '20260916-0420-abc1234',
    })

    expect(query).toContain('v=20260916-0420-abc1234')
    expect(readViewState(query).build).toBe('20260916-0420-abc1234')
  })

  it('round-trips a view through the URL', () => {
    const original = {
      mode: 'TRAFFIC' as const,
      date: '2025-11-30',
      borough: 'Bronx',
      crossingsStart: '2024-02-01',
      crossingsEnd: '2024-03-01',
      airGranularity: null,
      airTime: null,
    }

    expect(readViewState(buildViewStateQuery(original))).toEqual({
      mode: 'TRAFFIC',
      date: '2025-11-30',
      borough: 'Bronx',
      dayType: null,
      timeBand: null,
      crossingsStart: '2024-02-01',
      crossingsEnd: '2024-03-01',
      airGranularity: null,
      airTime: null,
      build: null,
      map: null,
      hotspotRanking: null,
      qualityPollutant: null,
      qualitySite: null,
    })
  })

  it('round-trips measured-air resolution and timestamp', () => {
    const query = buildViewStateQuery({
      mode: 'AIR',
      date: null,
      borough: null,
      dayType: null,
      timeBand: null,
      crossingsStart: null,
      crossingsEnd: null,
      airGranularity: 'hourly',
      airTime: '2026-09-08T23:00:00.000Z',
      build: null,
      map: null,
    })
    expect(readViewState(query)).toMatchObject({
      mode: 'AIR',
      airGranularity: 'hourly',
      airTime: '2026-09-08T23:00:00.000Z',
    })
  })

  it('round-trips quality and hotspot selections and rejects unknown values', () => {
    const query = buildViewStateQuery({
      mode: 'CONFIDENCE',
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
      hotspotRanking: 'maximum',
      qualityPollutant: 'NOX',
      qualitySite: '12528-EJ:1',
    })

    expect(readViewState(query)).toMatchObject({
      hotspotRanking: 'maximum',
      qualityPollutant: 'NOX',
      qualitySite: '12528-EJ:1',
    })
    expect(readViewState('?rank=causal&pollutant=CO')).toMatchObject({
      hotspotRanking: null,
      qualityPollutant: null,
    })
  })
})
