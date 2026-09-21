import { expect, test } from '@playwright/test'

/**
 * Every module that the release publishes an asset for has to render published values.
 *
 * The failure this guards against is the one that reached production twice: a module that renders
 * its frame and its caveats while the data behind it failed to parse, so the page looks finished
 * and shows nothing. Each case therefore asserts both halves - a parsed figure is present, and no
 * failure or loading state is left on screen - rather than only that the card exists.
 */

const FAILURE_TEXT = [
  'ASSET_MALFORMED',
  'ASSET_',
  'MANIFEST_',
  'could not be loaded',
  'Not available for this claim',
  'nothing to show',
]

test.describe('published modules render published values', () => {
  const cases: { mode: string; metric: string }[] = [
    { mode: 'TRAFFIC', metric: '.analysis-metrics' },
    { mode: 'CROSSINGS', metric: '.analysis-metrics' },
    { mode: 'CRZ', metric: '.analysis-metrics' },
    { mode: 'AIR', metric: '.air-surface-canvas' },
    { mode: 'EQUITY', metric: '.analysis-metrics' },
  ]

  for (const { mode, metric } of cases) {
    test(`${mode} renders its published values`, async ({ page }) => {
      await page.goto(`/?module=${mode}`)

      const card = page.locator('.module-card')
      await expect(card.locator(metric).first()).toBeVisible()

      const text = (await card.innerText()).replace(/\s+/g, ' ')
      for (const marker of FAILURE_TEXT) {
        expect(text, `${mode} shows a failure state: ${marker}`).not.toContain(marker)
      }
      expect(text, `${mode} is still reporting a loading state`).not.toMatch(/Reading the published/i)

      // A parsed figure, not an empty frame. The provenance block carries a metrics list of its
      // own, so read the module's first list, which is the one the module populates from the asset.
      if (mode !== 'AIR') {
        const values = await card.locator('.analysis-metrics').first().locator('dd').allInnerTexts()
        expect(values.length, `${mode} publishes no metric values`).toBeGreaterThan(0)
        expect(
          values.some((value) => /\d/.test(value)),
          `${mode} publishes metric labels with no figures behind them`,
        ).toBe(true)
      }
    })
  }

  test('the equity module draws its published geography', async ({ page }) => {
    await page.goto('/?module=EQUITY')
    const tracts = page.locator('.equity-map-tract')
    await expect(tracts.first()).toBeVisible()
    // A single tract would mean the geometry parsed but the feature list did not.
    expect(await tracts.count()).toBeGreaterThan(1)
  })

  test('the air module paints its published surface', async ({ page }) => {
    await page.goto('/?module=AIR')

    const painted = await page.locator('.air-surface-canvas').evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement
      const context = element.getContext('2d')
      if (!context) return 0
      const { data } = context.getImageData(0, 0, element.width, element.height)
      let opaque = 0
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque += 1
      return opaque
    })

    expect(painted, 'the air canvas exists but nothing was drawn on it').toBeGreaterThan(0)
  })

  test('every module attributes its values to the published release', async ({ page }) => {
    for (const mode of ['TRAFFIC', 'CROSSINGS', 'CRZ', 'AIR', 'EQUITY']) {
      await page.goto(`/?module=${mode}`)
      // The asset is fetched after the shell paints, so wait for the module to be populated before
      // counting what it renders.
      await expect(page.locator('.module-card .analysis-metrics, .module-card .air-surface-canvas').first())
        .toBeVisible()

      // A module can publish more than one asset and so carries one block per asset; every block has
      // to stand on its own.
      const provenance = page.locator('.module-card .module-provenance')
      expect(await provenance.count(), `${mode} publishes a value with no source and method block`)
        .toBeGreaterThan(0)

      for (const block of await provenance.all()) {
        await expect(block).toContainText('Source and method')

        // FR-07 names the fields, so assert the fields rather than only the heading, and assert they
        // carry the release's own values rather than placeholders.
        for (const field of ['Coverage', 'Grain', 'Transform', 'Checksum', 'Source register']) {
          await expect(block, `${mode} provenance is missing ${field}`).toContainText(field)
        }
        await expect(block).toContainText('pipeline-release-')
        await expect(block).toContainText('sha256')
        await expect(block).toContainText('Limitations of this asset')
      }
    }
  })
})
