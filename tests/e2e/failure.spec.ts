import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

/**
 * The release contract says a missing, malformed, or unvalidated manifest fails clearly (FR-01).
 *
 * "Clearly" means the reader sees no figures at all. The dangerous outcome is a shell that renders
 * yesterday's or an empty data view while the manifest behind it is broken, so each case asserts the
 * absence of published figures as well as the presence of an explanation.
 */

const FIGURE_TEXT = /Showing\s+[\d,]+\s+of|published aggregates|per 10,000|tracts/

test('an unpublished manifest shows the failure state, not figures', async ({ page }) => {
  await page.route('**/data/manifest.json*', (route) => route.fulfill({ status: 404, body: 'not found' }))
  await page.goto('/?module=TRAFFIC')

  const card = page.locator('.module-card')
  await expect(card).toBeVisible()

  const text = (await card.innerText()).replace(/\s+/g, ' ')
  expect(text, 'a module rendered figures while the manifest was missing').not.toMatch(FIGURE_TEXT)
  expect(text, 'the module did not say why it is empty').toMatch(/not available|could not|no .*published/i)
})

test('a malformed manifest is refused rather than rendered', async ({ page }) => {
  await page.route('**/data/manifest.json*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{ "release_id": ' }),
  )
  await page.goto('/?module=CROSSINGS')

  const text = (await page.locator('.module-card').innerText()).replace(/\s+/g, ' ')
  expect(text, 'a module rendered figures from a manifest it could not parse').not.toMatch(FIGURE_TEXT)
})

test('a manifest that is not validated is refused', async ({ page }) => {
  // Read the shipped manifest from disk and re-serve it with its status downgraded. Fetching it
  // through the route would leave an async handler in flight when the test ends.
  const shipped = JSON.parse(readFileSync('dist/data/manifest.json', 'utf8'))
  shipped.status = 'unvalidated'
  await page.route('**/data/manifest.json*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(shipped) }),
  )
  await page.goto('/?module=CRZ')

  const text = (await page.locator('.module-card').innerText()).replace(/\s+/g, ' ')
  expect(text, 'a module rendered figures from an unvalidated manifest').not.toMatch(FIGURE_TEXT)
})

test('a missing asset fails its module instead of showing a partial figure', async ({ page }) => {
  await page.route('**/data/releases/**/*', (route) => route.fulfill({ status: 404, body: 'not found' }))
  await page.goto('/?module=EQUITY')

  await expect(page.locator('.module-card')).toContainText(/could not|not available|no .*published/i)
  await expect(page.locator('.equity-map-tract')).toHaveCount(0)
})
