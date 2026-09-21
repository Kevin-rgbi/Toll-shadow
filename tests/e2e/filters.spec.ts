import { expect, test, type Page } from '@playwright/test'

/**
 * A filter has to change the published figures, and say so in the URL.
 *
 * The count line is read from the module rather than from a stored expectation, and the values to
 * filter by are taken from the module's own option list, so the tests assert the relationship
 * between the selection and the count instead of hard-coding figures that a new release would
 * silently invalidate.
 */

const countLine = async (page: Page) => {
  const text = await page.locator('.module-count').innerText()
  const match = /Showing\s+([\d,]+)\s+of\s+([\d,]+)\s+published aggregates/.exec(text.replace(/\s+/g, ' '))
  if (!match) throw new Error(`the module did not publish a readable count line: ${text}`)
  return { showing: Number(match[1].replaceAll(',', '')), total: Number(match[2].replaceAll(',', '')) }
}

const selectParam = (page: Page, name: string) => new URL(page.url()).searchParams.get(name)

/**
 * The boroughs the release publishes under the current selection, taken from the control itself so a
 * new release does not invalidate the test.
 */
const publishedBoroughs = async (page: Page) => {
  // The filter controls only exist once the asset has loaded, so wait for a populated control
  // rather than reading an empty one.
  await page.locator('.module-filter-row label').first().waitFor()
  const options = await page.locator('.module-filter-row label', { hasText: 'Borough' })
    .locator('select option')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean))
  expect(options.length, 'the release publishes no borough to filter by').toBeGreaterThan(0)
  return options
}

test('a traffic filter narrows the published figure and writes the URL', async ({ page }) => {
  await page.goto('/?module=TRAFFIC')

  const before = await countLine(page)
  expect(before.showing, 'the module shows nothing before filtering').toBeGreaterThan(0)
  expect(before.showing).toBeLessThanOrEqual(before.total)

  const borough = page.locator('.module-filter-row label', { hasText: 'Borough' }).locator('select')
  const options = await publishedBoroughs(page)

  // The first borough that publishes anything under the current selection.
  let filtered = 0
  for (const option of options) {
    await borough.selectOption(option)
    await expect.poll(() => selectParam(page, 'borough')).toBe(option)
    const current = await countLine(page)
    if (current.showing > 0 && current.showing < before.showing) {
      filtered = current.showing
      break
    }
  }

  expect(filtered, 'no published borough narrowed the figure').toBeGreaterThan(0)
  const after = await countLine(page)
  expect(after.total, 'the month total must not change with a filter').toBe(before.total)
})

test('clearing a filter restores the full published figure and drops it from the URL', async ({ page }) => {
  await page.goto('/?module=TRAFFIC')

  const before = await countLine(page)
  const borough = page.locator('.module-filter-row label', { hasText: 'Borough' }).locator('select')
  const options = await publishedBoroughs(page)
  await borough.selectOption(options[0])
  await expect.poll(() => selectParam(page, 'borough')).toBe(options[0])

  await borough.selectOption('')

  await expect.poll(() => selectParam(page, 'borough')).toBeNull()
  await expect.poll(async () => (await countLine(page)).showing).toBe(before.showing)
})

test('a linked borough is applied and shown as the selected value', async ({ page }) => {
  const borough = page.locator('.module-filter-row label', { hasText: 'Borough' }).locator('select')
  await page.goto('/?module=TRAFFIC')
  const options = await publishedBoroughs(page)

  await page.goto(`/?module=TRAFFIC&borough=${encodeURIComponent(options[0])}`)

  // The control has to report the filter that is actually applied. Falling back to "all" while the
  // figures stay narrowed misreports the state the reader is looking at.
  await expect(borough).toHaveValue(options[0])
})

test('a time band selection is written to the URL and changes what the module counts', async ({ page }) => {
  await page.goto('/?module=TRAFFIC')

  const before = await countLine(page)
  const band = page.locator('.module-filter-row label', { hasText: 'Time band' }).locator('select')
  const options = await band.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean))
  expect(options.length, 'the release publishes no time band to filter by').toBeGreaterThan(0)

  await band.selectOption(options[0])

  await expect.poll(() => selectParam(page, 'band')).toBe(options[0])
  const after = await countLine(page)
  expect(after.showing, 'the band filter published nothing').toBeGreaterThan(0)
  expect(after.showing, 'the band filter did not narrow the figure').toBeLessThanOrEqual(before.showing)
})

test('the crossings module states the window its figures cover', async ({ page }) => {
  await page.goto('/?module=CROSSINGS')

  const card = page.locator('.module-card')
  await expect(card).toContainText('crossing', { ignoreCase: true })
  // The window is part of the claim, so the module has to state it.
  await expect(card.locator('.module-provenance').first()).toContainText('Coverage')
})
