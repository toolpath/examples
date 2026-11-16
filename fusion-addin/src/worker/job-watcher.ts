import type { ToolpathClient } from '@/api/client'
import { describeError } from '@/api/client'
import { isFinal, pollJob } from '@/api/poll'
import type { ImportSummary, WatchedJob } from '@/fusion/protocol'

import type { JobUpdate } from '@/runs/runs'

export type { JobUpdate }

export interface JobWatcherOptions {
  apiUrl: string
  pollIntervalMs?: number
  report: (update: JobUpdate) => unknown
  /** Brings a finished toolpath job into Fusion. Absent in a browser, where there is no Fusion. */
  importResults?: (client: ToolpathClient, job: WatchedJob) => Promise<ImportSummary>
}

export const nextStep = (job: WatchedJob, canImport: boolean): 'poll' | 'import' | null => {
  if (!isFinal(job)) {
    return 'poll'
  }
  if (canImport && job.kind === 'toolpaths' && job.status === 'succeeded' && !job.importStatus) {
    return 'import'
  }
  return null
}

export class JobWatcher {
  private client: ToolpathClient | null = null
  private readonly jobs = new Map<string, WatchedJob>()
  private readonly running = new Map<string, AbortController>()

  constructor(private readonly options: JobWatcherOptions) {}

  setClient(client: ToolpathClient | null) {
    this.client = client
    if (!client) {
      this.running.forEach((controller) => controller.abort())
      return
    }
    this.jobs.forEach((job) => void this.run(job))
  }

  watch(job: WatchedJob) {
    if (job.importStatus === 'importing' && !this.running.has(job.jobId)) {
      this.options.report({
        jobId: job.jobId,
        importStatus: 'failed',
        importError: 'The import was interrupted. Request the toolpaths again to import them.',
      })
      return
    }
    this.jobs.set(job.jobId, job)
    void this.run(job)
  }

  stop() {
    this.running.forEach((controller) => controller.abort())
    this.running.clear()
  }

  private async run(job: WatchedJob) {
    const client = this.client
    const step = nextStep(job, !!this.options.importResults)
    if (!client || !step || this.running.has(job.jobId)) {
      return
    }
    const controller = new AbortController()
    this.running.set(job.jobId, controller)
    let current = job
    let importing = false
    try {
      if (step === 'poll') {
        const detail = await pollJob(() => client.jobs.getJob({ id: job.jobId }), {
          intervalMs: this.options.pollIntervalMs,
          signal: controller.signal,
          onUpdate: (update) =>
            this.options.report({
              jobId: job.jobId,
              status: update.status,
              progress: update.progress,
              error: update.error,
            }),
        })
        current = {
          ...current,
          status: detail.status,
          progress: detail.progress,
          error: detail.error,
        }
        this.jobs.set(job.jobId, current)
      }
      if (
        nextStep(current, !!this.options.importResults) === 'import' &&
        this.options.importResults
      ) {
        importing = true
        await this.options.importResults(client, current)
        // The add-in records `imported` and the summary itself, when the import lands.
        this.jobs.set(job.jobId, { ...current, importStatus: 'imported' })
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }
      const message = await describeError(error, this.options.apiUrl)
      if (importing) {
        this.jobs.set(job.jobId, { ...current, importStatus: 'failed' })
        this.options.report({ jobId: job.jobId, importStatus: 'failed', importError: message })
      } else {
        // Waiting failed, not the job: it may still finish in Toolpath.
        this.options.report({ jobId: job.jobId, error: message })
      }
    } finally {
      this.running.delete(job.jobId)
    }
  }
}
