import { expect, test } from '@playwright/test'

/**
 * The shell a production build is allowed to expose.
 *
 * These are the negative-space checks: a production build must not carry the development-only
 * control surface, and it must not leave the reader on a page whose data status they cannot see.
 */

test('a production build ships no development-only control surface', async ({ page }) => {
  await page.goto('/')

  // The dev controls are gated on the synthetic dataset being loaded, which production never does.
  await expect(page.getByRole('button', { name: 'COMPARE (DEV)' })).toHaveCount(0)
  await expect(page.locator('[aria-label="Synthetic development render mode"]')).toHaveCount(0)
  await expect(page.locator('[aria-label="Synthetic development hotspot panels"]')).toHaveCount(0)
  await expect(page.locator('[aria-label="Synthetic development summary"]')).toHaveCount(0)

  // And no page text claims synthetic values, which is the failure mode those controls would enable.
  await expect(page.locator('body')).not.toContainText('SYNTHETIC DEV')
})

test('the running build stamps its identity and names the data status', async ({ page }) => {
  await page.goto('/')

  const stamp = page.locator('.build-stamp')
  await expect(stamp).toBeVisible()
  await expect(stamp).toContainText('Build')

  const buildId = (await stamp.locator('strong').innerText()).trim()
  expect(buildId, 'the build stamp must carry an identity, not a placeholder').toMatch(
    /^(\d{8}-\d{4}-[0-9a-f]{7,}|unversioned)$/,
  )
  expect(buildId, 'a production build must not report itself as unversioned').not.toBe('unversioned')

  // The masthead status is a desktop affordance and is hidden on phones, where the release ribbon
  // carries the same statement, so assert the statement is reachable rather than one element.
  const status = page.locator(
    '[aria-label="Data status"]:visible, [aria-label="Release status summary"]:visible',
  )
  await expect(status.first()).toBeVisible()
})

test('a link from another build reports the staleness instead of failing silently', async ({ page }) => {
  await page.goto('/?v=20000101-0000-0000000')

  await expect(page.locator('body')).toContainText('Stale build.')
  // The message has to name both builds, otherwise it cannot be acted on.
  await expect(page.locator('body')).toContainText('20000101-0000-0000000')
})

test('the page loads without an uncaught error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('.masthead')).toBeVisible()

  expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([])
})
