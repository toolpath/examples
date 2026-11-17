import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const cube = readFileSync(
  new URL('../../react-viewer/fixtures/mesh/local-0.3.0-cube.glb', import.meta.url),
)
const box = { lower: { x: 0, y: 0, z: 0 }, upper: { x: 1, y: 1, z: 1 } }
const bodies = [
  { index: 0, name: 'Bracket', faceCount: 6, boundingBox: box, shape: 0 },
  { index: 1, faceCount: 6, boundingBox: box, shape: 0 },
]

/** Answers as the Toolpath API does, and returns the calls the page made, in order. */
const mockApi = async (page: Page) => {
  const calls: Array<string> = []
  const json = (body: object) => ({ json: body })
  await page.route(/\/(v1|upload|cube\.glb)/, async (route) => {
    const request = route.request()
    const { pathname, origin } = new URL(request.url())
    if (pathname === '/cube.glb') return route.fulfill({ body: cube })
    calls.push(`${request.method()} ${pathname}`)
    if (pathname === '/upload') return route.fulfill({ status: 200 })
    if (pathname.endsWith('/events')) {
      const job = { jobUuid: pathname.split('/')[3], status: 'succeeded', createdAt: 0 }
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `event: job\ndata: ${JSON.stringify({ ...job, updatedAt: 0 })}\n\n`,
      })
    }
    if (pathname === '/v1/files') {
      return route.fulfill(json({ fileId: 'file', uploadUrl: `${origin}/upload` }))
    }
    if (pathname === '/v1/files/file') {
      return route.fulfill(
        json(
          request.method() === 'PATCH'
            ? { jobId: 'inspect' }
            : { fileId: 'file', bodies, shapes: [] },
        ),
      )
    }
    if (pathname === '/v1/files/file/parts') {
      const parts = bodies.map(({ index }) => ({ bodyIndex: index, partId: `part-${index}` }))
      return route.fulfill(json({ fileId: 'file', parts }))
    }
    const partId = pathname.split('/')[3]
    return route.fulfill(
      json(
        request.method() === 'POST'
          ? { jobId: `mesh-${partId}` }
          : {
              partId,
              meshGlbUrl: `${origin}/cube.glb`,
              meshPointCount: 8,
              meshTriangleCount: 12,
              faceTriangleCounts: [2, 2, 2, 2, 2, 2],
            },
      ),
    )
  })
  return calls
}

test('uploads a file and lists and draws its bodies', async ({ page }) => {
  const calls = await mockApi(page)
  await page.goto('/')
  await page.getByLabel('CAD file').setInputFiles({
    name: 'assembly.step',
    mimeType: 'model/step',
    buffer: Buffer.from('ISO-10303-21;'),
  })

  await expect(page.getByRole('status')).toHaveText('Bodies in assembly.step: 2')
  expect(calls.slice(0, 7)).toEqual([
    'POST /v1/files',
    'PUT /upload',
    'PATCH /v1/files/file',
    'GET /v1/jobs/inspect/events',
    'GET /v1/files/file',
    'POST /v1/files/file/parts',
    'POST /v1/parts/part-0/mesh',
  ])

  const first = page.getByRole('button', { name: 'Bracket' })
  await expect(first).toBeVisible()
  await expect(page.getByRole('button', { name: 'Body 2' })).toBeVisible()
  await expect(page.locator('[data-viewer-canvas-container] canvas').first()).toBeVisible()

  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'false')
})
