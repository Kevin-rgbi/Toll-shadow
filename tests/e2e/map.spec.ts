import { expect, test } from '@playwright/test'

/**
 * The map has exactly one renderer, and whichever one it is, the reader is told what it is.
 *
 * Which renderer a machine takes is not the contract: a GPU host mounts the WebGL map and a headless
 * one falls back to the raster map, and the fallback can happen *after* first paint when the render
 * watchdog gives up on a context that never paints. Committing the suite to one branch would pass or
 * fail by machine and would race the watchdog, so the tests assert the invariant instead: one
 * surface, a named renderer behind it, and no silent rectangle.
 */

test('exactly one map renderer is mounted', async ({ page }) => {
  await page.goto('/?module=TRAFFIC')

  const interactive = page.locator('.map-shell')
  const raster = page.locator('.raster-map-wrap')

  await expect(interactive.or(raster).first()).toBeVisible()
  await expect
    .poll(async () => (await interactive.count()) + (await raster.count()), {
      message: 'the page mounted both renderers, or neither',
    })
    .toBe(1)
})

test('the reader is told which renderer is live, and why when it fell back', async ({ page }) => {
  await page.goto('/?module=TRAFFIC')

  const note = page.locator('.map-renderer-note')
  const notice = page.locator('.raster-map-notice')

  await expect(note.or(notice).first()).toBeVisible({ timeout: 30_000 })

  if (await notice.count() > 0) {
    // The software path has to name its reason; a fallback with no stated reason is the failure
    // this guards against, because it leaves the reader with a grey rectangle and no explanation.
    expect((await notice.innerText()).trim().length, 'the fallback names no reason').toBeGreaterThan(0)
    await expect(page.locator('.raster-map-tile').first()).toBeVisible()
    return
  }

  const text = (await note.innerText()).replace(/\s+/g, ' ')
  expect(text, 'the GPU path does not identify itself').toContain('GPU map')
  // The readout is written from queryRenderedFeatures, so it is evidence about the rendered map
  // rather than about the payload.
  expect(text).toMatch(/\d+ of \d+ published points in view|no published points in view|checking what is on screen/)
})

test('the map reports no data failure while the release loads', async ({ page }) => {
  await page.goto('/?module=TRAFFIC')

  await expect(page.locator('.map-shell, .raster-map-wrap').first()).toBeVisible()
  // The release is present, so a data-error banner would be a false alarm rather than a real one.
  await expect(page.locator('.data-error')).toHaveCount(0)
})

