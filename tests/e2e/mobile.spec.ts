import { expect, test } from '@playwright/test'

/**
 * The phone layout: the data rail is a bottom sheet that starts collapsed.
 *
 * Runs only under the mobile project, where the stylesheet puts the rail behind the handle. On the
 * desktop layout the handle is not the control, so asserting it there would be asserting the wrong
 * behaviour.
 */

test.describe('phone layout', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone-only surface')

  test('the data sheet starts collapsed and opens on the handle', async ({ page }) => {
    await page.goto('/?module=TRAFFIC')

    const handle = page.locator('.rail-handle')
    await expect(handle).toBeVisible()
    await expect(handle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('.data-rail')).not.toHaveClass(/is-expanded/)
    await expect(handle).toContainText('Show the figures')

    await handle.click()

    await expect(handle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('.data-rail')).toHaveClass(/is-expanded/)
    await expect(handle).toContainText('Hide the figures')

    await handle.click()
    await expect(handle).toHaveAttribute('aria-expanded', 'false')
  })

  test('the module is reachable and readable without opening the sheet', async ({ page }) => {
    await page.goto('/?module=EQUITY')

    // The module content is present in the document even while the sheet is collapsed, so a reader
    // arrives on the requested evidence rather than on an empty screen.
    await expect(page.locator('.module-card')).toBeAttached()
    await expect(page.locator('.map-shell, .raster-map-wrap').first()).toBeVisible()
  })

  test('the phone viewport does not scroll sideways', async ({ page }) => {
    await page.goto('/?module=TRAFFIC')

    const overflow = await page.evaluate(() => {
      const { scrollWidth, clientWidth } = document.documentElement
      return scrollWidth - clientWidth
    })

    // A single-pixel tolerance absorbs subpixel rounding, not a real horizontal overflow.
    expect(overflow, 'the phone layout overflows horizontally').toBeLessThanOrEqual(1)
  })
})
