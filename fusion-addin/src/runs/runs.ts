import type { Vec3 } from '@toolpath/api'

import type { JobKind, Run, WatchedJob } from '@/fusion/protocol'

export type JobUpdate = Partial<WatchedJob> & { jobId: string }

export const latestJob = (run: Run, kind: JobKind): WatchedJob | undefined =>
  run.jobs
    .filter((job) => job.kind === kind)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

/** Adds a job to its run, or updates it there. */
export const upsertJob = (runs: Record<string, Run>, job: JobUpdate): Record<string, Run> => {
  const run =
    Object.values(runs).find((r) => r.jobs.some((j) => j.jobId === job.jobId)) ??
    (job.runId ? runs[job.runId] : undefined)
  if (!run) {
    return runs
  }
  const exists = run.jobs.some((j) => j.jobId === job.jobId)
  const jobs = exists
    ? run.jobs.map((j) => (j.jobId === job.jobId ? { ...j, ...job } : j))
    : [...run.jobs, job as WatchedJob]
  return { ...runs, [run.runId]: { ...run, jobs, updatedAt: new Date().toISOString() } }
}

export const isInProgress = (job: WatchedJob | undefined): boolean =>
  !!job && (job.status === 'queued' || job.status === 'running' || job.importStatus === 'importing')

export type RunTone = 'muted' | 'info' | 'success' | 'danger'

export const runStatus = (run: Run): { label: string; tone: RunTone } => {
  const toolpaths = latestJob(run, 'toolpaths')
  if (toolpaths) {
    if (toolpaths.status === 'failed') {
      return { label: 'Toolpaths failed', tone: 'danger' }
    }
    if (toolpaths.status !== 'succeeded') {
      return { label: 'Calculating', tone: 'info' }
    }
    if (toolpaths.importStatus === 'imported') {
      return { label: 'Imported', tone: 'success' }
    }
    if (toolpaths.importStatus === 'failed') {
      return { label: 'Import failed', tone: 'danger' }
    }
    return {
      label: toolpaths.importStatus === 'importing' ? 'Importing' : 'Toolpaths ready',
      tone: 'info',
    }
  }
  const analysis = latestJob(run, 'analysis')
  if (!analysis || analysis.status === 'failed') {
    return { label: 'Analysis failed', tone: 'danger' }
  }
  return analysis.status === 'succeeded'
    ? { label: 'Analyzed', tone: 'muted' }
    : { label: 'Analyzing', tone: 'info' }
}

/** Indices into `candidates` of `directions`, which the API serves back bit-exact. */
export const directionIndices = (
  candidates: ReadonlyArray<Vec3>,
  directions: ReadonlyArray<Vec3> | null | undefined,
) =>
  (directions ?? [])
    .map((d) => candidates.findIndex((c) => c.x === d.x && c.y === d.y && c.z === d.z))
    .filter((index) => index >= 0)
