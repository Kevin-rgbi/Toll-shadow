import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QualityModule } from '../../src/features/quality/QualityModule'
import { parseAirQualityContext, parseNeighborhoodContext } from '../../src/features/quality/qualityData'
import { parseReleaseManifest } from '../../src/lib/releaseManifest'

const load = (name: string) => JSON.parse(readFileSync(new URL(`../../public/data/releases/2026-09-22.1/${name}`, import.meta.url), 'utf8'))
const release = parseReleaseManifest(load('manifest.json'))
const quality = parseAirQualityContext(load('air_quality_context.json'), 'quality fixture')
const neighborhood = parseNeighborhoodContext(load('neighborhood_context.geojson'), 'neighborhood fixture')

const render = (overrides = {}) => renderToStaticMarkup(createElement(QualityModule, {
  quality: { status: 'ready' as const, data: quality },
  neighborhood: { status: 'ready' as const, data: neighborhood },
  release,
  pollutant: 'PM' as const,
  onPollutantChange: () => undefined,
  siteSearch: '',
  onSiteSearchChange: () => undefined,
  selectedSiteKey: null,
  onSelectSite: () => undefined,
  ...overrides,
}))

describe('data quality and coverage module', () => {
  it('renders direct workbook facts and honest Westchester Square coverage', () => {
    const markup = render()
    expect(markup).toContain('Data quality and coverage')
    expect(markup).toContain('not a statistical confidence score')
    expect(markup).toContain('7,555')
    expect(markup).toContain('Westchester Square')
    expect(markup).toContain('0 historical sites inside')
    expect(markup).toContain('0 current monitors inside')
    expect(markup).toContain('12528-EJ')
    expect(markup).toContain('Hunts Point')
    expect(markup).toContain('outside the official boundary')
    expect(markup).toContain('nyccas_source_quality_coverage')
    expect(markup).toContain('westchester_square_monitor_coverage')
    expect(markup).not.toMatch(/high confidence|medium confidence|low confidence|% confidence/i)
  })

  it('renders failures without substituting figures', () => {
    const markup = render({ quality: { status: 'error', reason: 'checksum mismatch' } })
    expect(markup).toContain('checksum mismatch')
    expect(markup).not.toContain('7,555')
  })
})
