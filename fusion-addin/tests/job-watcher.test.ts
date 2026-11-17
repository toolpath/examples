import type { JobDetail } from '@toolpath/api'

import type { ToolpathClient } from '@/api/client'
import type { WatchedJob } from '@/fusion/protocol'
import { JobWatcher, nextStep, type JobUpdate } from '@/worker/job-watcher'

const watched = (overrides: Partial<WatchedJob> = {}): WatchedJob => ({
  jobId: 'job-1',
  runId: 'run-1',
  kind: 'toolpaths',
  partId: 'part-1',
  planId: 'plan-1',
  bodyToken: 'body-token',
  bodyName: 'Bracket',
  documentId: 'doc-1',
  status: 'queued',
  progress: null,
  error: null,
  createdAt: '2026-11-12T00:00:00.000Z',
  ...overrides,
})

const clientReturning = (...statuses: Array<JobDetail['status']>) => {
  let i = 0
  const getJob = vi.fn(async () => ({
    status: statuses[Math.min(i++, statuses.length - 1)],
    progress: null,
    error: null,
  }))
  return { jobs: { getJob } } as unknown as ToolpathClient
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('nextStep', () => {
  it('polls until final, then imports succeeded toolpath jobs once', () => {
    expect(nextStep(watched({ status: 'running' }), true)).toBe('poll')
    expect(nextStep(watched({ status: 'succeeded' }), true)).toBe('import')
    expect(nextStep(watched({ status: 'succeeded' }), false)).toBeNull()
    expect(nextStep(watched({ status: 'succeeded', importStatus: 'imported' }), true)).toBeNull()
    expect(nextStep(watched({ status: 'failed' }), true)).toBeNull()
    expect(nextStep(watched({ kind: 'analysis', status: 'succeeded' }), true)).toBeNull()
  })
})

describe('JobWatcher', () => {
  it('waits for a client, polls, then imports', async () => {
    const updates: Array<JobUpdate> = []
    const importResults = vi.fn(async () => ({
      setups: 1,
      actions: 1,
      sketchLines: 3,
      thinned: false,
      warnings: [],
    }))
    const watcher = new JobWatcher({
      apiUrl: 'https://api.test',
      pollIntervalMs: 1,
      report: (u) => updates.push(u),
      importResults,
    })

    watcher.watch(watched())
    await settled()
    expect(updates).toEqual([])

    watcher.setClient(clientReturning('running', 'succeeded'))
    await vi.waitFor(() => expect(importResults).toHaveBeenCalledTimes(1))
    expect(updates.map((u) => u.status)).toEqual(['running', 'succeeded'])
  })

  it('reports an import interrupted by a reload instead of importing again', async () => {
    const updates: Array<JobUpdate> = []
    const importResults = vi.fn()
    const watcher = new JobWatcher({
      apiUrl: 'https://api.test',
      pollIntervalMs: 1,
      report: (u) => updates.push(u),
      importResults,
    })
    watcher.setClient(clientReturning('succeeded'))

    watcher.watch(watched({ status: 'succeeded', importStatus: 'importing' }))
    await settled()

    expect(importResults).not.toHaveBeenCalled()
    expect(updates).toEqual([expect.objectContaining({ jobId: 'job-1', importStatus: 'failed' })])
  })

  it('reports a failed import', async () => {
    const updates: Array<JobUpdate> = []
    const watcher = new JobWatcher({
      apiUrl: 'https://api.test',
      report: (u) => updates.push(u),
      importResults: async () => {
        throw new Error('Switch back to the design')
      },
    })
    watcher.setClient(clientReturning('succeeded'))

    watcher.watch(watched({ status: 'succeeded' }))
    await vi.waitFor(() =>
      expect(updates).toContainEqual(expect.objectContaining({ importStatus: 'failed' })),
    )
    expect(updates.at(-1)?.importError).toBe('Switch back to the design')
  })
})
