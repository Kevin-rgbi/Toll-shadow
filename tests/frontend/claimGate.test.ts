import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AirContextModule } from '../../src/features/air/AirContextModule'
import { EquityContextModule } from '../../src/features/equity/EquityContextModule'
import type { AirContextSurface, EquityContext, HealthContext } from '../../src/types/releaseData'

/**
 * The claim gate the technical design document specifies.
 *
 * It names five conditions that a test must fail on before a production build. Four are enforced
 * elsewhere (the release gate refuses `synthetic: true`; the accessibility and module-state suites
 * cover missing provenance metadata and causal wording in the live modules; the asset budgets are
 * measured). This file covers the one that was not enforced anywhere: that a historical asthma or
 * NYCCAS value is never presented as a current or local outcome.
 *
 * It asserts the rendered markup rather than the source, because the claim a reader sees is the one
 * that matters, and a caveat that exists in a comment is not a caveat.
 */

const air: AirContextSurface = {
  pollutantLabel: 'black carbon, annual average (label inferred from the filename)',
  periodLabel: '2016 (inferred from the filename; not verified)',
  valuesNote: 'relative 0-1 within this surface; absolute units are not established',
  aggregation: '2x2 mean of the 300 m source cells, nodata masked',
  bounds: [-74.25, 40.5, -73.7, 40.92],
  width: 2,
  height: 2,
  grid: [[0.1, null], [0.75, 1]],
}

const health: HealthContext = {
  source: 'New York State Department of Health (archived extract)',
  geographyLabel: 'county, which for New York City is the borough',
  periodLabel: 'rolling multi-year periods ending 2019 or earlier',
  records: [{
    indicator: 'Hospitalizations',
    county: 'Bronx',
    borough: 'Bronx',
    period: '2017-2019',
    ageAdjustedRatePer10000: 22.5,
    annualAgeAdjustedRatePer10000: null,
    events: 1200,
    dailyMeanEvents: 1.1,
  }],
}

const equity: EquityContext = {
  vintage: '2023 disadvantaged-communities criteria (archived layer); the 2025 Version 2.0 update makes a current-designation claim unsupportable',
  geographyLabel: 'census tract polygons clipped to New York City',
  features: [{
    geoid: '36005000100',
    county: 'Bronx',
    population: 4215,
    vulnerabilityPercentile: 92.35,
    geometry: {
      type: 'Polygon',
      coordinates: [[[-73.9, 40.8], [-73.8, 40.8], [-73.8, 40.9], [-73.9, 40.8]]],
    },
  }],
}

const markup = (element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(element).replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ')

const airMarkup = markup(createElement(AirContextModule, {
  airState: { status: 'ready', data: air },
  healthState: { status: 'ready', data: health },
  release: null,
}))

const equityMarkup = markup(createElement(EquityContextModule, {
  state: { status: 'ready', data: equity },
  release: null,
}))

describe('historical context is never presented as a current or local outcome', () => {
  it('states the health figures are historical and county level', () => {
    expect(airMarkup).toContain('historical context')
    expect(airMarkup).toContain('ending 2019')
    expect(airMarkup).toContain('not a neighbourhood or post-policy outcome')
  })

  it('does not attach a 2025 or current claim to the health figures', () => {
    // The release window reaches 2025 and the policy date is 2025-01-05; neither belongs to a
    // historical asthma record, so a 2025 in this module's copy is a claim it cannot support.
    expect(airMarkup).not.toMatch(/\b2025\b/)

    // The module is allowed to deny a current claim, and it does. Strip the denials, and then any
    // remaining use of the word is an affirmative one, which is what this asserts against.
    const withoutDenials = airMarkup
      .replace(/not a current measurement/gi, '')
      .replace(/cannot be presented as a current status/gi, '')
      .replace(/not a neighbourhood or post-policy outcome/gi, '')
    expect(withoutDenials).not.toMatch(/\bcurrent\b/i)
  })

  it('publishes the air surface as a relative field, never as a measurement', () => {
    expect(airMarkup).toContain('relative')
    expect(airMarkup).toMatch(/no .{0,40}concentration/i)
    expect(airMarkup).not.toMatch(/\b(ug\/m3|µg\/m3|ppb|ppm)\b/i)
  })

  it('labels the air value as inferred rather than verified', () => {
    expect(airMarkup).toContain('inferred')
    expect(airMarkup).toContain('not verified')
  })

  it('labels the equity layer as an archived vintage, not a current designation', () => {
    expect(equityMarkup).toMatch(/historical/i)
    expect(equityMarkup).toContain('2025 criteria revision')
    expect(equityMarkup).toMatch(/cannot be presented as a current status/i)
  })

  it('carries no causal or effect language about either context layer', () => {
    for (const text of [airMarkup, equityMarkup]) {
      expect(text).not.toMatch(/\bcaused?\b|\bdrives?\b|\bimpact\b|\beffect of\b/i)
    }
  })
})
