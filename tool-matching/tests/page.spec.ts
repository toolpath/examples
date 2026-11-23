import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const sample = 'gripper-bracket'
const saved = (file: string) =>
  readFileSync(new URL(`../public/parts/${sample}/${file}`, import.meta.url))

/**
 * Answers an upload as the Toolpath API does, with a saved sample's own responses, and returns the
 * calls the page made, in order.
 */
const mockApi = async (page: Page) => {
  const calls: Array<string> = []
  await page.route(/\/(v1|upload|uploaded\.glb)/, async (route) => {
    const request = route.request()
    const { pathname, origin } = new URL(request.url())
    if (pathname === '/uploaded.glb') return route.fulfill({ body: saved('mesh.glb') })
    calls.push(`${request.method()} ${pathname}`)
    if (pathname === '/upload') return route.fulfill({ status: 200 })
    if (pathname.endsWith('/events')) {
      const job = { jobUuid: 'analysis', status: 'succeeded', createdAt: 0, updatedAt: 0 }
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `event: job\ndata: ${JSON.stringify(job)}\n\n`,
      })
    }
    if (pathname === '/v1/parts') {
      return route.fulfill({ json: { partId: 'uploaded', uploadUrl: `${origin}/upload` } })
    }
    if (pathname === '/v1/parts/uploaded' && request.method() === 'PATCH') {
      return route.fulfill({ json: { partId: 'uploaded', jobId: 'analysis' } })
    }
    if (pathname === '/v1/parts/uploaded/features') {
      return route.fulfill({ body: saved('features.json'), contentType: 'application/json' })
    }
    const report = JSON.parse(saved('report.json').toString())
    return route.fulfill({ json: { ...report, meshGlbUrl: `${origin}/uploaded.glb` } })
  })
  return calls
}

test('a sample lists the tools it needs, and how each is used', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gripper bracket' }).click()

  const tools = page.getByRole('complementary', { name: 'Tools' })
  await expect(tools.getByRole('heading', { level: 2 })).toHaveText(/^\d+ tools$/)
  await expect(tools.getByTitle('Held in').first()).toBeVisible()
  await expect(page.locator('[data-viewer-canvas-container] canvas').first()).toBeVisible()

  const first = tools.locator('.tool-head').first()
  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'in', exact: true }).click()
  await expect(tools.locator('.spec').first()).toContainText(' in')
})

test('a click anywhere on a tool card picks it, whichever tool was picked before', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Housing' }).click()
  const chamfer = page.locator('article', { hasText: 'Chamfer mill 90°' })
  const card = page.locator('article', { hasText: 'Square end mill, long reach' })
  const name = card.getByRole('button', { name: /Square end mill, long reach/ })
  // The use row's text is under the name's click area, as the pointer finds it: `force` clicks
  // where the text is, and the browser decides what is there.
  for (const [spot, force] of [
    [name, false],
    [card.getByTitle('Held in'), false],
    [card.getByText('Profile', { exact: true }), true],
    [card.locator('.spec button').first(), false],
  ] as const) {
    await chamfer.getByRole('button', { name: /Chamfer mill 90°/ }).click()
    await spot.click({ force })
    await expect(name).toHaveAttribute('aria-pressed', 'true')
  }
  // Asking why doesn't pick or drop the tool.
  await card.getByRole('button', { name: 'Why this tool' }).click()
  await expect(name).toHaveAttribute('aria-pressed', 'true')
})

test('a feature no tool makes can be picked, as a tool can', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Motor mount bracket' }).click()
  const missing = page
    .getByRole('complementary', { name: 'Tools' })
    .locator('[data-pick^="unmatched|"]')
  const row = missing.first().getByRole('button').first()
  await missing.first().click()
  await expect(row).toHaveAttribute('aria-pressed', 'true')
  // Picking a tool drops it.
  await page.locator('.tool-head').first().click()
  await expect(row).toHaveAttribute('aria-pressed', 'false')
})

test('the counts scroll the list: tooled to the top, not tooled to their list', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Motor mount bracket' }).click()
  const tools = page.getByRole('complementary', { name: 'Tools' })
  const missing = tools.getByRole('heading', { name: /Not in this library/ })
  await expect(missing).not.toBeInViewport()
  await tools.getByRole('button', { name: /not tooled/ }).click()
  await expect(missing).toBeInViewport()
  await tools.getByRole('button', { name: /^\d+ tooled$/ }).click()
  await expect(tools.locator('.tool-head').first()).toBeInViewport()
  await expect(missing).not.toBeInViewport()
})

test('opening a sample leaves the upload button alone', async ({ page }) => {
  // A slow sample, to look at the page while it opens.
  await page.route(/toolpath-housing-probing-example-simple\/report\.json$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await route.fallback()
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Housing' }).click()
  const upload = page.getByRole('button', { name: 'Upload CAD file' })
  await expect(upload).toBeEnabled()
  await expect(page.getByText('Analyzing…')).toHaveCount(0)
  const tools = page.getByRole('complementary', { name: 'Tools' })
  await expect(tools.getByRole('heading', { level: 2 })).toHaveText(/^\d+ tools$/)
})

test('the library lists what matching may choose from', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Tool library/ }).click()
  await expect(page.getByRole('heading', { name: 'Tool library' })).toBeVisible()
  await expect(page.getByText('CAT40 ER32 collet chuck').first()).toBeVisible()
})

test('the page never scrolls, only its panels do', async ({ page }) => {
  const pageScrolls = () =>
    page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)
  await page.goto('/')

  await page.getByRole('button', { name: /Tool library/ }).click()
  await expect(page.getByRole('heading', { name: 'Collets' })).toBeVisible()
  expect(await pageScrolls()).toBe(false)

  await page.getByRole('button', { name: 'Motor mount bracket' }).click()
  const tools = page.getByRole('complementary', { name: 'Tools' })
  await expect(tools.getByRole('heading', { level: 2 })).toHaveText(/^\d+ tools$/)
  expect(await pageScrolls()).toBe(false)
})

test('an upload is analyzed and matched like a sample', async ({ page }) => {
  const calls = await mockApi(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Upload CAD file' })).toBeVisible()
  await page.getByLabel('CAD file').setInputFiles({
    name: 'bracket.step',
    mimeType: 'model/step',
    buffer: Buffer.from('ISO-10303-21;'),
  })

  const tools = page.getByRole('complementary', { name: 'Tools' })
  await expect(tools.getByRole('heading', { level: 2 })).toHaveText(/^\d+ tools$/)
  expect(calls).toEqual([
    'POST /v1/parts',
    'PUT /upload',
    'PATCH /v1/parts/uploaded',
    'GET /v1/jobs/analysis/events',
    'GET /v1/parts/uploaded',
    // 54 features: their datasheets in two requests of at most 50.
    'GET /v1/parts/uploaded/features',
    'GET /v1/parts/uploaded/features',
  ])

  // The part stays in the sidebar, as a sample does, with a button to swap it for another.
  const part = page.getByRole('button', { name: 'bracket.step' })
  await expect(part).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Upload CAD file' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Gripper bracket' }).click()
  await expect(part).toHaveAttribute('aria-pressed', 'false')
  await part.click()
  await expect(part).toHaveAttribute('aria-pressed', 'true')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Upload a different part' }).click()
  await chooser
})
