import type { JobDetail } from '@toolpath/api'

import { errorStatus } from './client'

export interface PollOptions {
  intervalMs?: number
  maxIntervalMs?: number
  /** Stop waiting after this long; the job carries on in Toolpath. */
  timeoutMs?: number
  signal?: AbortSignal
  onUpdate?: (job: JobDetail) => void
}

export class PollTimeoutError extends Error {
  constructor(minutes: number) {
    super(
      `Stopped waiting after ${minutes} minutes. The job is still in Toolpath; open the panel again to look.`,
    )
    this.name = 'PollTimeoutError'
  }
}

/** Errors no retry will fix: a refused key, or a job this key can't see. */
const FATAL_STATUSES = new Set([400, 401, 403, 404, 410])

export const isFinal = (job: Pick<JobDetail, 'status'>): boolean =>
  job.status === 'succeeded' || job.status === 'failed'

export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(signal.reason)
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })

// `waitForJob` from @toolpath/api streams instead of polling.
export const pollJob = async (
  getJob: () => Promise<JobDetail>,
  {
    intervalMs = 2000,
    maxIntervalMs = 30_000,
    timeoutMs = 60 * 60_000,
    signal,
    onUpdate,
  }: PollOptions = {},
): Promise<JobDetail> => {
  const deadline = Date.now() + timeoutMs
  let wait = intervalMs
  let last: Pick<JobDetail, 'status' | 'progress'> | null = null

  for (;;) {
    signal?.throwIfAborted()
    try {
      const job = await getJob()
      wait = intervalMs
      if (!last || last.status !== job.status || last.progress !== job.progress) {
        last = { status: job.status, progress: job.progress }
        onUpdate?.(job)
      }
      if (isFinal(job)) {
        return job
      }
    } catch (error) {
      const status = errorStatus(error)
      if (status !== null && FATAL_STATUSES.has(status)) {
        throw error
      }
      // A dropped connection, a 429 or a 5xx: back off and read again.
      wait = Math.min(wait * 2, maxIntervalMs)
    }
    if (Date.now() + wait > deadline) {
      throw new PollTimeoutError(Math.round(timeoutMs / 60_000))
    }
    await sleep(wait, signal)
  }
}
