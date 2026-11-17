import type { PartResponse } from '@toolpath/api'

import type { Run } from '@/fusion/protocol'
import { isInProgress, latestJob } from '@/runs/runs'

export type Step =
  | { name: 'body' }
  /** Waiting for analysis, then reading the report. */
  | { name: 'analyzing'; runId: string }
  | { name: 'directions'; runId: string; report: PartResponse }
  | { name: 'toolpaths'; runId: string; jobId: string }

export const stepForRun = (run: Run): Step => {
  const toolpaths = latestJob(run, 'toolpaths')
  return toolpaths
    ? { name: 'toolpaths', runId: run.runId, jobId: toolpaths.jobId }
    : { name: 'analyzing', runId: run.runId }
}

/** Reopens the newest run while it still has a job in progress. */
export const resumeStep = (runs: ReadonlyArray<Run>): Step => {
  const newest = [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return newest?.jobs.some(isInProgress) ? stepForRun(newest) : { name: 'body' }
}
