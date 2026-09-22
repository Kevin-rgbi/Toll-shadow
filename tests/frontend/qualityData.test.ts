import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseAirQualityContext, parseNeighborhoodContext } from '../../src/features/quality/qualityData'

const load = (name: string) => JSON.parse(readFileSync(new URL(`../../public/data/releases/2026-09-22.1/${name}`, import.meta.url), 'utf8'))

describe('NYCCAS quality asset', () => {
  it('parses direct source counts without raw concentration rows', () => {
    const context = parseAirQualityContext(load('air_quality_context.json'), 'quality fixture')
    expect(context.pollutants.PM.sourceRows).toBe(7555)
    expect(context.pollutants.EC.analyticFields.bc_conc).toEqual({ unit: 'ug/m3', present: 3237, missing: 4254 })
    expect(context.pollutants.NOX.qa.eitherFlag).toBe(1058)
    expect(context.pollutants.O3.sitePosts).toHaveLength(199)
    expect(context.pollutants.PM.sitePosts[0]).not.toHaveProperty('blk_corr_pm_ugm3')
  })

  it('rejects inconsistent arithmetic, duplicate site/posts, and invalid coordinates', () => {
    const badCount = load('air_quality_context.json')
    badCount.pollutants.PM.analytic_fields.blk_corr_pm_ugm3.present = 1
    expect(() => parseAirQualityContext(badCount, 'bad count')).toThrow(/present.*missing/i)

    const duplicate = load('air_quality_context.json')
    duplicate.pollutants.PM.site_posts.push(duplicate.pollutants.PM.site_posts[0])
    expect(() => parseAirQualityContext(duplicate, 'duplicate')).toThrow(/duplicate/i)

    const coordinate = load('air_quality_context.json')
    coordinate.pollutants.PM.site_posts[0].latitude = 999
    expect(() => parseAirQualityContext(coordinate, 'coordinate')).toThrow(/latitude/i)
  })
})

describe('Westchester Square neighborhood asset', () => {
  it('requires one official boundary and two explicitly outside nearest points', () => {
    const context = parseNeighborhoodContext(load('neighborhood_context.geojson'), 'neighborhood fixture')
    expect(context.area).toEqual({ id: 'BX1001', name: 'Westchester Square', borough: 'Bronx' })
    expect(context.coverage).toEqual({ historicalSitesInside: 0, currentMonitorsInside: 0 })
    expect(context.nearestHistorical).toMatchObject({ siteId: '12528-EJ', inside: false, distanceKm: 0.188 })
    expect(context.nearestCurrent).toMatchObject({ siteId: '36005NY11790', siteName: 'Hunts Point', inside: false, distanceKm: 3.314 })
  })

  it('rejects a mislabeled boundary or an inside nearest point', () => {
    const wrongArea = load('neighborhood_context.geojson')
    wrongArea.features[0].properties.nta2020 = 'BX9999'
    expect(() => parseNeighborhoodContext(wrongArea, 'wrong area')).toThrow(/BX1001/)

    const inside = load('neighborhood_context.geojson')
    inside.features[1].properties.inside = true
    expect(() => parseNeighborhoodContext(inside, 'inside')).toThrow(/outside/i)
  })
})
