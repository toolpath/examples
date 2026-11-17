import type { PlanResponse, ToolpathsResponse } from '@toolpath/api'

import type { WatchedJob } from '@/fusion/protocol'
import { buildImportBegin, importResults, parseToolpath } from '@/worker/import-results'

const fusionSend = vi.hoisted(() => vi.fn())
vi.mock('@/fusion/bridge', () => ({ fusionSend }))

const job = {
  jobId: 'job-1',
  runId: 'run-1',
  kind: 'toolpaths',
  partId: 'part-1',
  planId: 'plan-1',
  bodyToken: 'body-token',
  bodyName: 'Bracket',
  documentId: 'doc-1',
  status: 'succeeded',
  progress: 100,
  error: null,
  createdAt: '2026-11-12T00:00:00.000Z',
} satisfies WatchedJob

const plan = {
  planId: 'plan-1',
  stock: { input: { mode: 'automaticFlatBar' }, resolved: null },
  setups: [
    { idx: 0, direction: { x: 0, y: 0, z: 1 }, actions: [], unmachined: [] },
    { idx: 1, direction: null, actions: [], unmachined: [] },
  ],
} as unknown as PlanResponse

const action = (idx: number, toolpathUrl: string | null) => ({
  idx,
  actionId: `a${idx}`,
  intent: 'Roughing',
  toolName: '6 mm flat',
  machiningTime: 61,
  toolpathUrl,
})

const toolpaths = {
  setups: [
    { idx: 0, actions: [action(0, 'https://s3.test/a0.json'), action(1, null)] },
    { idx: 1, actions: [action(0, 'https://s3.test/skipped.json')] },
  ],
} as unknown as ToolpathsResponse

const rawResponse = (body: unknown) => ({ raw: { json: async () => body } })

const client = {
  plans: { getPlanRaw: vi.fn(async () => rawResponse(plan)) },
  toolpaths: { getToolpathsRaw: vi.fn(async () => rawResponse(toolpaths)) },
} as never

describe('parseToolpath', () => {
  it('reads sections, and segments from older files', () => {
    expect(
      parseToolpath({ points: [0, 0, 0], sections: [{ start: 0, end: 1, kind: 'Cutting' }] }),
    ).not.toBeNull()
    expect(parseToolpath({ points: [0, 0, 0], segments: [] })?.sections).toEqual([])
  })

  it('refuses files in a tool frame', () => {
    expect(parseToolpath({ points: [], sections: [], frame: {} })).toBeNull()
    expect(parseToolpath('nope')).toBeNull()
  })
})

describe('importResults', () => {
  beforeEach(() => {
    fusionSend.mockReset()
    fusionSend.mockImplementation(async (action: string) =>
      action === 'importEnd' ? { summary: { setups: 1 } } : { success: true },
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          points: [0, 0, 0, 1, 0, 0],
          sections: [{ start: 0, end: 2, kind: 'Cutting' }],
        }),
      ),
    )
  })

  it('sends the setups, then each action of a setup with a direction, then ends', async () => {
    const summary = await importResults(client, job)

    expect(summary).toEqual({ setups: 1 })
    expect(fusionSend.mock.calls.map(([name]) => name)).toEqual([
      'importBegin',
      'importAction',
      'importAction',
      'importEnd',
    ])
    const [, begin] = fusionSend.mock.calls[0]!
    expect(begin).toEqual(buildImportBegin(job, begin.importId, { plan, toolpaths }))
    expect(fusionSend.mock.calls[2]![1]).toMatchObject({
      setupIdx: 0,
      actionIdx: 1,
      toolpath: null,
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
