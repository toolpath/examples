import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url))
const part = JSON.parse(fixture('part.json').toString())
const plan = JSON.parse(fixture('plan.json').toString())
const queued = JSON.parse(fixture('plan-queued.json').toString())

/** Answers as the Toolpath API does, and returns the calls the page made and each plan spec sent. */
const mockApi = async (page: Page) => {
  const calls: Array<string> = []
  const specs: Array<unknown> = []
  await page.route('**/mesh.glb', (route) => route.fulfill({ body: fixture('mesh.glb') }))
  await page.route(/\/(v1|upload)\b/, async (route) => {
    const request = route.request()
    const { pathname, origin } = new URL(request.url())
    calls.push(`${request.method()} ${pathname}`)
    if (pathname === '/upload') return route.fulfill({ status: 200 })
    if (pathname.endsWith('/events')) {
      const job = { jobUuid: pathname.split('/')[3], status: 'succeeded', createdAt: 0 }
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `event: job\ndata: ${JSON.stringify({ ...job, updatedAt: 0 })}\n\n`,
      })
    }
    if (pathname === '/v1/parts') {
      return route.fulfill({ json: { partId: part.partId, uploadUrl: `${origin}/upload` } })
    }
    if (pathname === `/v1/parts/${part.partId}`) {
      return route.fulfill({ json: request.method() === 'PATCH' ? { jobId: part.jobId } : part })
    }
    if (pathname === `/v1/parts/${part.partId}/plans`) {
      specs.push(request.postDataJSON().planSpec)
      return route.fulfill({ json: queued })
    }
    return route.fulfill({ json: plan })
  })
  return { calls, specs }
}

test('analyzes a part, plans it by region, and plans again after a click', async ({ page }) => {
  const { calls, specs } = await mockApi(page)
  await page.goto('/')
  await page.getByLabel('CAD file').setInputFiles({
    name: 'cube.step',
    mimeType: 'model/step',
    buffer: Buffer.from('ISO-10303-21;'),
  })

  await expect(page.getByRole('status')).toHaveText('Setups planned: 4')
  expect(calls).toEqual([
    'POST /v1/parts',
    'PUT /upload',
    `PATCH /v1/parts/${part.partId}`,
    `GET /v1/jobs/${part.jobId}/events`,
    `GET /v1/parts/${part.partId}`,
    `POST /v1/parts/${part.partId}/plans`,
    `GET /v1/jobs/${plan.jobId}/events`,
    `GET /v1/plans/${plan.planId}`,
  ])
  expect(specs).toEqual([queued.planSpec])

  // A face of the cube is under the middle of the canvas: a click there changes the draft.
  const again = page.getByRole('button', { name: 'Plan again' })
  await expect(again).toBeDisabled()
  const canvas = page.locator('[data-viewer-canvas-container] canvas').first()
  await expect(canvas).toBeVisible()
  await canvas.click()
  await expect(again).toBeEnabled()
  await again.click()
  await expect.poll(() => specs.length).toBe(2)
  expect(specs[1]).not.toEqual(specs[0])
  await expect(page.getByRole('status')).toHaveText('Setups planned: 4')
})
