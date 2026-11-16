import { ResponseError, type JobDetail } from '@toolpath/api'

import { PollTimeoutError, pollJob } from '@/api/poll'

const job = (status: JobDetail['status'], progress: number | null = null) =>
  ({ status, progress }) as JobDetail

const sequence = (...steps: Array<JobDetail | Error>) => {
  let i = 0
  return vi.fn(async () => {
    const step = steps[Math.min(i++, steps.length - 1)]!
    if (step instanceof Error) {
      throw step
    }
    return step
  })
}

const httpError = (status: number) => new ResponseError(new Response(null, { status }))

describe('pollJob', () => {
  it('reads until the job is final, reporting each change', async () => {
    const getJob = sequence(
      job('queued'),
      job('running', 10),
      job('running', 10),
      job('running', 60),
      job('succeeded', 100),
    )
    const updates: Array<string> = []

    const final = await pollJob(getJob, {
      intervalMs: 1,
      onUpdate: (j) => updates.push(`${j.status}:${j.progress}`),
    })

    expect(final.status).toBe('succeeded')
    expect(updates).toEqual(['queued:null', 'running:10', 'running:60', 'succeeded:100'])
  })

  it('retries transient failures', async () => {
    const getJob = sequence(new TypeError('Failed to fetch'), httpError(503), job('failed'))

    await expect(pollJob(getJob, { intervalMs: 1, maxIntervalMs: 4 })).resolves.toMatchObject({
      status: 'failed',
    })
    expect(getJob).toHaveBeenCalledTimes(3)
  })

  it('stops on errors a retry cannot fix', async () => {
    const getJob = sequence(httpError(401), job('succeeded'))

    await expect(pollJob(getJob, { intervalMs: 1 })).rejects.toBeInstanceOf(ResponseError)
    expect(getJob).toHaveBeenCalledTimes(1)
  })

  it('gives up after the timeout', async () => {
    await expect(
      pollJob(sequence(job('running')), { intervalMs: 5, timeoutMs: 20 }),
    ).rejects.toBeInstanceOf(PollTimeoutError)
  })

  it('stops when aborted', async () => {
    const controller = new AbortController()
    const polling = pollJob(sequence(job('running')), {
      intervalMs: 1000,
      signal: controller.signal,
    })
    controller.abort(new Error('stopped'))

    await expect(polling).rejects.toThrow('stopped')
  })
})
