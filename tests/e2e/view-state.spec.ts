import { expect, test } from '@playwright/test'

/**
 * FR-08: the selected module and the supported filter state live in the URL.
 *
 * A deep link is the whole point of that requirement, so these tests open the link cold and check
 * that the view the link asked for is the view that renders, and that interaction writes the state
 * back for the next reader to share.
 */

const moduleCard = (page: import('@playwright/test').Page) => page.locator('.module-card')

test('a deep link opens the module it names', async ({ page }) => {
  await page.goto('/?module=CROSSINGS')

  await expect(page.locator('.mode-tab[aria-pressed="true"]')).toHaveText('CROSSINGS')
  await expect(moduleCard(page)).toContainText('crossing', { ignoreCase: true })
})

test('a filter carried on the link is applied, not ignored', async ({ page }) => {
  await page.goto('/?module=TRAFFIC&borough=Queens')

  await expect(page.locator('.mode-tab[aria-pressed="true"]')).toHaveText('TRAFFIC')
  const borough = page.locator('.module-filter-row label', { hasText: 'Borough' }).locator('select')
  await expect(borough).toHaveValue('Queens')
})

test('choosing a module writes it to the URL and survives a reload', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'CRZ', exact: true }).click()
  await expect(page).toHaveURL(/module=CRZ/)
  await expect(page.locator('.mode-tab[aria-pressed="true"]')).toHaveText('CRZ')

  await page.reload()
  await expect(page.locator('.mode-tab[aria-pressed="true"]')).toHaveText('CRZ')
  await expect(moduleCard(page)).toContainText('CRZ entry', { ignoreCase: true })
})

test('the module is addressable by parameter alone, with no in-page interaction', async ({ page }) => {
  for (const mode of ['TRAFFIC', 'CRZ', 'AIR', 'EQUITY']) {
    await page.goto(`/?module=${mode}`)
    await expect(page.locator('.mode-tab[aria-pressed="true"]')).toHaveText(mode)
    await expect(moduleCard(page).first()).toBeVisible()
  }
})

test('measured AIR resolution and timestamp survive a deep link', async ({ page }) => {
  await page.goto('/?module=AIR&air=hourly&airTime=2026-09-08T23%3A00%3A00.000Z')
  await expect(page.getByLabel('Resolution')).toHaveValue('hourly')
  await expect(page.locator('.air-timeline-period')).toContainText('Sep 08, 2026')
  await expect(page).toHaveURL(/air=hourly/)
  const rates = await page.locator('.air-rate-control option').allTextContents()
  expect(rates).toEqual(['0.5×', '1×', '2×', '4×'])
})

test('STORY uses published measured-air points and timeline', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.air-timeline-shell')).toBeVisible()
  const map = page.locator('.map-shell, .raster-map-wrap').first()
  await expect(map).toBeVisible()

  const gpuReadout = page.locator('.map-renderer-note')
  const softwareMap = page.locator('.raster-map-wrap')
  await expect(gpuReadout.or(softwareMap).first()).toBeVisible()

  if (await softwareMap.count() > 0) {
    await expect(softwareMap.getByRole('region')).toHaveAttribute('aria-label', /15 published points/)
  } else {
    await expect(gpuReadout).toContainText(/points in view|checking what is on screen/)
  }
})
