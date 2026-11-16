import { setupPlanFor } from '@/api/cam'
import type { Run, WatchedJob } from '@/fusion/protocol'
import { resumeStep, stepForRun } from '@/lib/steps'
import { directionIndices, runStatus, upsertJob } from '@/runs/runs'

const job = (overrides: Partial<WatchedJob>): WatchedJob => ({
  jobId: 'job',
  runId: 'run',
  kind: 'analysis',
  partId: 'part',
  bodyToken: 'token',
  bodyName: 'Bracket',
  documentId: null,
  status: 'succeeded',
  progress: null,
  error: null,
  createdAt: '2026-11-12T00:00:00.000Z',
  ...overrides,
})

const run = (jobs: Array<WatchedJob>, overrides: Partial<Run> = {}): Run => ({
  runId: 'run',
  createdAt: '2026-11-12T00:00:00.000Z',
  bodyName: 'Bracket',
  bodyToken: 'token',
  documentId: null,
  documentName: null,
  partId: 'part',
  jobs,
  ...overrides,
})

describe('stepForRun', () => {
  it('opens the latest toolpaths, or the analysis', () => {
    expect(stepForRun(run([job({})]))).toEqual({ name: 'analyzing', runId: 'run' })
    const jobs = [
      job({}),
      job({ jobId: 'old', kind: 'toolpaths', createdAt: '2026-11-12T01:00:00.000Z' }),
      job({ jobId: 'new', kind: 'toolpaths', createdAt: '2026-11-12T02:00:00.000Z' }),
    ]
    expect(stepForRun(run(jobs))).toEqual({ name: 'toolpaths', runId: 'run', jobId: 'new' })
  })
})

describe('resumeStep', () => {
  it('reopens the newest run only while it has a job in progress', () => {
    expect(resumeStep([])).toEqual({ name: 'body' })
    expect(resumeStep([run([job({ kind: 'toolpaths', importStatus: 'imported' })])])).toEqual({
      name: 'body',
    })
    const older = run([job({ status: 'running' })], {
      runId: 'older',
      createdAt: '2026-11-11T00:00:00.000Z',
    })
    expect(resumeStep([older, run([job({ status: 'running' })])])).toEqual({
      name: 'analyzing',
      runId: 'run',
    })
  })
})

describe('upsertJob', () => {
  it('adds a job to its run and updates it there', () => {
    const runs = { run: run([]) }
    const added = upsertJob(runs, job({ status: 'queued' }))
    expect(added.run!.jobs).toHaveLength(1)
    const updated = upsertJob(added, { jobId: 'job', status: 'running', progress: 40 })
    expect(updated.run!.jobs[0]).toMatchObject({
      status: 'running',
      progress: 40,
      bodyName: 'Bracket',
    })
    expect(upsertJob(runs, { jobId: 'stray' })).toBe(runs)
  })
})

describe('runStatus', () => {
  it('reads the latest step of the run', () => {
    expect(runStatus(run([job({ status: 'running' })])).label).toBe('Analyzing')
    expect(runStatus(run([job({})])).label).toBe('Analyzed')
    expect(
      runStatus(run([job({}), job({ jobId: 't', kind: 'toolpaths', importStatus: 'imported' })])),
    ).toEqual({
      label: 'Imported',
      tone: 'success',
    })
    expect(
      runStatus(run([job({}), job({ jobId: 't', kind: 'toolpaths', importStatus: 'failed' })]))
        .tone,
    ).toBe('danger')
  })
})

describe('directions', () => {
  const tilted = { x: 0.1234567890123, y: 0, z: 0.9923 }

  it('finds a request’s directions among the candidates, in order', () => {
    const candidates = [{ x: 0, y: 0, z: 1 }, tilted, { x: 0, y: 0, z: -1 }]
    expect(
      directionIndices(candidates, [{ x: 0, y: 0, z: -1 }, tilted, { x: 1, y: 0, z: 0 }]),
    ).toEqual([2, 1])
    expect(directionIndices(candidates, null)).toEqual([])
  })

  it('makes one setup per direction, passing the vectors through untouched', () => {
    expect(setupPlanFor([{ x: 0, y: 0, z: 1 }, tilted])).toEqual({
      setups: [
        { orientations: [{ direction: { x: 0, y: 0, z: 1 }, features: [] }] },
        { orientations: [{ direction: tilted, features: [] }] },
      ],
    })
  })
})
